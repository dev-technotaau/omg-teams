import { type Role } from "@prisma/client";
import { cache } from "../config/cache.js";
import { extractAccessToken } from "../config/cookie.js";
import { getPrisma } from "../config/database.js";
import { ErrorCode } from "../constants/error-codes.js";
import { ForbiddenError } from "../exceptions/forbidden-error.js";
import { UnauthorizedError } from "../exceptions/unauthorized-error.js";
import { getSession, refreshSession } from "../services/session.service.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  Auth Middleware
//  Spec Section 4, 22.8 — JWT + Session + Device verification
// ──────────────────────────────────────────────

/**
 * Require authentication. Verifies JWT from BFF cookie,
 * validates session in Redis, validates device binding (§22.8),
 * and refreshes session TTL.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const tokenPayload = extractAccessToken(req);
  if (!tokenPayload) {
    throw new UnauthorizedError("Authentication required", ErrorCode.TOKEN_INVALID);
  }

  const sessionId = tokenPayload["sessionId"] as string | undefined;
  if (!sessionId) {
    throw new UnauthorizedError("Invalid session", ErrorCode.TOKEN_INVALID);
  }

  void getSession(sessionId)
    .then(async (session) => {
      if (!session) {
        next(new UnauthorizedError("Session expired", ErrorCode.TOKEN_EXPIRED));
        return;
      }

      // §22.8 — Device validation on every request (non-Admin only).
      // Uses Redis cache (5 min TTL) to avoid DB hit on every request.
      const role = session.role as Role;
      if (role !== "ADMIN" && session.deviceId) {
        const user = await cache.getOrSet(
          `user_auth:${session.userId}`,
          async () => {
            const prisma = getPrisma();
            return prisma.user.findUnique({
              where: { id: session.userId },
              select: { deviceId: true, status: true },
            });
          },
          300, // 5 minutes
        );

        if (user?.status !== "ACTIVE") {
          next(new UnauthorizedError("Account no longer active", ErrorCode.ACCOUNT_DISABLED));
          return;
        }

        if (user.deviceId && user.deviceId !== session.deviceId) {
          next(new UnauthorizedError("Device mismatch — unauthorized", ErrorCode.TOKEN_INVALID));
          return;
        }
      }

      req.user = {
        id: tokenPayload.sub,
        role,
        sessionId,
        deviceId: session.deviceId,
      };

      // §24.14 — Attach user context to Sentry for error tracking
      try {
        const Sentry = await import("@sentry/node");
        Sentry.setUser({ id: tokenPayload.sub, role });
      } catch {
        /* Sentry not initialized — non-critical */
      }

      void refreshSession(sessionId);
      next();
    })
    .catch(next);
}

/**
 * Require specific role(s). Must be used AFTER requireAuth.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required", ErrorCode.TOKEN_INVALID);
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError("You do not have permission to access this resource");
    }

    next();
  };
}

/**
 * Require Admin role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole("ADMIN")(req, res, next);
}
