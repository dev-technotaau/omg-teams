import { NextResponse } from "next/server";
import { getTokensFromCookies, setAuthCookies, clearAuthCookies } from "../_lib/proxy-helpers";
import { attemptServerRefresh } from "../_lib/refresh";

export async function POST() {
  try {
    const { refreshToken } = await getTokensFromCookies();

    if (!refreshToken) {
      return clearAuthCookies(
        NextResponse.json({ status: "error", message: "No refresh token" }, { status: 401 }),
      );
    }

    const tokens = await attemptServerRefresh();

    if (!tokens) {
      return clearAuthCookies(
        NextResponse.json({ status: "error", message: "Refresh failed" }, { status: 401 }),
      );
    }

    const response = NextResponse.json({ status: "success", message: "Token refreshed" });
    return setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
  } catch {
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
