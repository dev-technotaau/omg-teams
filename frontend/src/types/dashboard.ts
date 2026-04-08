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
  /** Which period the target applies to — null if recruiter has no target */
  targetType: "DAILY" | "WEEKLY" | "MONTHLY" | null;
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
