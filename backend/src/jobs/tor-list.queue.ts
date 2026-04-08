import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  TOR Exit List Refresh Queue
//
//  §16 — Login anomaly mitigation. Periodically downloads the public Tor
//  exit-node list from check.torproject.org and stores it in Redis as a
//  set, where login-anomaly.service.ts#evaluateIpReputation can do
//  O(1) membership checks during login.
//
//  Refresh cadence: every 2 hours. Tor exits are stable enough that this
//  is plenty fresh, and infrequent enough to be a non-issue against the
//  torproject.org infrastructure.
// ──────────────────────────────────────────────

export const torListQueue = createQueue("tor-list");

export async function scheduleTorListRefresh(): Promise<void> {
  await torListQueue.upsertJobScheduler(
    "tor-list-refresh",
    { pattern: "0 */2 * * *" }, // Every 2 hours, on the hour
    {
      name: "refresh-tor-exit-list",
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    },
  );
  logger.info("TOR exit list refresh scheduled (0 */2 * * *)");
}
