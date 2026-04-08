import { api } from "@/lib/api";

export interface UserListItem {
  id: string;
  employeeId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  profilePhotoUrl: string | null;
  deviceId: string | null;
  createdAt: string;
}

export interface PaginatedUsers {
  data: UserListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listUsers(params?: Record<string, string>): Promise<PaginatedUsers> {
  const res = await api.get<PaginatedUsers>("/users", { params });
  return res.data;
}

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "RECRUITER" | "REPORTING_MANAGER";
  mobileNumber?: string;
  address?: string;
  managerIds?: string[];
  recruiterIds?: string[];
}) {
  const res = await api.post<{
    user: {
      id: string;
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      plainPassword: string;
      assignedManagers: string[];
      assignedRecruiters: string[];
    };
  }>("/users", data);
  return res.data.user;
}

export async function updateUser(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string | null;
    address?: string | null;
    role?: "RECRUITER" | "REPORTING_MANAGER";
  },
) {
  const res = await api.patch<{
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      mobileNumber: string | null;
      address: string | null;
      status: string;
    };
  }>(`/users/${id}`, data);
  return res.data.user;
}

export async function suspendUser(id: string): Promise<void> {
  await api.patch(`/users/${id}/suspend`);
}

export async function reactivateUser(id: string): Promise<void> {
  await api.patch(`/users/${id}/reactivate`);
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  await api.patch(`/users/${id}/reset-password`, { newPassword });
}

export async function resetDevice(id: string): Promise<void> {
  await api.post(`/users/${id}/reset-device`);
}

export async function assignManager(userId: string, managerId: string): Promise<void> {
  await api.post(`/users/${userId}/assign-manager`, { managerId });
}

export async function removeManager(userId: string, managerId: string): Promise<void> {
  await api.delete(`/users/${userId}/remove-manager/${managerId}`);
}

/** §22.9 — Force logout: revoke all sessions for a user */
export async function forceLogout(userId: string): Promise<void> {
  await api.delete(`/admin/sessions/user/${userId}`);
}

/** §22.9 — Force switch device: reset device binding + destroy all sessions */
export async function forceSwitchDevice(userId: string): Promise<void> {
  await api.post(`/users/${userId}/reset-device`);
  // resetDevice backend already destroys sessions
}

/** §25.1 — Unlock a locked-out account (admin override) */
export async function unlockAccount(userId: string): Promise<void> {
  await api.post(`/users/${userId}/unlock`);
}

/** §22.9 — Get device info + history for admin view */
export interface DeviceInfo {
  currentDeviceId: string | null;
  deviceLockedAt: string | null;
  userName: string | null;
  devices: {
    id: string;
    deviceId: string;
    userAgent: string | null;
    platform: string | null;
    screenSize: string | null;
    lastSeen: string;
    isActive: boolean;
    createdAt: string;
  }[];
  recentLogins: {
    id: string;
    attemptedDeviceId: string | null;
    ip: string | null;
    userAgent: string | null;
    success: boolean;
    failureReason: string | null;
    loginMethod: string;
    createdAt: string;
  }[];
}

export async function getUserDeviceInfo(userId: string): Promise<DeviceInfo> {
  const res = await api.get<{ data: DeviceInfo }>(`/users/${userId}/device-info`);
  return res.data.data;
}

/** §22.9 — Reactivate suspended user + reset device binding in one action */
export async function reactivateWithDeviceReset(userId: string): Promise<void> {
  await api.post(`/users/${userId}/reactivate-with-device-reset`);
}

/** §23.16 — Generate backup codes for a user */
export async function generateBackupCodes(userId: string): Promise<{ codes: string[] }> {
  const res = await api.post<{ codes: string[] }>(`/users/${userId}/backup-codes`);
  return res.data;
}

/** §23.16 — Get backup code status */
export async function getBackupCodeStatus(userId: string): Promise<{
  total: number;
  remaining: number;
  generatedAt: string | null;
}> {
  const res = await api.get<{ total: number; remaining: number; generatedAt: string | null }>(
    `/users/${userId}/backup-codes/status`,
  );
  return res.data;
}

/** §7 — RM view assigned recruiter / Admin view any user */
export async function getTeamMember(userId: string) {
  const res = await api.get<{ user: UserListItem }>(`/users/${userId}/team-view`);
  return res.data.user;
}

/** Get single user presence status */
export async function getUserPresence(userId: string) {
  const res = await api.get<{ status: string; lastActiveAt: string | null }>(`/presence/${userId}`);
  return res.data;
}
