"use client";

// ──────────────────────────────────────────────
//  Admin → Employee Detail → Performance tab
//
//  Pulls the per-user metrics bundle from GET /users/:id/performance
//  and renders KPIs + charts. Different from the global Analytics page —
//  this is scoped to one employee only.
// ──────────────────────────────────────────────

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  TrendingUp,
  Target,
  Clock,
  Calendar,
  Award,
  CheckSquare,
} from "lucide-react";
import { getUserTaskMetrics, type UserTaskMetrics } from "@/services/task.service";
import { qk } from "@/lib/query-keys";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { Card, Badge, Select, Progress, TableSkeleton } from "@/components/ui";
import { CHART_COLORS } from "@/constants/analytics";

interface UserPerformance {
  period: string;
  range: { from: string; to: string };
  kpi: {
    total: number;
    complete: number;
    pending: number;
    completionRate: number;
    activeDays: number;
    dailyAverage: number;
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
    progress: number;
  }>;
  rank: { position: number | null; totalRecruiters: number };
  bestDay: { date: string; count: number } | null;
}

// Backend accepts these period tokens — keep aligned with user-performance.service.ts
const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "thisWeek", label: "This Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisQuarter", label: "This Quarter" },
  { value: "thisYear", label: "This Year" },
  { value: "allTime", label: "All Time" },
];

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function EmployeePerformancePanel({ employeeId }: { employeeId: string }) {
  const [period, setPeriod] = useState("thisMonth");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-performance", employeeId, period] as const,
    queryFn: async () => {
      const res = await api.get<{ data: UserPerformance }>(
        `/users/${employeeId}/performance?period=${period}`,
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });

  // §Task — task-completion metrics shown alongside other performance cards.
  // Loaded independently so a slow task query doesn't block the rest.
  const taskMetricsQuery = useQuery<UserTaskMetrics>({
    queryKey: qk.tasks.userMetrics(employeeId),
    queryFn: () => getUserTaskMetrics(employeeId),
    staleTime: 60_000,
  });

  if (isLoading) return <TableSkeleton />;
  if (isError || !data) {
    return (
      <Card>
        <Card.Body>
          <p className="text-text-muted text-sm">Failed to load performance metrics.</p>
        </Card.Body>
      </Card>
    );
  }

  const { kpi, pipeline, zoneDistribution, statusBreakdown, dailyTrend, attendance, leave, targets, rank, bestDay } =
    data;

  const trendData = dailyTrend.map((d) => ({ date: formatShortDate(d.date), count: d.count }));
  const pipelineData = pipeline.map((p) => ({
    stage: p.stage.replace(/_/g, " "),
    count: p.count,
  }));
  const zoneData = zoneDistribution.map((z) => ({ name: z.zone, value: z.count }));
  const statusData = [
    { name: "Complete", value: statusBreakdown.complete },
    { name: "Pending", value: statusBreakdown.pending },
  ];
  const statusColors = ["#16A34A", "#EAB308"]; // success-500, warning-500

  return (
    <div className="space-y-6">
      {/* Period selector + rank banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={PERIOD_OPTIONS}
          className="w-48"
        />
        {rank.position !== null && (
          <Badge variant="primary" size="md">
            <Trophy size={14} className="mr-1" /> Rank #{rank.position} of {rank.totalRecruiters} this month
          </Badge>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total Candidates" value={kpi.total} />
        <KpiCard label="Complete" value={kpi.complete} tone="success" />
        <KpiCard label="Pending" value={kpi.pending} tone="warning" />
        <KpiCard label="Completion Rate" value={`${kpi.completionRate}%`} />
        <KpiCard label="Daily Average" value={kpi.dailyAverage} />
      </div>

      {/* Quick-glance row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Today" value={kpi.today} small />
        <KpiCard label="This Week" value={kpi.thisWeek} small />
        <KpiCard label="This Month" value={kpi.thisMonth} small />
      </div>

      {/* Targets (if any) */}
      {targets.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Target size={16} className="text-primary-500" />
              <h3 className="text-text-secondary text-sm font-medium">Target Progress</h3>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {targets.map((t) => (
                <div key={t.type}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-text-primary font-medium">{t.type}</span>
                    <span className="text-text-secondary">
                      {t.actual} / {t.target}
                    </span>
                  </div>
                  <Progress value={t.actual} max={t.target > 0 ? t.target : 1} size="md" />
                  <p className="text-text-muted mt-1 text-xs">{t.progress}% achieved</p>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Trend + Pipeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-500" />
              <h3 className="text-text-secondary text-sm font-medium">
                Daily Trend (Last 30 Days)
              </h3>
            </div>
          </Card.Header>
          <Card.Body>
            {trendData.every((d) => d.count === 0) ? (
              <p className="text-text-muted py-12 text-center text-sm">
                No submissions in the last 30 days.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-surface-raised)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Pipeline Stages</h3>
          </Card.Header>
          <Card.Body>
            {pipelineData.length === 0 ? (
              <p className="text-text-muted py-12 text-center text-sm">No pipeline data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={pipelineData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    width={110}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-surface-raised)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Zone + Status donuts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Zone Distribution</h3>
          </Card.Header>
          <Card.Body>
            {zoneData.length === 0 ? (
              <p className="text-text-muted py-12 text-center text-sm">No zone data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={zoneData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    label
                  >
                    {zoneData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Status Breakdown</h3>
          </Card.Header>
          <Card.Body>
            {statusData.every((d) => d.value === 0) ? (
              <p className="text-text-muted py-12 text-center text-sm">No status data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    label
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={statusColors[i]} />
                    ))}
                  </Pie>
                  <Legend />
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Attendance + Best day */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Card.Header>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary-500" />
              <h3 className="text-text-secondary text-sm font-medium">
                Attendance — This Month
              </h3>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <MiniStat label="Present" value={attendance.present} tone="success" />
              <MiniStat label="Half Day" value={attendance.halfDay} tone="warning" />
              <MiniStat label="Late" value={attendance.late} tone="warning" />
              <MiniStat label="Absent" value={attendance.absent} tone="danger" />
              <MiniStat label="On Leave" value={attendance.onLeave} tone="info" />
              <MiniStat label="Total Hours" value={formatMinutes(attendance.totalMinutes)} />
            </div>
            {attendance.avgDailyMinutes > 0 && (
              <p className="text-text-muted mt-3 flex items-center gap-1 text-xs">
                <Clock size={12} /> Average {formatMinutes(attendance.avgDailyMinutes)} per worked day
              </p>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Award size={16} className="text-primary-500" />
              <h3 className="text-text-secondary text-sm font-medium">Best Day</h3>
            </div>
          </Card.Header>
          <Card.Body>
            {bestDay ? (
              <div>
                <p className="text-text-primary text-2xl font-bold">{bestDay.count}</p>
                <p className="text-text-muted mt-1 text-xs">candidates on</p>
                <p className="text-text-secondary text-sm font-medium">
                  {new Date(bestDay.date).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            ) : (
              <p className="text-text-muted text-sm">No submissions in the last 30 days.</p>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* §Task — Task completion metrics */}
      {taskMetricsQuery.data && taskMetricsQuery.data.total > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-primary-500" />
              <h3 className="text-text-secondary text-sm font-medium">Task Completion</h3>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
              <MiniStat label="Assigned" value={taskMetricsQuery.data.total} />
              <MiniStat label="To Do" value={taskMetricsQuery.data.pending} tone="info" />
              <MiniStat
                label="In Review"
                value={taskMetricsQuery.data.submitted}
                tone="info"
              />
              <MiniStat
                label="Accepted"
                value={taskMetricsQuery.data.accepted}
                tone="success"
              />
              <MiniStat
                label="Rejected"
                value={taskMetricsQuery.data.rejected}
                tone="danger"
              />
              <MiniStat
                label="Overdue"
                value={taskMetricsQuery.data.overdue}
                tone="danger"
              />
              <MiniStat
                label="Completion"
                value={`${taskMetricsQuery.data.completionRate}%`}
                tone={
                  taskMetricsQuery.data.completionRate >= 80
                    ? "success"
                    : taskMetricsQuery.data.completionRate >= 50
                      ? "warning"
                      : "danger"
                }
              />
            </div>
            {taskMetricsQuery.data.accepted > 0 && (
              <p className="text-text-muted mt-3 text-xs">
                On-time submission rate:{" "}
                <span className="text-text-primary font-medium">
                  {taskMetricsQuery.data.onTimeRate}%
                </span>
                {taskMetricsQuery.data.lateSubmissions > 0 &&
                  ` (${taskMetricsQuery.data.lateSubmissions} late)`}
              </p>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Leave balance */}
      {leave.length > 0 && (
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Leave Balance — {new Date().getFullYear()}</h3>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {leave.map((l) => (
                <div key={l.code}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-text-primary text-sm font-medium">{l.code}</span>
                    <span className="text-text-muted text-xs">
                      {l.remaining}/{l.totalAllotted}
                    </span>
                  </div>
                  <Progress
                    value={l.remaining}
                    max={l.totalAllotted > 0 ? l.totalAllotted : 1}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
//  Local presentational helpers
// ──────────────────────────────────────────────

function KpiCard({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warning" | "danger" | "info";
  small?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-success-500"
      : tone === "warning"
        ? "text-warning-500"
        : tone === "danger"
          ? "text-error-500"
          : tone === "info"
            ? "text-info-500"
            : "text-text-primary";

  return (
    <Card>
      <p className="text-text-muted text-xs">{label}</p>
      <p className={`mt-1 font-bold ${small ? "text-xl" : "text-2xl"} ${toneClass}`}>{value}</p>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-success-500"
      : tone === "warning"
        ? "text-warning-500"
        : tone === "danger"
          ? "text-error-500"
          : tone === "info"
            ? "text-info-500"
            : "text-text-primary";
  return (
    <div>
      <p className="text-text-muted text-xs">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
