import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  §24.8 — Database Backup Queue
//  Daily pg_dump backup to cloud storage.
// ──────────────────────────────────────────────

export const backupQueue = createQueue("database-backup");

/**
 * Schedule daily database backup at 2:30 AM.
 */
export async function scheduleDatabaseBackup(): Promise<void> {
  await backupQueue.upsertJobScheduler(
    "daily-db-backup",
    { pattern: "30 2 * * *" }, // Daily at 2:30 AM
    {
      name: "backup",
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    },
  );
  logger.info("Daily database backup cron scheduled (30 2 * * *)");
}
