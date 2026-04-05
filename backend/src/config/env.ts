import path from "node:path";
import dotenv from "dotenv";

// ──────────────────────────────────────────────
//  Load .env file
// ──────────────────────────────────────────────

dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

export function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer, got: "${raw}"`);
  }
  return parsed;
}

export function optionalBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]?.toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  throw new Error(`Environment variable ${key} must be a boolean, got: "${raw}"`);
}

// ──────────────────────────────────────────────
//  Environment Configuration
// ──────────────────────────────────────────────

export const env = {
  // ── App ──
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: optionalInt("PORT", 3000),
  HOST: optional("HOST", "0.0.0.0"),
  LOG_LEVEL: optional("LOG_LEVEL", "info"),
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:3001"),
  BACKEND_INTERNAL_URL: optional("BACKEND_INTERNAL_URL", "http://localhost:3000"),

  // ── Database (PostgreSQL) ──
  DATABASE_URL: process.env["DATABASE_URL"] ?? "",
  DATABASE_DIRECT_URL: process.env["DATABASE_DIRECT_URL"] ?? "",
  DATABASE_SHADOW_URL: optional("DATABASE_SHADOW_URL", ""),
  DATABASE_SSL_MODE: optional("DATABASE_SSL_MODE", "prefer"),
  DATABASE_POOL_SIZE: optionalInt("DATABASE_POOL_SIZE", 10),
  DATABASE_POOL_TIMEOUT: optionalInt("DATABASE_POOL_TIMEOUT", 30),
  DATABASE_CONNECTION_TIMEOUT: optionalInt("DATABASE_CONNECTION_TIMEOUT", 10),
  DATABASE_IDLE_TIMEOUT: optionalInt("DATABASE_IDLE_TIMEOUT", 60),

  // ── Redis ──
  REDIS_URL: optional("REDIS_URL", ""),
  REDIS_HOST: optional("REDIS_HOST", "127.0.0.1"),
  REDIS_PORT: optionalInt("REDIS_PORT", 6379),
  REDIS_PASSWORD: optional("REDIS_PASSWORD", ""),
  REDIS_DB: optionalInt("REDIS_DB", 0),

  // ── JWT / Auth ──
  JWT_SECRET: optional("JWT_SECRET", ""),
  JWT_EXPIRES_IN: optional("JWT_EXPIRES_IN", "7d"),
  JWT_REFRESH_SECRET: optional("JWT_REFRESH_SECRET", ""),
  JWT_REFRESH_EXPIRES_IN: optional("JWT_REFRESH_EXPIRES_IN", "30d"),
  JWT_ALGORITHM: optional("JWT_ALGORITHM", "HS256"),
  JWT_PRIVATE_KEY: optional("JWT_PRIVATE_KEY", ""),
  JWT_PUBLIC_KEY: optional("JWT_PUBLIC_KEY", ""),

  // ── Cookies / BFF ──
  COOKIE_SECRET: optional("COOKIE_SECRET", ""),
  COOKIE_ACCESS_MAX_AGE_DAYS: optionalInt("COOKIE_ACCESS_MAX_AGE_DAYS", 7),
  COOKIE_REFRESH_MAX_AGE_DAYS: optionalInt("COOKIE_REFRESH_MAX_AGE_DAYS", 30),
  CSRF_SECRET: optional("CSRF_SECRET", ""),
  BFF_SECRET: optional("BFF_SECRET", ""),

  // ── Session ──
  SESSION_SECRET: optional("SESSION_SECRET", ""),
  SESSION_MAX_AGE: optionalInt("SESSION_MAX_AGE", 86400000),
  /** §4: Idle timeout in minutes. Default 30 min. Every API request resets TTL. */
  SESSION_IDLE_TIMEOUT_MINUTES: optionalInt("SESSION_IDLE_TIMEOUT_MINUTES", 30),
  /** @deprecated Use SESSION_IDLE_TIMEOUT_MINUTES. Kept for backward compat. */
  SESSION_TIMEOUT_HOURS: optionalInt("SESSION_TIMEOUT_HOURS", 24),
  MAX_SESSIONS_PER_USER: optionalInt("MAX_SESSIONS_PER_USER", 5),

  // ── Auth Security ──
  MAX_LOGIN_ATTEMPTS: optionalInt("MAX_LOGIN_ATTEMPTS", 5),
  ACCOUNT_LOCK_DURATION_MINUTES: optionalInt("ACCOUNT_LOCK_DURATION_MINUTES", 15),
  AUTH_RATE_LIMIT_WINDOW_MS: optionalInt("AUTH_RATE_LIMIT_WINDOW_MS", 60000), // §16: 1 min window
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: optionalInt("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 5), // §16: 5 attempts/min/IP

  // ── Password Policy ──
  PASSWORD_MIN_LENGTH: optionalInt("PASSWORD_MIN_LENGTH", 8),
  PASSWORD_MAX_LENGTH: optionalInt("PASSWORD_MAX_LENGTH", 128),
  PASSWORD_REQUIRE_UPPERCASE: optionalBool("PASSWORD_REQUIRE_UPPERCASE", true),
  PASSWORD_REQUIRE_LOWERCASE: optionalBool("PASSWORD_REQUIRE_LOWERCASE", true),
  PASSWORD_REQUIRE_NUMBER: optionalBool("PASSWORD_REQUIRE_NUMBER", true),
  PASSWORD_REQUIRE_SPECIAL: optionalBool("PASSWORD_REQUIRE_SPECIAL", true),

  // ── Encryption ──
  FIELD_ENCRYPTION_KEY: optional("FIELD_ENCRYPTION_KEY", ""),

  // ── Cloudflare Turnstile (CAPTCHA) ──
  CF_TURNSTILE_SECRET_KEY: optional("CF_TURNSTILE_SECRET_KEY", ""),

  // ── SMTP / Email ──
  SMTP_HOST: optional("SMTP_HOST", ""),
  SMTP_PORT: optionalInt("SMTP_PORT", 587),
  SMTP_USER: optional("SMTP_USER", ""),
  SMTP_PASS: optional("SMTP_PASS", ""),
  SMTP_FROM: optional("SMTP_FROM", "noreply@omgteams.com"),
  SMTP_FROM_NAME: optional("SMTP_FROM_NAME", "OMG Teams"),
  SMTP_SECURE: optionalBool("SMTP_SECURE", false),
  EMAIL_REPLY_TO: optional("EMAIL_REPLY_TO", ""),
  EMAIL_MAX_SEND_PER_HOUR: optionalInt("EMAIL_MAX_SEND_PER_HOUR", 25000),
  EMAIL_MAX_SEND_PER_DAY: optionalInt("EMAIL_MAX_SEND_PER_DAY", 100000),

  // ── Cloudflare R2 (S3-compatible) ──
  R2_ACCOUNT_ID: optional("R2_ACCOUNT_ID", ""),
  R2_ACCESS_KEY_ID: optional("R2_ACCESS_KEY_ID", ""),
  R2_SECRET_ACCESS_KEY: optional("R2_SECRET_ACCESS_KEY", ""),
  R2_BUCKET: optional("R2_BUCKET", ""),
  R2_PUBLIC_URL: optional("R2_PUBLIC_URL", ""),

  // ── Cloudinary ──
  CLOUDINARY_CLOUD_NAME: optional("CLOUDINARY_CLOUD_NAME", ""),
  CLOUDINARY_API_KEY: optional("CLOUDINARY_API_KEY", ""),
  CLOUDINARY_API_SECRET: optional("CLOUDINARY_API_SECRET", ""),

  // ── File Upload Limits ──
  AVATAR_UPLOAD_MAX_SIZE: optionalInt("AVATAR_UPLOAD_MAX_SIZE", 5242880),
  DOCUMENT_UPLOAD_MAX_SIZE: optionalInt("DOCUMENT_UPLOAD_MAX_SIZE", 10485760),
  UPLOAD_DAILY_LIMIT_MB: optionalInt("UPLOAD_DAILY_LIMIT_MB", 100),

  // ── VirusTotal (Virus Scanning) ──
  VIRUSTOTAL_API_KEY: optional("VIRUSTOTAL_API_KEY", ""),

  // ── Signed URL TTL (seconds) ──
  SIGNED_URL_TTL: optionalInt("SIGNED_URL_TTL", 900), // 15 minutes

  // ── Sentry ──
  SENTRY_DSN: optional("SENTRY_DSN", ""),
  SENTRY_AUTH_TOKEN: optional("SENTRY_AUTH_TOKEN", ""),
  SENTRY_RELEASE: optional("SENTRY_RELEASE", ""),

  // ── WebAuthn ──
  WEBAUTHN_RP_ID: optional("WEBAUTHN_RP_ID", "localhost"),
  WEBAUTHN_RP_NAME: optional("WEBAUTHN_RP_NAME", "OMG Teams"),

  // ── Web Push (VAPID) ──
  VAPID_PUBLIC_KEY: optional("VAPID_PUBLIC_KEY", ""),
  VAPID_PRIVATE_KEY: optional("VAPID_PRIVATE_KEY", ""),
  VAPID_SUBJECT: optional("VAPID_SUBJECT", "mailto:noreply@omgteams.com"),

  // ── Firebase (Server-Side Admin) ──
  GOOGLE_CLOUD_PROJECT_ID: optional("GOOGLE_CLOUD_PROJECT_ID", ""),
  FIREBASE_DATABASE_URL: optional("FIREBASE_DATABASE_URL", ""),
  FIREBASE_SERVICE_ACCOUNT: optional("FIREBASE_SERVICE_ACCOUNT", ""),

  // ── Webhooks ──
  WEBHOOK_SECRET: optional("WEBHOOK_SECRET", ""),
  WEBHOOK_CALLBACK_URL: optional("WEBHOOK_CALLBACK_URL", ""),

  // ── BullMQ ──
  BULLMQ_DEFAULT_JOB_OPTIONS_ATTEMPTS: optionalInt("BULLMQ_DEFAULT_JOB_OPTIONS_ATTEMPTS", 3),
  BULLMQ_DEFAULT_JOB_OPTIONS_BACKOFF: optionalInt("BULLMQ_DEFAULT_JOB_OPTIONS_BACKOFF", 1000),
  BULLMQ_REMOVE_ON_COMPLETE: optionalInt("BULLMQ_REMOVE_ON_COMPLETE", 1000),
  BULLMQ_REMOVE_ON_FAIL: optionalInt("BULLMQ_REMOVE_ON_FAIL", 5000),
  BULLMQ_EMAIL_CONCURRENCY: optionalInt("BULLMQ_EMAIL_CONCURRENCY", 5),
  BULLMQ_STORAGE_CONCURRENCY: optionalInt("BULLMQ_STORAGE_CONCURRENCY", 3),
  BULLMQ_NOTIFICATION_CONCURRENCY: optionalInt("BULLMQ_NOTIFICATION_CONCURRENCY", 10),

  // ── OpenTelemetry ──
  OTEL_ENABLED: optionalBool("OTEL_ENABLED", false),
  OTEL_SERVICE_NAME: optional("OTEL_SERVICE_NAME", "omg-teams-backend"),
  OTEL_EXPORTER_OTLP_ENDPOINT: optional("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
  HONEYCOMB_API_KEY: optional("HONEYCOMB_API_KEY", ""),

  // ── Google Analytics (server-side) ──
  GA_MEASUREMENT_ID: optional("GA_MEASUREMENT_ID", ""),
  GA_API_SECRET: optional("GA_API_SECRET", ""),

  // ── CORS — §16: strict CORS, only frontend domain allowed ──
  CORS_ORIGIN: optional("CORS_ORIGIN", "https://teams.opportunitymakers.in,http://localhost:3001"),

  // ── Rate Limiting ──
  RATE_LIMIT_WINDOW_MS: optionalInt("RATE_LIMIT_WINDOW_MS", 60000),
  RATE_LIMIT_MAX: optionalInt("RATE_LIMIT_MAX", 100),

  // ── Swagger ──
  SWAGGER_ENABLED: optionalBool("SWAGGER_ENABLED", true),

  // ── Helpers ──
  get isDev(): boolean {
    return this.NODE_ENV === "development";
  },
  get isProd(): boolean {
    return this.NODE_ENV === "production";
  },
  get isTest(): boolean {
    return this.NODE_ENV === "test";
  },
  get hasDatabaseUrl(): boolean {
    return this.DATABASE_URL !== "";
  },
  get hasRedis(): boolean {
    return this.REDIS_URL !== "" || this.REDIS_HOST !== "127.0.0.1";
  },
  get hasJwtSecret(): boolean {
    return this.JWT_SECRET !== "";
  },
  get hasSession(): boolean {
    return this.SESSION_SECRET !== "" && this.hasRedis;
  },
  get hasSmtp(): boolean {
    return this.SMTP_HOST !== "";
  },
  get hasR2(): boolean {
    return this.R2_BUCKET !== "" && this.R2_ACCESS_KEY_ID !== "";
  },
  get hasCloudinary(): boolean {
    return this.CLOUDINARY_CLOUD_NAME !== "" && this.CLOUDINARY_API_KEY !== "";
  },
  get hasSentry(): boolean {
    return this.SENTRY_DSN !== "";
  },
  get hasFirebase(): boolean {
    return this.FIREBASE_SERVICE_ACCOUNT !== "";
  },
  get hasVapid(): boolean {
    return this.VAPID_PUBLIC_KEY !== "" && this.VAPID_PRIVATE_KEY !== "";
  },
  get hasOtel(): boolean {
    return this.OTEL_ENABLED && this.OTEL_EXPORTER_OTLP_ENDPOINT !== "";
  },
  get hasTurnstile(): boolean {
    return this.CF_TURNSTILE_SECRET_KEY !== "";
  },
  get hasVirusTotal(): boolean {
    return this.VIRUSTOTAL_API_KEY !== "";
  },
} as const;

// ──────────────────────────────────────────────
//  Validation
// ──────────────────────────────────────────────

const VALID_NODE_ENVS = ["development", "production", "test", "staging"];
const VALID_SSL_MODES = ["disable", "prefer", "require", "verify-ca", "verify-full"];

export function validateEnv(): string[] {
  const errors: string[] = [];

  if (!VALID_NODE_ENVS.includes(env.NODE_ENV)) {
    errors.push(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(", ")} (got: "${env.NODE_ENV}")`);
  }

  if (!VALID_SSL_MODES.includes(env.DATABASE_SSL_MODE)) {
    errors.push(
      `DATABASE_SSL_MODE must be one of: ${VALID_SSL_MODES.join(", ")} (got: "${env.DATABASE_SSL_MODE}")`,
    );
  }

  if (env.PORT < 0 || env.PORT > 65535) {
    errors.push(`PORT must be 0-65535 (got: ${env.PORT})`);
  }

  if (env.DATABASE_POOL_SIZE < 1 || env.DATABASE_POOL_SIZE > 1000) {
    errors.push(`DATABASE_POOL_SIZE must be 1-1000 (got: ${env.DATABASE_POOL_SIZE})`);
  }

  return errors;
}
