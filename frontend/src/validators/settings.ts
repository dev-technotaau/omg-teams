// ──────────────────────────────────────────────
//  Settings Validation Schemas
// ──────────────────────────────────────────────

import { z } from "zod";

export const settingValueSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const settingsBatchSchema = z.object({
  settings: z.array(settingValueSchema).min(1),
});

export type SettingsBatchInput = z.infer<typeof settingsBatchSchema>;
