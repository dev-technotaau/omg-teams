import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Recruiter Targets Service — Spec Section 23.9
// ──────────────────────────────────────────────

type TargetType = "DAILY" | "WEEKLY" | "MONTHLY";

/**
 * Derived target status — combines the raw `isActive` boolean with the
 * effective-date window. A target that's `isActive=true` is *not*
 * automatically operational: it may be SCHEDULED (start date in the future)
 * or EXPIRED (end date in the past). Admins need to see the real state,
 * not just the DB flag.
 */
export type EffectiveStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

export function deriveEffectiveStatus(
  isActive: boolean,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  now: Date = new Date(),
): EffectiveStatus {
  if (!isActive) return "INACTIVE";
  if (effectiveFrom > now) return "SCHEDULED";
  if (effectiveTo !== null && effectiveTo < now) return "EXPIRED";
  return "ACTIVE";
}

/**
 * Days until/since a boundary (positive = future, negative = past).
 * Returns null if the boundary is undefined (e.g. ongoing target).
 */
export function daysFromNow(boundary: Date | null, now: Date = new Date()): number | null {
  if (!boundary) return null;
  const ms = boundary.getTime() - now.getTime();
  // Round up so "ends in 0.4 days" still shows as "1 day left" to the admin
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

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
 * `achieved` count, the derived `effectiveStatus`, and a
 * `daysUntilStart` / `daysUntilEnd` hint for the time-context UI.
 *
 * Filters:
 *   - recruiterId: scope to one recruiter (or null = global defaults only)
 *   - isActive: raw DB flag filter (kept for backward compat)
 *   - effectiveStatus: derived status filter (ACTIVE/SCHEDULED/EXPIRED/INACTIVE)
 *     — applied in-memory after fetch because it depends on `now`
 *   - endingWithinDays: only rows with effectiveTo within this many days
 *     from now (positive only — does not include already-expired)
 */
export async function listTargets(filters?: {
  recruiterId?: string;
  isActive?: boolean;
  effectiveStatus?: EffectiveStatus;
  endingWithinDays?: number;
}) {
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

  const now = new Date();

  // Compute achievement + derived status for each row in parallel.
  const enriched = await Promise.all(
    rows.map(async (t) => {
      const achieved = t.recruiterId
        ? await getTargetAchievement(t.recruiterId, t.targetType as TargetType)
        : GLOBAL_DEFAULT_ACHIEVED;
      const effectiveStatus = deriveEffectiveStatus(t.isActive, t.effectiveFrom, t.effectiveTo, now);
      return {
        ...t,
        achieved,
        effectiveStatus,
        daysUntilStart: daysFromNow(t.effectiveFrom, now), // negative if already started
        daysUntilEnd: daysFromNow(t.effectiveTo, now), // null if ongoing, negative if past
      };
    }),
  );

  // §23.9 — Override-relationship metadata. Two annotations:
  //
  //   overridesGlobalValue → on individual rows that currently shadow a
  //                          global default of the same type
  //   suppressedByRecruiterCount → on global default rows, how many
  //                                ACTIVE individuals are currently
  //                                using their own value instead
  //
  // Only ACTIVE rows on both sides contribute — a scheduled/expired
  // individual doesn't suppress an active global, and vice versa.
  //
  // The compute needs the full ACTIVE set of globals + individuals, but
  // user filters (recruiterId, status) may have narrowed `enriched`.
  // We side-fetch the missing slice so the hint works correctly even
  // when the admin filters to one recruiter or to SCHEDULED only.
  const activeGlobalsByType = new Map<TargetType, { id: string; targetValue: number }>();
  const activeIndividualCountByType = new Map<TargetType, number>();
  const seedFromList = (
    rs: { recruiterId: string | null; targetType: string; targetValue: number; id: string; effectiveStatus?: EffectiveStatus }[],
  ) => {
    for (const t of rs) {
      if (t.effectiveStatus !== "ACTIVE") continue;
      const type = t.targetType as TargetType;
      if (t.recruiterId === null) {
        activeGlobalsByType.set(type, { id: t.id, targetValue: t.targetValue });
      } else {
        activeIndividualCountByType.set(type, (activeIndividualCountByType.get(type) ?? 0) + 1);
      }
    }
  };
  seedFromList(enriched);

  // If filters narrowed the set, query the missing pieces. We only need
  // the bare minimum (id, type, value, isActive, dates) — no relations.
  const needGlobals =
    !activeGlobalsByType.size &&
    (filters?.recruiterId !== undefined || filters?.effectiveStatus !== undefined);
  const needIndividuals =
    !activeIndividualCountByType.size &&
    (filters?.recruiterId === undefined ? false : filters.recruiterId !== "");
  if (needGlobals || needIndividuals) {
    const extraRows = await prisma.recruiterTarget.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        ...(needGlobals && !needIndividuals ? { recruiterId: null } : {}),
        ...(needIndividuals && !needGlobals ? { NOT: { recruiterId: null } } : {}),
      },
      select: {
        id: true,
        recruiterId: true,
        targetType: true,
        targetValue: true,
      },
    });
    seedFromList(
      extraRows.map((r) => ({ ...r, effectiveStatus: "ACTIVE" as EffectiveStatus })),
    );
  }
  const enrichedWithOverrides = enriched.map((t) => {
    const type = t.targetType as TargetType;
    if (t.recruiterId === null) {
      // Global default — annotate with how many individuals shadow it
      return {
        ...t,
        overridesGlobalValue: null as number | null,
        suppressedByRecruiterCount:
          t.effectiveStatus === "ACTIVE"
            ? (activeIndividualCountByType.get(type) ?? 0)
            : 0,
      };
    }
    // Individual — annotate with the global value it overrides (if any)
    const matchingGlobal =
      t.effectiveStatus === "ACTIVE" ? activeGlobalsByType.get(type) : undefined;
    return {
      ...t,
      overridesGlobalValue: matchingGlobal?.targetValue ?? null,
      suppressedByRecruiterCount: 0,
    };
  });

  // In-memory filters for derived properties
  let filtered = enrichedWithOverrides;
  if (filters?.effectiveStatus) {
    filtered = filtered.filter((t) => t.effectiveStatus === filters.effectiveStatus);
  }
  if (filters?.endingWithinDays !== undefined) {
    const within = filters.endingWithinDays;
    filtered = filtered.filter(
      (t) =>
        t.daysUntilEnd !== null && t.daysUntilEnd >= 0 && t.daysUntilEnd <= within,
    );
  }

  return filtered;
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
  data: {
    targetValue?: number;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    isActive?: boolean;
  },
) {
  const prisma = getPrisma();

  const existing = await prisma.recruiterTarget.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Target not found", 404, "TARGET_NOT_FOUND");
  }

  const updateData: Record<string, unknown> = {};
  if (data.targetValue !== undefined) updateData["targetValue"] = data.targetValue;

  // §23.9 — Editing effectiveFrom is only allowed while the target is
  // SCHEDULED (not yet started). Once it has started, the start date is
  // historical and changing it would silently invalidate the achievement
  // window calculations + dedup keys.
  if (data.effectiveFrom !== undefined) {
    const now = new Date();
    if (existing.effectiveFrom <= now) {
      throw new AppError(
        "effectiveFrom can only be edited while the target is SCHEDULED (start date in the future).",
        409,
        "TARGET_ALREADY_STARTED",
      );
    }
    const newFrom = new Date(data.effectiveFrom);
    if (Number.isNaN(newFrom.getTime())) {
      throw new AppError("Invalid effectiveFrom date", 400, "INVALID_DATE");
    }
    // Don't allow editing into the past either — keep SCHEDULED semantics.
    if (newFrom <= now) {
      throw new AppError(
        "effectiveFrom must remain in the future for SCHEDULED targets.",
        400,
        "INVALID_DATE_RANGE",
      );
    }
    updateData["effectiveFrom"] = newFrom;
  }

  if (data.effectiveTo !== undefined) {
    if (data.effectiveTo === null || data.effectiveTo === "") {
      updateData["effectiveTo"] = null;
    } else {
      const toDate = new Date(data.effectiveTo);
      if (Number.isNaN(toDate.getTime())) {
        throw new AppError("Invalid effectiveTo date", 400, "INVALID_DATE");
      }
      // Compare against the *new* effectiveFrom if we're also editing it.
      const referenceFrom =
        (updateData["effectiveFrom"] as Date | undefined) ?? existing.effectiveFrom;
      if (toDate < referenceFrom) {
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

  // Re-check overlap if either bound moved. This catches: shifting a
  // SCHEDULED window onto an existing target, or extending effectiveTo
  // into another active target's window.
  const fromOrEndChanged =
    updateData["effectiveFrom"] !== undefined || updateData["effectiveTo"] !== undefined;
  if (fromOrEndChanged && existing.isActive) {
    const newFrom = (updateData["effectiveFrom"] as Date | undefined) ?? existing.effectiveFrom;
    const newTo =
      "effectiveTo" in updateData
        ? (updateData["effectiveTo"] as Date | null)
        : existing.effectiveTo;
    const conflict = await findOverlappingTarget(
      existing.recruiterId,
      existing.targetType as TargetType,
      newFrom,
      newTo,
      existing.id,
    );
    if (conflict) {
      throw new AppError(
        `This change would overlap with an existing active ${existing.targetType.toLowerCase()} target.`,
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

  return { existing, updated };
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
 * their achievement counts. Used by /targets/recruiter/:id, /targets/me,
 * /targets/team, and the recruiter / RM "My Targets" / "Team Targets" pages.
 *
 * Rows returned here are pre-filtered to currently-effective by
 * getRecruiterActiveTargets, so `effectiveStatus` is always ACTIVE — but
 * we still attach it (alongside `daysUntilEnd` / `daysUntilStart`) so the
 * frontend can render "ends in 3d" subtext consistently with the admin
 * Targets page. Without this, recruiters and RMs would see the same
 * targets the admin sees, but without the time-context cues.
 */
export async function getRecruiterTargetsWithAchievement(recruiterId: string) {
  const targets = await getRecruiterActiveTargets(recruiterId);
  const now = new Date();
  return Promise.all(
    targets.map(async (t) => ({
      ...t,
      achieved: await getTargetAchievement(recruiterId, t.targetType as TargetType),
      effectiveStatus: deriveEffectiveStatus(t.isActive, t.effectiveFrom, t.effectiveTo, now),
      daysUntilStart: daysFromNow(t.effectiveFrom, now),
      daysUntilEnd: daysFromNow(t.effectiveTo, now),
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
