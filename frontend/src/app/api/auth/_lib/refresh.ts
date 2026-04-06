import { cookies } from "next/headers";
import { BACKEND_URL, COOKIE_NAMES } from "./config";

/**
 * Mutex to prevent concurrent refresh calls from the proxy.
 * After token rotation the old refresh token is revoked — without a mutex,
 * concurrent 401s would each try to refresh, and all but the first would fail.
 */
let refreshPromise: Promise<{ accessToken: string; refreshToken: string } | null> | null = null;

/** TTL cache for the last successful refresh result */
let cachedTokens: { accessToken: string; refreshToken: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 300_000; // 5 minutes

/** Check if a JWT token is expired by decoding the exp claim */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return true;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (typeof payload.exp !== "number") return true;
    // Add 30-second buffer to avoid edge-case expiry during request
    return Date.now() / 1000 > payload.exp - 30;
  } catch {
    return true;
  }
}

/**
 * Attempt a silent token refresh server-side.
 * Returns new tokens on success or null on failure.
 */
export async function attemptServerRefresh(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  // Return cached tokens if still fresh AND not expired
  if (
    cachedTokens &&
    Date.now() - cachedAt < CACHE_TTL_MS &&
    !isTokenExpired(cachedTokens.accessToken)
  ) {
    return cachedTokens;
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh()
    .then((tokens) => {
      if (tokens) {
        cachedTokens = tokens;
        cachedAt = Date.now();
      }
      return tokens;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/** Clear cached tokens (call on logout) */
export function clearRefreshCache() {
  cachedTokens = null;
  cachedAt = 0;
}

async function doRefresh(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;

  if (!refreshToken) return null;

  try {
    // The OMG backend expects refresh_token as a cookie on the restricted path.
    // In server-to-server fetch, we send it as a Cookie header manually.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Cookie: `refresh_token=${refreshToken}`,
    };
    const bffSecret = process.env.BFF_SECRET;
    if (bffSecret) headers["x-bff-secret"] = bffSecret;

    const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers,
      cache: "no-store",
    });

    if (!res.ok) return null;

    // Backend sets new tokens via Set-Cookie headers
    const setCookies = res.headers.getSetCookie();
    let newAccessToken: string | null = null;
    let newRefreshToken: string | null = null;

    for (const cookie of setCookies) {
      const [nameValue] = cookie.split(";");
      if (!nameValue) continue;
      const eqIndex = nameValue.indexOf("=");
      if (eqIndex === -1) continue;
      const name = nameValue.slice(0, eqIndex).trim();
      const value = nameValue.slice(eqIndex + 1).trim();

      if (name === "access_token") newAccessToken = value;
      if (name === "refresh_token") newRefreshToken = value;
    }

    if (!newAccessToken || !newRefreshToken) return null;

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch {
    return null;
  }
}
