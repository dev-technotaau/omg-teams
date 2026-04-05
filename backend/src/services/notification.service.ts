import { type NotificationCategory, type Prisma } from "@prisma/client";
import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";
import { enqueuePushNotification } from "../jobs/notification.queue.js";
import type { Server as SocketIOServer } from "socket.io";

// ──────────────────────────────────────────────
//  Notification Service — Spec Section 11
//  Real-time delivery via Socket.IO — Section 23.15.5
//  Push delivery via FCM/Web Push — BullMQ queue
// ──────────────────────────────────────────────

async function tryEmitSocket(userId: string, event: string, payload: unknown) {
  try {
    // Dynamic import to avoid circular deps at startup
    const { getIO } = (await import("../socket.js")) as { getIO: () => SocketIOServer };
    const io = getIO();
    io.to(`user:${userId}`).emit(event, payload);
  } catch {
    // Socket.IO not initialized yet or not available — silent fallback
    logger.debug("Socket.IO emit skipped (not initialized)", { userId, event });
  }
}

/**
 * §11.5 — Check if a user is currently in their quiet hours window.
 * During quiet hours, notifications are saved but real-time push is suppressed.
 */
async function isInQuietHours(userId: string): Promise<boolean> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quietHoursStart: true, quietHoursEnd: true },
  });
  if (!user?.quietHoursStart || !user?.quietHoursEnd) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = user.quietHoursStart.split(":").map(Number);
  const [endH, endM] = user.quietHoursEnd.split(":").map(Number);
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

  // Handle overnight quiet hours (e.g., 22:00 → 07:00)
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export async function createNotification(data: {
  userId: string;
  type: NotificationCategory;
  title: string;
  message: string;
  actionUrl?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}) {
  const prisma = getPrisma();

  // Always save notification to DB (user sees it when they open the app)
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl ?? null,
      metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // Invalidate cached count — new notification arrived
  invalidateNotificationCount(data.userId);

  // §11.5 — Suppress real-time push during quiet hours
  // System and Account notifications bypass quiet hours (always pushed)
  const BYPASS_QUIET = new Set<NotificationCategory>(["SYSTEM", "ACCOUNT"]);
  const quiet = BYPASS_QUIET.has(data.type) ? false : await isInQuietHours(data.userId);

  if (!quiet) {
    // Push real-time notification via Socket.IO (in-app)
    void tryEmitSocket(data.userId, "notification:new", notification);
    // Also push updated unread count
    await pushUnreadCount(data.userId);
  }

  // §11 — Enqueue browser push notification (FCM / Web Push)
  // Respects quiet hours: only SYSTEM/ACCOUNT bypass
  // Respects user preference: browserPushEnabled per category
  if (!quiet) {
    try {
      const pref = await prisma.notificationPreference.findUnique({
        where: { userId_category: { userId: data.userId, category: data.type } },
        select: { isEnabled: true, browserPushEnabled: true },
      });
      // Push if no preference exists (default) or if explicitly enabled
      const shouldPush = !pref || (pref.isEnabled && pref.browserPushEnabled);
      if (shouldPush) {
        await enqueuePushNotification({
          userId: data.userId,
          title: data.title,
          body: data.message,
          data: {
            url: data.actionUrl ?? "/notifications",
            tag: data.type.toLowerCase(),
            notificationId: notification.id,
          },
        });
      }
    } catch (err) {
      logger.warn("Failed to enqueue push notification", { userId: data.userId, error: err });
    }
  }

  return notification;
}

/**
 * §11.7 — Push current unread count via Socket.IO for badge sync.
 */
export async function pushUnreadCount(userId: string): Promise<void> {
  const count = await getUnreadCount(userId);
  void tryEmitSocket(userId, "notification:count", { unreadCount: count });
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return cache.getOrSet(
    `notification_count:${userId}`,
    async () => {
      const prisma = getPrisma();
      return prisma.notification.count({
        where: { userId, isRead: false, isCleared: false },
      });
    },
    60, // 1 minute
  );
}

/** Invalidate notification count cache (call on create/read/clear) */
export function invalidateNotificationCount(userId: string): void {
  void cache.del(`notification_count:${userId}`);
}

export async function getUserNotifications(
  userId: string,
  opts: {
    page?: number;
    limit?: number;
    category?: string;
    readFilter?: string; // "read" | "unread"
    search?: string;
  } = {},
) {
  const prisma = getPrisma();
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = { userId, isCleared: false };

  // §11.2.2 — Filter by category
  if (opts.category) {
    where.type = opts.category as NotificationCategory;
  }

  // §11.2.2 — Filter by read/unread
  if (opts.readFilter === "unread") {
    where.isRead = false;
  } else if (opts.readFilter === "read") {
    where.isRead = true;
  }

  // §11.2.2 — Search by title or message
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search, mode: "insensitive" } },
      { message: { contains: opts.search, mode: "insensitive" } },
    ];
  }

  const [data, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false, isCleared: false } }),
  ]);

  return {
    data,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function markAsRead(notificationId: string, userId: string) {
  const prisma = getPrisma();
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
  invalidateNotificationCount(userId);
  return result;
}

export async function markAsUnread(notificationId: string, userId: string) {
  const prisma = getPrisma();
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: false, readAt: null },
  });
  invalidateNotificationCount(userId);
  return result;
}

export async function markAllAsRead(userId: string) {
  const prisma = getPrisma();
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  invalidateNotificationCount(userId);
  return result;
}

export async function clearNotification(notificationId: string, userId: string) {
  const prisma = getPrisma();
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isCleared: true, clearedAt: new Date() },
  });
  invalidateNotificationCount(userId);
  return result;
}

export async function clearAllNotifications(userId: string) {
  const prisma = getPrisma();
  invalidateNotificationCount(userId);
  return prisma.notification.updateMany({
    where: { userId, isCleared: false },
    data: { isCleared: true, clearedAt: new Date() },
  });
}
