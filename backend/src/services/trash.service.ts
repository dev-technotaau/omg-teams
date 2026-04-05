import { getPrisma } from "../config/database.js";
import { deleteStorageObjects } from "../config/storage.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Soft Delete with Restore (Trash)
//  Spec Section 23.7
//
//  - All entities support soft delete (deletedAt + deletedBy)
//  - Admin can restore from Trash
//  - 90-day auto-purge (via BullMQ cron)
// ──────────────────────────────────────────────

type TrashableEntity = "candidateReport" | "company" | "serviceProvider" | "hRManager" | "user";

const ENTITY_MAP: Record<TrashableEntity, string> = {
  candidateReport: "candidateReport",
  company: "company",
  serviceProvider: "serviceProvider",
  hRManager: "hRManager",
  user: "user",
};

/**
 * List all soft-deleted records across entity types.
 */
export async function listTrash(entityType?: TrashableEntity, page = 1, limit = 20) {
  const prisma = getPrisma();
  const skip = (page - 1) * limit;
  const items: {
    entityType: string;
    id: string;
    name: string;
    deletedAt: Date;
    deletedBy: string | null;
  }[] = [];

  const types = entityType ? [entityType] : (Object.keys(ENTITY_MAP) as TrashableEntity[]);

  for (const type of types) {
    switch (type) {
      case "candidateReport": {
        const records = await prisma.candidateReport.findMany({
          where: { deletedAt: { not: null } },
          select: { id: true, candidateName: true, deletedAt: true, deletedBy: true },
          orderBy: { deletedAt: "desc" },
          skip,
          take: limit,
        });
        for (const r of records) {
          items.push({
            entityType: "candidateReport",
            id: r.id,
            name: r.candidateName ?? "Unknown",
            deletedAt: r.deletedAt!,
            deletedBy: r.deletedBy,
          });
        }
        break;
      }
      case "company": {
        const records = await prisma.company.findMany({
          where: { deletedAt: { not: null } },
          select: { id: true, name: true, deletedAt: true, deletedBy: true },
          orderBy: { deletedAt: "desc" },
          skip,
          take: limit,
        });
        for (const r of records) {
          items.push({
            entityType: "company",
            id: r.id,
            name: r.name,
            deletedAt: r.deletedAt!,
            deletedBy: r.deletedBy,
          });
        }
        break;
      }
      case "user": {
        const records = await prisma.user.findMany({
          where: { deletedAt: { not: null } },
          select: { id: true, firstName: true, lastName: true, deletedAt: true, deletedBy: true },
          orderBy: { deletedAt: "desc" },
          skip,
          take: limit,
        });
        for (const r of records) {
          items.push({
            entityType: "user",
            id: r.id,
            name: `${r.firstName} ${r.lastName}`,
            deletedAt: r.deletedAt!,
            deletedBy: r.deletedBy,
          });
        }
        break;
      }
      // ServiceProvider and HRManager follow same pattern
      default:
        break;
    }
  }

  return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/**
 * Restore a soft-deleted record.
 */
export async function restoreFromTrash(entityType: TrashableEntity, id: string) {
  const prisma = getPrisma();
  const data = { deletedAt: null, deletedBy: null };

  switch (entityType) {
    case "candidateReport":
      return prisma.candidateReport.update({ where: { id }, data });
    case "company":
      return prisma.company.update({ where: { id }, data });
    case "serviceProvider":
      return prisma.serviceProvider.update({ where: { id }, data });
    case "hRManager":
      return prisma.hRManager.update({ where: { id }, data });
    case "user":
      return prisma.user.update({ where: { id }, data: { ...data, status: "ACTIVE" } });
    default:
      throw new Error(`Unknown entity type: ${entityType as string}`);
  }
}

/**
 * Permanently delete a trashed record.
 */
export async function permanentDelete(entityType: TrashableEntity, id: string) {
  const prisma = getPrisma();

  // Clean up associated files from R2 before hard-deleting
  await cleanupEntityFiles(entityType, id);

  switch (entityType) {
    case "candidateReport":
      return prisma.candidateReport.delete({ where: { id } });
    case "company":
      return prisma.company.delete({ where: { id } });
    case "serviceProvider":
      return prisma.serviceProvider.delete({ where: { id } });
    case "hRManager":
      return prisma.hRManager.delete({ where: { id } });
    case "user":
      return prisma.user.delete({ where: { id } });
    default:
      throw new Error(`Unknown entity type: ${entityType as string}`);
  }
}

/** Delete R2 files associated with an entity before permanent deletion */
async function cleanupEntityFiles(entityType: TrashableEntity, id: string): Promise<void> {
  const prisma = getPrisma();
  const keys: string[] = [];

  try {
    if (entityType === "user") {
      // User profile photo
      const user = await prisma.user.findUnique({
        where: { id },
        select: { profilePhotoStorageKey: true },
      });
      if (user?.profilePhotoStorageKey) keys.push(user.profilePhotoStorageKey);

      // User's documents
      const docs = await prisma.employeeDocument.findMany({
        where: { userId: id },
        select: { storageKey: true },
      });
      for (const doc of docs) {
        if (doc.storageKey) keys.push(doc.storageKey);
      }

      // User's offer letter PDFs
      const offers = await prisma.offerLetter.findMany({
        where: { userId: id, generatedFileUrl: { not: null } },
        select: { referenceNumber: true, userId: true },
      });
      for (const ol of offers) {
        keys.push(`offer-letters/${ol.userId}/${ol.referenceNumber}.pdf`);
      }
    }

    if (keys.length > 0) {
      const deleted = await deleteStorageObjects(keys);
      logger.info("Cleaned up R2 files before permanent deletion", {
        entityType,
        id,
        filesDeleted: deleted,
        filesRequested: keys.length,
      });
    }
  } catch (err) {
    // File cleanup failure should not block permanent deletion
    logger.warn("File cleanup failed during permanent deletion (non-blocking)", {
      entityType,
      id,
      error: (err as Error).message,
    });
  }
}

/**
 * Auto-purge records deleted more than N days ago.
 * Called by BullMQ cron job.
 */
export async function autoPurgeTrash(daysOld = 90) {
  const prisma = getPrisma();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const where = { deletedAt: { not: null, lt: cutoff } };

  const [candidates, companies, sps, hrs] = await Promise.all([
    prisma.candidateReport.deleteMany({ where }),
    prisma.company.deleteMany({ where }),
    prisma.serviceProvider.deleteMany({ where }),
    prisma.hRManager.deleteMany({ where }),
  ]);

  return {
    purged: candidates.count + companies.count + sps.count + hrs.count,
    details: {
      candidateReports: candidates.count,
      companies: companies.count,
      serviceProviders: sps.count,
      hrManagers: hrs.count,
    },
  };
}
