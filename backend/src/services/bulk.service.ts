import { type CandidateStage, type PaymentStatus } from "@prisma/client";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Bulk Operations
//  Spec Section 23.2
//
//  - Bulk edit, delete, status update, assign
//  - Applied to candidate reports
// ──────────────────────────────────────────────

/**
 * Bulk update status for multiple candidate reports.
 */
export async function bulkUpdateStatus(ids: string[], status: string) {
  const prisma = getPrisma();
  return prisma.candidateReport.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { status },
  });
}

/**
 * Bulk update candidate stage.
 */
export async function bulkUpdateStage(ids: string[], stage: CandidateStage) {
  const prisma = getPrisma();
  return prisma.candidateReport.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { candidateStage: stage },
  });
}

/**
 * Bulk update payment status.
 */
export async function bulkUpdatePaymentStatus(ids: string[], paymentStatus: PaymentStatus) {
  const prisma = getPrisma();
  return prisma.candidateReport.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { paymentStatus },
  });
}

/**
 * Bulk soft-delete candidate reports.
 */
export async function bulkDelete(ids: string[], deletedBy: string) {
  const prisma = getPrisma();
  return prisma.candidateReport.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy },
  });
}

/**
 * Bulk assign company to candidate reports.
 */
export async function bulkAssignCompany(ids: string[], companyId: string) {
  const prisma = getPrisma();
  return prisma.candidateReport.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { companyId },
  });
}

/**
 * Bulk restore from trash. Items are grouped by entityType so each
 * underlying Prisma model gets a single `updateMany`. Mirrors the friendly
 * entity-type alphabet used by the trash service.
 */
export interface BulkRestoreItem {
  id: string;
  entityType: "candidate" | "company" | "serviceProvider" | "hrManager" | "user";
}

export async function bulkRestore(items: BulkRestoreItem[]) {
  const prisma = getPrisma();
  const data = { deletedAt: null, deletedBy: null };

  const groups: Record<BulkRestoreItem["entityType"], string[]> = {
    candidate: [],
    company: [],
    serviceProvider: [],
    hrManager: [],
    user: [],
  };
  for (const item of items) groups[item.entityType].push(item.id);

  const results = await Promise.all([
    groups.candidate.length
      ? prisma.candidateReport.updateMany({ where: { id: { in: groups.candidate } }, data })
      : Promise.resolve({ count: 0 }),
    groups.company.length
      ? prisma.company.updateMany({ where: { id: { in: groups.company } }, data })
      : Promise.resolve({ count: 0 }),
    groups.serviceProvider.length
      ? prisma.serviceProvider.updateMany({
          where: { id: { in: groups.serviceProvider } },
          data,
        })
      : Promise.resolve({ count: 0 }),
    groups.hrManager.length
      ? prisma.hRManager.updateMany({ where: { id: { in: groups.hrManager } }, data })
      : Promise.resolve({ count: 0 }),
    groups.user.length
      ? prisma.user.updateMany({
          where: { id: { in: groups.user } },
          data: { ...data, status: "ACTIVE" },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  return { count: results.reduce((sum, r) => sum + r.count, 0) };
}
