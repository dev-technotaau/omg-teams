import { api } from "@/lib/api";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<{ unreadCount: number }>("/notifications/unread-count");
  return res.data.unreadCount ?? 0;
}

export async function listNotifications(page = 1) {
  const res = await api.get<{
    data: Notification[];
    unreadCount: number;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("/notifications", { params: { page: String(page) } });
  return res.data;
}

export async function markAsRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAsUnread(id: string) {
  await api.patch(`/notifications/${id}/unread`);
}

export async function markAllAsRead() {
  await api.patch("/notifications/read-all");
}

export async function clearNotification(id: string) {
  await api.delete(`/notifications/${id}`);
}

export async function clearAll() {
  await api.delete("/notifications/clear-all");
}

// ── Push Subscription API ──

export async function registerPushToken(data: {
  endpoint: string;
  type: "FCM" | "WEB_PUSH";
  deviceId?: string;
  keys?: { p256dh: string; auth: string };
}) {
  const res = await api.post<{ id: string }>("/push-subscriptions", data);
  return res.data;
}

export async function unregisterPushToken(endpoint: string) {
  await api.delete("/push-subscriptions", { data: { endpoint } });
}
