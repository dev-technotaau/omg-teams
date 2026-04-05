// ──────────────────────────────────────────────
//  Settings Types
// ──────────────────────────────────────────────

export interface SettingItem {
  key: string;
  value: string;
  category: string;
}

export interface SettingFieldDef {
  key: string;
  label: string;
  description: string;
  type: "text" | "number" | "toggle" | "select" | "time";
  options?: { label: string; value: string }[];
  category: string;
}
