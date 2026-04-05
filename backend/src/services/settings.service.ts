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

export async function getSetting(key: string) {
  // Try cache first
  const cache = await getCachedSettings();
  if (cache.has(key)) {
    return { key, value: cache.get(key) };
  }
  const prisma = getPrisma();
  return prisma.platformSetting.findUnique({ where: { key } });
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
