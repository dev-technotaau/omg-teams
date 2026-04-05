import { api } from "@/lib/api";
import type {
  KpiData,
  FunnelItem,
  TrendItem,
  RecruiterPerformanceItem,
  ZoneDistributionItem,
  CompanyVolumeItem,
  FeedbackBreakdownItem,
  RevenueItem,
  EmployeeOverview,
  LeaderboardItem,
  PaymentStatusItem,
  CompanyRevenueItem,
  ProfileDistributionItem,
  NoticePeriodItem,
  AgeDistributionItem,
  ExperienceDistributionItem,
  CTCAnalysisItem,
  ActivityHeatmapItem,
  EmployeeAttendanceHeatmapEntry,
  EmployeeLeaveUtilizationEntry,
  WorkforceDistribution,
  GSTTDSSummary,
  LiveMetrics,
  PlatformHealth,
} from "@/types/analytics";

// §21.2 — KPI Summary
export async function getKPISummary(period: string, from?: string, to?: string) {
  const params: Record<string, string> = { period };
  if (from) params["from"] = from;
  if (to) params["to"] = to;
  const res = await api.get<{ data: KpiData }>("/analytics/kpi", { params });
  return res.data.data;
}

// §21.3 — Pipeline Funnel
export async function getPipelineFunnel(period: string) {
  const res = await api.get<{ data: FunnelItem[] }>("/analytics/funnel", { params: { period } });
  return res.data.data;
}

// §21.4.1 — Recruitment Trend
export async function getRecruitmentTrend(period: string, granularity = "daily") {
  const res = await api.get<{ data: TrendItem[] }>("/analytics/recruitment-trend", {
    params: { period, granularity },
  });
  return res.data.data;
}

// §21.4.2 — Recruiter Performance
export async function getRecruiterPerformance(period: string) {
  const res = await api.get<{ data: RecruiterPerformanceItem[] }>(
    "/analytics/recruiter-performance",
    { params: { period } },
  );
  return res.data.data;
}

// §21.4.3 — Leaderboard
export async function getRecruiterLeaderboard(period: string) {
  const res = await api.get<{ data: LeaderboardItem[] }>("/analytics/recruiter-leaderboard", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.4 — Zone Distribution
export async function getZoneDistribution(period: string) {
  const res = await api.get<{ data: ZoneDistributionItem[] }>("/analytics/zone-distribution", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.5 — Company Volume
export async function getCompanyVolume(period: string) {
  const res = await api.get<{ data: CompanyVolumeItem[] }>("/analytics/company-volume", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.6 — Profile Distribution
export async function getProfileDistribution(period: string) {
  const res = await api.get<{ data: ProfileDistributionItem[] }>(
    "/analytics/profile-distribution",
    { params: { period } },
  );
  return res.data.data;
}

// §21.4.7 — HR Feedback Breakdown
export async function getHRFeedbackBreakdown(period: string) {
  const res = await api.get<{ data: FeedbackBreakdownItem[] }>("/analytics/hr-feedback", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.8 — Revenue Over Time
export async function getRevenueOverTime(period: string) {
  const res = await api.get<{ data: RevenueItem[] }>("/analytics/revenue", { params: { period } });
  return res.data.data;
}

// §21.4.8 — Payment Status
export async function getPaymentStatusDistribution(period: string) {
  const res = await api.get<{ data: PaymentStatusItem[] }>("/analytics/payment-status", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.8 — Company Revenue Table
export async function getCompanyRevenueTable(period: string) {
  const res = await api.get<{ data: CompanyRevenueItem[] }>("/analytics/company-revenue", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.8 — GST & TDS Summary
export async function getGSTTDSSummary(period: string) {
  const res = await api.get<{ data: GSTTDSSummary }>("/analytics/gst-tds-summary", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.9 — Notice Period
export async function getNoticePeriodDistribution(period: string) {
  const res = await api.get<{ data: NoticePeriodItem[] }>("/analytics/notice-period", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.10 — Age Distribution
export async function getAgeDistribution(period: string) {
  const res = await api.get<{ data: AgeDistributionItem[] }>("/analytics/age-distribution", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.10 — Experience Distribution
export async function getExperienceDistribution(period: string) {
  const res = await api.get<{ data: ExperienceDistributionItem[] }>(
    "/analytics/experience-distribution",
    { params: { period } },
  );
  return res.data.data;
}

// §21.4.11 — CTC Analysis
export async function getCTCAnalysis(period: string) {
  const res = await api.get<{ data: CTCAnalysisItem[] }>("/analytics/ctc-analysis", {
    params: { period },
  });
  return res.data.data;
}

// §21.4.12 — Activity Heatmap
export async function getActivityHeatmap(period: string, recruiterId?: string) {
  const params: Record<string, string> = { period };
  if (recruiterId) params.recruiterId = recruiterId;
  const res = await api.get<{ data: ActivityHeatmapItem[] }>("/analytics/activity-heatmap", {
    params,
  });
  return res.data.data;
}

// §21.4.13 — Employee Overview
export async function getEmployeeOverview() {
  const res = await api.get<{ data: EmployeeOverview }>("/analytics/employee-overview");
  return res.data.data;
}

// §21.4.13 — Employee Attendance Heatmap
export async function getEmployeeAttendanceHeatmap(period: string) {
  const res = await api.get<{ data: EmployeeAttendanceHeatmapEntry[] }>(
    "/analytics/employee-attendance-heatmap",
    { params: { period } },
  );
  return res.data.data;
}

// §21.4.13 — Employee Leave Utilization
export async function getEmployeeLeaveUtilization() {
  const res = await api.get<{ data: EmployeeLeaveUtilizationEntry[] }>(
    "/analytics/employee-leave-utilization",
  );
  return res.data.data;
}

// §21.4.13 — Workforce Distribution
export async function getWorkforceDistribution() {
  const res = await api.get<{ data: WorkforceDistribution }>("/analytics/workforce-distribution");
  return res.data.data;
}

// §21.5 — Live Metrics
export async function getLiveMetrics() {
  const res = await api.get<{ data: LiveMetrics }>("/analytics/live-metrics");
  return res.data.data;
}

// §21.6 — Platform Health
export async function getPlatformHealth() {
  const res = await api.get<{ data: PlatformHealth }>("/analytics/platform-health");
  return res.data.data;
}
