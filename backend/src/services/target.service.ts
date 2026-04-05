import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Recruiter Targets Service — Spec Section 23.9
// ──────────────────────────────────────────────

export async function listTargets(filters?: { recruiterId?: string; isActive?: boolean }) {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};
  if (filters?.recruiterId) where["recruiterId"] = filters.recruiterId;
  if (filters?.isActive !== undefined) where["isActive"] = filters.isActive;
  return prisma.recruiterTarget.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      recruiter: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createTarget(
  data: {
    recruiterId: string;
    targetType: "DAILY" | "WEEKLY" | "MONTHLY";
    targetValue: number;
    effectiveFrom: string;
    effectiveTo?: string;
  },
  createdBy: string,
) {
  const prisma = getPrisma();
  const target = await prisma.recruiterTarget.create({
    data: {
      recruiterId: data.recruiterId,
      targetType: data.targetType,
      targetValue: data.targetValue,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      createdBy,
    },
  });

  // Notify recruiter
  const { onTargetAssigned } = await import("./notification-triggers.js");
  void onTargetAssigned(data.recruiterId, data.targetType, data.targetValue);

  return target;
}

export async function updateTarget(
  id: string,
  data: { targetValue?: number; effectiveTo?: string; isActive?: boolean },
) {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.targetValue !== undefined) updateData["targetValue"] = data.targetValue;
  if (data.effectiveTo !== undefined)
    updateData["effectiveTo"] = data.effectiveTo ? new Date(data.effectiveTo) : null;
  if (data.isActive !== undefined) updateData["isActive"] = data.isActive;
  const updated = await prisma.recruiterTarget.update({ where: { id }, data: updateData });

  // Notify recruiter of target update
  if (data.targetValue !== undefined && updated.recruiterId) {
    const { onTargetUpdated } = await import("./notification-triggers.js");
    void onTargetUpdated(updated.recruiterId, updated.targetType, updated.targetValue);
  }

  return updated;
}

export async function deleteTarget(id: string) {
  const prisma = getPrisma();
  return prisma.recruiterTarget.update({ where: { id }, data: { isActive: false } });
}

/**
 * §23.9 — Get active targets for a recruiter with global default fallback.
 * Individual targets override global defaults for the same targetType.
 */
export async function getRecruiterActiveTargets(recruiterId: string) {
  const prisma = getPrisma();
  const now = new Date();
  const dateFilter = {
    isActive: true,
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
  };

  // Fetch individual targets for this recruiter
  const individual = await prisma.recruiterTarget.findMany({
    where: { recruiterId, ...dateFilter },
    orderBy: { targetType: "asc" },
  });

  // Fetch global defaults (recruiterId = null)
  const globalDefaults = await prisma.recruiterTarget.findMany({
    where: { recruiterId: null, ...dateFilter },
    orderBy: { targetType: "asc" },
  });

  // Merge: individual overrides global for the same targetType
  const individualTypes = new Set(individual.map((t) => t.targetType));
  const merged = [
    ...individual,
    ...globalDefaults.filter((g) => !individualTypes.has(g.targetType)),
  ];

  return merged;
}

export async function getTargetAchievement(
  recruiterId: string,
  targetType: "DAILY" | "WEEKLY" | "MONTHLY",
) {
  const prisma = getPrisma();
  const now = new Date();
  let dateFrom: Date;

  if (targetType === "DAILY") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (targetType === "WEEKLY") {
    const day = now.getDay();
    dateFrom = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (day === 0 ? 6 : day - 1),
    );
  } else {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const count = await prisma.candidateReport.count({
    where: { recruiterId, createdAt: { gte: dateFrom }, deletedAt: null },
  });

  return count;
}
