import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Absent Detection Queue — Spec §27.3, §27.5
//
//  Runs daily at configurable absent threshold time
//  (default 12:00 PM) to mark employees with no
//  punch-in as ABSENT.
// ──────────────────────────────────────────────

export const absentDetectionQueue = createQueue("absent-detection");

/**
 * Register the repeatable absent detection cron job.
 * Default: 12:00 PM daily.
 */
export async function scheduleAbsentDetection(): Promise<void> {
  // Fixed daily 12:00 PM cron. The threshold is intentionally not exposed
  // in the admin Settings UI — changing a cron schedule at runtime would
  // require a backend restart to take effect, which is a footgun. If you
  // need to shift this, edit the pattern here and redeploy.
  await absentDetectionQueue.upsertJobScheduler(
    "absent-detection-daily",
    { pattern: "0 12 * * *" },
    {
      name: "detect-absent",
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    },
  );
  logger.info("Absent detection cron scheduled (0 12 * * *)");
}
