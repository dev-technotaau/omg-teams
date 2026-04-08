import { type Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Data Archiving Service — Spec Section 23.5
//
//  Moves aged records to archive JSON storage
//  to keep primary tables lean.
// ──────────────────────────────────────────────

/** Default thresholds in months */
const THRESHOLDS = {
  CANDIDATE_REPORT: 12,
  AUDIT_LOG: 12,
  LOGIN_HISTORY: 6,
  NOTIFICATION: 3,
} as const;

export type ArchiveEntityType = keyof typeof THRESHOLDS;

/**
 * List archived records with pagination.
 */
export async function listArchivedRecords(filters: {
  entityType?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const where: Prisma.ArchivedRecordWhereInput = {};
  if (filters.entityType) where.entityType = filters.entityType;

  const [data, total] = await Promise.all([
    prisma.archivedRecord.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.archivedRecord.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Restore an archived record back to its original table.
 */
export async function restoreArchivedRecord(archiveId: string): Promise<void> {
  const prisma = getPrisma();
  const record = await prisma.archivedRecord.findUnique({ where: { id: archiveId } });
  if (!record) throw new Error("Archived record not found");

  const snapshot = record.snapshot as Record<string, unknown>;

  switch (record.entityType) {
    case "CANDIDATE_REPORT":
      await prisma.candidateReport.create({
        data: snapshot as unknown as Prisma.CandidateReportCreateInput,
      });
      break;
    case "AUDIT_LOG":
      await prisma.auditLog.create({ data: snapshot as unknown as Prisma.AuditLogCreateInput });
      break;
    case "LOGIN_HISTORY":
      await prisma.loginHistory.create({
        data: snapshot as unknown as Prisma.LoginHistoryCreateInput,
      });
      break;
    case "NOTIFICATION":
      await prisma.notification.create({
        data: snapshot as unknown as Prisma.NotificationCreateInput,
      });
      break;
    default:
      throw new Error(`Unknown entity type: ${record.entityType}`);
  }

  await prisma.archivedRecord.delete({ where: { id: archiveId } });
  logger.info("Archived record restored", { archiveId, entityType: record.entityType });
}

/**
 * Permanently delete an archived record.
 */
export async function deleteArchivedRecord(archiveId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.archivedRecord.delete({ where: { id: archiveId } });
}

/**
 * Run the archiving process for all entity types.
 * Called by the monthly cron job.
 */
export async function runArchiving(): Promise<{ archived: Record<string, number> }> {
  const prisma = getPrisma();
  const results: Record<string, number> = {};

  // §23.5 — Master archive threshold (months) is now configurable from the
  // admin Settings page. The audit-log/login/notification thresholds are
  // *relative* to the candidate threshold, preserving the original ratios
  // (12/12/6/3 → 1.0x / 1.0x / 0.5x / 0.25x).
  const { getSettingNumber } = await import("./settings.service.js");
  const baseMonths = await getSettingNumber(
    "archive_threshold_months",
    THRESHOLDS.CANDIDATE_REPORT,
  );

  // 1. Candidate Reports — completed + paid + older than threshold
  const candidateCutoff = monthsAgo(baseMonths);
  const candidates = await prisma.candidateReport.findMany({
    where: {
      status: "COMPLETE",
      paymentStatus: "PAID",
      deletedAt: null,
      createdAt: { lt: candidateCutoff },
    },
    take: 1000,
  });
  if (candidates.length > 0) {
    await prisma.archivedRecord.createMany({
      data: candidates.map((c) => ({
        entityType: "CANDIDATE_REPORT",
        entityId: c.id,
        snapshot: c as unknown as Prisma.InputJsonValue,
      })),
    });
    await prisma.candidateReport.deleteMany({
      where: { id: { in: candidates.map((c) => c.id) } },
    });
    results["CANDIDATE_REPORT"] = candidates.length;
  }

  // 2. Audit Logs — older than threshold
  const auditCutoff = monthsAgo(baseMonths);
  const auditLogs = await prisma.auditLog.findMany({
    where: { timestamp: { lt: auditCutoff } },
    take: 5000,
  });
  if (auditLogs.length > 0) {
    await prisma.archivedRecord.createMany({
      data: auditLogs.map((a) => ({
        entityType: "AUDIT_LOG",
        entityId: a.id,
        snapshot: a as unknown as Prisma.InputJsonValue,
      })),
    });
    await prisma.auditLog.deleteMany({
      where: { id: { in: auditLogs.map((a) => a.id) } },
    });
    results["AUDIT_LOG"] = auditLogs.length;
  }

  // 3. Login History — older than threshold
  const loginCutoff = monthsAgo(Math.max(1, Math.floor(baseMonths * 0.5)));
  const loginLogs = await prisma.loginHistory.findMany({
    where: { createdAt: { lt: loginCutoff } },
    take: 5000,
  });
  if (loginLogs.length > 0) {
    await prisma.archivedRecord.createMany({
      data: loginLogs.map((l) => ({
        entityType: "LOGIN_HISTORY",
        entityId: l.id,
        snapshot: l as unknown as Prisma.InputJsonValue,
      })),
    });
    await prisma.loginHistory.deleteMany({
      where: { id: { in: loginLogs.map((l) => l.id) } },
    });
    results["LOGIN_HISTORY"] = loginLogs.length;
  }

  // 4. Notifications — older than threshold
  const notifCutoff = monthsAgo(Math.max(1, Math.floor(baseMonths * 0.25)));
  const notifications = await prisma.notification.findMany({
    where: { createdAt: { lt: notifCutoff } },
    take: 5000,
  });
  if (notifications.length > 0) {
    await prisma.archivedRecord.createMany({
      data: notifications.map((n) => ({
        entityType: "NOTIFICATION",
        entityId: n.id,
        snapshot: n as unknown as Prisma.InputJsonValue,
      })),
    });
    await prisma.notification.deleteMany({
      where: { id: { in: notifications.map((n) => n.id) } },
    });
    results["NOTIFICATION"] = notifications.length;
  }

  logger.info("Archiving completed", results);
  return { archived: results };
}

/** Get summary stats for the archive */
export async function getArchiveStats() {
  const prisma = getPrisma();
  const counts = await prisma.archivedRecord.groupBy({
    by: ["entityType"],
    _count: true,
  });
  return counts.map((c) => ({ entityType: c.entityType, count: c._count }));
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}
