import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import { logger } from "../instrument.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  Per-Role Rate Limiting — §16
//
//  Redis-backed sliding window rate limiter.
//  Different limits per role:
//  - Recruiter: 200 req/min
//  - Reporting Manager: 200 req/min
//  - Admin: 500 req/min
//  - Unauthenticated: falls through to global limiter
// ──────────────────────────────────────────────

const ROLE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  RECRUITER: { maxRequests: 200, windowMs: 60_000 },
  REPORTING_MANAGER: { maxRequests: 200, windowMs: 60_000 },
  ADMIN: { maxRequests: 500, windowMs: 60_000 },
};

/**
 * Per-user/role rate limiting using Redis sliding window.
 * Applied after auth middleware so req.user is populated.
 */
export function roleRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    // Unauthenticated — let the global express-rate-limit handle it
    next();
    return;
  }

  if (!env.hasRedis) {
    next();
    return;
  }

  const role = req.user.role;
  const limits = ROLE_LIMITS[role];
  if (!limits) {
    next();
    return;
  }

  const key = `rl:user:${req.user.id}`;
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - limits.windowMs;

  // Use sorted set with timestamps for sliding window
  void (async () => {
    try {
      // Remove expired entries
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count current window
      const count = await redis.zcard(key);

      if (count >= limits.maxRequests) {
        const retryAfter = Math.ceil(limits.windowMs / 1000);
        res.set("Retry-After", String(retryAfter));
        res.status(429).json({
          error: "Too many requests. Please slow down.",
          retryAfter,
        });
        return;
      }

      // Add current request
      await redis.zadd(key, now, `${now}:${Math.random()}`);
      await redis.expire(key, Math.ceil(limits.windowMs / 1000) + 1);

      next();
    } catch (err) {
      // On Redis error, fail open (don't block the request)
      logger.warn("Role rate limiter Redis error — failing open", { error: err });
      next();
    }
  })();
}
