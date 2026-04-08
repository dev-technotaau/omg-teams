import { getPrisma } from "../config/database.js";
import { deleteStorageObjects } from "../config/storage.js";
import { ConflictError } from "../exceptions/conflict-error.js";
import { logger } from "../instrument.js";
import type { PrismaClient } from "@prisma/client";

// ──────────────────────────────────────────────
//  Soft Delete with Restore (Trash)
//  Spec Section 23.7
//
//  - All entities support soft delete (deletedAt + deletedBy)
//  - Admin can restore from Trash
//  - 90-day auto-purge (via BullMQ cron)
// ──────────────────────────────────────────────

/**
 * Externally-facing entity type alphabet — what the API accepts and returns.
 * These are the friendly names used by the admin UI tabs and badge map.
 * Internally we map them to the Prisma model names below.
 */
export type TrashEntityType = "candidate" | "company" | "serviceProvider" | "hrManager" | "user";

export const TRASH_ENTITY_TYPES: readonly TrashEntityType[] = [
  "candidate",
  "company",
  "serviceProvider",
  "hrManager",
  "user",
] as const;

interface TrashRow {
  entityType: TrashEntityType;
  id: string;
  name: string;
  deletedAt: Date;
  deletedBy: string | null;
}

interface ListTrashOptions {
  entityType?: TrashEntityType | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

interface ListTrashResult {
  data: TrashRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * List all soft-deleted records across entity types.
 *
 * Cross-entity pagination strategy: counts are summed per entity to give an
 * accurate global total, then each entity's top `(page * limit)` records are
 * fetched, merged, sorted by `deletedAt desc`, and sliced. This is correct
 * because any record in the global top N must also be in its own entity's
 * top N — so per-entity over-fetching of `(page * limit)` is sufficient.
 */
export async function listTrash(opts: ListTrashOptions = {}): Promise<ListTrashResult> {
  const prisma = getPrisma();
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.max(1, Math.min(200, opts.limit ?? 20));
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const search = opts.search?.trim() || undefined;

  const types: TrashEntityType[] = opts.entityType ? [opts.entityType] : [...TRASH_ENTITY_TYPES];

  // Per-entity over-fetch — see strategy comment above.
  const perEntityTake = page * limit;

  const results = await Promise.all(
    types.map((type) => fetchEntityTrash(prisma, type, search, perEntityTake)),
  );

  const total = results.reduce((sum, r) => sum + r.count, 0);
  const merged = results.flatMap((r) => r.rows);
  merged.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  const start = (page - 1) * limit;
  const data = merged.slice(start, start + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function fetchEntityTrash(
  prisma: PrismaClient,
  type: TrashEntityType,
  search: string | undefined,
  take: number,
): Promise<{ count: number; rows: TrashRow[] }> {
  switch (type) {
    case "candidate": {
      const where = search
        ? {
            deletedAt: { not: null },
            OR: [
              { candidateName: { contains: search, mode: "insensitive" as const } },
              { contactNo: { contains: search, mode: "insensitive" as const } },
              { emailId: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : { deletedAt: { not: null } };
      const [count, records] = await Promise.all([
        prisma.candidateReport.count({ where }),
        prisma.candidateReport.findMany({
          where,
          select: { id: true, candidateName: true, deletedAt: true, deletedBy: true },
          orderBy: { deletedAt: "desc" },
          take,
        }),
      ]);
      return {
        count,
        rows: records.map((r) => ({
          entityType: "candidate" as const,
          id: r.id,
          name: r.candidateName ?? "Unknown",
          deletedAt: r.deletedAt!,
          deletedBy: r.deletedBy,
        })),
      };
    }

    case "company": {
      const where = search
        ? {
            deletedAt: { not: null },
            name: { contains: search, mode: "insensitive" as const },
          }
        : { deletedAt: { not: null } };
      const [count, records] = await Promise.all([
        prisma.company.count({ where }),
        prisma.company.findMany({
          where,
          select: { id: true, name: true, deletedAt: true, deletedBy: true },
          orderBy: { deletedAt: "desc" },
          take,
        }),
      ]);
      return {
        count,
        rows: records.map((r) => ({
          entityType: "company" as const,
          id: r.id,
          name: r.name,
          deletedAt: r.deletedAt!,
          deletedBy: r.deletedBy,
        })),
      };
    }

    case "serviceProvider": {
      const where = search
        ? {
            deletedAt: { not: null },
            name: { contains: search, mode: "insensitive" as const },
          }
        : { deletedAt: { not: null } };
      const [count, records] = await Promise.all([
        prisma.serviceProvider.count({ where }),
        prisma.serviceProvider.findMany({
          where,
          select: { id: true, name: true, deletedAt: true, deletedBy: true },
          orderBy: { deletedAt: "desc" },
          take,
        }),
      ]);
      return {
        count,
        rows: records.map((r) => ({
          entityType: "serviceProvider" as const,
          id: r.id,
          name: r.name,
          deletedAt: r.deletedAt!,
          deletedBy: r.deletedBy,
        })),
      };
    }

    case "hrManager": {
      const where = search
        ? {
            deletedAt: { not: null },
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : { deletedAt: { not: null } };
      const [count, records] = await Promise.all([
        prisma.hRManager.count({ where }),
        prisma.hRManager.findMany({
          where,
          select: { id: true, name: true, deletedAt: true, deletedBy: true },
          orderBy: { deletedAt: "desc" },
          take,
        }),
      ]);
      return {
        count,
        rows: records.map((r) => ({
          entityType: "hrManager" as const,
          id: r.id,
          name: r.name,
          deletedAt: r.deletedAt!,
          deletedBy: r.deletedBy,
        })),
      };
    }

    case "user": {
      const where = search
        ? {
            deletedAt: { not: null },
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { employeeId: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : { deletedAt: { not: null } };
      const [count, records] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            deletedAt: true,
            deletedBy: true,
          },
          orderBy: { deletedAt: "desc" },
          take,
        }),
      ]);
      return {
        count,
        rows: records.map((r) => ({
          entityType: "user" as const,
          id: r.id,
          name: `${r.firstName} ${r.lastName}`,
          deletedAt: r.deletedAt!,
          deletedBy: r.deletedBy,
        })),
      };
    }
  }
}

/**
 * Restore a soft-deleted record.
 */
export async function restoreFromTrash(entityType: TrashEntityType, id: string) {
  const prisma = getPrisma();
  const data = { deletedAt: null, deletedBy: null };

  switch (entityType) {
    case "candidate":
      return prisma.candidateReport.update({ where: { id }, data });
    case "company":
      return prisma.company.update({ where: { id }, data });
    case "serviceProvider":
      return prisma.serviceProvider.update({ where: { id }, data });
    case "hrManager":
      return prisma.hRManager.update({ where: { id }, data });
    case "user":
      return prisma.user.update({ where: { id }, data: { ...data, status: "ACTIVE" } });
  }
}

/**
 * Permanently delete a trashed record.
 *
 * For users specifically, two FK relations are `onDelete: Restrict` to
 * protect business records from accidental loss:
 *   • CandidateReport.recruiter (schema.prisma:551)
 *   • CandidateStageHistory.changedBy (schema.prisma:629)
 *
 * If a user is linked through either of those, raw `prisma.user.delete()`
 * will throw a Prisma P2003 FK constraint error. We pre-check those
 * relations and return a clear, actionable ConflictError instead so the
 * admin sees "this user has linked business data" instead of a cryptic
 * database error. Users without any linked reports / history (e.g. brand
 * new accounts created in error) still purge cleanly.
 */
export async function permanentDelete(entityType: TrashEntityType, id: string) {
  const prisma = getPrisma();

  // Clean up associated files from R2 before hard-deleting
  await cleanupEntityFiles(entityType, id);

  switch (entityType) {
    case "candidate":
      return prisma.candidateReport.delete({ where: { id } });
    case "company":
      return prisma.company.delete({ where: { id } });
    case "serviceProvider":
      return prisma.serviceProvider.delete({ where: { id } });
    case "hrManager":
      return prisma.hRManager.delete({ where: { id } });
    case "user": {
      // Pre-check FK-restricted relations so the admin gets a clear error
      // instead of a Prisma P2003 leak.
      const [reportCount, stageHistoryCount] = await Promise.all([
        prisma.candidateReport.count({ where: { recruiterId: id } }),
        prisma.candidateStageHistory.count({ where: { changedByUserId: id } }),
      ]);

      if (reportCount > 0 || stageHistoryCount > 0) {
        const parts: string[] = [];
        if (reportCount > 0)
          parts.push(`${reportCount} candidate report${reportCount === 1 ? "" : "s"}`);
        if (stageHistoryCount > 0) {
          parts.push(
            `${stageHistoryCount} pipeline transition${stageHistoryCount === 1 ? "" : "s"}`,
          );
        }
        throw new ConflictError(
          `Cannot permanently delete this user — they have ${parts.join(" and ")} on record. Restore them, reassign their work, or leave them in trash.`,
        );
      }

      return prisma.user.delete({ where: { id } });
    }
  }
}

/** Delete R2 files associated with an entity before permanent deletion */
async function cleanupEntityFiles(entityType: TrashEntityType, id: string): Promise<void> {
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
