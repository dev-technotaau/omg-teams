import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import type { Prisma } from "@prisma/client";

// ──────────────────────────────────────────────
//  Dashboard Service — Spec Section 23.4
// ──────────────────────────────────────────────

export async function getDashboardStats(userId: string, role: string) {
  // Cache dashboard stats for 5 minutes — heavy aggregation queries
  const cacheKey = `dashboard:${role}:${userId}:${new Date().toISOString().slice(0, 10)}`;
  return cache.getOrSet(cacheKey, () => computeDashboardStats(userId, role), 300);
}

async function computeDashboardStats(userId: string, role: string) {
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Scope: recruiter sees own, RM sees team, admin sees all
  let recruiterFilter: Prisma.CandidateReportWhereInput;
  let userIds: string[] = [userId];

  if (role === "REPORTING_MANAGER") {
    const assignments = await prisma.recruiterManagerAssignment.findMany({
      where: { managerId: userId, removedAt: null },
      select: { recruiterId: true },
    });
    userIds = [userId, ...assignments.map((a) => a.recruiterId)];
    recruiterFilter = { recruiterId: { in: userIds } };
  } else if (role === "ADMIN") {
    recruiterFilter = {};
  } else {
    recruiterFilter = { recruiterId: userId };
  }

  const [todayCount, weekCount, monthCount, pendingCount, totalCount] = await Promise.all([
    prisma.candidateReport.count({ where: { ...recruiterFilter, createdAt: { gte: today } } }),
    prisma.candidateReport.count({ where: { ...recruiterFilter, createdAt: { gte: weekAgo } } }),
    prisma.candidateReport.count({ where: { ...recruiterFilter, createdAt: { gte: monthStart } } }),
    prisma.candidateReport.count({ where: { ...recruiterFilter, status: "PENDING" } }),
    prisma.candidateReport.count({ where: recruiterFilter }),
  ]);

  const completedCount = await prisma.candidateReport.count({
    where: { ...recruiterFilter, status: "COMPLETE" },
  });
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Target info (for recruiter)
  let targetValue = 0;
  let targetAchieved = 0;
  if (role === "RECRUITER") {
    const activeTarget = await prisma.recruiterTarget.findFirst({
      where: { recruiterId: userId, isActive: true, effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
    });
    if (activeTarget) {
      targetValue = activeTarget.targetValue;
      if (activeTarget.targetType === "DAILY") targetAchieved = todayCount;
      else if (activeTarget.targetType === "WEEKLY") targetAchieved = weekCount;
      else targetAchieved = monthCount;
    }
  }

  // Active recruiters (for RM/Admin)
  let activeRecruiters: number | undefined;
  if (role !== "RECRUITER") {
    const recruiterWhere: Prisma.UserWhereInput = { role: "RECRUITER", status: "ACTIVE" };
    if (role === "REPORTING_MANAGER") {
      recruiterWhere.id = { in: userIds.filter((id) => id !== userId) };
    }
    activeRecruiters = await prisma.user.count({ where: recruiterWhere });
  }

  return {
    candidatesToday: todayCount,
    candidatesWeek: weekCount,
    candidatesMonth: monthCount,
    completionRate,
    pendingReports: pendingCount,
    targetValue,
    targetAchieved,
    activeRecruiters,
  };
}

export async function getDailyTrend(userId: string, role: string) {
  const prisma = getPrisma();
  const days = 14;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const recruiterFilter: Prisma.CandidateReportWhereInput = { createdAt: { gte: startDate } };

  if (role === "REPORTING_MANAGER") {
    const assignments = await prisma.recruiterManagerAssignment.findMany({
      where: { managerId: userId, removedAt: null },
      select: { recruiterId: true },
    });
    const ids = [userId, ...assignments.map((a) => a.recruiterId)];
    recruiterFilter.recruiterId = { in: ids };
  } else if (role !== "ADMIN") {
    recruiterFilter.recruiterId = userId;
  }

  const reports = await prisma.candidateReport.findMany({
    where: recruiterFilter,
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by date
  const trend: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0]!;
    const count = reports.filter((r) => r.createdAt.toISOString().split("T")[0] === dateStr).length;
    trend.push({ date: dateStr, count });
  }

  return trend;
}

export async function getStatusBreakdown(userId: string, role: string) {
  const prisma = getPrisma();

  const recruiterFilter: Prisma.CandidateReportWhereInput = {};
  if (role === "REPORTING_MANAGER") {
    const assignments = await prisma.recruiterManagerAssignment.findMany({
      where: { managerId: userId, removedAt: null },
      select: { recruiterId: true },
    });
    recruiterFilter.recruiterId = { in: [userId, ...assignments.map((a) => a.recruiterId)] };
  } else if (role !== "ADMIN") {
    recruiterFilter.recruiterId = userId;
  }

  const total = await prisma.candidateReport.count({ where: recruiterFilter });
  const statuses = await prisma.candidateReport.groupBy({
    by: ["status"],
    where: recruiterFilter,
    _count: true,
  });

  return statuses.map((s) => ({
    status: s.status,
    count: s._count,
    percentage: total > 0 ? Math.round((s._count / total) * 100) : 0,
  }));
}

// ── RM Team Snapshot (§7 — Gaps 1-4) ──

export async function getRMTeamSnapshot(userId: string) {
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get assigned recruiter IDs
  const assignments = await prisma.recruiterManagerAssignment.findMany({
    where: { managerId: userId, removedAt: null },
    select: { recruiterId: true },
  });
  const recruiterIds = assignments.map((a) => a.recruiterId);

  if (recruiterIds.length === 0) {
    return {
      teamAttendance: { present: 0, absent: 0, late: 0, onLeave: 0 },
      teamLogins: [],
      topPerformer: null,
      ownMonthlyAttendanceRate: 0,
      ownIsLate: false,
    };
  }

  // Team attendance counts
  const [present, absent, late, onLeave] = await Promise.all([
    prisma.attendanceRecord.count({
      where: { date: today, userId: { in: recruiterIds }, status: "PRESENT_FULL" },
    }),
    prisma.attendanceRecord.count({
      where: { date: today, userId: { in: recruiterIds }, status: "ABSENT" },
    }),
    prisma.attendanceRecord.count({
      where: { date: today, userId: { in: recruiterIds }, status: "LATE" },
    }),
    prisma.attendanceRecord.count({
      where: { date: today, userId: { in: recruiterIds }, status: "ON_LEAVE" },
    }),
  ]);

  // Team logins today
  const teamLoginRecords = await prisma.attendanceRecord.findMany({
    where: { date: today, userId: { in: recruiterIds }, punchInTime: { not: null } },
    select: {
      punchInTime: true,
      isLate: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { punchInTime: "desc" },
  });
  const teamLogins = teamLoginRecords.map((r) => ({
    name: `${r.user.firstName} ${r.user.lastName}`,
    punchIn: r.punchInTime!.toISOString(),
    isLate: r.isLate,
  }));

  // Top performer — most candidates sourced this month
  const recruiterCounts = await prisma.candidateReport.groupBy({
    by: ["recruiterId"],
    where: { recruiterId: { in: recruiterIds }, createdAt: { gte: monthStart } },
    _count: true,
    orderBy: { _count: { recruiterId: "desc" } },
    take: 1,
  });

  let topPerformer: { name: string; count: number } | null = null;
  if (recruiterCounts.length > 0) {
    const topId = recruiterCounts[0]!.recruiterId;
    const topUser = await prisma.user.findUnique({
      where: { id: topId },
      select: { firstName: true, lastName: true },
    });
    if (topUser) {
      topPerformer = {
        name: `${topUser.firstName} ${topUser.lastName}`,
        count: recruiterCounts[0]!._count,
      };
    }
  }

  // Own monthly attendance rate
  const ownMonthRecords = await prisma.attendanceRecord.count({
    where: { userId, date: { gte: monthStart } },
  });
  const ownMonthPresent = await prisma.attendanceRecord.count({
    where: { userId, date: { gte: monthStart }, status: { in: ["PRESENT_FULL", "PRESENT_HALF"] } },
  });
  const ownMonthlyAttendanceRate =
    ownMonthRecords > 0 ? Math.round((ownMonthPresent / ownMonthRecords) * 100) : 0;

  // Own late status today
  const ownToday = await prisma.attendanceRecord.findFirst({
    where: { userId, date: today },
    select: { isLate: true },
  });
  const ownIsLate = ownToday?.isLate ?? false;

  return {
    teamAttendance: { present, absent, late, onLeave },
    teamLogins,
    topPerformer,
    ownMonthlyAttendanceRate,
    ownIsLate,
  };
}

// ── Admin Dashboard Stats (§6.2) ──

/** Resolve date-range string to a start Date for KPI filtering */
function resolveRangeStart(range: string): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case "yesterday": {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return d;
    }
    case "week": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "15days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 15);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "3months": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    case "6months": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      return d;
    }
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return new Date(2000, 0, 1);
    default: // "today"
      return today;
  }
}

export async function getAdminDashboardStats(range = "today") {
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const rangeStart = resolveRangeStart(range);

  // Attendance counts for today (always today regardless of range)
  const [presentCount, absentCount, lateCount, onLeaveCount, halfDayCount] = await Promise.all([
    prisma.attendanceRecord.count({ where: { date: today, status: "PRESENT_FULL" } }),
    prisma.attendanceRecord.count({ where: { date: today, status: "ABSENT" } }),
    prisma.attendanceRecord.count({ where: { date: today, status: "LATE" } }),
    prisma.attendanceRecord.count({ where: { date: today, status: "ON_LEAVE" } }),
    prisma.attendanceRecord.count({ where: { date: today, status: "PRESENT_HALF" } }),
  ]);

  // KPI metrics — scoped by selected range
  const [candidatesToday, candidatesInRange, pendingCount, invoiceTotals] = await Promise.all([
    prisma.candidateReport.count({ where: { createdAt: { gte: today } } }),
    prisma.candidateReport.count({ where: { createdAt: { gte: rangeStart } } }),
    prisma.candidateReport.count({ where: { status: "PENDING" } }),
    prisma.invoice.aggregate({
      _sum: { amountTotal: true, amountReceived: true },
    }),
  ]);

  const outstandingAmount =
    (invoiceTotals._sum.amountTotal ?? 0) - (invoiceTotals._sum.amountReceived ?? 0);

  // Conversion rate: candidates with dateOfJoining / total sourced in range
  const [totalSourced, joinedCount] = await Promise.all([
    prisma.candidateReport.count({ where: { createdAt: { gte: rangeStart } } }),
    prisma.candidateReport.count({
      where: { createdAt: { gte: rangeStart }, dateOfJoining: { not: null } },
    }),
  ]);
  const conversionRate = totalSourced > 0 ? Math.round((joinedCount / totalSourced) * 100) : 0;

  // Today's logins from LoginHistory
  const todayLogins = await prisma.loginHistory.findMany({
    where: { success: true, createdAt: { gte: today, lt: tomorrow } },
    select: {
      id: true,
      createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Check which login was late (if attendance says so)
  const loginUserIds = todayLogins.map((l) => l.user?.id).filter(Boolean) as string[];
  const attendanceByUser = new Map<string, { isLate: boolean }>();
  if (loginUserIds.length > 0) {
    const records = await prisma.attendanceRecord.findMany({
      where: { date: today, userId: { in: loginUserIds } },
      select: { userId: true, isLate: true },
    });
    for (const r of records) {
      attendanceByUser.set(r.userId, { isLate: r.isLate });
    }
  }

  const logins = todayLogins
    .filter((l) => l.user)
    .map((l) => ({
      id: l.id,
      loginTime: l.createdAt.toISOString(),
      employeeName: `${l.user!.firstName} ${l.user!.lastName}`,
      role: l.user!.role,
      isLate: attendanceByUser.get(l.user!.id)?.isLate ?? false,
    }));

  // §6.2 — Employees who have NOT logged in today
  const loggedInUserIds = new Set(loginUserIds);
  const allActiveEmployees = await prisma.user.findMany({
    where: { role: { in: ["RECRUITER", "REPORTING_MANAGER"] }, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  const notLoggedIn = allActiveEmployees
    .filter((e) => !loggedInUserIds.has(e.id))
    .map((e) => ({
      id: e.id,
      employeeName: `${e.firstName} ${e.lastName}`,
      role: e.role,
    }));

  // Pending actions
  const [pendingLeaves, pendingDocs, suspendedAccounts] = await Promise.all([
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.employeeDocument.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "SUSPENDED", role: { not: "ADMIN" } } }),
  ]);

  return {
    attendance: {
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      onLeave: onLeaveCount,
      halfDay: halfDayCount,
    },
    kpis: {
      candidatesToday,
      candidatesMonth: candidatesInRange,
      pendingReports: pendingCount,
      outstandingAmount,
      conversionRate,
    },
    logins,
    notLoggedIn,
    pendingActions: {
      leaveRequests: pendingLeaves,
      kycVerifications: pendingDocs,
      suspendedAccounts,
    },
  };
}

// ── Monthly Attendance Rate (§6.2 — Gap 5) ──

export async function getMonthlyAttendanceRate() {
  const prisma = getPrisma();
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month

  const totalEmployees = await prisma.user.count({
    where: { role: { in: ["RECRUITER", "REPORTING_MANAGER"] }, status: "ACTIVE" },
  });

  if (totalEmployees === 0) {
    return { currentRate: 0, lastMonthRate: 0, change: 0 };
  }

  // Current month: working days so far
  const currentMonthPresent = await prisma.attendanceRecord.count({
    where: { date: { gte: currentMonthStart }, status: { in: ["PRESENT_FULL", "PRESENT_HALF"] } },
  });
  const currentWorkingDays = await prisma.attendanceRecord.groupBy({
    by: ["date"],
    where: { date: { gte: currentMonthStart } },
  });
  const currentTotal = (currentWorkingDays.length || 1) * totalEmployees;
  const currentRate = Math.round((currentMonthPresent / currentTotal) * 100);

  // Last month
  const lastMonthPresent = await prisma.attendanceRecord.count({
    where: {
      date: { gte: lastMonthStart, lte: lastMonthEnd },
      status: { in: ["PRESENT_FULL", "PRESENT_HALF"] },
    },
  });
  const lastWorkingDays = await prisma.attendanceRecord.groupBy({
    by: ["date"],
    where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
  });
  const lastTotal = (lastWorkingDays.length || 1) * totalEmployees;
  const lastMonthRate = Math.round((lastMonthPresent / lastTotal) * 100);

  return {
    currentRate,
    lastMonthRate,
    change: currentRate - lastMonthRate,
  };
}

export async function getCandidateStatsByRecruiter(recruiterIds: string[]) {
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const stats: Record<string, { today: number; month: number; completionRate: number }> = {};

  await Promise.all(
    recruiterIds.map(async (rid) => {
      const [todayCount, monthCount, totalCount, completeCount] = await Promise.all([
        prisma.candidateReport.count({ where: { recruiterId: rid, createdAt: { gte: today } } }),
        prisma.candidateReport.count({
          where: { recruiterId: rid, createdAt: { gte: monthStart } },
        }),
        prisma.candidateReport.count({ where: { recruiterId: rid } }),
        prisma.candidateReport.count({ where: { recruiterId: rid, status: "COMPLETE" } }),
      ]);
      stats[rid] = {
        today: todayCount,
        month: monthCount,
        completionRate: totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0,
      };
    }),
  );

  return stats;
}

/**
 * §23.4.1/23.4.2 — Extended dashboard data for recruiter/RM.
 * Returns attendance hours, streak, leave info, recent submissions, zone breakdown.
 */
export async function getExtendedDashboard(userId: string, role: string) {
  const prisma = getPrisma();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Determine scope (own for recruiter, team for RM)
  const isRM = role === "REPORTING_MANAGER";
  let recruiterIds: string[] = [userId];
  if (isRM) {
    const assignments = await prisma.recruiterManagerAssignment.findMany({
      where: { managerId: userId, removedAt: null },
      select: { recruiterId: true },
    });
    recruiterIds = assignments.map((a) => a.recruiterId);
  }

  // §23.4.1 — Yesterday's, this week's, this month's working hours (own)
  const [yesterdayRecord, weekRecords, monthRecords] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { userId, date: yesterday },
      select: { netWorkingMinutes: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { userId, date: { gte: weekStart, lte: today } },
      select: { netWorkingMinutes: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { userId, date: { gte: monthStart, lte: today } },
      select: { netWorkingMinutes: true },
    }),
  ]);

  const sumMinutes = (records: { netWorkingMinutes: number | null }[]) =>
    records.reduce((sum, r) => sum + (r.netWorkingMinutes ?? 0), 0);

  const yesterdayMinutes = yesterdayRecord?.netWorkingMinutes ?? 0;
  const weekMinutes = sumMinutes(weekRecords);
  const monthMinutes = sumMinutes(monthRecords);

  // §23.4.1 — Attendance streak (last 14 days, colored by status)
  const streakStart = new Date(today);
  streakStart.setDate(today.getDate() - 13);
  const streakRecords = await prisma.attendanceRecord.findMany({
    where: { userId, date: { gte: streakStart, lte: today } },
    select: { date: true, status: true, isLate: true },
    orderBy: { date: "asc" },
  });
  const streakMap = new Map(
    streakRecords.map((r) => [r.date.toISOString().slice(0, 10), r.status]),
  );
  // Check leave days
  const leaveRecords = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: "APPROVED",
      startDate: { lte: today },
      endDate: { gte: streakStart },
    },
    select: { startDate: true, endDate: true },
  });
  const leaveDays = new Set<string>();
  for (const lr of leaveRecords) {
    const d = new Date(lr.startDate);
    while (d <= lr.endDate && d <= today) {
      leaveDays.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  }
  const streak: { date: string; status: string }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(streakStart);
    d.setDate(streakStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    let status: string;
    if (dayOfWeek === 0 || dayOfWeek === 6) status = "WEEKEND";
    else if (leaveDays.has(key)) status = "ON_LEAVE";
    else if (streakMap.has(key)) status = streakMap.get(key) as string;
    else if (d < today) status = "ABSENT";
    else status = "FUTURE";
    streak.push({ date: key, status });
  }

  // §23.4.1 — Monthly attendance rate (own)
  const totalWorkingDays = Math.max(
    1,
    Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const presentDays = monthRecords.filter(
    (r) =>
      r.netWorkingMinutes !== null && r.netWorkingMinutes !== undefined && r.netWorkingMinutes > 0,
  ).length;
  const monthlyAttendanceRate = Math.round((presentDays / totalWorkingDays) * 100);

  // §23.4.1 — Leave info (upcoming approved, pending count, next leave)
  const [upcomingLeaves, pendingLeaveCount] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { userId, status: "APPROVED", startDate: { gt: today } },
      select: { startDate: true, endDate: true, leaveType: { select: { name: true } } },
      orderBy: { startDate: "asc" },
      take: 5,
    }),
    prisma.leaveRequest.count({
      where: { userId, status: "PENDING" },
    }),
  ]);
  const nextLeave =
    upcomingLeaves.length > 0
      ? {
          date: upcomingLeaves[0]!.startDate.toISOString().slice(0, 10),
          type: upcomingLeaves[0]!.leaveType.name,
        }
      : null;

  // §23.4.1 — Zone distribution (own submissions)
  const zoneBreakdown = await prisma.candidateReport.groupBy({
    by: ["zone"],
    where: { recruiterId: userId, deletedAt: null },
    _count: true,
  });

  // §23.4.1 — Recent submissions (last 10)
  const recentSubmissions = await prisma.candidateReport.findMany({
    where: { recruiterId: userId, deletedAt: null },
    select: {
      id: true,
      candidateName: true,
      status: true,
      zone: true,
      company: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // §23.4.2 — RM: recruiter summary table + team monthly attendance
  let recruiterSummary: {
    id: string;
    name: string;
    todayCount: number;
    weekCount: number;
    monthCount: number;
    completionRate: number;
    punchIn: string | null;
    workingHours: number;
    attendanceStatus: string;
    monthlyAttendanceRate: number;
  }[] = [];
  let teamMonthlyAttendanceRate = 0;

  if (isRM && recruiterIds.length > 0) {
    const [recruiterUsers, recruiterAttendance, recruiterCandidates] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: recruiterIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.attendanceRecord.findMany({
        where: { userId: { in: recruiterIds }, date: today },
        select: {
          userId: true,
          punchInTime: true,
          netWorkingMinutes: true,
          status: true,
          isLate: true,
        },
      }),
      prisma.candidateReport.findMany({
        where: {
          recruiterId: { in: recruiterIds },
          deletedAt: null,
          createdAt: { gte: monthStart },
        },
        select: { recruiterId: true, status: true, createdAt: true },
      }),
    ]);

    const attMap = new Map(recruiterAttendance.map((a) => [a.userId, a]));
    const nameMap = new Map(recruiterUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    // Monthly attendance per recruiter
    const monthlyAttRecords = await prisma.attendanceRecord.groupBy({
      by: ["userId"],
      where: { userId: { in: recruiterIds }, date: { gte: monthStart } },
      _count: true,
    });
    const monthlyAttMap = new Map(monthlyAttRecords.map((r) => [r.userId, r._count]));

    recruiterSummary = recruiterIds.map((rid) => {
      const att = attMap.get(rid);
      const todayCandidates = recruiterCandidates.filter(
        (c) => c.recruiterId === rid && c.createdAt >= today,
      );
      const weekCandidates = recruiterCandidates.filter(
        (c) => c.recruiterId === rid && c.createdAt >= weekStart,
      );
      const allCandidates = recruiterCandidates.filter((c) => c.recruiterId === rid);
      const completeCount = allCandidates.filter((c) => c.status === "Complete").length;
      const monthDays = monthlyAttMap.get(rid) ?? 0;

      let attendanceStatus = "ABSENT";
      if (att) {
        attendanceStatus = att.isLate ? "LATE" : (att.status as string);
      }

      return {
        id: rid,
        name: nameMap.get(rid) ?? "Unknown",
        todayCount: todayCandidates.length,
        weekCount: weekCandidates.length,
        monthCount: allCandidates.length,
        completionRate:
          allCandidates.length > 0 ? Math.round((completeCount / allCandidates.length) * 100) : 0,
        punchIn: att?.punchInTime?.toISOString() ?? null,
        workingHours: att?.netWorkingMinutes ?? 0,
        attendanceStatus,
        monthlyAttendanceRate: Math.round((monthDays / totalWorkingDays) * 100),
      };
    });

    const totalTeamDays = recruiterIds.reduce((s, rid) => s + (monthlyAttMap.get(rid) ?? 0), 0);
    teamMonthlyAttendanceRate =
      recruiterIds.length > 0
        ? Math.round((totalTeamDays / (recruiterIds.length * totalWorkingDays)) * 100)
        : 0;
  }

  return {
    workingHours: {
      yesterday: yesterdayMinutes,
      thisWeek: weekMinutes,
      thisMonth: monthMinutes,
    },
    streak,
    monthlyAttendanceRate,
    leave: {
      upcoming: upcomingLeaves.map((l) => ({
        startDate: l.startDate.toISOString().slice(0, 10),
        endDate: l.endDate.toISOString().slice(0, 10),
        type: l.leaveType.name,
      })),
      pendingCount: pendingLeaveCount,
      nextLeave,
    },
    zoneBreakdown: zoneBreakdown.map((z) => ({ zone: z.zone, count: z._count })),
    recentSubmissions: recentSubmissions.map((r) => ({
      id: r.id,
      candidateName: r.candidateName,
      status: r.status,
      zone: r.zone,
      company: r.company?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    // RM-only
    recruiterSummary,
    teamMonthlyAttendanceRate,
  };
}
