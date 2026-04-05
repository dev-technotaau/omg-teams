import helmet from "helmet";
import { env } from "./env.js";
import type { RequestHandler } from "express";

// ──────────────────────────────────────────────
//  Content Security Policy (CSP) + Security Headers
//
//  Strict CSP for an API-first backend:
//  - default-src: 'none' (no resources loaded)
//  - frame-ancestors: 'none' (no embedding)
//  - form-action: 'self'
//  - base-uri: 'self'
//
//  In dev mode, Swagger UI needs 'unsafe-inline'
//  for styles and 'self' for scripts.
// ──────────────────────────────────────────────

export function createSecurityHeaders(): RequestHandler {
  return helmet({
    // ── CSP ──
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: env.SWAGGER_ENABLED ? ["'self'", "'unsafe-inline'"] : ["'none'"],
        styleSrc: env.SWAGGER_ENABLED ? ["'self'", "'unsafe-inline'"] : ["'none'"],
        imgSrc: env.SWAGGER_ENABLED
          ? ["'self'", "data:", "https://validator.swagger.io"]
          : ["'none'"],
        connectSrc: ["'self'"],
        fontSrc: env.SWAGGER_ENABLED ? ["'self'"] : ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: env.isProd ? [] : null,
      },
    },

    // ── HSTS — force HTTPS ──
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // ── Prevent MIME sniffing ──
    xContentTypeOptions: true,

    // ── Prevent clickjacking ──
    xFrameOptions: { action: "deny" },

    // ── Referrer policy ──
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // ── Permissions policy — disable all browser features ──
    permittedCrossDomainPolicies: { permittedPolicies: "none" },

    // ── Cross-Origin policies ──
    crossOriginEmbedderPolicy: false, // breaks Swagger UI
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },

    // ── Origin-Agent-Cluster ──
    originAgentCluster: true,

    // ── DNS Prefetch Control ──
    dnsPrefetchControl: { allow: false },

    // ── Expect-CT (deprecated but still sent by some scanners) ──
    // Not configurable in helmet v8+, handled automatically

    // ── X-XSS-Protection: disabled (CSP is the modern replacement) ──
    xXssProtection: false,

    // ── X-Download-Options ──
    xDownloadOptions: true,
  }) as RequestHandler;
}
