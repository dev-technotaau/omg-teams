"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  Target,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Users,
  Trophy,
  MapPin,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import {
  PageHeader,
  StatsCard,
  Card,
  Progress,
  Badge,
  DashboardSkeleton,
  Tooltip,
  DataTable,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { cn } from "@/lib/utils";
import { OnboardingTour, DASHBOARD_TOUR_STEPS } from "@/components/onboarding-tour";
import { CANDIDATE_STATUS_COLORS } from "@/constants/statuses";
import { ROLES } from "@/constants/roles";
import { getGreeting } from "@/utils/greeting";
import type { DashboardStats, DailyTrend, StatusBreakdown } from "@/types/dashboard";
import type { AttendanceInfo } from "@/types/attendance";
import type { LeaveBalanceInfo } from "@/types/leave";

// ──────────────────────────────────────────────
//  Dashboard — Recruiter (Section 23.4.1) & RM (Section 23.4.2)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
//  Extended API types
// ──────────────────────────────────────────────

interface ExtendedWorkingHours {
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
}

interface StreakDay {
  date: string;
  status: "PRESENT_FULL" | "PRESENT_HALF" | "LATE" | "ABSENT" | "ON_LEAVE" | "WEEKEND" | "FUTURE";
}

interface UpcomingLeave {
  startDate: string;
  endDate: string;
  type: string;
}

interface ExtendedLeave {
  upcoming: UpcomingLeave[];
  pendingCount: number;
  nextLeave: { date: string; type: string } | null;
}

interface ZoneBreakdown {
  zone: string;
  count: number;
}

interface RecentSubmission {
  id: string;
  candidateName: string;
  status: string;
  zone: string;
  company: string | null;
  createdAt: string;
}

interface RecruiterSummary {
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
}

interface ExtendedDashboard {
  workingHours: ExtendedWorkingHours;
  streak: StreakDay[];
  monthlyAttendanceRate: number;
  leave: ExtendedLeave;
  zoneBreakdown: ZoneBreakdown[];
  recentSubmissions: RecentSubmission[];
  recruiterSummary?: RecruiterSummary[];
  teamMonthlyAttendanceRate?: number;
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

function minsToHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

const STREAK_DOT_CLASSES: Record<StreakDay["status"], string> = {
  PRESENT_FULL: "bg-success-500",
  PRESENT_HALF: "bg-success-300",
  LATE: "bg-warning-500",
  ABSENT: "bg-error-500",
  ON_LEAVE: "bg-info-500",
  WEEKEND: "bg-bg-muted",
  FUTURE: "bg-bg-muted",
};

const STREAK_LABEL: Record<StreakDay["status"], string> = {
  PRESENT_FULL: "Present (Full)",
  PRESENT_HALF: "Present (Half)",
  LATE: "Late",
  ABSENT: "Absent",
  ON_LEAVE: "On Leave",
  WEEKEND: "Weekend",
  FUTURE: "—",
};

// ──────────────────────────────────────────────
//  DataTable column definitions
// ──────────────────────────────────────────────

const recentSubmissionColumns: Column<RecentSubmission>[] = [
  {
    key: "candidateName",
    header: "Candidate",
    cell: (row) => <span className="text-text-primary font-medium">{row.candidateName}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <Badge
        variant="outline"
        size="sm"
        className={cn(CANDIDATE_STATUS_COLORS[row.status] ?? "bg-bg-muted", "border-0 text-white")}
      >
        {row.status.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    key: "company",
    header: "Company",
    cell: (row) => <span className="text-text-secondary text-xs">{row.company ?? "—"}</span>,
  },
  {
    key: "createdAt",
    header: "Date",
    cell: (row) => (
      <span className="text-text-muted text-xs">
        {new Date(row.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })}
      </span>
    ),
  },
];

const recruiterSummaryColumns: Column<RecruiterSummary>[] = [
  {
    key: "name",
    header: "Name",
    cell: (row) => <span className="text-text-primary font-medium">{row.name}</span>,
  },
  {
    key: "todayCount",
    header: "Today",
    align: "center",
    cell: (row) => <span className="text-text-primary">{row.todayCount}</span>,
  },
  {
    key: "weekCount",
    header: "Week",
    align: "center",
    cell: (row) => <span className="text-text-primary">{row.weekCount}</span>,
  },
  {
    key: "monthCount",
    header: "Month",
    align: "center",
    cell: (row) => <span className="text-text-primary">{row.monthCount}</span>,
  },
  {
    key: "completionRate",
    header: "Completion%",
    align: "center",
    cell: (row) => (
      <span
        className={cn(
          "font-medium",
          row.completionRate >= 75
            ? "text-success-600"
            : row.completionRate >= 50
              ? "text-warning-600"
              : "text-error-600",
        )}
      >
        {row.completionRate}%
      </span>
    ),
  },
  {
    key: "punchIn",
    header: "Punch In",
    cell: (row) => (
      <span className="text-text-secondary text-xs">
        {row.punchIn
          ? new Date(row.punchIn).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </span>
    ),
  },
  {
    key: "workingHours",
    header: "Hours",
    cell: (row) => (
      <span className="text-text-secondary text-xs">{minsToHM(row.workingHours)}</span>
    ),
  },
  {
    key: "attendanceStatus",
    header: "Status",
    cell: (row) => {
      const variantMap: Record<string, "success" | "warning" | "danger" | "info" | "outline"> = {
        PRESENT_FULL: "success",
        PRESENT_HALF: "success",
        LATE: "warning",
        ABSENT: "danger",
        ON_LEAVE: "info",
      };
      return (
        <Badge variant={variantMap[row.attendanceStatus] ?? "outline"} size="sm">
          {row.attendanceStatus.replace(/_/g, " ")}
        </Badge>
      );
    },
  },
  {
    key: "monthlyAttendanceRate",
    header: "Att%",
    align: "center",
    cell: (row) => (
      <span
        className={cn(
          "text-xs font-medium",
          row.monthlyAttendanceRate >= 90
            ? "text-success-600"
            : row.monthlyAttendanceRate >= 75
              ? "text-warning-600"
              : "text-error-600",
        )}
      >
        {row.monthlyAttendanceRate}%
      </span>
    ),
  },
];

// ──────────────────────────────────────────────
//  Page Component
// ──────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [attendance, setAttendance] = useState<AttendanceInfo | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceInfo[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [workingHours, setWorkingHours] = useState("0h 0m");
  const [extended, setExtended] = useState<ExtendedDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // §7 — RM team snapshot (Gaps 1-4)
  const [teamSnapshot, setTeamSnapshot] = useState<{
    teamAttendance: { present: number; absent: number; late: number; onLeave: number };
    teamLogins: Array<{ name: string; punchIn: string; isLate: boolean }>;
    topPerformer: { name: string; count: number } | null;
    ownMonthlyAttendanceRate: number;
    ownIsLate: boolean;
  } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsRes, attRes, leaveRes] = await Promise.allSettled([
        api.get<{ stats: DashboardStats }>("/dashboard/stats"),
        api.get<{ records: AttendanceInfo[] }>("/attendance/my?limit=1"),
        api.get<{ balances: LeaveBalanceInfo[] }>("/leaves/balances"),
      ]);

      if (statsRes.status === "fulfilled") {
        const s = statsRes.value.data.stats ?? statsRes.value.data;
        setStats({
          candidatesToday: s.candidatesToday ?? 0,
          candidatesWeek: s.candidatesWeek ?? 0,
          candidatesMonth: s.candidatesMonth ?? 0,
          completionRate: s.completionRate ?? 0,
          pendingReports: s.pendingReports ?? 0,
          targetValue: s.targetValue ?? 0,
          targetAchieved: s.targetAchieved ?? 0,
          activeRecruiters: s.activeRecruiters,
        });
      }
      if (attRes.status === "fulfilled") {
        const records = attRes.value.data.records;
        if (records && records.length > 0) {
          setAttendance(records[0]!);
        }
      }
      if (leaveRes.status === "fulfilled") {
        setLeaveBalances(leaveRes.value.data.balances ?? []);
      }

      // Fetch trend & breakdown (non-critical)
      try {
        const [trendRes, breakdownRes] = await Promise.allSettled([
          api.get<{ trend: DailyTrend[] }>("/dashboard/daily-trend"),
          api.get<{ breakdown: StatusBreakdown[] }>("/dashboard/status-breakdown"),
        ]);
        if (trendRes.status === "fulfilled") setDailyTrend(trendRes.value.data.trend ?? []);
        if (breakdownRes.status === "fulfilled")
          setStatusBreakdown(breakdownRes.value.data.breakdown ?? []);
      } catch {
        /* chart data is supplementary */
      }

      // §7 — RM team snapshot
      try {
        const snapRes = await api.get("/dashboard/rm-team-snapshot");
        setTeamSnapshot(snapRes.data as typeof teamSnapshot);
      } catch {
        /* RM-only endpoint; silently fail for other roles */
      }

      // Extended dashboard data
      try {
        const extRes = await api.get<{ data: ExtendedDashboard }>("/dashboard/extended");
        setExtended(extRes.data.data ?? null);
      } catch {
        /* extended data is supplementary */
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // Live working hours counter
  useEffect(() => {
    if (!attendance?.punchInTime) return;
    const updateTimer = (): void => {
      const diff = Date.now() - new Date(attendance.punchInTime!).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setWorkingHours(`${h}h ${m}m`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [attendance?.punchInTime]);

  if (authLoading || isLoading) return <DashboardSkeleton />;

  const isRM = user?.role === ROLES.REPORTING_MANAGER;
  const greeting = getGreeting(user?.name);
  const s = stats ?? {
    candidatesToday: 0,
    candidatesWeek: 0,
    candidatesMonth: 0,
    completionRate: 0,
    pendingReports: 0,
    targetValue: 0,
    targetAchieved: 0,
  };

  // Derive leave balance display
  const leaveTypes =
    leaveBalances.length > 0
      ? leaveBalances.map((b) => ({
          label: b.name,
          code: b.code,
          used: b.used,
          total: b.total,
        }))
      : [
          { label: "Casual Leave", code: "CL", used: 0, total: 12 },
          { label: "Sick Leave", code: "SL", used: 0, total: 8 },
          { label: "Earned Leave", code: "EL", used: 0, total: 15 },
        ];

  // Daily trend chart — simple bar chart
  const maxTrend = Math.max(...dailyTrend.map((d) => d.count), 1);

  // Zone distribution max for bar scaling
  const maxZoneCount = Math.max(...(extended?.zoneBreakdown.map((z) => z.count) ?? [1]), 1);

  // Recent submissions — cap at 10
  const recentSubmissions = (extended?.recentSubmissions ?? []).slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title={isRM ? "Team Dashboard" : "My Dashboard"} description={greeting} />

      {/* Stats Cards */}
      <div data-tour="stats-cards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label={isRM ? "Team Candidates Today" : "Candidates Today"}
          value={s.candidatesToday}
          icon={FileText}
          description={`${s.candidatesWeek} this week \u00b7 ${s.candidatesMonth} this month`}
        />
        <StatsCard label="Completion Rate" value={`${s.completionRate}%`} icon={CheckCircle2} />
        <StatsCard label="Pending Reports" value={s.pendingReports} icon={Clock} />
        <StatsCard
          label={isRM ? "Active Recruiters" : "Target Progress"}
          value={isRM ? (s.activeRecruiters ?? 0) : `${s.targetAchieved}/${s.targetValue}`}
          icon={isRM ? TrendingUp : Target}
        />
      </div>

      {/* Attendance & Leave */}
      <div data-tour="quick-actions" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Attendance Card */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Today&apos;s Attendance</h3>
          </Card.Header>
          <Card.Body>
            <div className="flex items-center gap-4">
              <div className="bg-success-100 flex h-12 w-12 items-center justify-center rounded-full">
                <Calendar size={24} className="text-success-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-text-primary text-lg font-bold">{workingHours}</p>
                  {/* Gap 3: Late indicator */}
                  {teamSnapshot?.ownIsLate && (
                    <Badge variant="warning" size="sm">
                      Late
                    </Badge>
                  )}
                </div>
                <p className="text-text-muted text-xs">
                  {attendance?.punchInTime
                    ? `Punched in at ${new Date(attendance.punchInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                    : "Not punched in yet"}
                </p>
                {/* Gap 4: Monthly attendance rate — RM via teamSnapshot; all users via extended */}
                {isRM && teamSnapshot ? (
                  <p className="text-text-secondary mt-1 text-xs">
                    Monthly attendance:{" "}
                    <span className="font-medium">{teamSnapshot.ownMonthlyAttendanceRate}%</span>
                  </p>
                ) : extended?.monthlyAttendanceRate != null ? (
                  <p className="text-text-secondary mt-1 text-xs">
                    Attendance:{" "}
                    <span className="font-medium">{extended.monthlyAttendanceRate}%</span> this
                    month
                  </p>
                ) : null}
              </div>
            </div>

            {/* 14-day streak dots */}
            <div className="mt-4 flex gap-1">
              {extended?.streak && extended.streak.length > 0
                ? extended.streak.map((day) => (
                    <Tooltip
                      key={day.date}
                      content={
                        <span>
                          {new Date(day.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · {STREAK_LABEL[day.status]}
                        </span>
                      }
                    >
                      <div
                        className={cn(
                          "h-3 w-3 cursor-default rounded-full",
                          STREAK_DOT_CLASSES[day.status],
                        )}
                      />
                    </Tooltip>
                  ))
                : Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-3 w-3 rounded-full",
                        i < 7 ? "bg-success-500" : "bg-bg-muted",
                      )}
                    />
                  ))}
            </div>

            {/* Working hours breakdown from extended data */}
            {extended?.workingHours && (
              <p className="text-text-muted mt-2 text-xs">
                Yesterday:{" "}
                <span className="text-text-secondary font-medium">
                  {minsToHM(extended.workingHours.yesterday)}
                </span>{" "}
                &middot; This week:{" "}
                <span className="text-text-secondary font-medium">
                  {minsToHM(extended.workingHours.thisWeek)}
                </span>{" "}
                &middot; This month:{" "}
                <span className="text-text-secondary font-medium">
                  {minsToHM(extended.workingHours.thisMonth)}
                </span>
              </p>
            )}
          </Card.Body>
        </Card>

        {/* Leave Balance Card */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Leave Balance</h3>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              {leaveTypes.map((lv) => {
                const remaining = lv.total - lv.used;
                const percentage = lv.total > 0 ? (remaining / lv.total) * 100 : 0;
                return (
                  <div key={lv.code} className="flex items-center justify-between">
                    <span className="text-text-secondary text-sm">
                      {lv.label}{" "}
                      <Badge variant="outline" size="sm">
                        {lv.code}
                      </Badge>
                    </span>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={percentage}
                        size="sm"
                        variant={
                          percentage > 50 ? "primary" : percentage > 25 ? "warning" : "danger"
                        }
                        className="w-24"
                      />
                      <span className="text-text-primary text-xs font-medium">
                        {remaining}/{lv.total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Extended leave info */}
            {extended?.leave && (
              <div className="border-border-default mt-4 space-y-2 border-t pt-3">
                {/* Pending requests */}
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">Pending requests</span>
                  <a
                    href="/leaves?tab=pending"
                    className="text-primary-500 hover:text-primary-600 text-xs font-medium underline-offset-2 hover:underline"
                  >
                    {extended.leave.pendingCount} pending
                  </a>
                </div>

                {/* Next leave */}
                {extended.leave.nextLeave && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted text-xs">Next leave</span>
                    <span className="text-text-secondary text-xs">
                      {new Date(extended.leave.nextLeave.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      <span className="text-text-muted">({extended.leave.nextLeave.type})</span>
                    </span>
                  </div>
                )}

                {/* Upcoming approved leaves (max 3) */}
                {extended.leave.upcoming.length > 0 && (
                  <div className="mt-1 space-y-1">
                    <p className="text-text-muted text-xs font-medium">Upcoming</p>
                    {extended.leave.upcoming.slice(0, 3).map((lv, i) => (
                      <div
                        key={i}
                        className="bg-info-50 border-info-100 flex items-center justify-between rounded-md border px-2 py-1 text-xs"
                      >
                        <span className="text-info-700 font-medium">{lv.type}</span>
                        <span className="text-text-secondary">
                          {new Date(lv.startDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                          {lv.startDate !== lv.endDate && (
                            <>
                              {" "}
                              &ndash;{" "}
                              {new Date(lv.endDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* §7 — RM Team Snapshot (Gaps 1, 2) */}
      {isRM && teamSnapshot && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Team attendance summary cards */}
          <Card>
            <Card.Header>
              <h3 className="text-text-secondary flex items-center gap-2 text-sm font-medium">
                <Users size={16} /> Team Attendance Today
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Present",
                    value: teamSnapshot.teamAttendance.present,
                    color: "text-success-500",
                  },
                  {
                    label: "Absent",
                    value: teamSnapshot.teamAttendance.absent,
                    color: "text-error-500",
                  },
                  {
                    label: "Late",
                    value: teamSnapshot.teamAttendance.late,
                    color: "text-warning-500",
                  },
                  {
                    label: "On Leave",
                    value: teamSnapshot.teamAttendance.onLeave,
                    color: "text-info-500",
                  },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className={cn("text-2xl font-bold", item.color)}>{item.value}</p>
                    <p className="text-text-muted text-xs">{item.label}</p>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>

          {/* Team logins today */}
          <Card>
            <Card.Header>
              <h3 className="text-text-secondary text-sm font-medium">Team Logins</h3>
            </Card.Header>
            <Card.Body>
              {teamSnapshot.teamLogins.length > 0 ? (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {teamSnapshot.teamLogins.map((login, i) => (
                    <div
                      key={i}
                      className="hover:bg-bg-hover flex items-center justify-between rounded-sm px-2 py-1 text-xs"
                    >
                      <span className="text-text-primary font-medium">{login.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-muted">
                          {new Date(login.punchIn).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {login.isLate && <AlertTriangle size={12} className="text-warning-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-xs">No team logins yet</p>
              )}
            </Card.Body>
          </Card>

          {/* Top performer */}
          <Card>
            <Card.Header>
              <h3 className="text-text-secondary flex items-center gap-2 text-sm font-medium">
                <Trophy size={16} /> Top Performer (This Month)
              </h3>
            </Card.Header>
            <Card.Body>
              {teamSnapshot.topPerformer ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-text-primary text-lg font-bold">
                    {teamSnapshot.topPerformer.name}
                  </p>
                  <Badge variant="primary">{teamSnapshot.topPerformer.count} candidates</Badge>
                </div>
              ) : (
                <p className="text-text-muted py-4 text-center text-xs">No data yet</p>
              )}
            </Card.Body>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Daily Trend Chart */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">
              {isRM ? "Team Daily Trend" : "Daily Trend"} (Last 14 Days)
            </h3>
          </Card.Header>
          <Card.Body>
            {dailyTrend.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-text-muted text-sm">No trend data available yet</p>
              </div>
            ) : (
              <div className="flex h-48 items-end gap-1">
                {dailyTrend.map((d) => {
                  const height = maxTrend > 0 ? (d.count / maxTrend) * 100 : 0;
                  return (
                    <div key={d.date} className="group relative flex flex-1 flex-col items-center">
                      <div
                        className="bg-primary-500 hover:bg-primary-600 w-full rounded-t transition-all"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-text-muted mt-1 text-[9px]">
                        {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric" })}
                      </span>
                      {/* Tooltip */}
                      <div className="bg-bg-surface-raised absolute -top-8 hidden rounded-sm px-2 py-1 text-xs shadow-sm group-hover:block">
                        {d.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Status Breakdown</h3>
          </Card.Header>
          <Card.Body>
            {statusBreakdown.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-text-muted text-sm">No status data available yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statusBreakdown.map((sb) => (
                  <div key={sb.status}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-text-secondary text-xs">
                        {sb.status.replace("_", " ")}
                      </span>
                      <span className="text-text-primary text-xs font-medium">
                        {sb.count} ({sb.percentage}%)
                      </span>
                    </div>
                    <div className="bg-bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          CANDIDATE_STATUS_COLORS[sb.status] ?? "bg-primary-300",
                        )}
                        style={{ width: `${sb.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Zone Distribution */}
      {extended?.zoneBreakdown && extended.zoneBreakdown.length > 0 && (
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary flex items-center gap-2 text-sm font-medium">
              <MapPin size={16} /> Zone Distribution
            </h3>
          </Card.Header>
          <Card.Body>
            <div className="space-y-2.5">
              {extended.zoneBreakdown.map((z) => {
                const widthPct = maxZoneCount > 0 ? (z.count / maxZoneCount) * 100 : 0;
                return (
                  <div key={z.zone} className="flex items-center gap-3">
                    <span className="text-text-secondary w-28 shrink-0 truncate text-xs font-medium">
                      {z.zone}
                    </span>
                    <div
                      className="bg-bg-muted flex-1 overflow-hidden rounded-full"
                      style={{ height: "8px" }}
                    >
                      <div
                        className="bg-primary-400 h-full rounded-full transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="text-text-muted w-8 shrink-0 text-right text-xs">
                      {z.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Recent Submissions — recruiters only */}
      {!isRM && recentSubmissions.length > 0 && (
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary flex items-center gap-2 text-sm font-medium">
              <ClipboardList size={16} /> Recent Submissions
            </h3>
          </Card.Header>
          <Card.Body>
            <DataTable<RecentSubmission>
              columns={recentSubmissionColumns}
              data={recentSubmissions}
              compact
              getRowId={(row) => row.id}
              emptyTitle="No submissions yet"
              emptyDescription="Your recent candidate submissions will appear here."
            />
          </Card.Body>
        </Card>
      )}

      {/* RM Recruiter Summary Table */}
      {isRM && extended?.recruiterSummary && extended.recruiterSummary.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h3 className="text-text-secondary flex items-center gap-2 text-sm font-medium">
                <Users size={16} /> Recruiter Summary
              </h3>
              {extended.teamMonthlyAttendanceRate != null && (
                <span className="text-text-secondary text-xs">
                  Team attendance this month:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      extended.teamMonthlyAttendanceRate >= 90
                        ? "text-success-600"
                        : extended.teamMonthlyAttendanceRate >= 75
                          ? "text-warning-600"
                          : "text-error-600",
                    )}
                  >
                    {extended.teamMonthlyAttendanceRate}%
                  </span>
                </span>
              )}
            </div>
          </Card.Header>
          <Card.Body>
            <DataTable<RecruiterSummary>
              columns={recruiterSummaryColumns}
              data={extended.recruiterSummary}
              compact
              getRowId={(row) => row.id}
              emptyTitle="No recruiter data"
              emptyDescription="Recruiter activity will appear here once data is available."
            />
          </Card.Body>
        </Card>
      )}

      {/* Onboarding Tour — first-time users */}
      <OnboardingTour tourId="dashboard" steps={DASHBOARD_TOUR_STEPS} />
    </div>
  );
}
