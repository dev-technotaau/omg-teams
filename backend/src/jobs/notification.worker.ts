import { Worker, type Job } from "bullmq";
import { getPrisma } from "../config/database.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";
import { sendPushToUser } from "../services/push.service.js";
import type { PushNotificationJob, WebhookJob } from "./notification.queue.js";

// ──────────────────────────────────────────────
//  Notification Worker
// ──────────────────────────────────────────────

export function startNotificationWorker(): Worker {
  const worker = new Worker(
    "notification",
    async (job: Job<PushNotificationJob | WebhookJob>) => {
      switch (job.name) {
        case "push":
          await processPush(job as Job<PushNotificationJob>);
          break;
        case "webhook":
          await processWebhook(job as Job<WebhookJob>);
          break;
        case "cleanup":
          await processCleanup();
          break;
        default:
          logger.warn(`Unknown notification job: ${job.name}`);
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 10,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "notification", status: "completed" });
    logger.debug(`Notification job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "notification", status: "failed" });
    logger.error(`Notification job ${job?.id} failed`, { error: err.message });
  });

  getRedisSubscriber();

  logger.info("Notification worker started");
  return worker;
}

/** Send push notification via FCM / Web Push to all user's registered devices */
async function processPush(job: Job<PushNotificationJob>): Promise<void> {
  const { userId, title, body, data } = job.data;

  const sent = await sendPushToUser(userId, {
    title,
    body,
    ...(data?.["url"] ? { url: data["url"] } : {}),
    ...(data?.["tag"] ? { tag: data["tag"] } : {}),
    ...(data ? { data } : {}),
  });

  logger.info("Push notification delivered", { userId, title, devicesSent: sent });
}

/** POST webhook payload to external URL */
async function processWebhook(job: Job<WebhookJob>): Promise<void> {
  const { url, event, payload } = job.data;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Webhook POST to ${url} failed with status ${res.status}`);
  }

  logger.info("Webhook delivered", { url, event, status: res.status });
}

/** §11.6 — Auto-archive notifications older than 90 days */
async function processCleanup(): Promise<void> {
  const prisma = getPrisma();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const result = await prisma.notification.updateMany({
    where: { createdAt: { lt: cutoff }, isCleared: false },
    data: { isCleared: true, clearedAt: new Date() },
  });

  if (result.count > 0) {
    logger.info("Notification cleanup: archived old notifications", { count: result.count });
  }
}
