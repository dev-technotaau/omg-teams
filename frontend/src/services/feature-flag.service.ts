import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Feature Flag Service — Admin-only
// ──────────────────────────────────────────────

export async function getAllFlags(): Promise<Record<string, unknown>> {
  const res = await api.get<{ flags: Record<string, unknown> }>("/feature-flags");
  return res.data.flags;
}
