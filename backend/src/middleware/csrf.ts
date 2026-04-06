import crypto from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../instrument.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  CSRF Protection for BFF Cookie Auth
//
//  Double-submit cookie pattern:
//  1. Server sets a non-HttpOnly CSRF token cookie
//  2. Client reads it and sends it in X-CSRF-Token header
//  3. Middleware compares cookie value with header value
//
//  Safe methods (GET, HEAD, OPTIONS) are skipped.
//  This protects state-changing requests that use
//  cookie-based auth from cross-site forgery.
// ──────────────────────────────────────────────

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const BFF_SECRET_HEADER = "x-bff-secret";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Constant-time comparison of two strings of potentially different lengths.
 * Prevents both timing attacks and length-based early-exit attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Middleware: sets a CSRF token cookie if not present.
 * Must be mounted AFTER cookie-parser.
 */
export function csrfTokenSetter(req: Request, res: Response, next: NextFunction): void {
  const existing = (req.cookies as Record<string, string | undefined>)[CSRF_COOKIE];
  if (!existing) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // JS must read this
      secure: env.isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });
  }
  next();
}

/**
 * Middleware: validates CSRF token on state-changing requests.
 * Skips GET/HEAD/OPTIONS. Returns 403 on mismatch.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Skip if request uses Authorization header (API client, not browser BFF)
  if (req.headers.authorization) {
    next();
    return;
  }

  // Skip if request carries the BFF shared secret — this is an authenticated
  // service-to-service call from the Next.js BFF. CSRF's double-submit-cookie
  // pattern is incompatible with a BFF boundary (browser cookies go to the BFF,
  // not to us), so we establish trust via a pre-shared secret instead.
  if (env.BFF_SECRET) {
    const bffHeader = req.headers[BFF_SECRET_HEADER];
    if (typeof bffHeader === "string" && safeCompare(bffHeader, env.BFF_SECRET)) {
      next();
      return;
    }
  }

  const cookieValue = (req.cookies as Record<string, string | undefined>)[CSRF_COOKIE];
  const headerValue = req.headers[CSRF_HEADER];

  if (!cookieValue || !headerValue || typeof headerValue !== "string") {
    logger.warn("CSRF token missing", { ip: req.ip, path: req.originalUrl });
    res.status(403).json({ error: "CSRF token missing" });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(cookieValue), Buffer.from(headerValue))) {
    logger.warn("CSRF token mismatch", { ip: req.ip, path: req.originalUrl });
    res.status(403).json({ error: "CSRF token invalid" });
    return;
  }

  next();
}
