// ──────────────────────────────────────────────
//  Analytics Types — §21
// ──────────────────────────────────────────────

export type KpiData = Record<string, { value: number; change?: number }>;

export interface FunnelItem {
  stage: string;
  count: number;
  pctOfPrev: number;
  pctOfTop: number;
}

export interface TrendItem {
  date: string;
  sourced: number;
  cvShared: number;
  joined: number;
}

export interface RecruiterPerformanceItem {
  name: string;
  complete: number;
  pending: number;
  total: number;
  completionRate: number;
}

export interface ZoneDistributionItem {
  zone: string;
  count: number;
}

export interface CompanyVolumeItem {
  name: string;
  count: number;
}

export interface FeedbackBreakdownItem {
  feedback: string;
  count: number;
}

export interface RevenueItem {
  month: string;
  invoiced: number;
  received: number;
  outstanding: number;
}

export interface EmployeeOverview {
  totalActive: number;
  totalSuspended: number;
  recruiters: number;
  managers: number;
  presentToday: number;
  onLeaveToday: number;
  absentToday: number;
}

export interface LeaderboardItem {
  rank: number;
  name: string;
  employeeId: string | null;
  candidatesSourced: number;
  completionRate: number;
  conversionRate: number;
}

export interface PaymentStatusItem {
  status: string;
  count: number;
}

export interface CompanyRevenueItem {
  name: string;
  totalInvoiced: number;
  amountReceived: number;
  outstanding: number;
  gst: number;
  tds: number;
}

export interface ProfileDistributionItem {
  profile: string;
  count: number;
}

export interface NoticePeriodItem {
  bucket: string;
  count: number;
}

// §21.4.10
export interface AgeDistributionItem {
  bucket: string;
  count: number;
}

export interface ExperienceDistributionItem {
  bucket: string;
  count: number;
}

// §21.4.11
export interface CTCAnalysisItem {
  profile: string;
  currentCtc: { min: number; max: number; median: number; q1: number; q3: number };
  expectedCtc: { min: number; max: number; median: number; q1: number; q3: number };
}

// §21.4.12
export interface ActivityHeatmapItem {
  date: string;
  count: number;
}

// §21.4.13
export interface EmployeeAttendanceHeatmapEntry {
  employeeId: string;
  employeeName: string;
  days: { date: string; status: string }[];
}

export interface EmployeeLeaveUtilizationEntry {
  employeeId: string;
  name: string;
  leaveTypes: { type: string; used: number; allotted: number }[];
}

export interface WorkforceDistribution {
  byStatus: { active: number; suspended: number; deactivated: number };
  byRole: { recruiters: number; reportingManagers: number; admins: number };
  deviceBound: number;
  deviceUnbound: number;
}

// §21.4.8
export interface GSTTDSSummary {
  totalGST: number;
  totalTDS: number;
  totalInvoiced: number;
  netReceivable: number;
}

// §21.5
export interface LiveMetrics {
  todaySubmissions: number;
  activeUsersNow: number;
  lastSubmission: { recruiterName: string; timestamp: string } | null;
  todayRate: number;
  pendingCount: number;
}

// §21.6
export interface PlatformHealth {
  activeSessions: { total: number; byRole: Record<string, number> };
  redis: { status: string; memoryUsedMb: number | null };
  bullmq: Record<string, { active: number; waiting: number; completed: number; failed: number }>;
  emailDelivery24h: { sent: number; failed: number; pending: number };
  uptime: number;
  cloudStorage: { activeFiles: number };
  scheduledJobs: { name: string; nextRun: string | null }[];
}
