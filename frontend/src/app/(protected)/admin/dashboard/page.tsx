"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarOff,
  CheckSquare,
  Clock,
  Copy,
  CreditCard,
  IndianRupee,
  FileText,
  Mail,
  Percent,
  Receipt,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { getAdminTaskStats } from "@/services/task.service";
import { useAuth } from "@/contexts/auth";
import { getGreeting } from "@/utils/greeting";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge, Select } from "@/components/ui";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { PasskeyNudge } from "@/components/passkey-nudge";

// ──────────────────────────────────────────────
//  Admin Dashboard — Spec Section 6.2
//  Gap 4: Dynamic data fetching
//  Gap 12: Today's logins live list
//  Gap 13: Conversion rate KPI
// ──────────────────────────────────────────────

interface AdminStats {
  attendance: { present: number; absent: number; late: number; onLeave: number; halfDay: number };
  kpis: {
    candidatesToday: number;
    candidatesMonth: number;
    pendingReports: number;
    outstandingAmount: number;
    conversionRate: number;
  };
  logins: Array<{
    id: string;
    loginTime: string;
    employeeName: string;
    role: string;
    isLate: boolean;
    /** Number of successful login events today for this user — when >1
     *  the UI surfaces a "N sessions" badge so admins can see at a glance
     *  who's been logging out and back in. */
    sessionCount: number;
  }>;
  notLoggedIn: Array<{
    id: string;
    employeeName: string;
    role: string;
  }>;
  pendingActions: {
    leaveRequests: number;
    kycVerifications: number;
    suspendedAccounts: number;
    unresolvedDuplicates: number;
    overdueInvoices: number;
    unpaidInvoices: number;
    pendingOfferLetters: number;
  };
}

interface MonthlyAttendance {
  currentRate: number;
  lastMonthRate: number;
  change: number;
}

const DATE_RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "15days", label: "Last 15 Days" },
  { value: "month", label: "This Month" },
  { value: "3months", label: "Last 3 Months" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const greeting = getGreeting(user?.name);
  const [dateRange, setDateRange] = useState("today");

  const statsQuery = useQuery({
    queryKey: [...qk.dashboard.admin(), "stats", dateRange] as const,
    queryFn: async () => {
      const r = await api.get<{ stats: AdminStats }>(
        `/dashboard/admin-stats?range=${dateRange}`,
      );
      return r.data.stats;
    },
  });
  const monthlyQuery = useQuery({
    queryKey: [...qk.dashboard.admin(), "monthly-attendance"] as const,
    queryFn: async () => {
      const r = await api.get<MonthlyAttendance>("/dashboard/monthly-attendance");
      return r.data;
    },
  });
  // §Task — task stats (independent so a slow task query doesn't gate the rest)
  const taskStatsQuery = useQuery({
    queryKey: qk.tasks.stats(),
    queryFn: getAdminTaskStats,
    staleTime: 60_000,
  });
  const stats = statsQuery.data ?? null;
  const monthlyAttendance = monthlyQuery.data ?? null;
  const taskStats = taskStatsQuery.data;
  const isLoading = statsQuery.isLoading || monthlyQuery.isLoading;

  if (authLoading || isLoading) return <DashboardSkeleton />;

  const a = stats?.attendance ?? { present: 0, absent: 0, late: 0, onLeave: 0, halfDay: 0 };
  const k = stats?.kpis ?? {
    candidatesToday: 0,
    candidatesMonth: 0,
    pendingReports: 0,
    outstandingAmount: 0,
    conversionRate: 0,
  };
  const pa = stats?.pendingActions ?? {
    leaveRequests: 0,
    kycVerifications: 0,
    suspendedAccounts: 0,
    unresolvedDuplicates: 0,
    overdueInvoices: 0,
    unpaidInvoices: 0,
    pendingOfferLetters: 0,
  };

  const attendance = [
    {
      label: "Present Today",
      value: a.present,
      icon: <UserCheck size={20} />,
      color: "text-success-500",
      bg: "bg-success-100",
    },
    {
      label: "Absent Today",
      value: a.absent,
      icon: <CalendarOff size={20} />,
      color: "text-error-500",
      bg: "bg-error-100",
    },
    {
      label: "Late Today",
      value: a.late,
      icon: <Clock size={20} />,
      color: "text-warning-500",
      bg: "bg-warning-100",
    },
    {
      label: "On Leave",
      value: a.onLeave,
      icon: <CalendarOff size={20} />,
      color: "text-info-500",
      bg: "bg-info-100",
    },
    {
      label: "Half Day",
      value: a.halfDay,
      icon: <Timer size={20} />,
      color: "text-accent-amber-warm",
      bg: "bg-primary-50",
    },
  ];

  const kpis = [
    {
      label: "Candidates Today",
      value: k.candidatesToday,
      icon: <FileText size={20} />,
      color: "text-primary-500",
    },
    {
      label: "This Month",
      value: k.candidatesMonth,
      icon: <TrendingUp size={20} />,
      color: "text-accent-blue",
    },
    {
      label: "Pending",
      value: k.pendingReports,
      icon: <AlertCircle size={20} />,
      color: "text-warning-500",
    },
    {
      label: "Outstanding",
      value: `₹${k.outstandingAmount.toLocaleString("en-IN")}`,
      icon: <IndianRupee size={20} />,
      color: "text-error-500",
    },
    {
      label: "Conversion Rate",
      value: `${k.conversionRate}%`,
      icon: <Percent size={20} />,
      color: "text-success-500",
    },
  ];

  const pendingActions = [
    {
      label: "Leave Requests",
      count: pa.leaveRequests,
      href: "/admin/leaves",
      icon: <AlertCircle size={16} />,
      color: "text-warning-500",
    },
    {
      label: "KYC Verifications",
      count: pa.kycVerifications,
      href: "/admin/documents",
      icon: <FileText size={16} />,
      color: "text-info-500",
    },
    {
      label: "Suspended Accounts",
      count: pa.suspendedAccounts,
      href: "/admin/users",
      icon: <Users size={16} />,
      color: "text-error-500",
    },
    {
      label: "Unresolved Duplicates",
      count: pa.unresolvedDuplicates,
      href: "/admin/duplicates",
      icon: <Copy size={16} />,
      color: "text-warning-500",
    },
    {
      label: "Overdue Invoices",
      count: pa.overdueInvoices,
      href: "/admin/reports",
      icon: <Receipt size={16} />,
      color: "text-error-500",
    },
    {
      label: "Unpaid Invoices",
      count: pa.unpaidInvoices,
      href: "/admin/reports",
      icon: <CreditCard size={16} />,
      color: "text-warning-500",
    },
    {
      label: "Pending Offer Letters",
      count: pa.pendingOfferLetters,
      href: "/admin/offer-letters",
      icon: <Mail size={16} />,
      color: "text-info-500",
    },
    // §Task — submissions awaiting admin review + overdue tasks
    {
      label: "Tasks Awaiting Review",
      count: taskStats?.awaitingReview ?? 0,
      href: "/admin/tasks?assignmentStatus=SUBMITTED",
      icon: <CheckSquare size={16} />,
      color: "text-info-500",
    },
    {
      label: "Overdue Tasks",
      count: taskStats?.overdue ?? 0,
      href: "/admin/tasks?timeBucket=OVERDUE",
      icon: <AlertCircle size={16} />,
      color: "text-error-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* §16 — Nudge admins to enrol a passkey if they have none yet */}
      <PasskeyNudge />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-text-secondary mt-1 text-sm">{greeting}</p>
        </div>
        {/* §6.2 — Date-wise data tabs (Gap 6) */}
        <Select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          options={DATE_RANGE_OPTIONS}
          className="w-44"
        />
      </div>

      {/* Attendance Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {attendance.map((c) => (
          <div key={c.label} className="border-border-default bg-bg-surface rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${c.bg}`}>
                <span className={c.color}>{c.icon}</span>
              </div>
              <div>
                <p className="text-text-primary text-2xl font-bold">{c.value}</p>
                <p className="text-text-muted text-xs">{c.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((c) => (
          <div key={c.label} className="border-border-default bg-bg-surface rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm font-medium">{c.label}</span>
              <span className={c.color}>{c.icon}</span>
            </div>
            <p className="text-text-primary mt-2 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* §6.2 — Monthly Attendance Percentage Tracker (Gap 5) */}
      {monthlyAttendance && (
        <div className="border-border-default bg-bg-surface rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-text-secondary text-sm font-medium">Monthly Attendance Rate</h3>
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                monthlyAttendance.change >= 0
                  ? "bg-success-100 text-success-600"
                  : "bg-error-100 text-error-600",
              )}
            >
              {monthlyAttendance.change >= 0 ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              )}
              <span>{Math.abs(monthlyAttendance.change)}% vs last month</span>
            </div>
          </div>

          {/* Three-column layout fills the full width without padding empty
              space — gauge | this/last month numbers | progress bar to 100% */}
          <div className="mt-5 grid grid-cols-1 items-center gap-6 lg:grid-cols-[auto_1fr_1fr]">
            {/* ── Circular gauge (left) ── */}
            <div className="relative mx-auto h-32 w-32 shrink-0 lg:mx-0">
              <svg
                className="h-32 w-32 -rotate-90"
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                {/* Track */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  className="stroke-bg-muted"
                  strokeWidth="10"
                />
                {/* Progress — strokeDasharray uses 2πr ≈ 263.89, gauge fills
                    proportionally to currentRate */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  className="stroke-primary-500 transition-[stroke-dasharray] duration-500"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(monthlyAttendance.currentRate / 100) * 263.89} 263.89`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-text-primary text-3xl font-bold leading-none">
                  {monthlyAttendance.currentRate}
                  <span className="text-text-muted text-base">%</span>
                </span>
                <span className="text-text-muted mt-1 text-[10px] uppercase tracking-wider">
                  This month
                </span>
              </div>
            </div>

            {/* ── This / Last month split (middle) ── */}
            <div className="border-border-default grid grid-cols-2 gap-4 lg:border-l lg:border-r lg:px-6">
              <div>
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">
                  This Month
                </p>
                <p className="text-text-primary mt-1 text-2xl font-bold">
                  {monthlyAttendance.currentRate}
                  <span className="text-text-muted text-base">%</span>
                </p>
              </div>
              <div>
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">
                  Last Month
                </p>
                <p className="text-text-secondary mt-1 text-2xl font-bold">
                  {monthlyAttendance.lastMonthRate}
                  <span className="text-text-muted text-base">%</span>
                </p>
              </div>
            </div>

            {/* ── Progress bar to 100% target (right) ── */}
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">
                  Progress to Goal
                </p>
                <p className="text-text-muted text-xs">100% target</p>
              </div>
              <div className="bg-bg-muted mt-3 h-3 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, monthlyAttendance.currentRate))}%`,
                  }}
                />
              </div>
              <p className="text-text-muted mt-2 text-xs">
                {monthlyAttendance.currentRate >= 100
                  ? "Goal reached "
                  : `${(100 - monthlyAttendance.currentRate).toFixed(0)}% to go`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logins + Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* §6.2 — Today's Attendance live list (Gap 12)
            Sourced from AttendanceRecord (one row per user per day), so
            each user appears exactly once with their first punch-in time.
            Multi-session badge surfaces re-logins. */}
        <div className="border-border-default bg-bg-surface rounded-lg border p-5">
          <h3 className="text-text-secondary text-sm font-medium">Today&apos;s Attendance</h3>
          {stats?.logins && stats.logins.length > 0 ? (
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
              {stats.logins.map((login) => (
                <div
                  key={login.id}
                  className="hover:bg-bg-hover flex items-center justify-between rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary text-sm font-medium">
                      {login.employeeName}
                    </span>
                    <Badge variant="default" size="sm">
                      {login.role}
                    </Badge>
                    {/* Multi-session badge — surfaces when a user has logged
                        out and back in today. The first-login time (their
                        actual punch-in) is what stays in the row's main
                        timestamp; this badge just signals "they're not on
                        their original session anymore". */}
                    {login.sessionCount > 1 && (
                      <span title={`${login.sessionCount} login events today`}>
                        <Badge variant="primary" size="sm">
                          {login.sessionCount} sessions
                        </Badge>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-xs">
                      {new Date(login.loginTime).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {login.isLate ? (
                      <span className="text-warning-500 text-xs">Late</span>
                    ) : (
                      <span className="text-success-500 text-xs">On Time</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted mt-4 text-sm">No attendance recorded yet.</p>
          )}
          {/* §6.2 — Not Yet Punched In */}
          {stats?.notLoggedIn && stats.notLoggedIn.length > 0 && (
            <>
              <h4 className="text-text-muted mt-4 text-xs font-semibold tracking-wider uppercase">
                Not Yet Punched In ({stats.notLoggedIn.length})
              </h4>
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {stats.notLoggedIn.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between rounded-md px-3 py-1.5"
                  >
                    <span className="text-text-muted text-sm">{emp.employeeName}</span>
                    <Badge variant="default" size="sm">
                      {emp.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pending Actions */}
        <div className="border-border-default bg-bg-surface rounded-lg border p-5">
          <h3 className="text-text-secondary text-sm font-medium">Pending Actions</h3>
          <div className="mt-4 space-y-2">
            {pendingActions.map((act) => (
              <a
                key={act.label}
                href={act.href}
                className="hover:bg-bg-hover flex items-center justify-between rounded-md px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className={act.color}>{act.icon}</span>
                  <span className="text-text-primary text-sm">{act.label}</span>
                </div>
                <span className="bg-bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
                  {act.count}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
