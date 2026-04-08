import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Recruiter Targets Service — Spec Section 23.9
// ──────────────────────────────────────────────

type TargetType = "DAILY" | "WEEKLY" | "MONTHLY";

/**
 * §23.9 — Period start for a given target type.
 *
 * - DAILY:   today at 00:00 local
 * - WEEKLY:  Monday at 00:00 local (India / ISO-8601 week start;
 *            JS Sunday=0 → treat as previous week's day 7)
 * - MONTHLY: 1st of current month at 00:00 local
 *
 * The week-start being Monday is intentional and matches the
 * recruiter workweek used everywhere else in the platform
 * (attendance, leave accrual, RM dashboards). Do not change to
 * Sunday-start without also updating those modules.
 */
export function getPeriodStart(targetType: TargetType, now: Date = new Date()): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  if (targetType === "DAILY") {
    return new Date(year, month, date);
  }
  if (targetType === "WEEKLY") {
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // ISO weeks start on Monday → distance back to Monday:
    //   Mon (1) → 0,  Tue (2) → 1,  …,  Sat (6) → 5,  Sun (0) → 6
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return new Date(year, month, date - offset);
  }
  return new Date(year, month, 1);
}

/**
 * Count candidate reports created by a recruiter within the
 * current period for a given target type.
 */
export async function getTargetAchievement(
  recruiterId: string,
  targetType: TargetType,
): Promise<number> {
  const prisma = getPrisma();
  const dateFrom = getPeriodStart(targetType);
  return prisma.candidateReport.count({
    where: { recruiterId, createdAt: { gte: dateFrom }, deletedAt: null },
  });
}

/**
 * For a global default we don't tie achievement to a specific
 * recruiter (it's not actionable as "achieved" per-row in admin
 * listings — admin sees the policy, not a single person's progress).
 * Return 0 so the UI shows the global row without a misleading bar.
 */
const GLOBAL_DEFAULT_ACHIEVED = 0;

/**
 * Admin list — returns every target row (filtered) WITH the
 * `achieved` count computed in the same period the target type
 * uses. Used by the admin Targets page.
 */
export async function listTargets(filters?: { recruiterId?: string; isActive?: boolean }) {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};
  if (filters?.recruiterId) where["recruiterId"] = filters.recruiterId;
  if (filters?.isActive !== undefined) where["isActive"] = filters.isActive;

  const rows = await prisma.recruiterTarget.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      recruiter: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Compute achievement for each row in parallel. For per-recruiter
  // targets we count their own reports; for global defaults
  // (recruiterId=null) we leave it at 0 (see helper above).
  const withAchievement = await Promise.all(
    rows.map(async (t) => {
      const achieved = t.recruiterId
        ? await getTargetAchievement(t.recruiterId, t.targetType as TargetType)
        : GLOBAL_DEFAULT_ACHIEVED;
      return { ...t, achieved };
    }),
  );

  return withAchievement;
}

/**
 * Find an active target that overlaps the given period for the
 * same recruiter (or global default) and same type. Used by
 * createTarget to prevent the admin from accidentally setting two
 * active targets that fight each other.
 */
async function findOverlappingTarget(
  recruiterId: string | null,
  targetType: TargetType,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  excludeId?: string,
) {
  const prisma = getPrisma();
  return prisma.recruiterTarget.findFirst({
    where: {
      ...(excludeId && { id: { not: excludeId } }),
      recruiterId,
      targetType,
      isActive: true,
      // Two ranges [a1, a2] and [b1, b2] overlap iff a1 <= b2 AND b1 <= a2.
      // With nullable upper bounds (open-ended), substitute MAX_DATE.
      AND: [
        {
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
        },
        ...(effectiveTo ? [{ effectiveFrom: { lte: effectiveTo } }] : []),
      ],
    },
  });
}

export async function createTarget(
  data: {
    /** null = global default applied to recruiters with no override */
    recruiterId: string | null;
    targetType: TargetType;
    targetValue: number;
    effectiveFrom: string;
    effectiveTo?: string;
  },
  createdBy: string,
) {
  const prisma = getPrisma();

  // §23.9 — date validation
  const fromDate = new Date(data.effectiveFrom);
  if (Number.isNaN(fromDate.getTime())) {
    throw new AppError("Invalid effectiveFrom date", 400, "INVALID_DATE");
  }
  const toDate = data.effectiveTo ? new Date(data.effectiveTo) : null;
  if (toDate && Number.isNaN(toDate.getTime())) {
    throw new AppError("Invalid effectiveTo date", 400, "INVALID_DATE");
  }
  if (toDate && toDate < fromDate) {
    throw new AppError("effectiveTo must be on or after effectiveFrom", 400, "INVALID_DATE_RANGE");
  }

  // §23.9 — overlap protection: same recruiter + same type + overlapping window
  const conflict = await findOverlappingTarget(data.recruiterId, data.targetType, fromDate, toDate);
  if (conflict) {
    const scope = data.recruiterId ? "this recruiter" : "the global default";
    throw new AppError(
      `An active ${data.targetType.toLowerCase()} target already exists for ${scope} in this date range. ` +
        `Deactivate or end the existing target (effective ${conflict.effectiveFrom
          .toISOString()
          .slice(
            0,
            10,
          )} → ${conflict.effectiveTo ? conflict.effectiveTo.toISOString().slice(0, 10) : "ongoing"}) first.`,
      409,
      "TARGET_OVERLAP",
    );
  }

  const target = await prisma.recruiterTarget.create({
    data: {
      recruiterId: data.recruiterId,
      targetType: data.targetType,
      targetValue: data.targetValue,
      effectiveFrom: fromDate,
      effectiveTo: toDate,
      createdBy,
    },
  });

  // Notify recruiter (skipped for global defaults — there's no single
  // recruiter to notify; recruiters discover the default on their dashboard)
  if (data.recruiterId) {
    const { onTargetAssigned } = await import("./notification-triggers.js");
    void onTargetAssigned(data.recruiterId, data.targetType, data.targetValue);
  }

  return target;
}

export async function updateTarget(
  id: string,
  data: { targetValue?: number; effectiveTo?: string | null; isActive?: boolean },
) {
  const prisma = getPrisma();

  const existing = await prisma.recruiterTarget.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Target not found", 404, "TARGET_NOT_FOUND");
  }

  const updateData: Record<string, unknown> = {};
  if (data.targetValue !== undefined) updateData["targetValue"] = data.targetValue;
  if (data.effectiveTo !== undefined) {
    if (data.effectiveTo === null || data.effectiveTo === "") {
      updateData["effectiveTo"] = null;
    } else {
      const toDate = new Date(data.effectiveTo);
      if (Number.isNaN(toDate.getTime())) {
        throw new AppError("Invalid effectiveTo date", 400, "INVALID_DATE");
      }
      if (toDate < existing.effectiveFrom) {
        throw new AppError(
          "effectiveTo must be on or after effectiveFrom",
          400,
          "INVALID_DATE_RANGE",
        );
      }
      updateData["effectiveTo"] = toDate;
    }
  }
  if (data.isActive !== undefined) updateData["isActive"] = data.isActive;

  // If we're extending the period, re-check overlaps with other rows
  if (
    data.effectiveTo !== undefined &&
    updateData["effectiveTo"] !== existing.effectiveTo &&
    existing.isActive
  ) {
    const conflict = await findOverlappingTarget(
      existing.recruiterId,
      existing.targetType as TargetType,
      existing.effectiveFrom,
      (updateData["effectiveTo"] as Date | null) ?? null,
      existing.id,
    );
    if (conflict) {
      throw new AppError(
        `Extending this target would overlap with an existing active ${existing.targetType.toLowerCase()} target.`,
        409,
        "TARGET_OVERLAP",
      );
    }
  }

  const updated = await prisma.recruiterTarget.update({ where: { id }, data: updateData });

  // Notify recruiter of value change
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
 *
 * Rules:
 * 1. A target is "active" if isActive=true AND today is within
 *    [effectiveFrom, effectiveTo] (effectiveTo nullable = ongoing).
 * 2. For each target type (DAILY/WEEKLY/MONTHLY), an individual
 *    target overrides the global default of the same type.
 * 3. If no individual exists for a type, the global default fills
 *    the gap.
 */
export async function getRecruiterActiveTargets(recruiterId: string) {
  const prisma = getPrisma();
  const now = new Date();
  const dateFilter = {
    isActive: true,
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
  };

  const [individual, globalDefaults] = await Promise.all([
    prisma.recruiterTarget.findMany({
      where: { recruiterId, ...dateFilter },
      orderBy: { targetType: "asc" },
    }),
    prisma.recruiterTarget.findMany({
      where: { recruiterId: null, ...dateFilter },
      orderBy: { targetType: "asc" },
    }),
  ]);

  const individualTypes = new Set(individual.map((t) => t.targetType));
  return [...individual, ...globalDefaults.filter((g) => !individualTypes.has(g.targetType))];
}

/**
 * §23.9 — Get the single most relevant active target for a recruiter
 * dashboard StatsCard. Strategy:
 *   1. Prefer DAILY (most actionable for daily standup)
 *   2. Then WEEKLY
 *   3. Then MONTHLY
 *   4. Falls back to global default if no individual target exists
 *
 * Returns null if the recruiter has no applicable target at all.
 */
export async function getDashboardTarget(recruiterId: string) {
  const targets = await getRecruiterActiveTargets(recruiterId);
  const priority: TargetType[] = ["DAILY", "WEEKLY", "MONTHLY"];
  for (const type of priority) {
    const t = targets.find((x) => x.targetType === type);
    if (t) return t;
  }
  return null;
}

/**
 * §23.9 — Resolve all active targets for a recruiter and compute
 * their achievement counts. Used by /targets/recruiter/:id and the
 * recruiter "My Targets" page.
 */
export async function getRecruiterTargetsWithAchievement(recruiterId: string) {
  const targets = await getRecruiterActiveTargets(recruiterId);
  return Promise.all(
    targets.map(async (t) => ({
      ...t,
      achieved: await getTargetAchievement(recruiterId, t.targetType as TargetType),
    })),
  );
}

/**
 * §11.4 — Per-period dedup key for the achievement notification.
 *
 * Stable across the period (e.g. all submissions on 2026-04-07
 * map to the same daily key, all submissions in week containing
 * Apr 7 map to the same weekly key, etc.) so the SETNX guard fires
 * exactly once per crossing.
 */
function achievementDedupeKey(
  recruiterId: string,
  targetType: TargetType,
  periodStart: Date,
): string {
  const iso = periodStart.toISOString().slice(0, 10);
  return `target:achieved:${targetType}:${recruiterId}:${iso}`;
}

/**
 * §23.9 — Called from candidate.controller after a new report is
 * created. Walks the recruiter's active targets (DAILY → WEEKLY →
 * MONTHLY), and for each one checks whether the new submission caused
 * the recruiter to cross the target threshold. Only fires the
 * achievement notification on the *first* crossing per period
 * (deduped via Redis SETNX with TTL = period length).
 *
 * Fires for all three types, not just DAILY.
 */
export async function checkAndFireAchievement(recruiterId: string): Promise<void> {
  const targets = await getRecruiterActiveTargets(recruiterId);
  if (targets.length === 0) return;

  const now = new Date();

  for (const t of targets) {
    const targetType = t.targetType as TargetType;
    const periodStart = getPeriodStart(targetType, now);
    const achieved = await getTargetAchievement(recruiterId, targetType);
    if (achieved < t.targetValue) continue;

    // Dedupe: only fire on the FIRST crossing in this period.
    // TTL is set so the key auto-expires shortly after the period
    // ends, preventing stale keys from accumulating.
    const dedupeKey = achievementDedupeKey(recruiterId, targetType, periodStart);
    const ttlSeconds =
      targetType === "DAILY"
        ? 36 * 60 * 60
        : targetType === "WEEKLY"
          ? 8 * 24 * 60 * 60
          : 33 * 24 * 60 * 60;

    // SETNX with TTL — atomic "claim once". If we win the race, fire.
    // If Redis is down we fall through to firing once (no dedupe is
    // strictly better than missed achievements).
    let claimed: boolean;
    try {
      const { getRedisClient } = await import("../config/redis.js");
      const redis = getRedisClient();
      const result = await redis.set(dedupeKey, "1", "EX", ttlSeconds, "NX");
      claimed = result === "OK";
    } catch (err) {
      logger.warn("Achievement dedupe Redis SETNX failed", { recruiterId, targetType, error: err });
      claimed = true;
    }
    if (!claimed) continue;

    try {
      const { onTargetAchieved } = await import("./notification-triggers.js");
      await onTargetAchieved(recruiterId, achieved, targetType);
    } catch (err) {
      logger.error("Failed to fire onTargetAchieved", { recruiterId, targetType, error: err });
      // If notification failed, release the dedupe lock so we retry
      // on the next submission rather than silently swallowing it.
      try {
        await cache.del(dedupeKey);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * §23.9 — RM team view: list every assigned recruiter with their
 * active targets and current achievement, sorted by recruiter name.
 */
export async function getTeamTargetsForManager(managerId: string) {
  const prisma = getPrisma();
  const assignments = await prisma.recruiterManagerAssignment.findMany({
    where: { managerId, removedAt: null },
    select: { recruiterId: true },
  });
  const recruiterIds = assignments.map((a) => a.recruiterId);
  if (recruiterIds.length === 0) return [];

  const recruiters = await prisma.user.findMany({
    where: { id: { in: recruiterIds }, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, employeeId: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return Promise.all(
    recruiters.map(async (r) => ({
      recruiter: r,
      targets: await getRecruiterTargetsWithAchievement(r.id),
    })),
  );
}
