import { type NotificationCategory } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Notification Preference Service — Gap #9
//  Per-user notification category preferences
// ──────────────────────────────────────────────

const ALL_CATEGORIES: NotificationCategory[] = [
  "DOCUMENT",
  "LEAVE",
  "ATTENDANCE",
  "RECRUITMENT",
  "ACCOUNT",
  "SYSTEM",
  "REPORT",
  "TARGET",
  "TASK",
  "GENERAL",
];

// §11.5 — Admin override: these categories cannot be disabled by users
const FORCE_ENABLED_CATEGORIES: NotificationCategory[] = ["SYSTEM", "ACCOUNT"];

/**
 * Get all notification preferences for a user.
 * Auto-creates default preferences (all enabled) if none exist.
 */
export async function getPreferences(userId: string) {
  const prisma = getPrisma();
  const existing = await prisma.notificationPreference.findMany({
    where: { userId },
    orderBy: { category: "asc" },
  });

  if (existing.length === ALL_CATEGORIES.length) {
    return existing;
  }

  // Determine which categories are missing and create defaults
  const existingCategories = new Set(existing.map((p) => p.category));
  const missing = ALL_CATEGORIES.filter((c) => !existingCategories.has(c));

  if (missing.length === 0) {
    return existing;
  }

  logger.info("Creating default notification preferences", { userId, categories: missing });

  await prisma.notificationPreference.createMany({
    data: missing.map((category) => ({
      userId,
      category,
      isEnabled: true,
      emailEnabled: true,
      soundEnabled: true,
      browserPushEnabled: false,
    })),
    skipDuplicates: true,
  });

  return prisma.notificationPreference.findMany({
    where: { userId },
    orderBy: { category: "asc" },
  });
}

/**
 * Upsert a single notification preference for a user + category.
 */
export async function updatePreference(
  userId: string,
  category: NotificationCategory,
  data: {
    isEnabled?: boolean | undefined;
    emailEnabled?: boolean | undefined;
    soundEnabled?: boolean | undefined;
    browserPushEnabled?: boolean | undefined;
  },
) {
  const prisma = getPrisma();

  // §11.5 — Admin override: SYSTEM and ACCOUNT cannot be disabled
  if (FORCE_ENABLED_CATEGORIES.includes(category)) {
    if (data.isEnabled === false) data.isEnabled = true;
  }

  // Strip undefined values for Prisma's exactOptionalPropertyTypes compliance
  const updateData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

  const preference = await prisma.notificationPreference.upsert({
    where: { userId_category: { userId, category } },
    update: updateData,
    create: {
      userId,
      category,
      isEnabled: data.isEnabled ?? true,
      emailEnabled: data.emailEnabled ?? true,
      soundEnabled: data.soundEnabled ?? true,
      browserPushEnabled: data.browserPushEnabled ?? false,
    },
  });

  logger.info("Updated notification preference", { userId, category, data });
  return preference;
}

/**
 * Bulk update all notification preferences for a user.
 * Each entry must include a category and at least one preference field.
 */
export async function updateAllPreferences(
  userId: string,
  preferences: {
    category: NotificationCategory;
    isEnabled?: boolean | undefined;
    emailEnabled?: boolean | undefined;
    soundEnabled?: boolean | undefined;
    browserPushEnabled?: boolean | undefined;
  }[],
) {
  const prisma = getPrisma();

  const results = await prisma.$transaction(
    preferences.map((pref) =>
      prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category: pref.category } },
        update: {
          ...(pref.isEnabled !== undefined && { isEnabled: pref.isEnabled }),
          ...(pref.emailEnabled !== undefined && { emailEnabled: pref.emailEnabled }),
          ...(pref.soundEnabled !== undefined && { soundEnabled: pref.soundEnabled }),
          ...(pref.browserPushEnabled !== undefined && {
            browserPushEnabled: pref.browserPushEnabled,
          }),
        },
        create: {
          userId,
          category: pref.category,
          isEnabled: pref.isEnabled ?? true,
          emailEnabled: pref.emailEnabled ?? true,
          soundEnabled: pref.soundEnabled ?? true,
          browserPushEnabled: pref.browserPushEnabled ?? false,
        },
      }),
    ),
  );

  logger.info("Bulk updated notification preferences", { userId, count: results.length });
  return results;
}

/**
 * Check if a user should receive in-app notifications for a given category.
 * Returns true if no preference exists (default enabled).
 */
export async function shouldNotify(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const prisma = getPrisma();
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_category: { userId, category } },
    select: { isEnabled: true },
  });

  return pref?.isEnabled ?? true;
}

/**
 * Check if a user should receive email notifications for a given category.
 * Returns true if no preference exists (default enabled).
 */
export async function shouldSendEmail(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  // Platform-wide kill switch (admin Settings → Notifications → Email)
  const { getSettingBool } = await import("./settings.service.js");
  if (!(await getSettingBool("notification_email_enabled", true))) return false;

  const prisma = getPrisma();
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_category: { userId, category } },
    select: { isEnabled: true, emailEnabled: true },
  });

  // Must have both global category enabled AND email specifically enabled
  if (!pref) return true;
  return pref.isEnabled && pref.emailEnabled;
}

// ──────────────────────────────────────────────
//  §11.5 — Quiet Hours
//
//  Stored on the User row (quietHoursStart / quietHoursEnd, both HH:mm
//  24-hour or null=disabled). The runtime check that gates Socket.IO +
//  FCM lives in notification.service.isInQuietHours — this module just
//  reads / writes the persisted values.
// ──────────────────────────────────────────────

export async function getQuietHours(
  userId: string,
): Promise<{ quietHoursStart: string | null; quietHoursEnd: string | null }> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quietHoursStart: true, quietHoursEnd: true },
  });
  return {
    quietHoursStart: user?.quietHoursStart ?? null,
    quietHoursEnd: user?.quietHoursEnd ?? null,
  };
}

export async function updateQuietHours(
  userId: string,
  data: { quietHoursStart: string | null; quietHoursEnd: string | null },
): Promise<{ quietHoursStart: string | null; quietHoursEnd: string | null }> {
  const prisma = getPrisma();
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
    },
    select: { quietHoursStart: true, quietHoursEnd: true },
  });
  return {
    quietHoursStart: user.quietHoursStart,
    quietHoursEnd: user.quietHoursEnd,
  };
}
