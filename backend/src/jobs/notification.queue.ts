import { createQueue } from "../config/queue.js";

// ──────────────────────────────────────────────
//  Notification Queue (push, in-app, webhooks)
// ──────────────────────────────────────────────

export const notificationQueue = createQueue("notification");

export interface PushNotificationJob {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface WebhookJob {
  url: string;
  event: string;
  payload: Record<string, unknown>;
}

export async function enqueuePushNotification(data: PushNotificationJob): Promise<void> {
  await notificationQueue.add("push", data, { priority: 1 });
}

export async function enqueueWebhook(data: WebhookJob): Promise<void> {
  await notificationQueue.add("webhook", data, {
    priority: 3,
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  });
}

/** §11.6 — Schedule notification retention cleanup (daily at 3 AM) */
export async function scheduleNotificationCleanup(): Promise<void> {
  await notificationQueue.upsertJobScheduler(
    "notification-cleanup",
    { pattern: "0 3 * * *" }, // Daily at 3 AM
    {
      name: "cleanup",
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    },
  );
}
