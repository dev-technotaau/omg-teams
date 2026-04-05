import { NextRequest, NextResponse } from "next/server";
import { backendFetch, parseTokensFromSetCookie, setAuthCookies } from "../_lib/proxy-helpers";

/**
 * POST /api/auth/webauthn-login
 * BFF proxy for passkey login — mirrors /api/auth/login but for WebAuthn.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await backendFetch("/webauthn/login", {
      method: "POST",
      body: JSON.stringify(body),
      request,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // Extract tokens from backend Set-Cookie headers (same as password login)
    const { accessToken, refreshToken } = parseTokensFromSetCookie(res);

    if (accessToken && refreshToken) {
      const response = NextResponse.json(data);
      return setAuthCookies(response, accessToken, refreshToken, data.sessionId);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
