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
 * Bulk restore from trash.
 */
export async function bulkRestore(ids: string[]) {
  const prisma = getPrisma();
  return prisma.candidateReport.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: null, deletedBy: null },
  });
}
