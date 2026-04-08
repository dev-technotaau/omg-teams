/**
 * Application-level error codes.
 * Each maps to a stable string for API consumers and logging.
 */
export const ErrorCode = {
  // ── Auth ──
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  REFRESH_TOKEN_EXPIRED: "REFRESH_TOKEN_EXPIRED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  OTP_INVALID: "OTP_INVALID",
  OTP_EXPIRED: "OTP_EXPIRED",
  CSRF_MISSING: "CSRF_MISSING",
  CSRF_INVALID: "CSRF_INVALID",
  /**
   * Admin already has an active session on another device. Returned with
   * HTTP 409 — the client should show a "logout other device?" confirmation
   * dialog and re-submit the login with `confirmReplaceSession: true` to
   * proceed (which will atomically destroy the old session via createSession's
   * single-session enforcement).
   */
  SESSION_EXISTS: "SESSION_EXISTS",

  // ── Authorization ──
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
  NOT_TEAM_MEMBER: "NOT_TEAM_MEMBER",

  // ── Validation ──
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  INVALID_DATE: "INVALID_DATE",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",

  // ── Targets (§23.9) ──
  TARGET_OVERLAP: "TARGET_OVERLAP",
  TARGET_NOT_FOUND: "TARGET_NOT_FOUND",

  // ── Resources ──
  NOT_FOUND: "NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  TEAM_NOT_FOUND: "TEAM_NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  // ── File ──
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FILE_TYPE_NOT_ALLOWED: "FILE_TYPE_NOT_ALLOWED",
  FILE_UPLOAD_FAILED: "FILE_UPLOAD_FAILED",
  FILE_INFECTED: "FILE_INFECTED",

  // ── Rate Limiting ──
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // ── Server ──
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
  REDIS_ERROR: "REDIS_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
