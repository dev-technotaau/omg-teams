import { logAudit } from "../services/audit.service.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  §23.1 — Audit Middleware
//
//  Automatically logs all write operations (POST, PUT, PATCH, DELETE)
//  by intercepting response completion. Fire-and-forget.
// ──────────────────────────────────────────────

/** Map route patterns to entity types for automatic detection */
const ENTITY_MAP: Record<string, string> = {
  "/candidates": "CANDIDATE_REPORT",
  "/reports": "GENERATED_REPORT",
  "/users": "USER",
  "/companies": "COMPANY",
  "/invoices": "INVOICE",
  "/leaves": "LEAVE_REQUEST",
  "/attendance": "ATTENDANCE",
  "/notifications": "NOTIFICATION",
  "/targets": "TARGET",
  "/bulk": "BULK_OPERATION",
  "/duplicates": "DUPLICATE_GROUP",
  "/settings": "SETTINGS",
  "/admin/sessions": "SESSION",
};

/** Map HTTP methods to action types */
function getAction(method: string, path: string): string {
  if (path.includes("/bulk/delete") || path.includes("/bulk/restore")) {
    return path.includes("restore") ? "BULK_RESTORE" : "BULK_DELETE";
  }
  if (path.includes("/bulk/")) return "BULK_UPDATE";
  if (path.includes("/suspend")) return "STATUS_CHANGE";
  if (path.includes("/reactivate")) return "STATUS_CHANGE";
  if (path.includes("/reset-device")) return "DEVICE_RESET";
  if (path.includes("/reset-password")) return "PASSWORD_RESET";
  if (path.includes("/export")) return "EXPORT";

  switch (method) {
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return "OTHER";
  }
}

function getEntityType(path: string): string {
  // Strip /api/v1 prefix and query string
  const clean = path.replace(/^\/api\/v1/, "").split("?")[0] ?? path;
  for (const [prefix, entity] of Object.entries(ENTITY_MAP)) {
    if (clean.startsWith(prefix)) return entity;
  }
  return "UNKNOWN";
}

function getEntityId(path: string): string | null {
  // Extract ID from paths like /users/abc123 or /users/abc123/reset-device
  const clean = path.replace(/^\/api\/v1/, "").split("?")[0] ?? path;
  const parts = clean.split("/").filter(Boolean);
  // Pattern: /entity/:id/... — ID is usually the second segment
  if (parts.length >= 2 && parts[1] && !parts[1].startsWith("bulk")) {
    // Check if it looks like a cuid/uuid (at least 8 chars, alphanumeric)
    if (parts[1].length >= 8 && /^[a-zA-Z0-9_-]+$/.test(parts[1])) {
      return parts[1];
    }
  }
  return null;
}

/**
 * Audit middleware — attach to all API routes AFTER auth middleware.
 * Only logs successful write operations (2xx status on POST/PUT/PATCH/DELETE).
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only audit write operations
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    next();
    return;
  }

  // Skip non-auditable paths
  const path = req.originalUrl ?? req.url;
  if (
    path.includes("/auth/") ||
    path.includes("/health") ||
    path.includes("/analytics/") ||
    path.includes("/dashboard/") ||
    path.includes("/audit-logs")
  ) {
    next();
    return;
  }

  // Hook into response finish to log after success
  const originalEnd = res.end.bind(res);
  res.end = function (this: Response, ...args: Parameters<Response["end"]>) {
    // Only log successful operations (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const userId = req.user?.id ?? null;
      const userRole = req.user?.role ?? null;

      logAudit({
        userId,
        userRole,
        action: getAction(method, path),
        entityType: getEntityType(path),
        entityId: getEntityId(path),
        changes: null, // Full change tracking requires before/after snapshots per entity
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
    }

    return originalEnd.apply(this, args);
  } as typeof res.end;

  next();
}
