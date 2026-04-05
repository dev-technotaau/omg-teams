// ──────────────────────────────────────────────
//  Platform Settings Constants
// ──────────────────────────────────────────────

export const SETTING_CATEGORIES = [
  { key: "general", label: "General" },
  { key: "session", label: "Session & Security" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "reports", label: "Reports" },
  { key: "invoice", label: "Invoice" },
  { key: "data", label: "Data Management" },
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number]["key"];
