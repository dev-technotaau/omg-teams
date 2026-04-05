import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";
import { createNotification } from "./notification.service.js";

// ──────────────────────────────────────────────
//  Suspicious Activity Detection — Spec §22.12
//
//  Automated flagging of anomalous login patterns.
//  Runs during login flow on failed attempts.
// ──────────────────────────────────────────────

const LOOKBACK_MINUTES = 30;
const DIFFERENT_DEVICE_THRESHOLD = 3; // 3+ different devices in 30 min = suspicious

/**
 * Check for suspicious login activity and notify Admin if detected.
 * Called on failed login attempts.
 */
export async function checkSuspiciousActivity(userId: string): Promise<void> {
  try {
    const prisma = getPrisma();
    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

    // Check for repeated failed logins from different devices
    const recentAttempts = await prisma.loginHistory.findMany({
      where: {
        userId,
        success: false,
        createdAt: { gte: since },
      },
      select: { attemptedDeviceId: true, failureReason: true },
    });

    const uniqueDevices = new Set(recentAttempts.map((a) => a.attemptedDeviceId).filter(Boolean));

    if (uniqueDevices.size >= DIFFERENT_DEVICE_THRESHOLD) {
      await notifyAdminSuspicious(
        userId,
        `Multiple failed login attempts from ${uniqueDevices.size} different devices in the last ${LOOKBACK_MINUTES} minutes.`,
        "multiple_device_attempts",
      );
    }

    // Check for device mismatch attempts (someone trying to access from wrong device)
    const deviceMismatches = recentAttempts.filter((a) => a.failureReason === "Device mismatch");
    if (deviceMismatches.length >= 3) {
      await notifyAdminSuspicious(
        userId,
        `${deviceMismatches.length} device mismatch attempts in the last ${LOOKBACK_MINUTES} minutes. Someone may be trying to access this account from an unauthorized device.`,
        "device_mismatch_pattern",
      );
    }
  } catch (err) {
    logger.error("Suspicious activity check failed", { userId, error: (err as Error).message });
  }
}

async function notifyAdminSuspicious(
  targetUserId: string,
  message: string,
  activityType: string,
): Promise<void> {
  const prisma = getPrisma();

  // Get user info for the notification
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { firstName: true, lastName: true, email: true, employeeId: true },
  });
  if (!user) return;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  if (!admin) return;

  const userName = `${user.firstName} ${user.lastName}`;

  await createNotification({
    userId: admin.id,
    type: "ACCOUNT",
    title: "Suspicious Login Activity",
    message: `${userName} (${user.employeeId ?? user.email}): ${message}`,
    actionUrl: `/admin/users`,
    metadata: { targetUserId, activityType },
  });

  logger.warn("Suspicious activity detected", { targetUserId, activityType, message });
}
