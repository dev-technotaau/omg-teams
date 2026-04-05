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
