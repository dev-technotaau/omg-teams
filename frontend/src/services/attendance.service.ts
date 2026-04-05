import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Attendance Service
// ──────────────────────────────────────────────

export interface AttendanceConfig {
  key: string;
  value: unknown;
}

/** Admin: Get all attendance configuration settings */
export async function getAttendanceConfig() {
  const res = await api.get<{ config: AttendanceConfig[] }>("/attendance/config");
  return res.data.config;
}

/** Admin: Update a single attendance config key */
export async function updateAttendanceConfig(key: string, value: string) {
  await api.put(`/attendance/config/${key}`, { value });
}
