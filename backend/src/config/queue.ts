import { Queue, type QueueOptions } from "bullmq";
import { env } from "./env.js";
import { getRedisClient } from "./redis.js";
import { registerService } from "./service-init.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  BullMQ Queue Factory
//
//  Reuses the singleton Redis connection.
//  Each service creates its own named queue
//  via createQueue(). Workers live in src/jobs/.
// ──────────────────────────────────────────────

const queues = new Map<string, Queue>();

const defaultOpts: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

/**
 * Get or create a named BullMQ queue.
 * All queues share the singleton Redis connection.
 */
export function createQueue(name: string, opts?: Partial<QueueOptions>): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    ...defaultOpts,
    ...opts,
    connection: getRedisClient(),
  });

  queue.on("error", (err) => {
    logger.error(`Queue "${name}" error`, { error: err.message });
  });

  queues.set(name, queue);
  logger.debug(`Queue "${name}" created`);
  return queue;
}

/**
 * Close all queues gracefully during shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  const names = Array.from(queues.keys());
  await Promise.all(
    names.map(async (name) => {
      const queue = queues.get(name);
      if (queue) {
        await queue.close();
        logger.debug(`Queue "${name}" closed`);
      }
    }),
  );
  queues.clear();
}

// ──────────────────────────────────────────────
//  Service Registration
// ──────────────────────────────────────────────

registerService({
  name: "bullmq",
  critical: false,
  enabled: env.hasRedis,
  dependsOn: ["redis"],
  isConfigured: () => env.hasRedis,
  connect: async () => {
    // Create a health-check queue to verify BullMQ works
    const healthQueue = createQueue("__health_check__");
    await healthQueue.getJobCounts();
    logger.info("BullMQ queue system verified");
  },
  disconnect: async () => {
    await closeAllQueues();
  },
});
