import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Webhook Management Service — Admin-only
// ──────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export async function listWebhooks(): Promise<WebhookEndpoint[]> {
  const res = await api.get<{ webhooks: WebhookEndpoint[] }>("/webhooks");
  return res.data.webhooks;
}

export async function listWebhookEvents(): Promise<string[]> {
  const res = await api.get<{ events: string[] }>("/webhooks/events");
  return res.data.events;
}

export async function createWebhook(data: {
  url: string;
  events: string[];
  description?: string;
}): Promise<{ webhook: WebhookEndpoint; secret: string }> {
  const res = await api.post<{ webhook: WebhookEndpoint; secret: string }>("/webhooks", data);
  return res.data;
}

export async function updateWebhook(
  id: string,
  data: { url?: string; events?: string[]; description?: string; isActive?: boolean },
): Promise<WebhookEndpoint> {
  const res = await api.patch<{ webhook: WebhookEndpoint }>(`/webhooks/${id}`, data);
  return res.data.webhook;
}

export async function deleteWebhook(id: string): Promise<void> {
  await api.delete(`/webhooks/${id}`);
}

export async function testWebhook(
  id: string,
): Promise<{ success: boolean; statusCode?: number; statusText?: string; error?: string }> {
  const res = await api.post<{
    success: boolean;
    statusCode?: number;
    statusText?: string;
    error?: string;
  }>(`/webhooks/${id}/test`);
  return res.data;
}

export async function rotateWebhookSecret(id: string): Promise<string> {
  const res = await api.post<{ secret: string }>(`/webhooks/${id}/rotate-secret`);
  return res.data.secret;
}
