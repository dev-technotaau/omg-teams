"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarOff,
  Clock,
  DollarSign,
  FileText,
  Percent,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { getGreeting } from "@/utils/greeting";
import { api } from "@/lib/api";
import { Badge, Select } from "@/components/ui";
import { DashboardSkeleton } from "@/components/ui/skeleton";

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
  }>;
  notLoggedIn: Array<{
    id: string;
    employeeName: string;
    role: string;
  }>;
  pendingActions: { leaveRequests: number; kycVerifications: number; suspendedAccounts: number };
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
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [monthlyAttendance, setMonthlyAttendance] = useState<MonthlyAttendance | null>(null);
  const [dateRange, setDateRange] = useState("today");
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, attendanceRes] = await Promise.all([
        api.get<{ stats: AdminStats }>(`/dashboard/admin-stats?range=${dateRange}`),
        api.get<MonthlyAttendance>("/dashboard/monthly-attendance"),
      ]);
      setStats(statsRes.data.stats);
      setMonthlyAttendance(attendanceRes.data);
    } catch {
      // Fallback to zeros if endpoint fails
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

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
      icon: <DollarSign size={20} />,
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
  ];

  return (
    <div className="space-y-6">
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
            <div className="flex items-center gap-1 text-xs">
              {monthlyAttendance.change >= 0 ? (
                <ArrowUp size={14} className="text-success-500" />
              ) : (
                <ArrowDown size={14} className="text-error-500" />
              )}
              <span
                className={monthlyAttendance.change >= 0 ? "text-success-500" : "text-error-500"}
              >
                {Math.abs(monthlyAttendance.change)}% vs last month
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-6">
            {/* Circular progress gauge */}
            <div className="relative h-24 w-24 shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="varbg-muted" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="varprimary-500"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(monthlyAttendance.currentRate / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-text-primary text-xl font-bold">
                  {monthlyAttendance.currentRate}%
                </span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-text-secondary">
                <span className="font-medium">This month:</span> {monthlyAttendance.currentRate}%
              </p>
              <p className="text-text-muted">
                <span className="font-medium">Last month:</span> {monthlyAttendance.lastMonthRate}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logins + Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* §6.2 — Today's Logins live list (Gap 12) */}
        <div className="border-border-default bg-bg-surface rounded-lg border p-5">
          <h3 className="text-text-secondary text-sm font-medium">Today&apos;s Logins</h3>
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
            <p className="text-text-muted mt-4 text-sm">No logins recorded yet.</p>
          )}
          {/* §6.2 — Not Yet Logged In */}
          {stats?.notLoggedIn && stats.notLoggedIn.length > 0 && (
            <>
              <h4 className="text-text-muted mt-4 text-xs font-semibold tracking-wider uppercase">
                Not Yet Logged In ({stats.notLoggedIn.length})
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
