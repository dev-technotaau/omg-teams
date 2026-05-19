import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Orphan Storage Sweep Queue — Spec Section 30.3.4
//
//  Weekly job that detects Cloudinary objects in the avatars/
//  folder which are NOT referenced by any User.profilePhotoStorageKey
//  in the database, and deletes them. Catches files left behind by
//  failed cleanup paths.
// ──────────────────────────────────────────────

export const orphanSweepQueue = createQueue("orphan-sweep");

/**
 * Schedule the weekly orphaned-Cloudinary-avatar sweep.
 * Runs every Sunday at 4:00 AM — after the trash-purge job (3 AM)
 * so any soft-deleted users released during purge are also reflected.
 */
export async function scheduleOrphanSweep(): Promise<void> {
  await orphanSweepQueue.upsertJobScheduler(
    "orphan-sweep-weekly",
    { pattern: "0 4 * * 0" }, // Sunday 4 AM
    {
      name: "orphan-sweep-avatars",
      opts: {
        removeOnComplete: { count: 12 },
        removeOnFail: { count: 50 },
      },
    },
  );
  logger.info("Weekly orphan-sweep cron scheduled (0 4 * * 0)");
}
