import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "../_lib/proxy-helpers";

/**
 * POST /api/auth/webauthn-options
 * BFF proxy for getting passkey login challenge options (no auth required).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await backendFetch("/webauthn/login-options", {
      method: "POST",
      body: JSON.stringify(body),
      request,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
