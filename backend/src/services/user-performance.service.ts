import { Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Per-User Performance Service
//
//  Powers the Performance tab on the Admin → Employee Detail page
//  (frontend/src/app/(protected)/admin/employees/[id]/page.tsx).
//
//  Returns one bundle with KPIs, pipeline + zone + status breakdowns,
//  daily trend, attendance summary, leave summary, target progress,
//  and the user's rank among active recruiters. Scoped to a single
//  user — different from analytics.service which aggregates across all.
// ──────────────────────────────────────────────

interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Derive a start/end pair from a period token. Kept inline rather than
 * shared with analytics.service to avoid coupling — the two services
 * can drift independently.
 */
function getDateRange(period: string): DateRange {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let from: Date;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "thisWeek": {
      const day = now.getDay();
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
      break;
    }
    case "thisMonth":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "lastMonth":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to.setTime(new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1);
      break;
    case "thisQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "thisYear":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "allTime":
      from = new Date(2020, 0, 1);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { from, to };
}

export interface UserPerformance {
  period: string;
  range: { from: string; to: string };
  kpi: {
    total: number;
    complete: number;
    pending: number;
    completionRate: number; // 0-100
    activeDays: number; // distinct submission days within range
    dailyAverage: number; // total / activeDays
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  pipeline: Array<{ stage: string; count: number }>;
  zoneDistribution: Array<{ zone: string; count: number }>;
  statusBreakdown: { complete: number; pending: number };
  dailyTrend: Array<{ date: string; count: number }>;
  attendance: {
    present: number;
    halfDay: number;
    late: number;
    absent: number;
    onLeave: number;
    totalMinutes: number;
    avgDailyMinutes: number;
  };
  leave: Array<{
    code: string;
    name: string;
    totalAllotted: number;
    used: number;
    remaining: number;
  }>;
  targets: Array<{
    type: "DAILY" | "WEEKLY" | "MONTHLY";
    target: number;
    actual: number;
    progress: number; // 0-100
  }>;
  rank: {
    position: number | null; // 1-based; null if user has no submissions this month
    totalRecruiters: number;
  };
  bestDay: { date: string; count: number } | null;
}

export async function getUserPerformance(
  userId: string,
  period: string,
): Promise<UserPerformance> {
  const prisma = getPrisma();
  const range = getDateRange(period);

  // ── 1. Candidate counts within range, grouped by status ──
  const statusGroups = await prisma.candidateReport.groupBy({
    by: ["status"],
    where: {
      recruiterId: userId,
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: true,
  });

  let complete = 0;
  let pending = 0;
  for (const row of statusGroups) {
    // Status is stored as a free-form String (default "PENDING"); historical
    // data uses both "Complete"/"Pending" and uppercase. Compare case-insensitively.
    const s = (row.status ?? "").toUpperCase();
    if (s === "COMPLETE") complete += row._count;
    else pending += row._count;
  }
  const total = complete + pending;
  const completionRate = total > 0 ? Math.round((complete / total) * 1000) / 10 : 0;

  // ── 2. Today / Week / Month roll-ups (separate ranges, not period-bound) ──
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1),
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayCount, weekCount, monthCount] = await Promise.all([
    prisma.candidateReport.count({
      where: { recruiterId: userId, deletedAt: null, createdAt: { gte: todayStart } },
    }),
    prisma.candidateReport.count({
      where: { recruiterId: userId, deletedAt: null, createdAt: { gte: weekStart } },
    }),
    prisma.candidateReport.count({
      where: { recruiterId: userId, deletedAt: null, createdAt: { gte: monthStart } },
    }),
  ]);

  // ── 3. Pipeline stages within range ──
  const stageGroups = await prisma.candidateReport.groupBy({
    by: ["candidateStage"],
    where: {
      recruiterId: userId,
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: true,
  });
  const pipeline = stageGroups.map((g) => ({
    stage: g.candidateStage,
    count: g._count,
  }));

  // ── 4. Zone distribution ──
  const zoneGroups = await prisma.candidateReport.groupBy({
    by: ["zone"],
    where: {
      recruiterId: userId,
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: true,
  });
  const zoneDistribution = zoneGroups.map((g) => ({ zone: g.zone, count: g._count }));

  // ── 5. Daily trend (last 30 days, raw SQL for date_trunc + 0-fill) ──
  const trendFrom = new Date();
  trendFrom.setDate(trendFrom.getDate() - 30);
  trendFrom.setHours(0, 0, 0, 0);

  const rawTrend = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(
    Prisma.sql`
      SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
      FROM candidate_reports
      WHERE recruiter_id = ${userId}
        AND deleted_at IS NULL
        AND created_at >= ${trendFrom}
      GROUP BY day
      ORDER BY day ASC
    `,
  );
  // 0-fill any missing days for a clean chart
  const trendMap = new Map<string, number>();
  for (const r of rawTrend) {
    trendMap.set(r.day.toISOString().slice(0, 10), Number(r.count));
  }
  const dailyTrend: Array<{ date: string; count: number }> = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    dailyTrend.push({ date: key, count: trendMap.get(key) ?? 0 });
  }

  const activeDays = rawTrend.length;
  const dailyAverage = activeDays > 0 ? Math.round((total / activeDays) * 10) / 10 : 0;

  // ── 6. Best day (max count in trend window) ──
  let bestDay: { date: string; count: number } | null = null;
  for (const d of dailyTrend) {
    if (!bestDay || d.count > bestDay.count) {
      if (d.count > 0) bestDay = d;
    }
  }

  // ── 7. Attendance (this month) ──
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { userId, date: { gte: monthStart, lte: range.to } },
    select: { status: true, netWorkingMinutes: true, isLate: true },
  });
  const attendance = {
    present: 0,
    halfDay: 0,
    late: 0,
    absent: 0,
    onLeave: 0,
    totalMinutes: 0,
    avgDailyMinutes: 0,
  };
  for (const r of attendanceRecords) {
    if (r.status === "PRESENT_FULL") attendance.present++;
    else if (r.status === "PRESENT_HALF") attendance.halfDay++;
    else if (r.status === "ABSENT") attendance.absent++;
    else if (r.status === "ON_LEAVE") attendance.onLeave++;
    if (r.isLate) attendance.late++;
    if (r.netWorkingMinutes) attendance.totalMinutes += r.netWorkingMinutes;
  }
  const workedDays = attendance.present + attendance.halfDay;
  attendance.avgDailyMinutes = workedDays > 0 ? Math.round(attendance.totalMinutes / workedDays) : 0;

  // ── 8. Leave balances (current year) ──
  const balances = await prisma.leaveBalance.findMany({
    where: { userId, year: new Date().getFullYear() },
    include: { leaveType: { select: { name: true, code: true } } },
  });
  const leave = balances.map((b) => ({
    code: b.leaveType.code,
    name: b.leaveType.name,
    totalAllotted: b.totalAllotted,
    used: b.used,
    remaining: b.remaining,
  }));

  // ── 9. Targets — active per type, pick the most specific (user-scoped wins) ──
  const today = new Date();
  const activeTargets = await prisma.recruiterTarget.findMany({
    where: {
      isActive: true,
      OR: [{ recruiterId: userId }, { recruiterId: null }],
      effectiveFrom: { lte: today },
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] }],
    },
    orderBy: [{ recruiterId: "desc" }, { effectiveFrom: "desc" }], // user-specific first
  });
  // Pick at most one target per type, preferring user-specific over global
  const targetsByType = new Map<"DAILY" | "WEEKLY" | "MONTHLY", number>();
  for (const t of activeTargets) {
    if (!targetsByType.has(t.targetType)) {
      targetsByType.set(t.targetType, t.targetValue);
    }
  }
  const targets: UserPerformance["targets"] = [];
  for (const [type, target] of targetsByType) {
    const actual = type === "DAILY" ? todayCount : type === "WEEKLY" ? weekCount : monthCount;
    const progress = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
    targets.push({ type, target, actual, progress });
  }

  // ── 10. Rank — position among active recruiters by month count ──
  const monthGroupedAll = await prisma.candidateReport.groupBy({
    by: ["recruiterId"],
    where: { deletedAt: null, createdAt: { gte: monthStart } },
    _count: true,
  });
  const sorted = [...monthGroupedAll].sort((a, b) => b._count - a._count);
  const myIdx = sorted.findIndex((r) => r.recruiterId === userId);
  // Count of active recruiters overall (for context, not just those with submissions)
  const totalRecruiters = await prisma.user.count({
    where: { role: "RECRUITER", status: "ACTIVE", deletedAt: null },
  });

  return {
    period,
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    kpi: {
      total,
      complete,
      pending,
      completionRate,
      activeDays,
      dailyAverage,
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
    },
    pipeline,
    zoneDistribution,
    statusBreakdown: { complete, pending },
    dailyTrend,
    attendance,
    leave,
    targets,
    rank: {
      position: myIdx >= 0 ? myIdx + 1 : null,
      totalRecruiters,
    },
    bestDay,
  };
}
