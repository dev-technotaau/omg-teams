import crypto from "node:crypto";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Redis Session Management
//  Spec Section 4, 22.7, 25.3
// ──────────────────────────────────────────────

const SESSION_PREFIX = "session:";
const USER_SESSION_PREFIX = "user_session:";
const LOCKOUT_PREFIX = "lockout:";
const FAILED_ATTEMPTS_PREFIX = "failed_attempts:";

export interface SessionData {
  sessionId: string;
  userId: string;
  role: string;
  deviceId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  createdAt: string;
  lastActiveAt: string;
}

/**
 * Create a new session in Redis.
 * Enforces single-session-per-user by removing existing sessions.
 */
export async function createSession(data: {
  userId: string;
  role: string;
  deviceId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}): Promise<SessionData> {
  const redis = getRedisClient();
  const sessionId = crypto.randomBytes(24).toString("base64url");
  const now = new Date().toISOString();

  const session: SessionData = {
    sessionId,
    userId: data.userId,
    role: data.role,
    deviceId: data.deviceId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    createdAt: now,
    lastActiveAt: now,
  };

  // Remove existing session for this user (single session enforcement)
  const existingSessionId = await redis.get(`${USER_SESSION_PREFIX}${data.userId}`);
  if (existingSessionId) {
    await redis.del(`${SESSION_PREFIX}${existingSessionId}`);
  }

  // Calculate TTL — session lives until midnight or idle timeout, whichever is
  // shorter. Admin is exempt from the midnight cap (consistent with the
  // autologout cron exemption) so admin only ever logs out via idle timeout.
  const ttl = calculateSessionTTL(data.role);

  // Store session
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), "EX", ttl);

  // Map userId → sessionId for single-session lookup
  await redis.set(`${USER_SESSION_PREFIX}${data.userId}`, sessionId, "EX", ttl);

  return session;
}

/**
 * Get session by session ID.
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

/**
 * Throttle for DB lastActiveAt writes inside refreshSession. Postgres
 * gets updated at most once per minute per session — keeps the column
 * meaningful for the admin sessions page without hammering the DB on
 * every authenticated API request.
 */
const DB_LAST_ACTIVE_THROTTLE_MS = 60_000;

/**
 * Refresh session TTL on every authenticated request.
 * §4: "Every authenticated API request refreshes the TTL."
 *
 * Also updates the DB Session.lastActiveAt column on a 60-second
 * throttle. The DB column is what the admin sessions page filters on
 * to determine "currently active" — without this update it would
 * stay frozen at session-creation time forever.
 */
export async function refreshSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return;

  const session = JSON.parse(raw) as SessionData;
  const previousLastActive = new Date(session.lastActiveAt).getTime();
  const now = new Date();
  session.lastActiveAt = now.toISOString();

  // calculateSessionTTL already enforces the correct idle window per role
  // (admin → ADMIN_SESSION_IDLE_TIMEOUT_MINUTES, others → SESSION_IDLE_TIMEOUT_MINUTES
  // capped at midnight) so we don't need to wrap it in another Math.min here.
  const ttl = calculateSessionTTL(session.role);
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), "EX", ttl);
  await redis.expire(`${USER_SESSION_PREFIX}${session.userId}`, ttl);

  // Throttled DB write — only if it's been more than DB_LAST_ACTIVE_THROTTLE_MS
  // since the previous Redis-side update. Fire-and-forget so the request
  // path doesn't pay for the round-trip.
  if (now.getTime() - previousLastActive >= DB_LAST_ACTIVE_THROTTLE_MS) {
    void getPrisma()
      .session.updateMany({
        where: { token: sessionId, revokedAt: null },
        data: { lastActiveAt: now },
      })
      .catch((err: unknown) => {
        logger.warn("Failed to update Session.lastActiveAt", { err });
      });
  }
}

/**
 * Destroy a session (logout or admin revoke).
 *
 * Always marks the DB row as revoked, even if Redis no longer has the
 * key — this is the single source of truth so callers don't have to
 * remember to update the DB themselves.
 */
export async function destroySession(sessionId: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);

  // Mark the DB row revoked unconditionally — handles both the "Redis
  // still has it" and "Redis already lost it" cases.
  await getPrisma()
    .session.updateMany({
      where: { token: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch((err: unknown) => {
      logger.warn("Failed to mark session revoked in DB", { err, sessionId });
    });

  if (!raw) return null;

  const session = JSON.parse(raw) as SessionData;
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
  await redis.del(`${USER_SESSION_PREFIX}${session.userId}`);

  return session;
}

/**
 * Destroy all sessions for a user.
 *
 * Marks every non-revoked DB Session row for the user as revoked,
 * so callers in user.service.ts (suspend / delete / password reset /
 * device reset / reactivate) and godview.service.ts don't leave
 * ghost rows behind.
 */
export async function destroyUserSessions(userId: string): Promise<void> {
  const redis = getRedisClient();
  const sessionId = await redis.get(`${USER_SESSION_PREFIX}${userId}`);
  if (sessionId) {
    await redis.del(`${SESSION_PREFIX}${sessionId}`);
  }
  await redis.del(`${USER_SESSION_PREFIX}${userId}`);

  await getPrisma()
    .session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch((err: unknown) => {
      logger.warn("Failed to mark user sessions revoked in DB", { err, userId });
    });

  // §24.10 — Notify client of session revocation via Socket.io
  try {
    const { emitSessionRevoked } = await import("../socket.js");
    emitSessionRevoked(userId);
  } catch {
    /* socket not initialized — non-critical */
  }
}

/**
 * Get session ID for a user (for admin visibility).
 */
export async function getUserSessionId(userId: string): Promise<string | null> {
  return getRedisClient().get(`${USER_SESSION_PREFIX}${userId}`);
}

// ──────────────────────────────────────────────
//  Account Lockout (Spec Section 25.1)
// ──────────────────────────────────────────────

/**
 * Record a failed login attempt. Returns current count.
 */
export async function recordFailedAttempt(userId: string): Promise<number> {
  const redis = getRedisClient();
  const key = `${FAILED_ATTEMPTS_PREFIX}${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    // Set expiry on first failure (lockout window resets after configured minutes)
    await redis.expire(key, env.ACCOUNT_LOCK_DURATION_MINUTES * 60);
  }
  return count;
}

/**
 * Check if account is locked.
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const redis = getRedisClient();
  const lockKey = `${LOCKOUT_PREFIX}${userId}`;
  return (await redis.exists(lockKey)) === 1;
}

/**
 * Lock an account after max failed attempts.
 */
export async function lockAccount(userId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.set(
    `${LOCKOUT_PREFIX}${userId}`,
    "locked",
    "EX",
    env.ACCOUNT_LOCK_DURATION_MINUTES * 60,
  );
  logger.warn("Account locked due to failed attempts", { userId });
}

/**
 * Clear failed attempt counter (on successful login).
 */
export async function clearFailedAttempts(userId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${FAILED_ATTEMPTS_PREFIX}${userId}`);
  await redis.del(`${LOCKOUT_PREFIX}${userId}`);
}

/**
 * Unlock an account (admin action).
 */
export async function unlockAccount(userId: string): Promise<void> {
  await clearFailedAttempts(userId);
}

/**
 * Get failed attempt count.
 */
export async function getFailedAttemptCount(userId: string): Promise<number> {
  const raw = await getRedisClient().get(`${FAILED_ATTEMPTS_PREFIX}${userId}`);
  return raw ? parseInt(raw, 10) : 0;
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

/**
 * Calculate TTL in seconds.
 * Non-admin: min(SESSION_IDLE_TIMEOUT_MINUTES, seconds until midnight) — per
 *            §4 absolute session lifetime ends at midnight.
 * Admin:     ADMIN_SESSION_IDLE_TIMEOUT_MINUTES only — exempt from the
 *            midnight cap (mirrors the autologout cron exemption) and uses a
 *            much longer idle window so admin sessions persist across days.
 */
function calculateSessionTTL(role?: string): number {
  if (role === "ADMIN") {
    return env.ADMIN_SESSION_IDLE_TIMEOUT_MINUTES * 60;
  }

  const idleTimeoutSeconds = env.SESSION_IDLE_TIMEOUT_MINUTES * 60;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const secondsUntilMidnight = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  return Math.min(idleTimeoutSeconds, Math.max(secondsUntilMidnight, 60));
}
