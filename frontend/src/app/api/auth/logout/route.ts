import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCookies, backendFetch, clearAuthCookies } from "../_lib/proxy-helpers";
import { clearRefreshCache } from "../_lib/refresh";

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await getTokensFromCookies();

    // Clear cached refresh tokens
    clearRefreshCache();

    // Tell backend to destroy the session
    if (accessToken) {
      await backendFetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        request,
      }).catch(() => {}); // Don't block logout on backend failure
    }

    const response = NextResponse.json({ message: "Logged out" });
    return clearAuthCookies(response);
  } catch {
    clearRefreshCache();
    const response = NextResponse.json({ message: "Logged out" });
    return clearAuthCookies(response);
  }
}
