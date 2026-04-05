/**
 * BFF (Backend-For-Frontend) configuration.
 * Server-side only — never exposed to the browser.
 */

/** Backend URL for server-to-server calls (never sent to client) */
export const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000/api/v1";

export const COOKIE_NAMES = {
  ACCESS_TOKEN: "omg_access_token",
  REFRESH_TOKEN: "omg_refresh_token",
  /** Non-httpOnly flag so client JS can detect auth state */
  AUTH_SESSION: "omg_auth_session",
  /** Non-httpOnly session ID for UI display */
  SESSION_ID: "omg_session_id",
} as const;

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const daysToSeconds = (days: number) => days * 24 * 60 * 60;

const ACCESS_MAX_AGE_DAYS = parseInt(process.env.COOKIE_ACCESS_MAX_AGE_DAYS || "7", 10);
const REFRESH_MAX_AGE_DAYS = parseInt(process.env.COOKIE_REFRESH_MAX_AGE_DAYS || "30", 10);

export function accessTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/",
    maxAge: daysToSeconds(ACCESS_MAX_AGE_DAYS),
  };
}

export function refreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/",
    maxAge: daysToSeconds(REFRESH_MAX_AGE_DAYS),
  };
}

export function sessionCookieOptions() {
  return {
    httpOnly: false,
    secure: IS_PRODUCTION,
    sameSite: "lax" as const, // Lax for session indicator — allows external link navigation
    path: "/",
    maxAge: daysToSeconds(ACCESS_MAX_AGE_DAYS),
  };
}
