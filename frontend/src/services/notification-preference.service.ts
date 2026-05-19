import { api } from "@/lib/api";

export interface NotificationPreference {
  id: string;
  category: string;
  isEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
  browserPushEnabled: boolean;
}

export async function getMyPreferences(): Promise<NotificationPreference[]> {
  const res = await api.get<{ preferences: NotificationPreference[] }>(
    "/notification-preferences/preferences",
  );
  return res.data.preferences;
}

export async function updatePreference(
  category: string,
  data: Partial<Omit<NotificationPreference, "id" | "category">>,
): Promise<NotificationPreference> {
  const res = await api.patch<{ preference: NotificationPreference }>(
    `/notification-preferences/preferences/${category}`,
    data,
  );
  return res.data.preference;
}

export async function updateAllPreferences(
  preferences: Array<{
    category: string;
    isEnabled: boolean;
    emailEnabled: boolean;
    soundEnabled: boolean;
    browserPushEnabled: boolean;
  }>,
): Promise<NotificationPreference[]> {
  const res = await api.put<{ preferences: NotificationPreference[] }>(
    "/notification-preferences/preferences",
    { preferences },
  );
  return res.data.preferences;
}

// ──────────────────────────────────────────────
//  §11.5 — Quiet Hours
// ──────────────────────────────────────────────

export interface QuietHours {
  /** HH:mm 24-hour. null = disabled. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export async function getQuietHours(): Promise<QuietHours> {
  const res = await api.get<{ data: QuietHours }>(
    "/notification-preferences/quiet-hours",
  );
  return res.data.data;
}

export async function updateQuietHours(data: QuietHours): Promise<QuietHours> {
  const res = await api.patch<{ data: QuietHours }>(
    "/notification-preferences/quiet-hours",
    data,
  );
  return res.data.data;
}

/**
 * Pure helper — true when `now` falls inside the user's quiet hours window.
 * Handles overnight ranges (e.g. 22:00 → 07:00). Returns false when either
 * boundary is null (= disabled).
 *
 * Used by useNotificationSound to suppress chimes during quiet hours,
 * mirroring the backend `isInQuietHours` check in notification.service.ts.
 */
export function isInQuietHours(qh: QuietHours, now: Date = new Date()): boolean {
  if (!qh.quietHoursStart || !qh.quietHoursEnd) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = qh.quietHoursStart.split(":").map(Number);
  const [eh, em] = qh.quietHoursEnd.split(":").map(Number);
  const start = (sh ?? 0) * 60 + (sm ?? 0);
  const end = (eh ?? 0) * 60 + (em ?? 0);
  // Same-day window (e.g. 13:00 → 17:00)
  if (start <= end) return cur >= start && cur < end;
  // Overnight window (e.g. 22:00 → 07:00)
  return cur >= start || cur < end;
}
