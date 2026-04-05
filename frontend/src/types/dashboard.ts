// ──────────────────────────────────────────────
//  Dashboard Types
// ──────────────────────────────────────────────

export interface DashboardStats {
  candidatesToday: number;
  candidatesWeek: number;
  candidatesMonth: number;
  completionRate: number;
  pendingReports: number;
  targetValue: number;
  targetAchieved: number;
  activeRecruiters?: number;
}

export interface DailyTrend {
  date: string;
  count: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}
