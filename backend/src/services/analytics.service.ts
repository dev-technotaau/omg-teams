import { type Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Analytics Service — Spec Section 21
// ──────────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
}

function getDateRange(period: string): DateRange {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let from: Date;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      to.setDate(to.getDate() - 1);
      break;
    case "this_week":
    case "thisWeek": {
      const day = now.getDay();
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
      break;
    }
    case "last_week":
    case "lastWeek": {
      const day = now.getDay();
      const thisMonday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (day === 0 ? 6 : day - 1),
      );
      from = new Date(thisMonday);
      from.setDate(thisMonday.getDate() - 7);
      to.setTime(thisMonday.getTime() - 1);
      break;
    }
    case "this_month":
    case "thisMonth":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
    case "lastMonth":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to.setTime(new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1);
      break;
    case "this_quarter":
    case "thisQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "last_quarter":
    case "lastQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), (q - 1) * 3, 1);
      to.setTime(new Date(now.getFullYear(), q * 3, 1).getTime() - 1);
      break;
    }
    case "this_year":
    case "thisYear":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "last_year":
    case "lastYear":
      from = new Date(now.getFullYear() - 1, 0, 1);
      to.setTime(new Date(now.getFullYear(), 0, 1).getTime() - 1);
      break;
    case "all_time":
    case "allTime":
      from = new Date(2020, 0, 1);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return { from, to };
}

/** KPI Summary Cards — Section 21.2 */
export async function getKPISummary(period: string, customFrom?: string, customTo?: string) {
  const prisma = getPrisma();
  const range =
    customFrom && customTo
      ? { from: new Date(customFrom), to: new Date(customTo) }
      : getDateRange(period);

  const prevDuration = range.to.getTime() - range.from.getTime();
  const prevRange = {
    from: new Date(range.from.getTime() - prevDuration),
    to: new Date(range.from),
  };

  const [
    totalSourced,
    prevTotalSourced,
    todaySourced,
    activeRecruiters,
    totalRevenue,
    prevRevenue,
    amountReceived,
    prevAmountReceived,
    pendingReports,
    prevPending,
  ] = await Promise.all([
    prisma.candidateReport.count({
      where: { createdAt: { gte: range.from, lte: range.to }, deletedAt: null },
    }),
    prisma.candidateReport.count({
      where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, deletedAt: null },
    }),
    prisma.candidateReport.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, deletedAt: null },
    }),
    prisma.candidateReport
      .groupBy({
        by: ["recruiterId"],
        where: { createdAt: { gte: range.from, lte: range.to }, deletedAt: null },
      })
      .then((r) => r.length),
    prisma.candidateReport.aggregate({
      _sum: { invoiceAmountTotal: true },
      where: { createdAt: { gte: range.from, lte: range.to }, deletedAt: null },
    }),
    prisma.candidateReport.aggregate({
      _sum: { invoiceAmountTotal: true },
      where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, deletedAt: null },
    }),
    prisma.candidateReport.aggregate({
      _sum: { amountReceived: true },
      where: { createdAt: { gte: range.from, lte: range.to }, deletedAt: null },
    }),
    prisma.candidateReport.aggregate({
      _sum: { amountReceived: true },
      where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, deletedAt: null },
    }),
    prisma.candidateReport.count({
      where: { status: "Pending", deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    }),
    prisma.candidateReport.count({
      where: {
        status: "Pending",
        deletedAt: null,
        createdAt: { gte: prevRange.from, lte: prevRange.to },
      },
    }),
  ]);

  const revenue = totalRevenue._sum.invoiceAmountTotal ?? 0;
  const prevRev = prevRevenue._sum.invoiceAmountTotal ?? 0;
  const received = amountReceived._sum.amountReceived ?? 0;
  const prevRec = prevAmountReceived._sum.amountReceived ?? 0;
  const outstanding = Number(revenue) - Number(received);

  // Conversion rate: joined / total sourced
  const joinedCount = await prisma.candidateReport.count({
    where: {
      dateOfJoining: { not: null },
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
    },
  });
  const conversionRate = totalSourced > 0 ? (joinedCount / totalSourced) * 100 : 0;

  // Average Time to Join: (dateOfJoining - createdAt) in days
  const joinedRecords = await prisma.candidateReport.findMany({
    where: {
      dateOfJoining: { not: null },
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
    },
    select: { createdAt: true, dateOfJoining: true },
  });
  let avgTimeToJoin = 0;
  if (joinedRecords.length > 0) {
    const totalDays = joinedRecords.reduce((sum, r) => {
      const days = Math.max(
        0,
        Math.round((r.dateOfJoining!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      );
      return sum + days;
    }, 0);
    avgTimeToJoin = Math.round(totalDays / joinedRecords.length);
  }

  // HR Feedback Rate: candidates with any feedback / total
  const feedbackCount = await prisma.candidateReport.count({
    where: {
      hrFeedback: { not: null },
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
    },
  });
  const hrFeedbackRate = totalSourced > 0 ? (feedbackCount / totalSourced) * 100 : 0;

  const calcChange = (current: number, prev: number) =>
    prev === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - prev) / prev) * 100);

  // §21.2 — Additional comparisons for all cards
  const [
    yesterdaySourced,
    prevActiveRecruiters,
    prevOutstanding,
    prevJoinedRecords,
    prevFeedbackCount,
    prevTotalSourcedForRates,
  ] = await Promise.all([
    // todaySourced vs yesterday
    prisma.candidateReport.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(-24, 0, 0, 0)),
          lt: new Date(new Date().setHours(0, 0, 0, 0)),
        },
        deletedAt: null,
      },
    }),
    // activeRecruiters vs previous period
    prisma.candidateReport
      .groupBy({
        by: ["recruiterId"],
        where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, deletedAt: null },
      })
      .then((r) => r.length),
    // outstanding for prev period
    Promise.all([
      prisma.candidateReport.aggregate({
        _sum: { invoiceAmountTotal: true },
        where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, deletedAt: null },
      }),
      prisma.candidateReport.aggregate({
        _sum: { amountReceived: true },
        where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, deletedAt: null },
      }),
    ]).then(
      ([inv, rec]) =>
        Number(inv._sum.invoiceAmountTotal ?? 0) - Number(rec._sum.amountReceived ?? 0),
    ),
    // avgTimeToJoin for prev period
    prisma.candidateReport.findMany({
      where: {
        dateOfJoining: { not: null },
        deletedAt: null,
        createdAt: { gte: prevRange.from, lte: prevRange.to },
      },
      select: { createdAt: true, dateOfJoining: true },
    }),
    // hrFeedbackRate for prev period
    prisma.candidateReport.count({
      where: {
        hrFeedback: { not: null },
        deletedAt: null,
        createdAt: { gte: prevRange.from, lte: prevRange.to },
      },
    }),
    prisma.candidateReport.count({
      where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, deletedAt: null },
    }),
  ]);

  let prevAvgTimeToJoin = 0;
  if (prevJoinedRecords.length > 0) {
    const totalDays2 = prevJoinedRecords.reduce((sum, r) => {
      return (
        sum +
        Math.max(
          0,
          Math.round((r.dateOfJoining!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        )
      );
    }, 0);
    prevAvgTimeToJoin = Math.round(totalDays2 / prevJoinedRecords.length);
  }
  const prevHrFeedbackRate =
    prevTotalSourcedForRates > 0 ? (prevFeedbackCount / prevTotalSourcedForRates) * 100 : 0;

  return {
    totalSourced: { value: totalSourced, change: calcChange(totalSourced, prevTotalSourced) },
    todaySourced: { value: todaySourced, change: calcChange(todaySourced, yesterdaySourced) },
    activeRecruiters: {
      value: activeRecruiters,
      change: calcChange(activeRecruiters, prevActiveRecruiters),
    },
    totalRevenue: { value: Number(revenue), change: calcChange(Number(revenue), Number(prevRev)) },
    amountReceived: {
      value: Number(received),
      change: calcChange(Number(received), Number(prevRec)),
    },
    outstanding: { value: outstanding, change: calcChange(outstanding, prevOutstanding) },
    pendingReports: { value: pendingReports, change: calcChange(pendingReports, prevPending) },
    conversionRate: { value: Math.round(conversionRate * 10) / 10 },
    avgTimeToJoin: { value: avgTimeToJoin, change: calcChange(avgTimeToJoin, prevAvgTimeToJoin) },
    hrFeedbackRate: {
      value: Math.round(hrFeedbackRate * 10) / 10,
      change: calcChange(Math.round(hrFeedbackRate), Math.round(prevHrFeedbackRate)),
    },
    dateRange: { from: range.from, to: range.to },
  };
}

/** Recruitment Pipeline Funnel — Section 21.3 */
export async function getPipelineFunnel(period: string, customFrom?: string, customTo?: string) {
  const prisma = getPrisma();
  const range =
    customFrom && customTo
      ? { from: new Date(customFrom), to: new Date(customTo) }
      : getDateRange(period);

  const where = { deletedAt: null, createdAt: { gte: range.from, lte: range.to } };

  const [sourced, cvShared, feedbackReceived, holdOrShortlisted, joined] = await Promise.all([
    prisma.candidateReport.count({ where }),
    prisma.candidateReport.count({ where: { ...where, cvSharedOnDate: { not: null } } }),
    prisma.candidateReport.count({ where: { ...where, hrFeedback: { not: null } } }),
    prisma.candidateReport.count({ where: { ...where, hrFeedback: "HOLD" } }),
    prisma.candidateReport.count({ where: { ...where, dateOfJoining: { not: null } } }),
  ]);

  return [
    { stage: "Sourced", count: sourced, pctOfPrev: 100, pctOfTop: 100 },
    {
      stage: "CV Shared",
      count: cvShared,
      pctOfPrev: sourced > 0 ? Math.round((cvShared / sourced) * 100) : 0,
      pctOfTop: sourced > 0 ? Math.round((cvShared / sourced) * 100) : 0,
    },
    {
      stage: "Feedback Received",
      count: feedbackReceived,
      pctOfPrev: cvShared > 0 ? Math.round((feedbackReceived / cvShared) * 100) : 0,
      pctOfTop: sourced > 0 ? Math.round((feedbackReceived / sourced) * 100) : 0,
    },
    {
      stage: "Hold/Shortlisted",
      count: holdOrShortlisted,
      pctOfPrev:
        feedbackReceived > 0 ? Math.round((holdOrShortlisted / feedbackReceived) * 100) : 0,
      pctOfTop: sourced > 0 ? Math.round((holdOrShortlisted / sourced) * 100) : 0,
    },
    {
      stage: "Joined",
      count: joined,
      pctOfPrev: holdOrShortlisted > 0 ? Math.round((joined / holdOrShortlisted) * 100) : 0,
      pctOfTop: sourced > 0 ? Math.round((joined / sourced) * 100) : 0,
    },
  ];
}

/** Recruitment Trend — Section 21.4.1 */
export async function getRecruitmentTrend(
  period: string,
  granularity: "daily" | "weekly" | "monthly" = "daily",
) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.candidateReport.findMany({
    where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true, cvSharedOnDate: true, dateOfJoining: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, { sourced: number; cvShared: number; joined: number }>();

  for (const r of records) {
    let key: string;
    const d = r.createdAt;
    if (granularity === "daily") {
      key = d.toISOString().slice(0, 10);
    } else if (granularity === "weekly") {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = weekStart.toISOString().slice(0, 10);
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    if (!buckets.has(key)) buckets.set(key, { sourced: 0, cvShared: 0, joined: 0 });
    const b = buckets.get(key)!;
    b.sourced++;
    if (r.cvSharedOnDate) b.cvShared++;
    if (r.dateOfJoining) b.joined++;
  }

  return Array.from(buckets.entries()).map(([date, data]) => ({ date, ...data }));
}

/** Recruiter Performance — Section 21.4.2 */
export async function getRecruiterPerformance(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const data = await prisma.candidateReport.groupBy({
    by: ["recruiterId", "status"],
    where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    _count: true,
  });

  // Group by recruiter
  const recruiterMap = new Map<string, { complete: number; pending: number; total: number }>();
  for (const row of data) {
    if (!recruiterMap.has(row.recruiterId)) {
      recruiterMap.set(row.recruiterId, { complete: 0, pending: 0, total: 0 });
    }
    const entry = recruiterMap.get(row.recruiterId)!;
    if (row.status === "Complete") entry.complete += row._count;
    else entry.pending += row._count;
    entry.total += row._count;
  }

  // Get recruiter names
  const recruiterIds = Array.from(recruiterMap.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: recruiterIds } },
    select: { id: true, firstName: true, lastName: true, employeeId: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u]));

  return recruiterIds
    .map((id) => {
      const stats = recruiterMap.get(id)!;
      const user = nameMap.get(id);
      return {
        recruiterId: id,
        name: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        employeeId: user?.employeeId ?? null,
        ...stats,
        completionRate: stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Zone Distribution — Section 21.4.4 */
export async function getZoneDistribution(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const data = await prisma.candidateReport.groupBy({
    by: ["zone"],
    where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    _count: true,
  });

  return data.map((row) => ({ zone: row.zone, count: row._count }));
}

/** Company-wise Volume — Section 21.4.5 */
export async function getCompanyVolume(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const data = await prisma.candidateReport.groupBy({
    by: ["companyId"],
    where: {
      deletedAt: null,
      companyId: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: true,
  });

  const companyIds = data.filter((d) => d.companyId).map((d) => d.companyId!);
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, name: true },
  });
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  return data
    .filter((d) => d.companyId)
    .map((row) => ({
      companyId: row.companyId!,
      name: companyMap.get(row.companyId!) ?? "Unknown",
      count: row._count,
    }))
    .sort((a, b) => b.count - a.count);
}

/** HR Feedback Breakdown — Section 21.4.7 */
export async function getHRFeedbackBreakdown(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const data = await prisma.candidateReport.groupBy({
    by: ["hrFeedback"],
    where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    _count: true,
  });

  return data.map((row) => ({
    feedback: row.hrFeedback ?? "No Feedback",
    count: row._count,
  }));
}

/** Revenue Over Time — Section 21.4.8 */
export async function getRevenueOverTime(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.candidateReport.findMany({
    where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true, invoiceAmountTotal: true, amountReceived: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, { invoiced: number; received: number; outstanding: number }>();
  for (const r of records) {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(key)) buckets.set(key, { invoiced: 0, received: 0, outstanding: 0 });
    const b = buckets.get(key)!;
    b.invoiced += Number(r.invoiceAmountTotal ?? 0);
    b.received += Number(r.amountReceived ?? 0);
    b.outstanding += Number(r.invoiceAmountTotal ?? 0) - Number(r.amountReceived ?? 0);
  }

  return Array.from(buckets.entries()).map(([month, data]) => ({ month, ...data }));
}

/** Recruiter Leaderboard — Section 21.4.3 */
export async function getRecruiterLeaderboard(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const data = await prisma.candidateReport.groupBy({
    by: ["recruiterId"],
    where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    _count: true,
  });

  const recruiterIds = data.map((d) => d.recruiterId);
  const users = await prisma.user.findMany({
    where: { id: { in: recruiterIds } },
    select: { id: true, firstName: true, lastName: true, employeeId: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u]));

  // Get completion counts
  const completeCounts = await prisma.candidateReport.groupBy({
    by: ["recruiterId"],
    where: { deletedAt: null, status: "Complete", createdAt: { gte: range.from, lte: range.to } },
    _count: true,
  });
  const completeMap = new Map(completeCounts.map((c) => [c.recruiterId, c._count]));

  // Get joined counts for conversion rate
  const joinedCounts = await prisma.candidateReport.groupBy({
    by: ["recruiterId"],
    where: {
      deletedAt: null,
      dateOfJoining: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: true,
  });
  const joinedMap = new Map(joinedCounts.map((j) => [j.recruiterId, j._count]));

  return data
    .map((row) => {
      const user = nameMap.get(row.recruiterId);
      const total = row._count;
      const complete = completeMap.get(row.recruiterId) ?? 0;
      const joined = joinedMap.get(row.recruiterId) ?? 0;
      return {
        rank: 0, // computed after sort
        recruiterId: row.recruiterId,
        name: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        employeeId: user?.employeeId ?? null,
        candidatesSourced: total,
        completionRate: total > 0 ? Math.round((complete / total) * 100) : 0,
        conversionRate: total > 0 ? Math.round((joined / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.candidatesSourced - a.candidatesSourced)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Payment Status Distribution — Section 21.4.8 */
export async function getPaymentStatusDistribution(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const data = await prisma.candidateReport.groupBy({
    by: ["paymentStatus"],
    where: {
      deletedAt: null,
      paymentStatus: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: true,
  });

  return data.map((row) => ({
    status: row.paymentStatus ?? "Unknown",
    count: row._count,
  }));
}

/** Company Revenue Table — Section 21.4.8 */
export async function getCompanyRevenueTable(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.candidateReport.findMany({
    where: {
      deletedAt: null,
      companyId: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    select: {
      companyId: true,
      invoiceAmountTotal: true,
      amountReceived: true,
      gstAmount: true,
      tdsAmount: true,
    },
  });

  const companyIds = [...new Set(records.map((r) => r.companyId).filter(Boolean))] as string[];
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, name: true },
  });
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  const agg = new Map<string, { invoiced: number; received: number; gst: number; tds: number }>();
  for (const r of records) {
    if (!r.companyId) continue;
    if (!agg.has(r.companyId)) agg.set(r.companyId, { invoiced: 0, received: 0, gst: 0, tds: 0 });
    const a = agg.get(r.companyId)!;
    a.invoiced += Number(r.invoiceAmountTotal ?? 0);
    a.received += Number(r.amountReceived ?? 0);
    a.gst += Number(r.gstAmount ?? 0);
    a.tds += Number(r.tdsAmount ?? 0);
  }

  return Array.from(agg.entries())
    .map(([id, data]) => ({
      companyId: id,
      name: companyMap.get(id) ?? "Unknown",
      totalInvoiced: data.invoiced,
      amountReceived: data.received,
      outstanding: data.invoiced - data.received,
      gst: data.gst,
      tds: data.tds,
    }))
    .sort((a, b) => b.totalInvoiced - a.totalInvoiced);
}

/** Profile Distribution — Section 21.4.6 */
export async function getProfileDistribution(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const data = await prisma.candidateReport.groupBy({
    by: ["profile"],
    where: {
      deletedAt: null,
      profile: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: true,
  });

  return data
    .map((row) => ({ profile: row.profile ?? "Unknown", count: row._count }))
    .sort((a, b) => b.count - a.count);
}

/** Notice Period Distribution — Section 21.4.9 */
export async function getNoticePeriodDistribution(period: string) {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.candidateReport.findMany({
    where: {
      deletedAt: null,
      noticePeriod: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    select: { noticePeriod: true },
  });

  const buckets: Record<string, number> = {
    Immediate: 0,
    "15 days": 0,
    "30 days": 0,
    "60 days": 0,
    "90 days": 0,
    "90+ days": 0,
  };

  for (const r of records) {
    const np = (r.noticePeriod ?? "").toLowerCase();
    let key = "90+ days";
    if (np.includes("immediate") || np === "0") key = "Immediate";
    else if (np.includes("15")) key = "15 days";
    else if (np.includes("30") || np.includes("1 month")) key = "30 days";
    else if (np.includes("60") || np.includes("2 month")) key = "60 days";
    else if (np.includes("90") || np.includes("3 month")) key = "90 days";
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

/** Employee Overview — Section 21.4.13 */
export async function getEmployeeOverview() {
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalActive, totalSuspended, recruiters, managers, presentToday, onLeaveToday] =
    await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE", role: { not: "ADMIN" } } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { role: "RECRUITER", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "REPORTING_MANAGER", status: "ACTIVE" } }),
      prisma.attendanceRecord.count({
        where: { date: today, status: { in: ["PRESENT_FULL", "PRESENT_HALF", "LATE"] } },
      }),
      prisma.leaveRequest.count({
        where: { startDate: { lte: today }, endDate: { gte: today }, status: "APPROVED" },
      }),
    ]);

  const absentToday = Math.max(0, totalActive - presentToday - onLeaveToday);

  return {
    totalActive,
    totalSuspended,
    recruiters,
    managers,
    total: totalActive + totalSuspended,
    presentToday,
    onLeaveToday,
    absentToday,
  };
}

/** Platform Health — Section 21.6 */
export async function getPlatformHealth() {
  const prisma = getPrisma();

  const [activeSessions, totalUsers, recentHealthLogs] = await Promise.all([
    prisma.session.count({ where: { revokedAt: null } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.platformHealthLog.findMany({
      orderBy: { recordedAt: "desc" },
      take: 20,
    }),
  ]);

  // Map health logs into metrics
  const metrics: Record<string, unknown> = {};
  for (const log of recentHealthLogs) {
    metrics[log.metricName] = log.metricValue;
  }

  return {
    activeSessions,
    totalUsers,
    metrics,
    uptime: process.uptime(),
  };
}

// ──────────────────────────────────────────────
//  NEW FUNCTIONS — appended below
// ──────────────────────────────────────────────

/** Age Distribution — §21.4.10 */
export async function getAgeDistribution(
  period: string,
): Promise<{ bucket: string; count: number }[]> {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.candidateReport.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
      dateOfBirth: { not: null },
    },
    select: { dateOfBirth: true },
  });

  const buckets: Record<string, number> = {
    "18-25": 0,
    "25-30": 0,
    "30-35": 0,
    "35-40": 0,
    "40+": 0,
  };

  const now = new Date();
  for (const r of records) {
    if (!r.dateOfBirth) continue;
    const age = Math.floor(
      (now.getTime() - r.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );
    if (age < 25) buckets["18-25"] = (buckets["18-25"] ?? 0) + 1;
    else if (age < 30) buckets["25-30"] = (buckets["25-30"] ?? 0) + 1;
    else if (age < 35) buckets["30-35"] = (buckets["30-35"] ?? 0) + 1;
    else if (age < 40) buckets["35-40"] = (buckets["35-40"] ?? 0) + 1;
    else buckets["40+"] = (buckets["40+"] ?? 0) + 1;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

/** Experience Distribution — §21.4.10 */
export async function getExperienceDistribution(
  period: string,
): Promise<{ bucket: string; count: number }[]> {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.candidateReport.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
      yearsOfExperience: { not: null },
    },
    select: { yearsOfExperience: true },
  });

  const buckets: Record<string, number> = {
    "0-1": 0,
    "1-3": 0,
    "3-5": 0,
    "5-10": 0,
    "10+": 0,
  };

  for (const r of records) {
    if (r.yearsOfExperience === null) continue;
    const yoe = Number(r.yearsOfExperience);
    if (yoe < 1) buckets["0-1"] = (buckets["0-1"] ?? 0) + 1;
    else if (yoe < 3) buckets["1-3"] = (buckets["1-3"] ?? 0) + 1;
    else if (yoe < 5) buckets["3-5"] = (buckets["3-5"] ?? 0) + 1;
    else if (yoe < 10) buckets["5-10"] = (buckets["5-10"] ?? 0) + 1;
    else buckets["10+"] = (buckets["10+"] ?? 0) + 1;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

// Helper: compute percentile from a sorted array of numbers
function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const loVal = sorted[lo] ?? 0;
  const hiVal = sorted[hi] ?? 0;
  if (lo === hi) return loVal;
  return loVal + (hiVal - loVal) * (idx - lo);
}

/** CTC Analysis — §21.4.11 */
export async function getCTCAnalysis(period: string): Promise<
  {
    profile: string;
    currentCtc: { min: number; max: number; median: number; q1: number; q3: number };
    expectedCtc: { min: number; max: number; median: number; q1: number; q3: number };
  }[]
> {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.candidateReport.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
      profile: { not: null },
    },
    select: { profile: true, currentCtc: true, expectedCtc: true },
  });

  // Group by profile
  const profileMap = new Map<
    string,
    { currentCtcValues: number[]; expectedCtcValues: number[]; count: number }
  >();

  for (const r of records) {
    const profile = r.profile ?? "Unknown";
    if (!profileMap.has(profile)) {
      profileMap.set(profile, { currentCtcValues: [], expectedCtcValues: [], count: 0 });
    }
    const entry = profileMap.get(profile)!;
    entry.count++;
    if (r.currentCtc !== null) entry.currentCtcValues.push(Number(r.currentCtc));
    if (r.expectedCtc !== null) entry.expectedCtcValues.push(Number(r.expectedCtc));
  }

  const calcStats = (
    values: number[],
  ): { min: number; max: number; median: number; q1: number; q3: number } => {
    if (values.length === 0) return { min: 0, max: 0, median: 0, q1: 0, q3: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    return {
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      median: computePercentile(sorted, 50),
      q1: computePercentile(sorted, 25),
      q3: computePercentile(sorted, 75),
    };
  };

  return Array.from(profileMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([profile, data]) => ({
      profile,
      currentCtc: calcStats(data.currentCtcValues),
      expectedCtc: calcStats(data.expectedCtcValues),
    }));
}

/** Activity Heatmap — §21.4.12 */
export async function getActivityHeatmap(
  period: string,
  recruiterId?: string,
): Promise<{ date: string; count: number }[]> {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const where: Prisma.CandidateReportWhereInput = {
    deletedAt: null,
    createdAt: { gte: range.from, lte: range.to },
  };
  if (recruiterId) {
    where.recruiterId = recruiterId;
  }

  const records = await prisma.candidateReport.findMany({
    where,
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const dayMap = new Map<string, number>();
  for (const r of records) {
    const key = r.createdAt.toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }

  return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
}

/** Live Metrics — §21.5 */
export async function getLiveMetrics(): Promise<{
  todaySubmissions: number;
  activeUsersNow: number;
  lastSubmission: { recruiterName: string; timestamp: Date } | null;
  todayRate: number;
  pendingCount: number;
}> {
  const prisma = getPrisma();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [todaySubmissions, activeUsersNow, lastRecord, pendingCount] = await Promise.all([
    prisma.candidateReport.count({
      where: { deletedAt: null, createdAt: { gte: todayStart } },
    }),
    prisma.session.count({ where: { revokedAt: null } }),
    prisma.candidateReport.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        recruiter: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.candidateReport.count({
      where: { deletedAt: null, status: "Pending" },
    }),
  ]);

  const hoursElapsed = Math.max(1, (now.getTime() - todayStart.getTime()) / (1000 * 60 * 60));
  const todayRate = Math.round((todaySubmissions / hoursElapsed) * 10) / 10;

  const lastSubmission = lastRecord
    ? {
        recruiterName: `${lastRecord.recruiter.firstName} ${lastRecord.recruiter.lastName}`,
        timestamp: lastRecord.createdAt,
      }
    : null;

  return {
    todaySubmissions,
    activeUsersNow,
    lastSubmission,
    todayRate,
    pendingCount,
  };
}

/** Expanded Platform Health — §21.6 */
export async function getExpandedPlatformHealth(): Promise<{
  activeSessions: { total: number; byRole: Record<string, number> };
  redis: { status: string; memoryUsedMb: number | null };
  bullmq: Record<string, { active: number; waiting: number; completed: number; failed: number }>;
  emailDelivery24h: { sent: number; failed: number; pending: number };
  uptime: number;
  cloudStorage: { activeFiles: number };
  scheduledJobs: { name: string; nextRun: Date | null }[];
}> {
  const prisma = getPrisma();

  // Active sessions by role
  const sessionsByRole = await prisma.session.findMany({
    where: { revokedAt: null },
    select: { user: { select: { role: true } } },
  });

  const byRole: Record<string, number> = { ADMIN: 0, RECRUITER: 0, REPORTING_MANAGER: 0 };
  for (const s of sessionsByRole) {
    const role = s.user.role as string;
    byRole[role] = (byRole[role] ?? 0) + 1;
  }
  const totalSessions = sessionsByRole.length;

  // Redis status
  let redisStatus = "disconnected"; // eslint-disable-line no-useless-assignment -- used in catch fallback
  let memoryUsedMb: number | null = null;
  try {
    const { getRedisClient } = await import("../config/redis.js");
    const redis = getRedisClient();
    await redis.ping();
    redisStatus = "connected";
    try {
      const info = await redis.info("memory");
      const match = /used_memory:(\d+)/.exec(info);
      if (match?.[1]) memoryUsedMb = Math.round((parseInt(match[1], 10) / 1024 / 1024) * 100) / 100;
    } catch {
      // memory info is non-critical
    }
  } catch {
    redisStatus = "disconnected";
  }

  // BullMQ job counts
  const { emailQueue } = await import("../jobs/email.queue.js");
  const { notificationQueue } = await import("../jobs/notification.queue.js");
  const { scheduledReportQueue } = await import("../jobs/scheduled-report.queue.js");
  const { archiveQueue } = await import("../jobs/archive.queue.js");
  const { storageQueue } = await import("../jobs/storage.queue.js");
  const { absentDetectionQueue } = await import("../jobs/absent-detection.queue.js");
  const { midnightResetQueue } = await import("../jobs/midnight-reset.queue.js");
  const { sessionExpiryQueue } = await import("../jobs/session-expiry.queue.js");

  const queuesMap = {
    email: emailQueue,
    notification: notificationQueue,
    "scheduled-report": scheduledReportQueue,
    archive: archiveQueue,
    storage: storageQueue,
    "absent-detection": absentDetectionQueue,
    "midnight-reset": midnightResetQueue,
    "session-expiry": sessionExpiryQueue,
  };

  const bullmqCounts: Record<
    string,
    { active: number; waiting: number; completed: number; failed: number }
  > = {};
  await Promise.all(
    Object.entries(queuesMap).map(async ([name, queue]) => {
      try {
        const counts = await queue.getJobCounts("active", "waiting", "completed", "failed");
        bullmqCounts[name] = {
          active: counts["active"] ?? 0,
          waiting: counts["waiting"] ?? 0,
          completed: counts["completed"] ?? 0,
          failed: counts["failed"] ?? 0,
        };
      } catch {
        bullmqCounts[name] = { active: 0, waiting: 0, completed: 0, failed: 0 };
      }
    }),
  );

  // Email delivery last 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [emailSent, emailFailed, emailPending] = await Promise.all([
    prisma.reportDeliveryLog.count({
      where: { sentAt: { gte: since24h }, deliveryStatus: "SUCCESS" },
    }),
    prisma.reportDeliveryLog.count({
      where: { sentAt: { gte: since24h }, deliveryStatus: "FAILED" },
    }),
    prisma.reportDeliveryLog.count({
      where: { deliveryStatus: "PENDING" },
    }),
  ]);

  // Cloud storage active files
  const activeFiles = await prisma.generatedReport.count({
    where: { isExpired: false },
  });

  // Scheduled jobs — get job schedulers for the scheduled-report queue
  let scheduledJobs: { name: string; nextRun: Date | null }[];
  try {
    const schedulers = await scheduledReportQueue.getJobSchedulers();
    scheduledJobs = schedulers.map((s) => ({
      name: String(s.id ?? "unknown"),
      nextRun: s.next ? new Date(s.next) : null,
    }));
  } catch {
    scheduledJobs = [];
  }

  return {
    activeSessions: { total: totalSessions, byRole },
    redis: { status: redisStatus, memoryUsedMb },
    bullmq: bullmqCounts,
    emailDelivery24h: { sent: emailSent, failed: emailFailed, pending: emailPending },
    uptime: process.uptime(),
    cloudStorage: { activeFiles },
    scheduledJobs,
  };
}

/** Employee Attendance Heatmap — §21.4.13 */
export async function getEmployeeAttendanceHeatmap(period: string): Promise<
  {
    employeeId: string;
    employeeName: string;
    days: { date: string; status: string }[];
  }[]
> {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: range.from, lte: range.to },
    },
    select: {
      userId: true,
      date: true,
      status: true,
      user: { select: { firstName: true, lastName: true, employeeId: true } },
    },
    orderBy: [{ userId: "asc" }, { date: "asc" }],
  });

  const userMap = new Map<
    string,
    { employeeName: string; employeeId: string; days: { date: string; status: string }[] }
  >();

  for (const r of records) {
    if (!userMap.has(r.userId)) {
      userMap.set(r.userId, {
        employeeName: `${r.user.firstName} ${r.user.lastName}`,
        employeeId: r.user.employeeId ?? r.userId,
        days: [],
      });
    }
    userMap.get(r.userId)!.days.push({
      date: r.date.toISOString().slice(0, 10),
      status: r.status as string,
    });
  }

  return Array.from(userMap.entries()).map(([, data]) => ({
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    days: data.days,
  }));
}

/** Employee Leave Utilization — §21.4.13 */
export async function getEmployeeLeaveUtilization(): Promise<
  {
    employeeId: string;
    name: string;
    leaveTypes: { type: string; used: number; allotted: number }[];
  }[]
> {
  const prisma = getPrisma();
  const currentYear = new Date().getFullYear();

  const balances = await prisma.leaveBalance.findMany({
    where: {
      year: currentYear,
      user: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      userId: true,
      used: true,
      totalAllotted: true,
      carriedForward: true,
      manualAdjustment: true,
      user: { select: { firstName: true, lastName: true, employeeId: true } },
      leaveType: { select: { name: true } },
    },
  });

  // Group by userId
  const userMap = new Map<
    string,
    {
      name: string;
      employeeId: string;
      leaveTypes: { type: string; used: number; allotted: number }[];
    }
  >();

  for (const b of balances) {
    if (!userMap.has(b.userId)) {
      userMap.set(b.userId, {
        name: `${b.user.firstName} ${b.user.lastName}`,
        employeeId: b.user.employeeId ?? b.userId,
        leaveTypes: [],
      });
    }
    const allotted = b.totalAllotted + b.carriedForward + b.manualAdjustment;
    userMap.get(b.userId)!.leaveTypes.push({
      type: b.leaveType.name,
      used: b.used,
      allotted,
    });
  }

  return Array.from(userMap.values());
}

/** Workforce Distribution — §21.4.13 */
export async function getWorkforceDistribution(): Promise<{
  byStatus: { active: number; suspended: number; deactivated: number };
  byRole: { recruiters: number; reportingManagers: number; admins: number };
  deviceBound: number;
  deviceUnbound: number;
}> {
  const prisma = getPrisma();

  const [active, suspended, deactivated, recruiters, reportingManagers, admins, deviceBound] =
    await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
      prisma.user.count({ where: { status: "SUSPENDED", deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: { not: null } } }),
      prisma.user.count({ where: { role: "RECRUITER", deletedAt: null } }),
      prisma.user.count({ where: { role: "REPORTING_MANAGER", deletedAt: null } }),
      prisma.user.count({ where: { role: "ADMIN", deletedAt: null } }),
      prisma.user.count({ where: { deviceId: { not: null }, deletedAt: null } }),
    ]);

  const totalNonDeleted = active + suspended;
  const deviceUnbound = Math.max(0, totalNonDeleted - deviceBound);

  return {
    byStatus: { active, suspended, deactivated },
    byRole: { recruiters, reportingManagers, admins },
    deviceBound,
    deviceUnbound,
  };
}

/** GST / TDS Summary — §21.4.8 */
export async function getGSTTDSSummary(period: string): Promise<{
  totalGST: number;
  totalTDS: number;
  totalInvoiced: number;
  netReceivable: number;
}> {
  const prisma = getPrisma();
  const range = getDateRange(period);

  const agg = await prisma.candidateReport.aggregate({
    _sum: {
      gstAmount: true,
      tdsAmount: true,
      invoiceAmountTotal: true,
    },
    where: {
      deletedAt: null,
      createdAt: { gte: range.from, lte: range.to },
    },
  });

  const totalGST = Number(agg._sum.gstAmount ?? 0);
  const totalTDS = Number(agg._sum.tdsAmount ?? 0);
  const totalInvoiced = Number(agg._sum.invoiceAmountTotal ?? 0);
  const netReceivable = totalInvoiced - totalTDS - totalGST;

  return { totalGST, totalTDS, totalInvoiced, netReceivable };
}

// ──────────────────────────────────────────────
//  Analytics Snapshots — Pre-computed aggregations
// ──────────────────────────────────────────────

/** Save a pre-computed analytics snapshot */
export async function saveSnapshot(
  snapshotType: string,
  periodStart: Date,
  periodEnd: Date,
  data: Record<string, unknown>,
) {
  const prisma = getPrisma();
  return prisma.analyticsSnapshot.create({
    data: { snapshotType, periodStart, periodEnd, data: data as Prisma.InputJsonValue },
  });
}

/** Get the latest snapshot of a given type */
export async function getLatestSnapshot(snapshotType: string) {
  const prisma = getPrisma();
  return prisma.analyticsSnapshot.findFirst({
    where: { snapshotType },
    orderBy: { computedAt: "desc" },
  });
}

/** List snapshots for a given type and period */
export async function listSnapshots(snapshotType: string, from?: Date, to?: Date) {
  const prisma = getPrisma();
  const where: Prisma.AnalyticsSnapshotWhereInput = { snapshotType };
  if (from || to) {
    where.periodStart = {};
    if (from) where.periodStart.gte = from;
    if (to) where.periodStart.lte = to;
  }
  return prisma.analyticsSnapshot.findMany({ where, orderBy: { periodStart: "desc" } });
}
