import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Archive Queue — Spec Section 23.5
//
//  Monthly job to move aged records to archive.
// ──────────────────────────────────────────────

export const archiveQueue = createQueue("archive");

/**
 * Register the repeatable monthly archiving cron job.
 * Runs on the 1st of each month at 2:00 AM.
 */
export async function scheduleArchiving(): Promise<void> {
  await archiveQueue.upsertJobScheduler(
    "archive-monthly",
    { pattern: "0 2 1 * *" },
    {
      name: "archive",
      opts: {
        removeOnComplete: { count: 12 },
        removeOnFail: { count: 50 },
      },
    },
  );
  logger.info("Monthly archive cron scheduled (0 2 1 * *)");
}

/**
 * §23.7 — Schedule weekly trash auto-purge job.
 * Permanently deletes records soft-deleted more than 90 days ago.
 * Runs every Sunday at 3:00 AM.
 */
export async function scheduleTrashPurge(): Promise<void> {
  await archiveQueue.upsertJobScheduler(
    "trash-purge-weekly",
    { pattern: "0 3 * * 0" }, // Every Sunday at 3 AM
    {
      name: "trash-purge",
      opts: {
        removeOnComplete: { count: 12 },
        removeOnFail: { count: 50 },
      },
    },
  );
  logger.info("Weekly trash purge cron scheduled (0 3 * * 0)");
}

/**
 * §27.12 — Schedule monthly attendance summary notification.
 * Runs on the 1st of each month at 6:00 AM, notifies admin that
 * the previous month's attendance summary is ready for review.
 */
export async function scheduleMonthlyAttendanceSummary(): Promise<void> {
  await archiveQueue.upsertJobScheduler(
    "monthly-attendance-summary",
    { pattern: "0 6 1 * *" }, // 1st of month at 6 AM
    {
      name: "attendance-summary",
      opts: {
        removeOnComplete: { count: 12 },
        removeOnFail: { count: 50 },
      },
    },
  );
  logger.info("Monthly attendance summary cron scheduled (0 6 1 * *)");
}

/**
 * §29.7.2 — Schedule KYC reminder notifications every 3 days.
 * Sends reminders to employees with incomplete KYC.
 */
export async function scheduleKycReminder(): Promise<void> {
  await archiveQueue.upsertJobScheduler(
    "kyc-reminder",
    { pattern: "0 9 */3 * *" }, // Every 3 days at 9 AM
    {
      name: "kyc-reminder",
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 50 },
      },
    },
  );
  logger.info("KYC reminder cron scheduled (0 9 */3 * *)");
}
