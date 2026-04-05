import { NextRequest, NextResponse } from "next/server";
import { authenticatedBackendFetch, setAuthCookies, clearAuthCookies } from "../_lib/proxy-helpers";
import { attemptServerRefresh } from "../_lib/refresh";

export async function GET(request: NextRequest) {
  try {
    let res = await authenticatedBackendFetch("/auth/me", { request });

    // If 401, try silent refresh then retry
    if (res.status === 401) {
      const tokens = await attemptServerRefresh();
      if (tokens) {
        res = await authenticatedBackendFetch("/auth/me", {
          request,
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });

        // Always persist refreshed tokens — old refresh token was revoked
        const data = await res.json();
        const response = NextResponse.json(data, { status: res.status });
        return setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
      }

      // Refresh failed — session is dead
      return clearAuthCookies(
        NextResponse.json({ status: "error", message: "Not authenticated" }, { status: 401 }),
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
