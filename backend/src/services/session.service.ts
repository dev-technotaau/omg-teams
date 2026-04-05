import crypto from "node:crypto";
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

  // Calculate TTL — session lives until midnight or idle timeout, whichever is shorter
  const ttl = calculateSessionTTL();

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
 * Refresh session TTL on every authenticated request.
 * §4: "Every authenticated API request refreshes the TTL."
 */
export async function refreshSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return;

  const session = JSON.parse(raw) as SessionData;
  session.lastActiveAt = new Date().toISOString();

  const idleTimeoutSeconds = env.SESSION_IDLE_TIMEOUT_MINUTES * 60;
  const ttl = Math.min(idleTimeoutSeconds, calculateSessionTTL());
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), "EX", ttl);
  await redis.expire(`${USER_SESSION_PREFIX}${session.userId}`, ttl);
}

/**
 * Destroy a session (logout or admin revoke).
 */
export async function destroySession(sessionId: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;

  const session = JSON.parse(raw) as SessionData;
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
  await redis.del(`${USER_SESSION_PREFIX}${session.userId}`);

  return session;
}

/**
 * Destroy all sessions for a user.
 */
export async function destroyUserSessions(userId: string): Promise<void> {
  const redis = getRedisClient();
  const sessionId = await redis.get(`${USER_SESSION_PREFIX}${userId}`);
  if (sessionId) {
    await redis.del(`${SESSION_PREFIX}${sessionId}`);
  }
  await redis.del(`${USER_SESSION_PREFIX}${userId}`);

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
 * Calculate TTL in seconds — min(idle timeout, seconds until midnight).
 * §4: "Absolute session lifetime: until midnight. Idle timeout: 30 min (configurable)."
 */
function calculateSessionTTL(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const secondsUntilMidnight = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  const idleTimeoutSeconds = env.SESSION_IDLE_TIMEOUT_MINUTES * 60;
  return Math.min(idleTimeoutSeconds, Math.max(secondsUntilMidnight, 60));
}
