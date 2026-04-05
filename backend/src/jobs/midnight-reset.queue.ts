import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Midnight Reset Queue
//
//  Runs daily at midnight to:
//  - Revoke all active sessions
//  - Auto punch-out attendance records
// ──────────────────────────────────────────────

export const midnightResetQueue = createQueue("midnight-reset");

/**
 * Register the repeatable midnight cron job.
 * Safe to call multiple times — BullMQ deduplicates repeatables by key.
 */
export async function scheduleMidnightReset(): Promise<void> {
  await midnightResetQueue.upsertJobScheduler(
    "midnight-reset-daily",
    { pattern: "0 0 * * *" },
    {
      name: "reset",
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    },
  );
  logger.info("Midnight reset cron scheduled (0 0 * * *)");
}
