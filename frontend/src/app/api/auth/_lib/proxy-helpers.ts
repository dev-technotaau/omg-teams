import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND_URL,
  COOKIE_NAMES,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  sessionCookieOptions,
} from "./config";

/**
 * Make a server-to-server request to the Express backend.
 * Attaches Content-Type and forwards client IP / user-agent.
 */
export async function backendFetch(
  path: string,
  init: RequestInit & { request?: NextRequest } = {},
): Promise<Response> {
  const { request, ...fetchInit } = init;
  const url = `${BACKEND_URL}${path}`;

  const headers = new Headers(fetchInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Forward client info for rate limiting / audit
  if (request) {
    const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    if (forwarded) headers.set("x-forwarded-for", forwarded);
    const ua = request.headers.get("user-agent");
    if (ua) headers.set("user-agent", ua);
  }

  return fetch(url, { ...fetchInit, headers, cache: "no-store" });
}

/**
 * Make an authenticated backend request using the access token from cookies.
 * Attaches Authorization: Bearer header so the backend skips CSRF.
 */
export async function authenticatedBackendFetch(
  path: string,
  init: RequestInit & { request?: NextRequest } = {},
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

  const { request, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);

  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return backendFetch(path, { ...fetchInit, headers, request });
}

/**
 * Parse access_token and refresh_token from backend's Set-Cookie headers.
 * The OMG backend sets tokens as httpOnly cookies — we extract them
 * from the fetch response and re-set them as BFF-managed cookies.
 */
export function parseTokensFromSetCookie(response: Response): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  const setCookies = response.headers.getSetCookie();
  for (const cookie of setCookies) {
    const [nameValue] = cookie.split(";");
    if (!nameValue) continue;
    const eqIndex = nameValue.indexOf("=");
    if (eqIndex === -1) continue;
    const name = nameValue.slice(0, eqIndex).trim();
    const value = nameValue.slice(eqIndex + 1).trim();

    if (name === "access_token") accessToken = value;
    if (name === "refresh_token") refreshToken = value;
  }

  return { accessToken, refreshToken };
}

/**
 * Set BFF auth cookies on a NextResponse.
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  sessionId?: string,
): NextResponse {
  response.cookies.set(COOKIE_NAMES.ACCESS_TOKEN, accessToken, accessTokenCookieOptions());
  response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, refreshTokenCookieOptions());
  response.cookies.set(COOKIE_NAMES.AUTH_SESSION, "1", sessionCookieOptions());
  if (sessionId) {
    response.cookies.set(COOKIE_NAMES.SESSION_ID, sessionId, sessionCookieOptions());
  }
  return response;
}

/**
 * Clear all BFF auth cookies.
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(COOKIE_NAMES.ACCESS_TOKEN);
  response.cookies.delete(COOKIE_NAMES.REFRESH_TOKEN);
  response.cookies.delete(COOKIE_NAMES.AUTH_SESSION);
  response.cookies.delete(COOKIE_NAMES.SESSION_ID);
  return response;
}

/**
 * Read tokens from request cookies.
 */
export async function getTokensFromCookies() {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || null,
    refreshToken: cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || null,
  };
}

/**
 * Create a JSON error response.
 */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ status: "error", message }, { status });
}
