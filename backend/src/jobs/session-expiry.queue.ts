import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Session Expiry Checker Queue
//
//  §4: "If a session expires due to idle timeout
//  without explicit logout, the session expiry
//  timestamp is recorded as the Punch Out time."
//
//  Runs every 5 minutes to detect stale attendance
//  records where the user's session has expired.
// ──────────────────────────────────────────────

export const sessionExpiryQueue = createQueue("session-expiry");

export async function scheduleSessionExpiryChecker(): Promise<void> {
  await sessionExpiryQueue.upsertJobScheduler(
    "session-expiry-checker",
    { pattern: "*/5 * * * *" }, // Every 5 minutes
    {
      name: "check-expired-sessions",
      opts: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    },
  );
  logger.info("Session expiry checker scheduled (*/5 * * * *)");
}
