import { type CandidateStage, type Role } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { ForbiddenError } from "../exceptions/forbidden-error.js";
import { NotFoundError } from "../exceptions/not-found-error.js";

// ──────────────────────────────────────────────
//  Candidate Pipeline Stage Transitions
//  Spec Section 23.11
//
//  Sourced → Screened → CV Shared → Interview
//  → Selected → Joined → Invoiced → Closed
//  REJECTED / ON_HOLD can be set from any stage
// ──────────────────────────────────────────────

/** §23.11 — Ordered forward-only stages (excluding special stages) */
const STAGE_ORDER: CandidateStage[] = [
  "SOURCED",
  "SCREENED",
  "CV_SHARED",
  "INTERVIEW_SCHEDULED",
  "SELECTED",
  "JOINED",
  "INVOICED",
  "CLOSED",
];

/** §23.11 — Special stages that can be set from any stage */
const SPECIAL_STAGES: CandidateStage[] = ["REJECTED", "ON_HOLD"];

/**
 * §23.11 — Validate stage transition rules.
 * - Forward-only for normal stages (Sourced→Screened→CV_Shared→etc.)
 * - REJECTED/ON_HOLD can be set from any stage
 * - Backward transitions allowed only by Admin
 */
function validateTransition(
  fromStage: CandidateStage,
  toStage: CandidateStage,
  userRole: Role,
): void {
  // REJECTED/ON_HOLD can always be set
  if (SPECIAL_STAGES.includes(toStage)) return;

  // Moving FROM a special stage back to a normal stage — Admin only
  if (SPECIAL_STAGES.includes(fromStage)) {
    if (userRole !== "ADMIN") {
      throw new ForbiddenError("Only Admin can move a candidate out of Rejected/On Hold status");
    }
    return;
  }

  const fromIdx = STAGE_ORDER.indexOf(fromStage);
  const toIdx = STAGE_ORDER.indexOf(toStage);

  // Backward transition — Admin only
  if (toIdx < fromIdx) {
    if (userRole !== "ADMIN") {
      throw new ForbiddenError("Only Admin can move a candidate to a previous stage");
    }
    return;
  }
}

/**
 * Update a candidate's pipeline stage and record the transition.
 */
export async function updateCandidateStage(
  candidateReportId: string,
  toStage: CandidateStage,
  changedByUserId: string,
  userRole: Role,
  notes?: string,
) {
  const prisma = getPrisma();

  const report = await prisma.candidateReport.findFirst({
    where: { id: candidateReportId, deletedAt: null },
    select: { candidateStage: true },
  });

  if (!report) throw new NotFoundError("Candidate Report", candidateReportId);

  const fromStage = report.candidateStage;
  if (fromStage === toStage) return report;

  // §23.11 — Enforce transition rules
  validateTransition(fromStage, toStage, userRole);

  // Update the candidate stage
  const updated = await prisma.candidateReport.update({
    where: { id: candidateReportId },
    data: { candidateStage: toStage },
  });

  // Record the transition in history
  await prisma.candidateStageHistory.create({
    data: {
      candidateReportId,
      fromStage,
      toStage,
      changedByUserId,
      notes: notes ?? null,
    },
  });

  return updated;
}

/**
 * Get stage transition history for a candidate.
 */
export async function getStageHistory(candidateReportId: string) {
  const prisma = getPrisma();
  return prisma.candidateStageHistory.findMany({
    where: { candidateReportId },
    include: {
      changedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { changedAt: "desc" },
  });
}

/**
 * Get pipeline funnel counts (for analytics).
 */
export async function getPipelineFunnel(filters?: {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  recruiterId?: string | undefined;
}) {
  const prisma = getPrisma();

  const where: Record<string, unknown> = { deletedAt: null };
  if (filters) {
    if (filters.recruiterId) where["recruiterId"] = filters.recruiterId;
    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, unknown> = {};
      if (filters.dateFrom) createdAt["gte"] = new Date(filters.dateFrom);
      if (filters.dateTo) createdAt["lte"] = new Date(filters.dateTo);
      where["createdAt"] = createdAt;
    }
  }

  const counts = await prisma.candidateReport.groupBy({
    by: ["candidateStage"],
    where,
    _count: true,
  });

  return counts.map((c) => ({
    stage: c.candidateStage,
    count: c._count,
  }));
}
