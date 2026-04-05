// ──────────────────────────────────────────────
//  Analytics Constants — §21
// ──────────────────────────────────────────────

// §21.1 + §21.7 — Full global date range options
export const ANALYTICS_PERIODS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "this_week" },
  { label: "Last Week", value: "last_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "This Quarter", value: "this_quarter" },
  { label: "Last Quarter", value: "last_quarter" },
  { label: "This Year", value: "this_year" },
  { label: "Last Year", value: "last_year" },
  { label: "All Time", value: "all_time" },
  { label: "Custom Range", value: "custom" },
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]["value"];

export const ANALYTICS_PERIOD_OPTIONS = ANALYTICS_PERIODS.map((p) => ({
  value: p.value,
  label: p.label,
}));

// §18 — Chart Color Palette (10 sequential colors per spec)
export const CHART_COLORS = [
  "#DAA025", // Chart 1 — Primary (Amber Gold)
  "#001845", // Chart 2 — Secondary (Deep Navy)
  "#1E6FD9", // Chart 3 — Accent Blue
  "#0D9488", // Chart 4 — Accent Teal
  "#9333EA", // Chart 5 — Purple
  "#EA580C", // Chart 6 — Orange
  "#DC2626", // Chart 7 — Red
  "#16A34A", // Chart 8 — Green
  "#6366F1", // Chart 9 — Indigo
  "#EC4899", // Chart 10 — Pink
] as const;

// §21.4.13 — Employee attendance heatmap cell colors
export const ATTENDANCE_HEATMAP_COLORS: Record<string, string> = {
  PRESENT_FULL: "#16A34A",
  PRESENT_HALF: "#86EFAC",
  LATE: "#FACC15",
  ABSENT: "#DC2626",
  ON_LEAVE: "#3B82F6",
  WEEKEND_HOLIDAY: "#9CA3AF",
};

// §21.4.12 — Activity heatmap intensity scale
export const HEATMAP_INTENSITY = [
  "#EBEDF0", // 0
  "#9BE9A8", // 1-2
  "#40C463", // 3-5
  "#30A14E", // 6-9
  "#216E39", // 10+
] as const;
