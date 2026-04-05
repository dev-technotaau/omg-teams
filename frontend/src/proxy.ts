import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  PUBLIC_ROUTES,
  ADMIN_ROUTE_PREFIX,
  TEAM_ROUTE_PREFIX,
  ROLE_DEFAULT_ROUTE,
} from "@/constants/routes";

// ──────────────────────────────────────────────
//  Next.js 16 Proxy
//
//  1. Per-request CSP nonce generation
//  2. BFF cookie-based auth guard
//  3. Role-based route protection
// ──────────────────────────────────────────────

const PUBLIC_SET = new Set<string>(PUBLIC_ROUTES);

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_SET.has(pathname);
}

// ── CSP builder ──

function buildCsp(nonce: string): string {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";
  const wsUrl = socketUrl.replace(/^http/, "ws");
  const cloudinaryCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseDbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const fbPixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  // ── script-src ──
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://challenges.cloudflare.com",
  ];
  if (gtmId) scriptSources.push("https://www.googletagmanager.com");
  if (gaId)
    scriptSources.push("https://www.google-analytics.com", "https://www.googletagmanager.com");
  if (fbPixelId) scriptSources.push("https://connect.facebook.net");

  // ── img-src ──
  const imgSources = [
    "'self'",
    "data:",
    "blob:",
    // OAuth provider avatars
    "https://lh3.googleusercontent.com",
    "https://avatars.githubusercontent.com",
  ];
  if (cloudinaryCloud) imgSources.push(`https://res.cloudinary.com/${cloudinaryCloud}`);
  if (r2Url) imgSources.push(r2Url);
  if (gtmId || gaId)
    imgSources.push("https://www.google-analytics.com", "https://www.googletagmanager.com");
  if (fbPixelId) imgSources.push("https://www.facebook.com");

  // ── connect-src ──
  const connectSources = ["'self'", socketUrl, wsUrl];
  if (sentryDsn) connectSources.push("https://*.ingest.sentry.io");
  if (firebaseProjectId) {
    connectSources.push(
      "https://fcm.googleapis.com",
      "https://firebaseinstallations.googleapis.com",
      "https://firebaseremoteconfig.googleapis.com",
      "https://firebaselogging-pa.googleapis.com",
    );
  }
  // Firebase Realtime Database
  if (firebaseDbUrl) {
    connectSources.push(firebaseDbUrl);
    // RTDB also uses WebSocket
    connectSources.push(firebaseDbUrl.replace("https://", "wss://"));
  }
  if (gtmId || gaId) {
    connectSources.push(
      "https://www.google-analytics.com",
      "https://analytics.google.com",
      "https://www.googletagmanager.com",
      "https://region1.google-analytics.com",
      "https://stats.g.doubleclick.net",
    );
  }
  if (fbPixelId) connectSources.push("https://www.facebook.com");
  // Vercel Analytics + Speed Insights
  connectSources.push("https://va.vercel-scripts.com", "https://vitals.vercel-insights.com");

  // ── frame-src ──
  const frameSources = ["'self'"];
  frameSources.push("https://challenges.cloudflare.com"); // Turnstile CAPTCHA
  if (gtmId) frameSources.push("https://www.googletagmanager.com");

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSources.join(" ")}`,
    // unsafe-inline required: Next.js + Tailwind inject non-nonce'd inline styles
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src ${imgSources.join(" ")}`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    // Service worker needs gstatic.com for Firebase SDK importScripts
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];

  return directives.join("; ");
}

/** Attach CSP + nonce headers to a NextResponse */
function nextWithCsp(nonce: string): NextResponse {
  const csp = buildCsp(nonce);
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

/** Attach CSP headers to a redirect response */
function redirectWithCsp(url: URL, nonce: string): NextResponse {
  const csp = buildCsp(nonce);
  const response = NextResponse.redirect(url);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

// ── Main proxy function ──

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const accessToken = request.cookies.get("omg_access_token")?.value;

  // ── Public routes ──
  if (isPublicRoute(pathname)) {
    if (accessToken && pathname === "/login") {
      const payload = decodeJwtPayload(accessToken);
      const role = (payload?.role as string) ?? "RECRUITER";
      const dashboard = ROLE_DEFAULT_ROUTE[role] ?? "/dashboard";
      return redirectWithCsp(new URL(dashboard, request.url), nonce);
    }
    return nextWithCsp(nonce);
  }

  // ── Unauthenticated → /login ──
  if (!accessToken) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return redirectWithCsp(loginUrl, nonce);
  }

  // ── Decode JWT for role-based routing ──
  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    return redirectWithCsp(new URL("/login", request.url), nonce);
  }

  const role = payload.role as string;

  // Admin routes: only ADMIN
  if (pathname.startsWith(ADMIN_ROUTE_PREFIX) && role !== "ADMIN") {
    return redirectWithCsp(new URL("/dashboard", request.url), nonce);
  }

  // Team routes: only REPORTING_MANAGER (and ADMIN for oversight)
  if (pathname.startsWith(TEAM_ROUTE_PREFIX) && role !== "REPORTING_MANAGER" && role !== "ADMIN") {
    return redirectWithCsp(new URL("/dashboard", request.url), nonce);
  }

  // Root path → role-specific dashboard
  if (pathname === "/") {
    const dashboard = ROLE_DEFAULT_ROUTE[role] ?? "/dashboard";
    return redirectWithCsp(new URL(dashboard, request.url), nonce);
  }

  return nextWithCsp(nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav)$).*)",
  ],
};

/** Decode JWT payload without signature verification. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>;
    const exp = payload.exp as number | undefined;
    if (exp && Date.now() / 1000 > exp) return null;
    return payload;
  } catch {
    return null;
  }
}
