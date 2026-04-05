import { getRedisClient } from "./redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Redis Cache Utility
//
//  Uses the singleton Redis connection.
//  All values are JSON-serialized.
// ──────────────────────────────────────────────

const DEFAULT_TTL = 300; // 5 minutes

export const cache = {
  /**
   * Get a cached value by key.
   * Returns null if the key doesn't exist or Redis is unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await getRedisClient().get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.error("Cache get error", { key, error: (err as Error).message });
      return null;
    }
  },

  /**
   * Set a cached value with optional TTL (in seconds).
   */
  async set(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      await getRedisClient().set(key, raw, "EX", ttl);
    } catch (err) {
      logger.error("Cache set error", { key, error: (err as Error).message });
    }
  },

  /**
   * Delete a cached key.
   */
  async del(key: string): Promise<void> {
    try {
      await getRedisClient().del(key);
    } catch (err) {
      logger.error("Cache del error", { key, error: (err as Error).message });
    }
  },

  /**
   * Delete all keys matching a pattern (e.g. "user:*").
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const redis = getRedisClient();
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      logger.error("Cache delPattern error", { pattern, error: (err as Error).message });
    }
  },

  /**
   * Check if a key exists.
   */
  async has(key: string): Promise<boolean> {
    try {
      return (await getRedisClient().exists(key)) === 1;
    } catch {
      return false;
    }
  },

  /**
   * Get-or-set: returns cached value if it exists, otherwise calls
   * the factory function, caches the result, and returns it.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  },
};
