import { createQueue } from "../config/queue.js";

// ──────────────────────────────────────────────
//  Email Queue
// ──────────────────────────────────────────────

export const emailQueue = createQueue("email");

export interface SendEmailJob {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

export interface SendBulkEmailJob {
  recipients: string[];
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

export async function enqueueEmail(data: SendEmailJob): Promise<void> {
  await emailQueue.add("send", data, { priority: 2 });
}

export async function enqueueBulkEmail(data: SendBulkEmailJob): Promise<void> {
  await emailQueue.add("send-bulk", data, { priority: 5 });
}
