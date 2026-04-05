import jwt from "jsonwebtoken";
import { env } from "./env.js";
import type { CookieOptions, Request, Response } from "express";

// ──────────────────────────────────────────────
//  BFF Cookie Configuration
//
//  Backend-for-Frontend pattern: JWT tokens are
//  stored in HTTPS-only, SameSite cookies instead
//  of being exposed to JS via localStorage.
//
//  - Access token  → short-lived, HttpOnly cookie
//  - Refresh token → long-lived, HttpOnly cookie
//    on a restricted path (/api/v1/auth/refresh)
// ──────────────────────────────────────────────

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const DEVICE_ID_COOKIE = "omg_device_id";

function parseExpiry(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match?.[1] || !match[2]) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict",
    domain: env.isProd ? undefined : undefined, // set your prod domain here
  };
}

/**
 * Set access + refresh token cookies on the response.
 * Call this after successful login / token refresh.
 */
export function setAuthCookies(
  res: Response,
  payload: { sub: string; [key: string]: unknown },
): void {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: Math.floor(parseExpiry(env.JWT_EXPIRES_IN) / 1000),
  });

  const refreshToken = jwt.sign({ sub: payload.sub, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: Math.floor(parseExpiry(env.JWT_REFRESH_EXPIRES_IN) / 1000),
  });

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    maxAge: parseExpiry(env.JWT_EXPIRES_IN),
    path: "/",
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    maxAge: parseExpiry(env.JWT_REFRESH_EXPIRES_IN),
    path: "/api/v1/auth/refresh", // only sent on refresh endpoint
  });
}

/**
 * §22.3 — Set device ID as HTTP-only cookie (backup for localStorage).
 * Persists across sessions. Not cleared on logout (device binding persists).
 */
export function setDeviceIdCookie(res: Response, deviceId: string): void {
  res.cookie(DEVICE_ID_COOKIE, deviceId, {
    ...baseCookieOptions(),
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    path: "/",
  });
}

/**
 * Read device ID from HTTP-only cookie.
 */
export function getDeviceIdFromCookie(req: Request): string | null {
  return (req.cookies as Record<string, string | undefined>)[DEVICE_ID_COOKIE] ?? null;
}

/**
 * Clear auth cookies. Call on logout.
 * NOTE: Device ID cookie is NOT cleared — device binding persists after logout (§22.6).
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: "/api/v1/auth/refresh" });
}

/**
 * Read access token from cookie (BFF) or Authorization header (API).
 * Returns the decoded JWT payload or null.
 */
export function extractAccessToken(req: Request): { sub: string; [key: string]: unknown } | null {
  // 1. Try HttpOnly cookie first (BFF)
  const cookieToken = (req.cookies as Record<string, string | undefined>)[ACCESS_COOKIE];
  if (cookieToken) {
    try {
      return jwt.verify(cookieToken, env.JWT_SECRET) as { sub: string; [key: string]: unknown };
    } catch {
      return null;
    }
  }

  // 2. Fall back to Authorization: Bearer <token> (API clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      return jwt.verify(token, env.JWT_SECRET) as { sub: string; [key: string]: unknown };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Read refresh token from its restricted cookie.
 */
export function extractRefreshToken(req: Request): { sub: string; type: string } | null {
  const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  if (!token) return null;

  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; type: string };
  } catch {
    return null;
  }
}
