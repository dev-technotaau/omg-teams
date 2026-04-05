import { NextRequest, NextResponse } from "next/server";
import { backendFetch, parseTokensFromSetCookie, setAuthCookies } from "../_lib/proxy-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await backendFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      request,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // Backend sets tokens as httpOnly cookies — extract from Set-Cookie headers
    const { accessToken, refreshToken } = parseTokensFromSetCookie(res);

    if (accessToken && refreshToken) {
      // Strip any token data from response body, forward user + sessionId
      const response = NextResponse.json(data);
      return setAuthCookies(response, accessToken, refreshToken, data.sessionId);
    }

    // Fallback: return as-is (shouldn't happen in normal flow)
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
