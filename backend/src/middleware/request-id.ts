import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  §24.3 — Request ID Middleware
//
//  Generates a unique request ID for every HTTP request.
//  Propagated in response headers and available in logging context.
// ──────────────────────────────────────────────

const HEADER = "x-request-id";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing header (from upstream proxy/LB) or generate new
  const requestId = (req.headers[HEADER] as string) ?? crypto.randomUUID();

  // Attach to request for downstream use
  (req as Request & { requestId: string }).requestId = requestId;

  // Echo in response header for client-side correlation
  res.setHeader(HEADER, requestId);

  next();
}
