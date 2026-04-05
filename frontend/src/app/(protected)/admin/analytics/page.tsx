"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Users,
  IndianRupee,
  Clock,
  FileText,
  CalendarRange,
  Trophy,
  Activity,
  Server,
  RefreshCw,
  Maximize2,
  Minimize2,
  Download,
  Zap,
  Radio,
  AlertTriangle,
  Wifi,
  WifiOff,
  HardDrive,
  Database,
  Mail,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getKPISummary,
  getPipelineFunnel,
  getRecruitmentTrend,
  getRecruiterPerformance,
  getZoneDistribution,
  getCompanyVolume,
  getHRFeedbackBreakdown,
  getRevenueOverTime,
  getEmployeeOverview,
  getRecruiterLeaderboard,
  getPaymentStatusDistribution,
  getCompanyRevenueTable,
  getProfileDistribution,
  getNoticePeriodDistribution,
  getPlatformHealth,
  getLiveMetrics,
  getGSTTDSSummary,
  getAgeDistribution,
  getExperienceDistribution,
  getCTCAnalysis,
  getActivityHeatmap,
  getEmployeeAttendanceHeatmap,
  getEmployeeLeaveUtilization,
  getWorkforceDistribution,
} from "@/services/analytics.service";
import {
  PageHeader,
  Select,
  StatsCard,
  Card,
  Badge,
  IconButton,
  DataTable,
  DateRangePicker,
  SkeletonRect,
  Tooltip,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ANALYTICS_PERIOD_OPTIONS,
  CHART_COLORS,
  ATTENDANCE_HEATMAP_COLORS,
  HEATMAP_INTENSITY,
} from "@/constants/analytics";
import { formatCurrency } from "@/utils/format";
import type {
  KpiData,
  FunnelItem,
  TrendItem,
  RecruiterPerformanceItem as RecruiterItem,
  ZoneDistributionItem as ZoneItem,
  CompanyVolumeItem as CompanyItem,
  FeedbackBreakdownItem as FeedbackItem,
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

// ──────────────────────────────────────────────
//  Analytics & Statistics — Spec Section 21
//  Enterprise-grade analytics dashboard
// ──────────────────────────────────────────────

type TrendGranularity = "daily" | "weekly" | "monthly";
type HeatmapRange = "3m" | "6m" | "1y";

/** Returns the HEATMAP_INTENSITY color bucket for a given submission count */
function getHeatmapColor(count: number): string {
  if (count === 0) return HEATMAP_INTENSITY[0];
  if (count <= 2) return HEATMAP_INTENSITY[1];
  if (count <= 5) return HEATMAP_INTENSITY[2];
  if (count <= 9) return HEATMAP_INTENSITY[3];
  return HEATMAP_INTENSITY[4];
}

/** Build a map of date→count from heatmap items */
function buildHeatmapMap(items: ActivityHeatmapItem[]): Map<string, number> {
  return new Map(items.map((i) => [i.date, i.count]));
}

/** Generate all calendar dates for a range (from today going back `months` months) */
function generateDateRange(months: number): string[] {
  const dates: string[] = [];
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Format uptime seconds to "Xd Yh Zm" */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Tooltip style for recharts */
const TOOLTIP_STYLE = {
  background: "var(--bg-surface-raised)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  fontSize: 12,
};

// ──────────────────────────────────────────────
//  CardShell — Card with fullscreen + export
// ──────────────────────────────────────────────
interface CardShellProps {
  id: string;
  title: string;
  children: React.ReactNode;
  fullScreenChart: string | null;
  onToggleFullScreen: (id: string) => void;
  headerExtra?: React.ReactNode;
  exportData?: Record<string, unknown>[] | null;
}

function exportToCsv(data: Record<string, unknown>[], fileName: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]!);
  const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CardShell({
  id,
  title,
  children,
  fullScreenChart,
  onToggleFullScreen,
  headerExtra,
  exportData,
}: CardShellProps) {
  const isFullScreen = fullScreenChart === id;

  return (
    <div
      className={isFullScreen ? "bg-bg-page fixed inset-0 z-50 overflow-auto p-6" : undefined}
    >
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-text-primary text-sm font-semibold">{title}</h3>
            <div className="flex items-center gap-1">
              {headerExtra}
              <Tooltip content="Export as CSV">
                <IconButton
                  icon={Download}
                  size="xs"
                  variant="ghost"
                  aria-label="Export chart"
                  disabled={!exportData || exportData.length === 0}
                  onClick={() =>
                    exportData &&
                    exportToCsv(exportData, `${id}_${new Date().toISOString().slice(0, 10)}`)
                  }
                />
              </Tooltip>
              <Tooltip content={isFullScreen ? "Exit full screen" : "Full screen"}>
                <IconButton
                  icon={isFullScreen ? Minimize2 : Maximize2}
                  size="xs"
                  variant="ghost"
                  aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
                  onClick={() => onToggleFullScreen(id)}
                />
              </Tooltip>
            </div>
          </div>
        </Card.Header>
        <Card.Body>{children}</Card.Body>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Main Page
// ──────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  // ── Period / date range state ──
  const [period, setPeriod] = useState("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // ── Loading ──
  const [loading, setLoading] = useState(true);

  // ── Trend granularity ──
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("daily");

  // ── Heatmap range ──
  const [heatmapRange, setHeatmapRange] = useState<HeatmapRange>("3m");

  // ── Full screen ──
  const [fullScreenChart, setFullScreenChart] = useState<string | null>(null);

  const toggleFullScreen = (id: string) => {
    setFullScreenChart((prev) => (prev === id ? null : id));
  };

  // ── Data state ──
  const [kpi, setKpi] = useState<KpiData>({});
  const [funnel, setFunnel] = useState<FunnelItem[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [recruiterPerf, setRecruiterPerf] = useState<RecruiterItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [revenue, setRevenue] = useState<RevenueItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOverview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusItem[]>([]);
  const [companyRevenue, setCompanyRevenue] = useState<CompanyRevenueItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileDistributionItem[]>([]);
  const [noticePeriod, setNoticePeriod] = useState<NoticePeriodItem[]>([]);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [gstTds, setGstTds] = useState<GSTTDSSummary | null>(null);
  const [ageDist, setAgeDist] = useState<AgeDistributionItem[]>([]);
  const [expDist, setExpDist] = useState<ExperienceDistributionItem[]>([]);
  const [ctcAnalysis, setCtcAnalysis] = useState<CTCAnalysisItem[]>([]);
  const [activityHeatmap, setActivityHeatmap] = useState<ActivityHeatmapItem[]>([]);
  const [attendanceHeatmap, setAttendanceHeatmap] = useState<EmployeeAttendanceHeatmapEntry[]>([]);
  const [leaveUtilization, setLeaveUtilization] = useState<EmployeeLeaveUtilizationEntry[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceDistribution | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const effectivePeriod = period;
    const from = period === "custom" ? customFrom : undefined;
    const to = period === "custom" ? customTo : undefined;
    try {
      const [
        kpiRes,
        funnelRes,
        trendRes,
        rpRes,
        zoneRes,
        compRes,
        fbRes,
        revRes,
        empRes,
        lbRes,
        psRes,
        crRes,
        profRes,
        npRes,
        healthRes,
        gstRes,
        ageRes,
        expRes,
        ctcRes,
        heatRes,
        attRes,
        leaveRes,
        wfRes,
      ] = await Promise.all([
        getKPISummary(effectivePeriod, from, to),
        getPipelineFunnel(effectivePeriod),
        getRecruitmentTrend(effectivePeriod, trendGranularity),
        getRecruiterPerformance(effectivePeriod),
        getZoneDistribution(effectivePeriod),
        getCompanyVolume(effectivePeriod),
        getHRFeedbackBreakdown(effectivePeriod),
        getRevenueOverTime(effectivePeriod),
        getEmployeeOverview(),
        getRecruiterLeaderboard(effectivePeriod),
        getPaymentStatusDistribution(effectivePeriod),
        getCompanyRevenueTable(effectivePeriod),
        getProfileDistribution(effectivePeriod),
        getNoticePeriodDistribution(effectivePeriod),
        getPlatformHealth(),
        getGSTTDSSummary(effectivePeriod),
        getAgeDistribution(effectivePeriod),
        getExperienceDistribution(effectivePeriod),
        getCTCAnalysis(effectivePeriod),
        getActivityHeatmap(heatmapRange),
        getEmployeeAttendanceHeatmap(effectivePeriod),
        getEmployeeLeaveUtilization(),
        getWorkforceDistribution(),
      ]);
      setKpi(kpiRes ?? {});
      setFunnel(funnelRes ?? []);
      setTrend(trendRes ?? []);
      setRecruiterPerf(rpRes ?? []);
      setZones(zoneRes ?? []);
      setCompanies(compRes ?? []);
      setFeedback(fbRes ?? []);
      setRevenue(revRes ?? []);
      setEmployees(empRes ?? null);
      setLeaderboard(lbRes ?? []);
      setPaymentStatus(psRes ?? []);
      setCompanyRevenue(crRes ?? []);
      setProfiles(profRes ?? []);
      setNoticePeriod(npRes ?? []);
      setHealth(healthRes ?? null);
      setGstTds(gstRes ?? null);
      setAgeDist(ageRes ?? []);
      setExpDist(expRes ?? []);
      setCtcAnalysis(ctcRes ?? []);
      setActivityHeatmap(heatRes ?? []);
      setAttendanceHeatmap(attRes ?? []);
      setLeaveUtilization(leaveRes ?? []);
      setWorkforce(wfRes ?? null);
    } catch {
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, trendGranularity, heatmapRange]);

  // ── Initial + period-change fetch ──
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Live metrics polling every 30s ──
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await getLiveMetrics();
        setLiveMetrics(res ?? null);
      } catch {
        // silent — live metrics failure shouldn't break the page
      }
    };
    void fetchLive();
    const interval = setInterval(() => void fetchLive(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Re-fetch trend when granularity changes ──
  useEffect(() => {
    if (loading) return;
    getRecruitmentTrend(period, trendGranularity)
      .then((res) => setTrend(res ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendGranularity]);

  // ── Re-fetch heatmap when range changes ──
  useEffect(() => {
    if (loading) return;
    getActivityHeatmap(heatmapRange)
      .then((res) => setActivityHeatmap(res ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmapRange]);

  // ──────────────────────────────────────────────
  //  KPI card definitions
  // ──────────────────────────────────────────────
  const kpiCards = [
    {
      key: "totalSourced",
      label: "Total Candidates Sourced",
      format: (v: number) => v.toLocaleString(),
      icon: Users,
    },
    {
      key: "todaySourced",
      label: "Candidates Sourced Today",
      format: (v: number) => v.toLocaleString(),
      icon: Users,
    },
    {
      key: "activeRecruiters",
      label: "Active Recruiters",
      format: (v: number) => v.toLocaleString(),
      icon: Users,
    },
    { key: "totalRevenue", label: "Total Revenue", format: formatCurrency, icon: IndianRupee },
    { key: "amountReceived", label: "Amount Received", format: formatCurrency, icon: IndianRupee },
    { key: "outstanding", label: "Outstanding Amount", format: formatCurrency, icon: IndianRupee },
    {
      key: "pendingReports",
      label: "Pending Reports",
      format: (v: number) => v.toLocaleString(),
      icon: FileText,
    },
    {
      key: "conversionRate",
      label: "Conversion Rate",
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: BarChart3,
    },
    {
      key: "avgTimeToJoin",
      label: "Avg Time to Join",
      format: (v: number) => `${v} days`,
      icon: Clock,
    },
    {
      key: "hrFeedbackRate",
      label: "HR Feedback Rate",
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: BarChart3,
    },
  ] as const;

  // ──────────────────────────────────────────────
  //  Table column definitions
  // ──────────────────────────────────────────────
  const leaderboardCols: Column<LeaderboardItem>[] = [
    {
      key: "rank",
      header: "#",
      sortable: true,
      cell: (r) => {
        const isBottom3 = leaderboard.length > 6 && r.rank > leaderboard.length - 3;
        if (r.rank <= 3)
          return (
            <Badge variant="success" size="sm">
              {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
            </Badge>
          );
        if (isBottom3)
          return (
            <Badge variant="danger" size="sm">
              {r.rank}
            </Badge>
          );
        return <span className="text-text-muted text-sm">{r.rank}</span>;
      },
    },
    {
      key: "name",
      header: "Recruiter",
      sortable: true,
      cell: (r) => <span className="text-text-primary font-medium">{r.name}</span>,
    },
    {
      key: "candidatesSourced",
      header: "Candidates",
      sortable: true,
      cell: (r) => <span className="font-semibold">{r.candidatesSourced}</span>,
    },
    {
      key: "completionRate",
      header: "Completion %",
      sortable: true,
      cell: (r) => <span>{r.completionRate}%</span>,
    },
    {
      key: "conversionRate",
      header: "Conversion %",
      sortable: true,
      cell: (r) => <span>{r.conversionRate}%</span>,
    },
  ];

  const companyRevCols: Column<CompanyRevenueItem>[] = [
    {
      key: "name",
      header: "Company",
      sortable: true,
      cell: (r) => <span className="text-text-primary font-medium">{r.name}</span>,
    },
    {
      key: "totalInvoiced",
      header: "Invoiced",
      sortable: true,
      cell: (r) => formatCurrency(r.totalInvoiced),
    },
    {
      key: "amountReceived",
      header: "Received",
      sortable: true,
      cell: (r) => formatCurrency(r.amountReceived),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      sortable: true,
      cell: (r) => (
        <span className={r.outstanding > 0 ? "text-error-500" : ""}>
          {formatCurrency(r.outstanding)}
        </span>
      ),
    },
    { key: "gst", header: "GST", cell: (r) => formatCurrency(r.gst) },
    { key: "tds", header: "TDS", cell: (r) => formatCurrency(r.tds) },
  ];

  // ──────────────────────────────────────────────
  //  Loading skeleton
  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics & Statistics" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonRect key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRect key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  //  Derived / computed
  // ──────────────────────────────────────────────

  // CTC chart data: convert CTCAnalysisItem[] into flat recharts-friendly array
  const ctcChartData = ctcAnalysis.map((item) => ({
    profile: item.profile.length > 18 ? item.profile.slice(0, 18) + "…" : item.profile,
    currentMedian: Math.round(item.currentCtc.median / 100000), // in LPA
    expectedMedian: Math.round(item.expectedCtc.median / 100000),
    currentMin: Math.round(item.currentCtc.min / 100000),
    currentMax: Math.round(item.currentCtc.max / 100000),
    expectedMin: Math.round(item.expectedCtc.min / 100000),
    expectedMax: Math.round(item.expectedCtc.max / 100000),
  }));

  // Leave utilization stacked bar data
  const leaveLeaveTypes = Array.from(
    new Set(leaveUtilization.flatMap((e) => e.leaveTypes.map((lt) => lt.type))),
  );
  const leaveChartData = leaveUtilization.map((entry) => {
    const row: Record<string, number | string> = { name: entry.name };
    for (const lt of entry.leaveTypes) {
      row[lt.type] = lt.used;
    }
    return row;
  });

  // Workforce distribution pie data
  const workforceStatusData = workforce
    ? [
        { name: "Active", value: workforce.byStatus.active },
        { name: "Suspended", value: workforce.byStatus.suspended },
        { name: "Deactivated", value: workforce.byStatus.deactivated },
      ]
    : [];
  const workforceRoleData = workforce
    ? [
        { name: "Recruiters", value: workforce.byRole.recruiters },
        { name: "Reporting Mgrs", value: workforce.byRole.reportingManagers },
        { name: "Admins", value: workforce.byRole.admins },
      ]
    : [];
  const workforceDeviceData = workforce
    ? [
        { name: "Bound", value: workforce.deviceBound },
        { name: "Unbound", value: workforce.deviceUnbound },
      ]
    : [];

  // Activity heatmap calendar
  const heatmapMonths = heatmapRange === "3m" ? 3 : heatmapRange === "6m" ? 6 : 12;
  const heatmapDates = generateDateRange(heatmapMonths);
  const heatmapMap = buildHeatmapMap(activityHeatmap);

  // Group dates by week for the grid (7 cols)
  const heatmapWeeks: string[][] = [];
  if (heatmapDates.length > 0) {
    // Pad start to Sunday
    const firstDay = new Date(heatmapDates[0]);
    const startPad = firstDay.getDay(); // 0=Sun
    const allDatesWithPad: (string | null)[] = [
      ...Array<null>(startPad).fill(null),
      ...heatmapDates,
    ];
    for (let i = 0; i < allDatesWithPad.length; i += 7) {
      const week = allDatesWithPad.slice(i, i + 7) as string[];
      heatmapWeeks.push(week);
    }
  }

  // BullMQ table data
  const bullmqRows = health
    ? Object.entries(health.bullmq).map(([queue, stats]) => ({
        queue,
        ...stats,
      }))
    : [];

  // ──────────────────────────────────────────────
  //  Render
  // ──────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* ── §21.1 Header + Period Selector + Refresh ── */}
      <PageHeader
        title="Analytics & Statistics"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange size={16} className="text-text-muted" />
            <Select
              options={ANALYTICS_PERIOD_OPTIONS}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              size="sm"
              className="w-44"
            />
            <Tooltip content="Refresh all data">
              <IconButton
                icon={RefreshCw}
                size="sm"
                variant="outline"
                aria-label="Refresh analytics"
                onClick={() => void fetchAll()}
              />
            </Tooltip>
          </div>
        }
      />

      {/* Custom Date Range — shown only when period=custom */}
      {period === "custom" && (
        <Card>
          <Card.Body>
            <DateRangePicker
              startDate={customFrom}
              endDate={customTo}
              onChange={(from, to) => {
                setCustomFrom(from);
                setCustomTo(to);
              }}
            />
          </Card.Body>
        </Card>
      )}

      {/* ── §21.5 Live Metrics Row ── */}
      {liveMetrics && (
        <div>
          <h2 className="text-text-primary mb-3 flex items-center gap-2 text-base font-semibold">
            <Radio size={18} className="text-success-500 animate-pulse" />
            Live Metrics
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {/* Today's submissions */}
            <div className="bg-bg-surface border-border-default rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-primary-500" />
                <span className="text-text-secondary text-xs font-medium">
                  Today&apos;s Submissions
                </span>
              </div>
              <p className="text-text-primary mt-2 text-2xl font-bold">
                {liveMetrics.todaySubmissions.toLocaleString()}
              </p>
            </div>

            {/* Active users now */}
            <div className="bg-bg-surface border-border-default rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-accent-blue-500" />
                <span className="text-text-secondary text-xs font-medium">Active Users Now</span>
              </div>
              <p className="text-text-primary mt-2 text-2xl font-bold">
                {liveMetrics.activeUsersNow.toLocaleString()}
              </p>
            </div>

            {/* Last submission */}
            <div className="bg-bg-surface border-border-default rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-text-muted" />
                <span className="text-text-secondary text-xs font-medium">Last Submission</span>
              </div>
              {liveMetrics.lastSubmission ? (
                <>
                  <p className="text-text-primary mt-2 text-sm font-semibold">
                    {liveMetrics.lastSubmission.recruiterName}
                  </p>
                  <p className="text-text-muted text-xs">
                    {new Date(liveMetrics.lastSubmission.timestamp).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </>
              ) : (
                <p className="text-text-muted mt-2 text-sm">None yet</p>
              )}
            </div>

            {/* Submission rate */}
            <div className="bg-bg-surface border-border-default rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-success-500" />
                <span className="text-text-secondary text-xs font-medium">Rate / Hour (Today)</span>
              </div>
              <p className="text-text-primary mt-2 text-2xl font-bold">
                {liveMetrics.todayRate.toFixed(1)}
              </p>
            </div>

            {/* Pending reports */}
            <div
              className={`rounded-lg border p-4 ${
                liveMetrics.pendingCount > 0
                  ? "border-error-300 bg-error-50"
                  : "bg-bg-surface border-border-default"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  size={16}
                  className={liveMetrics.pendingCount > 0 ? "text-error-500" : "text-text-muted"}
                />
                <span className="text-text-secondary text-xs font-medium">Pending Reports</span>
              </div>
              <p
                className={`mt-2 text-2xl font-bold ${
                  liveMetrics.pendingCount > 0 ? "text-error-600" : "text-text-primary"
                }`}
              >
                {liveMetrics.pendingCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── §21.2 KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map(({ key, label, format, icon }) => {
          const item = kpi[key];
          const value = item?.value ?? 0;
          const change = item?.change ?? 0;
          return (
            <StatsCard
              key={key}
              label={label}
              value={format(value)}
              icon={icon}
              trend={change !== 0 ? { value: Math.abs(change), isPositive: change > 0 } : undefined}
            />
          );
        })}
      </div>

      {/* ── §21.3 Recruitment Pipeline Funnel ── */}
      {funnel.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h3 className="text-text-primary text-sm font-semibold">
                Recruitment Pipeline Funnel
              </h3>
              <div className="flex gap-1">
                <Tooltip content="Export as CSV">
                  <IconButton
                    icon={Download}
                    size="xs"
                    variant="ghost"
                    aria-label="Export funnel"
                    disabled={funnel.length === 0}
                    onClick={() =>
                      exportToCsv(
                        funnel as unknown as Record<string, unknown>[],
                        `funnel_${new Date().toISOString().slice(0, 10)}`,
                      )
                    }
                  />
                </Tooltip>
                <Tooltip content="Full screen">
                  <IconButton
                    icon={fullScreenChart === "funnel" ? Minimize2 : Maximize2}
                    size="xs"
                    variant="ghost"
                    aria-label="Full screen"
                    onClick={() => toggleFullScreen("funnel")}
                  />
                </Tooltip>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-2">
              {funnel.map((s, i) => (
                <button
                  key={s.stage}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 rounded transition-opacity hover:opacity-80"
                  onClick={() => {
                    router.push(`/admin/reports?stage=${encodeURIComponent(s.stage)}`);
                  }}
                >
                  <span className="text-text-secondary w-28 shrink-0 truncate text-left text-xs">
                    {s.stage}
                  </span>
                  <div className="bg-bg-muted h-7 flex-1 overflow-hidden rounded-sm">
                    <div
                      className="flex h-full items-center rounded-sm px-2 text-xs font-medium text-white"
                      style={{
                        width: `${s.pctOfTop}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        minWidth: s.pctOfTop > 0 ? "2rem" : 0,
                      }}
                    >
                      {s.count.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge variant="outline" size="sm">
                      {s.pctOfTop}% of top
                    </Badge>
                    {i > 0 && (
                      <span className="text-text-muted text-xs">{s.pctOfPrev}% of prev</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* ── §21.4 Charts Grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* §21.4.1 Recruitment Trend (with granularity toggle) */}
        <CardShell
          id="trend"
          title="Recruitment Trend"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
          headerExtra={
            <div className="border-border-default flex overflow-hidden rounded-md border text-xs">
              {(["daily", "weekly", "monthly"] as TrendGranularity[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`px-2 py-0.5 capitalize transition-colors ${
                    trendGranularity === g
                      ? "bg-primary-500 text-white"
                      : "text-text-secondary hover:bg-bg-hover"
                  }`}
                  onClick={() => setTrendGranularity(g)}
                >
                  {g.charAt(0).toUpperCase() +
                    g.slice(1, 1 + (g === "daily" ? 1 : g === "weekly" ? 1 : 1))}
                  {g === "daily" ? "D" : g === "weekly" ? "W" : "M"}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="sourced"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cvShared"
                stroke={CHART_COLORS[1]}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="joined"
                stroke={CHART_COLORS[2]}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.2 Recruiter Performance */}
        <CardShell
          id="recruiter-perf"
          title="Recruiter Performance"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={recruiterPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="complete" stackId="a" fill={CHART_COLORS[2]} />
              <Bar dataKey="pending" stackId="a" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.4 Zone Distribution (donut) */}
        <CardShell
          id="zone-dist"
          title="Zone Distribution"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={zones}
                dataKey="count"
                nameKey="zone"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                label={
                  ((props: { name: string; percent: number }) =>
                    `${props.name} ${(props.percent * 100).toFixed(0)}%`) as Parameters<
                    typeof Pie
                  >[0]["label"]
                }
              >
                {zones.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.5 Company Volume (horizontal bar) */}
        <CardShell
          id="company-vol"
          title="Company Volume (Top)"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={companies} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 11 }}
                stroke="var(--text-muted)"
              />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.7 HR Feedback Breakdown (pie) */}
        <CardShell
          id="hr-feedback"
          title="HR Feedback Breakdown"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={feedback}
                dataKey="count"
                nameKey="feedback"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={
                  ((props: { name: string; percent: number }) =>
                    `${props.name} ${(props.percent * 100).toFixed(0)}%`) as Parameters<
                    typeof Pie
                  >[0]["label"]
                }
              >
                {feedback.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.8 Revenue Over Time (area) */}
        <CardShell
          id="revenue"
          title="Revenue Over Time"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--text-muted)"
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <RechartsTooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => formatCurrency(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="invoiced"
                stroke={CHART_COLORS[0]}
                fill={CHART_COLORS[0]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="received"
                stroke={CHART_COLORS[2]}
                fill={CHART_COLORS[2]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="outstanding"
                stroke={CHART_COLORS[3]}
                fill={CHART_COLORS[3]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.8 Payment Status (donut) */}
        <CardShell
          id="payment-status"
          title="Payment Status Distribution"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={paymentStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                label={
                  ((props: { name: string; percent: number }) =>
                    `${props.name} ${(props.percent * 100).toFixed(0)}%`) as Parameters<
                    typeof Pie
                  >[0]["label"]
                }
              >
                {paymentStatus.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.6 Profile Distribution (horizontal bar) */}
        <CardShell
          id="profile-dist"
          title="Profile Distribution"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={profiles.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis
                dataKey="profile"
                type="category"
                width={120}
                tick={{ fontSize: 10 }}
                stroke="var(--text-muted)"
              />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={CHART_COLORS[4]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.9 Notice Period Distribution (bar) */}
        <CardShell
          id="notice-period"
          title="Notice Period Distribution"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={noticePeriod}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={CHART_COLORS[6]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.10 Age Distribution (bar) */}
        <CardShell
          id="age-dist"
          title="Age Distribution"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ageDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={CHART_COLORS[8]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.10 Experience Distribution (bar) */}
        <CardShell
          id="exp-dist"
          title="Experience Distribution"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={expDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={CHART_COLORS[9]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardShell>

        {/* §21.4.11 CTC Analysis (grouped bar) */}
        <CardShell
          id="ctc-analysis"
          title="CTC Analysis (Current vs Expected — Median, LPA)"
          fullScreenChart={fullScreenChart}
          onToggleFullScreen={toggleFullScreen}
        >
          {ctcChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ctcChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="profile" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--text-muted)"
                  tickFormatter={(v) => `${v}L`}
                />
                <RechartsTooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, name) => [
                    `${v} LPA`,
                    name === "currentMedian" ? "Current (median)" : "Expected (median)",
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="currentMedian"
                  name="Current CTC"
                  fill={CHART_COLORS[2]}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expectedMedian"
                  name="Expected CTC"
                  fill={CHART_COLORS[0]}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-text-muted flex h-40 items-center justify-center text-sm">
              No CTC data available for this period
            </div>
          )}
          {/* Min/max range indicators */}
          {ctcChartData.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ctcChartData.slice(0, 4).map((item) => (
                <div key={item.profile} className="bg-bg-muted rounded px-2 py-1 text-xs">
                  <span className="text-text-secondary font-medium">{item.profile}:</span>{" "}
                  <span className="text-text-primary">
                    Curr {item.currentMin}–{item.currentMax}L | Exp {item.expectedMin}–
                    {item.expectedMax}L
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardShell>
      </div>

      {/* ── §21.4.12 Activity Heatmap (full width) ── */}
      <CardShell
        id="activity-heatmap"
        title="Submission Activity Heatmap"
        fullScreenChart={fullScreenChart}
        onToggleFullScreen={toggleFullScreen}
        headerExtra={
          <div className="border-border-default flex overflow-hidden rounded-md border text-xs">
            {(["3m", "6m", "1y"] as HeatmapRange[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`px-2 py-0.5 transition-colors ${
                  heatmapRange === r
                    ? "bg-primary-500 text-white"
                    : "text-text-secondary hover:bg-bg-hover"
                }`}
                onClick={() => setHeatmapRange(r)}
              >
                {r === "3m" ? "3M" : r === "6m" ? "6M" : "1Y"}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          {/* Day-of-week labels */}
          <div className="mb-1 flex gap-0.5 pl-0">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={i}
                className="text-text-muted flex h-3 w-3 items-center justify-center text-[9px]"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid — weeks as rows of 7 */}
          <div className="flex flex-wrap gap-0.5">
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((date, di) => {
                  if (!date) {
                    return <div key={di} className="h-3 w-3" />;
                  }
                  const count = heatmapMap.get(date) ?? 0;
                  const color = getHeatmapColor(count);
                  return (
                    <Tooltip
                      key={date}
                      content={`${date}: ${count} submission${count !== 1 ? "s" : ""}`}
                    >
                      <div
                        className="h-3 w-3 cursor-default rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-text-muted text-xs">Less</span>
            {HEATMAP_INTENSITY.map((color, i) => (
              <div key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            ))}
            <span className="text-text-muted text-xs">More</span>
          </div>
        </div>
      </CardShell>

      {/* ── §21.4.8 GST & TDS Summary Cards ── */}
      {gstTds && (
        <div>
          <h2 className="text-text-primary mb-3 flex items-center gap-2 text-base font-semibold">
            <IndianRupee size={18} />
            GST & TDS Summary
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatsCard
              label="Total GST"
              value={formatCurrency(gstTds.totalGST)}
              icon={IndianRupee}
            />
            <StatsCard
              label="Total TDS"
              value={formatCurrency(gstTds.totalTDS)}
              icon={IndianRupee}
            />
            <StatsCard
              label="Total Invoiced"
              value={formatCurrency(gstTds.totalInvoiced)}
              icon={FileText}
            />
            <StatsCard
              label="Net Receivable"
              value={formatCurrency(gstTds.netReceivable)}
              icon={TrendingUp}
            />
          </div>
        </div>
      )}

      {/* ── §21.4.3 Recruiter Leaderboard ── */}
      {leaderboard.length > 0 && (
        <div>
          <h2 className="text-text-primary mb-3 flex items-center gap-2 text-base font-semibold">
            <Trophy size={20} />
            Recruiter Leaderboard
          </h2>
          <DataTable
            columns={leaderboardCols}
            data={leaderboard.slice(0, 20)}
            emptyTitle="No data"
            emptyDescription="No recruiter data for this period."
          />
        </div>
      )}

      {/* ── Company Revenue Table ── */}
      {companyRevenue.length > 0 && (
        <div>
          <h2 className="text-text-primary mb-3 flex items-center gap-2 text-base font-semibold">
            <IndianRupee size={20} />
            Company Revenue Summary
          </h2>
          <DataTable
            columns={companyRevCols}
            data={companyRevenue}
            emptyTitle="No data"
            emptyDescription="No revenue data for this period."
          />
        </div>
      )}

      {/* ── §21.4.13 Employee Overview ── */}
      {employees && (
        <div>
          <h2 className="text-text-primary mb-3 flex items-center gap-2 text-base font-semibold">
            <Users size={20} />
            Employee Overview
          </h2>

          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <StatsCard
              label="Total Active"
              value={employees.totalActive.toLocaleString()}
              icon={Users}
            />
            <StatsCard
              label="Suspended"
              value={employees.totalSuspended.toLocaleString()}
              icon={Users}
            />
            <StatsCard
              label="Recruiters"
              value={employees.recruiters.toLocaleString()}
              icon={Users}
            />
            <StatsCard label="Managers" value={employees.managers.toLocaleString()} icon={Users} />
            <StatsCard
              label="Present Today"
              value={employees.presentToday.toLocaleString()}
              icon={TrendingUp}
            />
            <StatsCard
              label="On Leave Today"
              value={employees.onLeaveToday.toLocaleString()}
              icon={CalendarRange}
            />
            <StatsCard
              label="Absent Today"
              value={employees.absentToday.toLocaleString()}
              icon={Activity}
            />
          </div>

          {/* Attendance Heatmap */}
          {attendanceHeatmap.length > 0 && (
            <div className="mb-6">
              <h3 className="text-text-primary mb-3 text-sm font-semibold">
                Employee Attendance Heatmap
              </h3>
              {/* Legend */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {Object.entries(ATTENDANCE_HEATMAP_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-text-secondary text-xs">
                      {status
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-text-secondary min-w-[120px] px-2 py-1 text-left font-medium">
                        Employee
                      </th>
                      {attendanceHeatmap[0]?.days.map((d) => (
                        <th
                          key={d.date}
                          className="text-text-muted min-w-[28px] px-0.5 py-1 text-center font-normal"
                        >
                          {new Date(d.date).getDate()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHeatmap.map((emp) => (
                      <tr key={emp.employeeId}>
                        <td className="text-text-primary truncate px-2 py-1 font-medium">
                          {emp.employeeName}
                        </td>
                        {emp.days.map((d) => {
                          const color =
                            ATTENDANCE_HEATMAP_COLORS[d.status] ??
                            ATTENDANCE_HEATMAP_COLORS["WEEKEND_HOLIDAY"];
                          return (
                            <td key={d.date} className="px-0.5 py-1 text-center">
                              <Tooltip
                                content={`${d.date}: ${d.status.toLowerCase().replace(/_/g, " ")}`}
                              >
                                <div
                                  className="mx-auto h-5 w-5 rounded-sm"
                                  style={{ backgroundColor: color }}
                                />
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leave Utilization Chart */}
          {leaveChartData.length > 0 && leaveLeaveTypes.length > 0 && (
            <div className="mb-6">
              <CardShell
                id="leave-utilization"
                title="Employee Leave Utilization"
                fullScreenChart={fullScreenChart}
                onToggleFullScreen={toggleFullScreen}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={leaveChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                    <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {leaveLeaveTypes.map((type, i) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        stackId="leave"
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={i === leaveLeaveTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardShell>
            </div>
          )}

          {/* Workforce Distribution — 3 donuts side by side */}
          {workforce && (
            <div>
              <h3 className="text-text-primary mb-3 text-sm font-semibold">
                Workforce Distribution
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* By Status */}
                <Card>
                  <Card.Header>
                    <h4 className="text-text-secondary text-xs font-medium">By Status</h4>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={workforceStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {workforceStatusData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>

                {/* By Role */}
                <Card>
                  <Card.Header>
                    <h4 className="text-text-secondary text-xs font-medium">By Role</h4>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={workforceRoleData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {workforceRoleData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>

                {/* By Device */}
                <Card>
                  <Card.Header>
                    <h4 className="text-text-secondary text-xs font-medium">By Device Binding</h4>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={workforceDeviceData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {workforceDeviceData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[(i + 6) % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── §21.6 Platform Health ── */}
      {health && (
        <div>
          <h2 className="text-text-primary mb-3 flex items-center gap-2 text-base font-semibold">
            <Server size={20} />
            Platform Health
          </h2>

          {/* Top metrics row */}
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatsCard
              label="Active Sessions"
              value={health.activeSessions.total.toLocaleString()}
              icon={Users}
            />
            <StatsCard label="Uptime" value={formatUptime(health.uptime)} icon={Activity} />
            <StatsCard
              label="Cloud Files"
              value={health.cloudStorage.activeFiles.toLocaleString()}
              icon={HardDrive}
            />
            <StatsCard
              label="Email (24h)"
              value={`${health.emailDelivery24h.sent} sent`}
              icon={Mail}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Sessions by role */}
            <Card>
              <Card.Header>
                <h3 className="text-text-primary text-sm font-semibold">Active Sessions by Role</h3>
              </Card.Header>
              <Card.Body>
                <div className="space-y-2">
                  {Object.entries(health.activeSessions.byRole).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between">
                      <span className="text-text-secondary text-sm capitalize">{role}</span>
                      <Badge variant="outline" size="sm">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>

            {/* Redis status */}
            <Card>
              <Card.Header>
                <h3 className="text-text-primary text-sm font-semibold">Redis</h3>
              </Card.Header>
              <Card.Body>
                <div className="flex items-center gap-3">
                  {health.redis.status === "connected" ? (
                    <Wifi size={20} className="text-success-500" />
                  ) : (
                    <WifiOff size={20} className="text-error-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          health.redis.status === "connected" ? "bg-success-500" : "bg-error-500"
                        }`}
                      />
                      <span className="text-text-primary text-sm font-medium capitalize">
                        {health.redis.status}
                      </span>
                    </div>
                    {health.redis.memoryUsedMb !== null && (
                      <p className="text-text-muted mt-0.5 text-xs">
                        Memory: {health.redis.memoryUsedMb.toFixed(1)} MB
                      </p>
                    )}
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Email delivery */}
            <Card>
              <Card.Header>
                <h3 className="text-text-primary text-sm font-semibold">
                  Email Delivery (Last 24h)
                </h3>
              </Card.Header>
              <Card.Body>
                <div className="flex gap-6">
                  <div>
                    <p className="text-text-muted text-xs">Sent</p>
                    <p className="text-success-600 text-xl font-bold">
                      {health.emailDelivery24h.sent}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Failed</p>
                    <p
                      className={`text-xl font-bold ${
                        health.emailDelivery24h.failed > 0 ? "text-error-600" : "text-text-primary"
                      }`}
                    >
                      {health.emailDelivery24h.failed}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Pending</p>
                    <p className="text-warning-600 text-xl font-bold">
                      {health.emailDelivery24h.pending}
                    </p>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Cloud storage */}
            <Card>
              <Card.Header>
                <h3 className="text-text-primary text-sm font-semibold">Cloud Storage</h3>
              </Card.Header>
              <Card.Body>
                <div className="flex items-center gap-3">
                  <Database size={24} className="text-accent-blue-500" />
                  <div>
                    <p className="text-text-primary text-xl font-bold">
                      {health.cloudStorage.activeFiles.toLocaleString()}
                    </p>
                    <p className="text-text-muted text-xs">Active files stored</p>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>

          {/* BullMQ Job Queue table */}
          {bullmqRows.length > 0 && (
            <div className="mt-4">
              <Card>
                <Card.Header>
                  <h3 className="text-text-primary flex items-center gap-2 text-sm font-semibold">
                    <BarChart2 size={16} />
                    BullMQ Job Queues
                  </h3>
                </Card.Header>
                <Card.Body>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-border-default border-b">
                          <th className="text-text-secondary px-3 py-2 text-left font-medium">
                            Queue
                          </th>
                          <th className="text-text-secondary px-3 py-2 text-right font-medium">
                            Active
                          </th>
                          <th className="text-text-secondary px-3 py-2 text-right font-medium">
                            Waiting
                          </th>
                          <th className="text-text-secondary px-3 py-2 text-right font-medium">
                            Completed
                          </th>
                          <th className="text-text-secondary px-3 py-2 text-right font-medium">
                            Failed
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bullmqRows.map((row) => (
                          <tr
                            key={row.queue}
                            className="border-border-default border-b last:border-0"
                          >
                            <td className="text-text-primary px-3 py-2 font-medium">{row.queue}</td>
                            <td className="text-text-primary px-3 py-2 text-right">{row.active}</td>
                            <td className="text-text-primary px-3 py-2 text-right">
                              {row.waiting}
                            </td>
                            <td className="text-text-primary px-3 py-2 text-right">
                              {row.completed}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={
                                  row.failed > 0
                                    ? "text-error-600 font-semibold"
                                    : "text-text-primary"
                                }
                              >
                                {row.failed}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card.Body>
              </Card>
            </div>
          )}

          {/* Scheduled Jobs */}
          {health.scheduledJobs.length > 0 && (
            <div className="mt-4">
              <Card>
                <Card.Header>
                  <h3 className="text-text-primary flex items-center gap-2 text-sm font-semibold">
                    <Clock size={16} />
                    Scheduled Jobs
                  </h3>
                </Card.Header>
                <Card.Body>
                  <div className="divide-border-default divide-y">
                    {health.scheduledJobs.map((job) => (
                      <div key={job.name} className="flex items-center justify-between py-2">
                        <span className="text-text-primary text-sm">{job.name}</span>
                        <span className="text-text-muted text-xs">
                          {job.nextRun
                            ? `Next: ${new Date(job.nextRun).toLocaleString("en-IN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}`
                            : "Not scheduled"}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
