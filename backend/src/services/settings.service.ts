import { type Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Platform Settings Service — Spec Section 23.12
//  With Redis caching for performance
// ──────────────────────────────────────────────

const CACHE_KEY = "platform_settings";
const CACHE_TTL = 300; // 5 minutes

/** §23.12 — Get Redis-cached settings, falling back to DB */
async function getCachedSettings(): Promise<Map<string, unknown>> {
  try {
    const { getRedisClient } = await import("../config/redis.js");
    const redis = getRedisClient();
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      const entries = JSON.parse(cached) as [string, unknown][];
      return new Map(entries);
    }
  } catch {
    // Redis unavailable — fall through to DB
  }
  return new Map();
}

/** §23.12 — Invalidate settings cache on update */
async function invalidateCache(): Promise<void> {
  try {
    const { getRedisClient } = await import("../config/redis.js");
    const redis = getRedisClient();
    await redis.del(CACHE_KEY);
  } catch {
    // non-critical
  }
  // Also bust per-domain caches that read PlatformSetting indirectly so a
  // save in the admin UI takes effect immediately instead of waiting for TTL.
  try {
    const { cache } = await import("../config/cache.js");
    await cache.delPattern("attendance_config:*");
    await cache.delPattern("leave_config:*");
    await cache.delPattern("notification_config:*");
    await cache.delPattern("invoice_config:*");
    await cache.delPattern("data_config:*");
    await cache.delPattern("report_config:*");
  } catch {
    // non-critical
  }
}

/** §23.12 — Warm the cache from DB */
async function warmCache(): Promise<void> {
  const prisma = getPrisma();
  try {
    const all = await prisma.platformSetting.findMany();
    const entries = all.map((s) => [s.key, s.value] as [string, unknown]);
    const { getRedisClient } = await import("../config/redis.js");
    const redis = getRedisClient();
    await redis.set(CACHE_KEY, JSON.stringify(entries), "EX", CACHE_TTL);
  } catch {
    logger.debug("Settings cache warm failed (non-critical)");
  }
}

// ──────────────────────────────────────────────
//  Default values for every key the admin Settings page can show.
//  Single source of truth shared by:
//   - the Prisma seed (initial DB hydration)
//   - ensureDefaultsOnBoot() (existing deployments / missing rows)
//   - the typed readers below (fallback when DB row missing)
//
//  When you add a setting, ADD IT HERE — not in three places.
// ──────────────────────────────────────────────
export const PLATFORM_SETTING_DEFAULTS: readonly {
  category: string;
  key: string;
  value: unknown;
}[] = [
  // Attendance
  { category: "attendance", key: "expected_login_time", value: "10:00" },
  { category: "attendance", key: "grace_period_minutes", value: 15 },
  { category: "attendance", key: "half_day_threshold_minutes", value: 240 },
  { category: "attendance", key: "working_days", value: "Mon,Tue,Wed,Thu,Fri,Sat" },
  { category: "attendance", key: "standard_day_minutes", value: 480 },
  { category: "attendance", key: "break_deduction_minutes", value: 60 },
  { category: "attendance", key: "excessive_late_threshold", value: 5 },
  // Leave
  { category: "leave", key: "leave_negative_balance", value: false },
  { category: "leave", key: "leave_low_balance_threshold", value: 2 },
  // Reports
  { category: "reports", key: "report_retention_days", value: 30 },
  { category: "reports", key: "report_default_schedule_time", value: "09:00" },
  // Invoice
  { category: "invoice", key: "invoice_prefix", value: "HF" },
  { category: "invoice", key: "invoice_date_format", value: "YYYY-MM-DD" },
  { category: "invoice", key: "invoice_starting_serial", value: 1 },
  // Data Management
  { category: "data", key: "archive_threshold_months", value: 12 },
  { category: "data", key: "trash_auto_purge_days", value: 90 },
  // Notifications
  { category: "notification", key: "notification_admin_emails", value: "" },
  { category: "notification", key: "notification_email_enabled", value: true },
  { category: "notification", key: "notification_device_mismatch", value: true },
  { category: "notification", key: "notification_suspicious_activity", value: true },
  // Offer Letter
  { category: "offer_letter", key: "offer_letter_signatory_name", value: "Shalini Singh" },
  { category: "offer_letter", key: "offer_letter_signatory_title", value: "HR Manager" },
];

/**
 * Ensure every default setting exists in the DB. Called once at server boot.
 *
 * - Inserts any missing key with its default value (no overwrite of existing)
 * - Lets admins who never re-ran the seed still see the full settings UI
 *   populated correctly
 * - Idempotent — safe to call repeatedly
 */
export async function ensureDefaultsOnBoot(): Promise<void> {
  const prisma = getPrisma();
  try {
    for (const def of PLATFORM_SETTING_DEFAULTS) {
      await prisma.platformSetting.upsert({
        where: { key: def.key },
        update: {}, // never overwrite existing values
        create: {
          category: def.category,
          key: def.key,
          value: def.value as Prisma.InputJsonValue,
          updatedBy: "SYSTEM",
        },
      });
    }
    await invalidateCache();
    logger.info("Platform settings defaults ensured", {
      count: PLATFORM_SETTING_DEFAULTS.length,
    });
  } catch (err) {
    logger.error("Failed to ensure platform settings defaults", { err });
  }
}

export async function getSetting(key: string) {
  // Try cache first
  const cache = await getCachedSettings();
  if (cache.has(key)) {
    return { key, value: cache.get(key) };
  }
  const prisma = getPrisma();
  return prisma.platformSetting.findUnique({ where: { key } });
}

// ──────────────────────────────────────────────
//  Typed readers — return parsed value or default.
//  All values land in PlatformSetting.value as JSON;
//  the admin UI sometimes stores them as strings, so
//  every reader is defensive about both shapes.
// ──────────────────────────────────────────────

export async function getSettingString(key: string, fallback: string): Promise<string> {
  const row = await getSetting(key);
  const v = row?.value;
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const row = await getSetting(key);
  const v = row?.value;
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export async function getSettingBool(key: string, fallback: boolean): Promise<boolean> {
  const row = await getSetting(key);
  const v = row?.value;
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

export async function getSettingCSV(key: string, fallback: string[]): Promise<string[]> {
  const s = await getSettingString(key, "");
  if (!s) return fallback;
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function getSettingsByCategory(category: string) {
  const prisma = getPrisma();
  return prisma.platformSetting.findMany({ where: { category } });
}

export async function getAllSettings() {
  const prisma = getPrisma();
  const settings = await prisma.platformSetting.findMany({ orderBy: { category: "asc" } });
  // Warm cache on full fetch
  void warmCache();
  return settings;
}

export async function updateSetting(
  key: string,
  value: unknown,
  updatedBy: string,
  category?: string,
) {
  const prisma = getPrisma();
  const result = await prisma.platformSetting.upsert({
    where: { key },
    update: { value: value as Prisma.InputJsonValue, updatedBy },
    create: {
      category: category ?? "general",
      key,
      value: value as Prisma.InputJsonValue,
      updatedBy,
    },
  });
  // Invalidate cache on any update
  void invalidateCache();
  return result;
}
