import { cache } from "../config/cache.js";
import { logger } from "../instrument.js";
import type { Server as SocketIOServer } from "socket.io";

// ──────────────────────────────────────────────
//  User Presence Service — Spec Section 23.15
//
//  Tracks online/idle/offline status using Redis
//  cache. Firebase is configured but optional;
//  this uses Redis for simplicity and reliability.
// ──────────────────────────────────────────────

export type PresenceStatus = "online" | "idle" | "offline";

const PRESENCE_KEY_PREFIX = "presence:";
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min → idle
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min → offline

interface PresenceData {
  userId: string;
  lastActiveAt: number; // Unix ms timestamp
  status: PresenceStatus;
}

/**
 * Record user activity (call on every API request via middleware).
 */
export async function touchPresence(userId: string): Promise<void> {
  const key = `${PRESENCE_KEY_PREFIX}${userId}`;
  const data: PresenceData = {
    userId,
    lastActiveAt: Date.now(),
    status: "online",
  };
  await cache.set(key, JSON.stringify(data), 3600); // TTL 1 hour
}

/**
 * Get single user's presence status.
 */
export async function getPresence(
  userId: string,
): Promise<{ status: PresenceStatus; lastActiveAt: string | null }> {
  const key = `${PRESENCE_KEY_PREFIX}${userId}`;
  const raw = await cache.get(key);
  if (!raw) return { status: "offline", lastActiveAt: null };

  const data = JSON.parse(raw as string) as PresenceData;
  const elapsed = Date.now() - data.lastActiveAt;

  let status: PresenceStatus = "offline";
  if (elapsed < ACTIVE_THRESHOLD_MS) status = "online";
  else if (elapsed < OFFLINE_THRESHOLD_MS) status = "idle";

  return {
    status,
    lastActiveAt: new Date(data.lastActiveAt).toISOString(),
  };
}

/**
 * Get presence for multiple users at once.
 */
export async function getBulkPresence(
  userIds: string[],
): Promise<Record<string, { status: PresenceStatus; lastActiveAt: string | null }>> {
  const result: Record<string, { status: PresenceStatus; lastActiveAt: string | null }> = {};

  // Batch fetch from cache
  for (const userId of userIds) {
    try {
      result[userId] = await getPresence(userId);
    } catch {
      result[userId] = { status: "offline", lastActiveAt: null };
    }
  }

  return result;
}

/**
 * Remove presence (on logout).
 */
export async function clearPresence(userId: string): Promise<void> {
  const key = `${PRESENCE_KEY_PREFIX}${userId}`;
  await cache.del(key);
}

/**
 * Broadcast presence update to relevant Socket.IO rooms.
 */
export function broadcastPresence(userId: string, status: PresenceStatus): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getIO } = require("../socket.js") as { getIO: () => SocketIOServer };
    const io = getIO();
    io.to("role:ADMIN").emit("presence:update", { userId, status });
    // Also emit to RM rooms (they'll filter client-side)
    io.to("role:REPORTING_MANAGER").emit("presence:update", { userId, status });
  } catch {
    logger.debug("Socket.IO emit skipped for presence (not initialized)");
  }
}
