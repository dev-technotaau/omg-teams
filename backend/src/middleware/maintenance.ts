import { cache } from "../config/cache.js";
import { isFeatureEnabled, getFlag } from "../config/feature-flags.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  Maintenance Mode Middleware — Spec §24.18
//
//  Dual-source maintenance mode:
//  1. Firebase Remote Config `maintenanceMode` flag
//     → Affects ALL users including admin (whole-app maintenance)
//     → Managed from Firebase Console
//  2. Redis `platform:maintenance_mode` flag
//     → Affects non-admin only (admin-toggled from settings)
//     → Managed from admin settings panel
//     → Supports custom message + estimated return time
//
//  Firebase takes priority. If Firebase says maintenance,
//  everyone sees it. If only Redis says maintenance,
//  admins can still access.
// ──────────────────────────────────────────────

const REDIS_MAINTENANCE_KEY = "platform:maintenance_mode";
const REDIS_MAINTENANCE_MESSAGE_KEY = "platform:maintenance_message";
const REDIS_MAINTENANCE_RETURN_KEY = "platform:maintenance_return_time";

const DEFAULT_MESSAGE =
  "We're performing scheduled maintenance to improve your experience. We'll be back online shortly.";

// Endpoints that bypass maintenance (frontend needs to check status)
const WHITELIST_PATTERNS = [/\/feature-flags/, /\/auth\/login/, /\/health/];

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip health checks
  if (req.path === "/health" || req.path.startsWith("/health/")) {
    next();
    return;
  }

  void checkMaintenance(req, res, next);
}

async function checkMaintenance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Check if path is whitelisted
    const isWhitelisted = WHITELIST_PATTERNS.some((p) => p.test(req.path));
    if (isWhitelisted) {
      next();
      return;
    }

    // Source 1: Firebase Remote Config (whole-app, affects everyone)
    const firebaseMaintenance = await isFeatureEnabled("maintenanceMode");

    if (firebaseMaintenance) {
      // Firebase maintenance blocks EVERYONE — no admin bypass
      const message = await getFlag("maintenanceMessage", DEFAULT_MESSAGE);
      const estimatedReturnTime = await getFlag("maintenanceReturnTime", "");

      const firebaseBody: Record<string, unknown> = {
        error: "Service Unavailable",
        message,
        code: "MAINTENANCE_MODE",
        maintenance: true,
        source: "firebase",
      };
      if (estimatedReturnTime) firebaseBody["estimatedReturnTime"] = estimatedReturnTime;

      res.status(503).json(firebaseBody);
      return;
    }

    // Source 2: Redis flag (admin-toggled, admin can bypass)
    const redisMaintenance = await cache.get(REDIS_MAINTENANCE_KEY);
    if (redisMaintenance === "true" || redisMaintenance === "1") {
      // Redis maintenance — admin can bypass
      if (req.user?.role === "ADMIN") {
        next();
        return;
      }

      // Read custom message and return time from Redis
      const [customMessage, returnTime] = await Promise.all([
        cache.get(REDIS_MAINTENANCE_MESSAGE_KEY),
        cache.get(REDIS_MAINTENANCE_RETURN_KEY),
      ]);

      const body: Record<string, unknown> = {
        error: "Service Unavailable",
        message: (customMessage as string) || DEFAULT_MESSAGE,
        code: "MAINTENANCE_MODE",
        maintenance: true,
        source: "admin",
      };
      if (returnTime) body["estimatedReturnTime"] = returnTime as string;

      res.status(503).json(body);
      return;
    }

    next();
  } catch {
    // If flag check fails, don't block requests
    next();
  }
}

/**
 * Enable admin-level maintenance mode (Redis).
 * Optionally set a custom message and estimated return time.
 */
export async function enableMaintenance(options?: {
  message?: string | undefined;
  estimatedReturnTime?: string | undefined;
}): Promise<void> {
  await cache.set(REDIS_MAINTENANCE_KEY, "true");

  if (options?.message) {
    await cache.set(REDIS_MAINTENANCE_MESSAGE_KEY, options.message);
  } else {
    await cache.del(REDIS_MAINTENANCE_MESSAGE_KEY);
  }

  if (options?.estimatedReturnTime) {
    await cache.set(REDIS_MAINTENANCE_RETURN_KEY, options.estimatedReturnTime);
  } else {
    await cache.del(REDIS_MAINTENANCE_RETURN_KEY);
  }
}

/**
 * Disable admin-level maintenance mode (Redis).
 * Cleans up message and return time keys.
 */
export async function disableMaintenance(): Promise<void> {
  await Promise.all([
    cache.del(REDIS_MAINTENANCE_KEY),
    cache.del(REDIS_MAINTENANCE_MESSAGE_KEY),
    cache.del(REDIS_MAINTENANCE_RETURN_KEY),
  ]);
}

/**
 * Get admin-level maintenance status with details.
 */
export async function getMaintenanceStatus(): Promise<{
  active: boolean;
  message: string | null;
  estimatedReturnTime: string | null;
}> {
  const [value, message, returnTime] = await Promise.all([
    cache.get(REDIS_MAINTENANCE_KEY),
    cache.get(REDIS_MAINTENANCE_MESSAGE_KEY),
    cache.get(REDIS_MAINTENANCE_RETURN_KEY),
  ]);

  return {
    active: value === "true" || value === "1",
    message: (message as string) || null,
    estimatedReturnTime: (returnTime as string) || null,
  };
}
