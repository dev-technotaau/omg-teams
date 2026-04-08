import { Worker, type Job } from "bullmq";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  TOR Exit List Refresh Worker
//
//  Downloads the public Tor exit-node list from
//  https://check.torproject.org/torbulkexitlist
//  and replaces the Redis set `ip:tor` atomically.
//
//  Used by login-anomaly.service.ts#evaluateIpReputation to hard-block
//  credential stuffing originating from Tor exits.
// ──────────────────────────────────────────────

const TOR_EXIT_REDIS_KEY = "ip:tor";
const TOR_EXIT_LIST_URL = "https://check.torproject.org/torbulkexitlist";
/** Used while we rebuild the live key — atomic rename at the end. */
const TOR_EXIT_REDIS_TMP_KEY = "ip:tor:rebuilding";
/** Network timeout for the fetch — torproject.org is usually fast but be safe. */
const FETCH_TIMEOUT_MS = 30_000;

export function startTorListWorker(): Worker {
  const worker = new Worker(
    "tor-list",
    async (job: Job) => {
      await processTorListRefresh(job);
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "tor-list", status: "completed" });
    logger.debug(`TOR list refresh job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "tor-list", status: "failed" });
    logger.error(`TOR list refresh job ${job?.id} failed`, { error: err.message });
    // Intentionally NOT calling onJobFailed admin notification — a Tor list
    // refresh failure is not actionable for an admin and would generate
    // noise. Operations can monitor it via the metric and queue dashboard.
  });

  getRedisSubscriber();

  logger.info("TOR list worker started");
  return worker;
}

async function processTorListRefresh(_job: Job): Promise<void> {
  const redis = getRedisClient();

  // Fetch the list with a timeout — node fetch hangs forever otherwise
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let body: string;
  try {
    const res = await fetch(TOR_EXIT_LIST_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "OMG-Teams-Security-Refresh/1.0" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from torproject.org`);
    }
    body = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  // Parse — one IP per line, lines starting with `#` are comments
  const ips = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (ips.length === 0) {
    throw new Error("TOR exit list returned zero IPs — refusing to clobber existing key");
  }

  // Build the new set under a temp key, then atomically RENAME on top of
  // the live key. This avoids a window where the live key is empty.
  await redis.del(TOR_EXIT_REDIS_TMP_KEY);
  // SADD with chunked args to avoid 1MB command limit on huge lists
  const CHUNK = 1000;
  for (let i = 0; i < ips.length; i += CHUNK) {
    const chunk = ips.slice(i, i + CHUNK);
    if (chunk.length > 0) {
      await redis.sadd(TOR_EXIT_REDIS_TMP_KEY, ...chunk);
    }
  }
  await redis.rename(TOR_EXIT_REDIS_TMP_KEY, TOR_EXIT_REDIS_KEY);

  logger.info("TOR exit list refreshed", { count: ips.length });
}
