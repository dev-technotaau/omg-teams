import admin from "firebase-admin";
import { cache } from "./cache.js";
import { env } from "./env.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Feature Flags — Firebase Remote Config
//
//  3-layer caching:
//    1. In-memory (60s)
//    2. Redis (60s)
//    3. Firebase Remote Config (source of truth)
//
//  Keys used for maintenance mode:
//    maintenanceMode       (boolean) — toggle
//    maintenanceMessage    (string)  — custom message
//    maintenanceReturnTime (string)  — ISO-8601 timestamp for countdown
// ──────────────────────────────────────────────

type FeatureFlagsConfig = Record<string, boolean | string | number>;

const defaultFlags: FeatureFlagsConfig = {
  maintenanceMode: false,
  maintenanceMessage: "",
  maintenanceReturnTime: "",
};

let cachedFlags: FeatureFlagsConfig = { ...defaultFlags };
let lastFetchTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute
const REDIS_FF_KEY = "ff:all";
const REDIS_FF_TTL = 60;

/**
 * Invalidate the feature flags cache.
 */
export function invalidateCache(): void {
  lastFetchTime = 0;
  void cache.del(REDIS_FF_KEY);
}

/**
 * Fetch feature flags from Firebase Remote Config.
 * @param force - bypass all caches and fetch fresh from Firebase
 */
export async function fetchFeatureFlags(force = false): Promise<FeatureFlagsConfig> {
  const now = Date.now();

  // Layer 1: In-memory cache
  if (!force && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedFlags;
  }

  // Layer 2: Redis cache
  if (!force) {
    try {
      const redisValue = await cache.get(REDIS_FF_KEY);
      if (redisValue) {
        const flags = JSON.parse(String(redisValue)) as FeatureFlagsConfig;
        cachedFlags = flags;
        lastFetchTime = now;
        return flags;
      }
    } catch {
      // Redis unavailable — fall through
    }
  }

  // Layer 3: Firebase Remote Config
  if (!env.hasFirebase) {
    return cachedFlags;
  }

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const remoteConfig = admin.remoteConfig();
      const template = await remoteConfig.getTemplate();

      const flags: FeatureFlagsConfig = { ...defaultFlags };

      if (template.parameters) {
        for (const [key, param] of Object.entries(template.parameters)) {
          const dv = param.defaultValue as { value?: string } | undefined;
          const value = dv?.value;
          if (value === undefined || value === null) continue;

          if (value === "true" || value === "false") {
            flags[key] = value === "true";
          } else if (value !== "" && !isNaN(Number(value))) {
            flags[key] = Number(value);
          } else {
            flags[key] = value;
          }
        }
      }

      cachedFlags = flags;
      lastFetchTime = now;
      logger.info("Feature flags refreshed from Firebase Remote Config");

      // Cache in Redis (fire-and-forget)
      void cache.set(REDIS_FF_KEY, JSON.stringify(flags), REDIS_FF_TTL);

      return flags;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      logger.error("Failed to fetch feature flags from Firebase", { error });
      return cachedFlags;
    }
  }

  return cachedFlags;
}

/**
 * Get a specific feature flag value.
 */
export async function getFlag<T extends boolean | string | number>(
  key: string,
  defaultValue: T,
): Promise<T> {
  const flags = await fetchFeatureFlags();
  return (flags[key] as T) ?? defaultValue;
}

/**
 * Check if a feature is enabled (boolean flag).
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  return getFlag(key, false);
}

/**
 * Get all feature flags.
 * @param force - bypass cache and fetch fresh
 */
export async function getAllFlags(force = false): Promise<FeatureFlagsConfig> {
  return fetchFeatureFlags(force);
}
