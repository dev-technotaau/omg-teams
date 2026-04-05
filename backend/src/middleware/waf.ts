import { env } from "../config/env.js";
import { logger } from "../instrument.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  Web Application Firewall (WAF) Middleware
//
//  Lightweight request-level protection:
//  1. Block suspicious user agents (scanners, bots)
//  2. Block path traversal attempts
//  3. Block SQL injection patterns in query/body
//  4. Block XSS payloads in query/body
//  5. Block oversized headers
//  6. IP-based request fingerprinting header
// ──────────────────────────────────────────────

// ── Blocked user agents (case-insensitive substrings) ──
const BLOCKED_UA_PATTERNS = [
  "sqlmap",
  "nikto",
  "nessus",
  "openvas",
  "masscan",
  "zgrab",
  "dirbuster",
  "gobuster",
  "nmap",
  "wpscan",
  "nuclei",
  "httpx",
  "acunetix",
  "burpsuite",
];

// ── Path traversal patterns ──
const PATH_TRAVERSAL_RE = /(\.\.[/\\]|%2e%2e[/\\%]|\.\.%2f|%2e%2e%5c)/i;

// ── SQL injection patterns ──
const SQL_INJECTION_RE =
  /(\b(union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|update\s+.*\s+set|exec(\s|\()|execute(\s|\()|xp_|sp_|0x[0-9a-f]{8})\b|['";]--\s|\/\*[\s\S]*?\*\/)/i;

// ── XSS patterns ──
const XSS_RE =
  /(<script[\s>]|javascript\s*:|on(error|load|click|mouseover|focus|blur)\s*=|<iframe|<object|<embed|<svg[\s/].*?on\w+\s*=)/i;

// ── Blocked file extensions in URL ──
const BLOCKED_EXTENSIONS_RE =
  /\.(env|git|svn|htaccess|htpasswd|DS_Store|bak|sql|log|ini|cfg|conf|swp)(\?|$)/i;

function blockRequest(res: Response, reason: string, ip: string, path: string): void {
  logger.warn("WAF blocked request", { reason, ip, path });
  res.status(403).json({ error: "Forbidden" });
}

function extractPayloadStrings(req: Request): string[] {
  const parts: string[] = [];

  // Query string values
  for (const val of Object.values(req.query)) {
    if (typeof val === "string") parts.push(val);
  }

  // Body values (shallow scan of string fields)
  if (req.body && typeof req.body === "object") {
    const body = req.body as Record<string, unknown>;
    for (const val of Object.values(body)) {
      if (typeof val === "string") parts.push(val);
    }
  }

  return parts;
}

export function wafMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const ua = req.headers["user-agent"] ?? "";
  const urlPath = req.originalUrl;

  // 1. Block suspicious user agents
  const uaLower = ua.toLowerCase();
  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (uaLower.includes(pattern)) {
      blockRequest(res, `Blocked user-agent: ${pattern}`, ip, urlPath);
      return;
    }
  }

  // 2. Block path traversal
  if (PATH_TRAVERSAL_RE.test(urlPath)) {
    blockRequest(res, "Path traversal attempt", ip, urlPath);
    return;
  }

  // 3. Block sensitive file access
  if (BLOCKED_EXTENSIONS_RE.test(urlPath)) {
    blockRequest(res, "Blocked file extension", ip, urlPath);
    return;
  }

  // 4. Block oversized headers (potential header injection / smuggling)
  const totalHeaderSize = Object.entries(req.headers).reduce(
    (sum, [k, v]) => sum + k.length + (typeof v === "string" ? v.length : 0),
    0,
  );
  if (totalHeaderSize > 16_384) {
    blockRequest(res, "Oversized headers", ip, urlPath);
    return;
  }

  // 5. Scan query + body for SQLi / XSS
  const payloads = extractPayloadStrings(req);
  for (const payload of payloads) {
    if (SQL_INJECTION_RE.test(payload)) {
      blockRequest(res, "SQL injection pattern", ip, urlPath);
      return;
    }
    if (XSS_RE.test(payload)) {
      blockRequest(res, "XSS pattern", ip, urlPath);
      return;
    }
  }

  // 6. Attach request fingerprint header (dev only — don't leak IP in production)
  if (!env.isProd) {
    res.setHeader("X-Request-IP", ip);
  }

  next();
}
