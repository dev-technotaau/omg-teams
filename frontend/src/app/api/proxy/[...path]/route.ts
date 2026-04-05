import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  BACKEND_URL,
  COOKIE_NAMES,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  sessionCookieOptions,
} from "../../auth/_lib/config";
import { attemptServerRefresh } from "../../auth/_lib/refresh";

/**
 * Generic API proxy: /api/proxy/[...path]
 * Forwards all requests to the Express backend with the access token
 * from httpOnly cookies as a Bearer header.
 * Handles 401 with silent refresh + retry.
 */
async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const backendPath = `/${path.join("/")}`;
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}${backendPath}${searchParams ? `?${searchParams}` : ""}`;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

  // Build headers
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  // Forward client headers for rate limiting / audit
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  if (forwarded) headers.set("x-forwarded-for", forwarded);
  const ua = request.headers.get("user-agent");
  if (ua) headers.set("user-agent", ua);

  // Get request body
  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  let res: Response;
  try {
    res = await fetch(url, { method: request.method, headers, body, cache: "no-store" });
  } catch {
    // Network error — retry once after delay (pod restart etc.)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    res = await fetch(url, { method: request.method, headers, body, cache: "no-store" });
  }

  // On 401, attempt silent refresh then retry once
  if (res.status === 401 && accessToken) {
    const tokens = await attemptServerRefresh();
    if (tokens) {
      headers.set("Authorization", `Bearer ${tokens.accessToken}`);
      res = await fetch(url, { method: request.method, headers, body, cache: "no-store" });

      // Always persist refreshed tokens — old refresh token was revoked
      const responseBody = await res.arrayBuffer();
      const response = new NextResponse(responseBody, {
        status: res.status,
        headers: buildResponseHeaders(res),
      });

      response.cookies.set(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        accessTokenCookieOptions(),
      );
      response.cookies.set(
        COOKIE_NAMES.REFRESH_TOKEN,
        tokens.refreshToken,
        refreshTokenCookieOptions(),
      );
      response.cookies.set(COOKIE_NAMES.AUTH_SESSION, "1", sessionCookieOptions());

      return response;
    }
    // Refresh failed — don't clear cookies (serverless concurrency issue)
  }

  // Stream the backend response through
  const responseBody = await res.arrayBuffer();
  return new NextResponse(responseBody, {
    status: res.status,
    headers: buildResponseHeaders(res),
  });
}

function buildResponseHeaders(res: Response): Record<string, string> {
  const h: Record<string, string> = {};
  const ct = res.headers.get("content-type");
  if (ct) h["content-type"] = ct;
  const requestId = res.headers.get("x-request-id");
  if (requestId) h["x-request-id"] = requestId;
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) h["retry-after"] = retryAfter;
  const cacheControl = res.headers.get("cache-control");
  if (cacheControl) h["cache-control"] = cacheControl;
  return h;
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
