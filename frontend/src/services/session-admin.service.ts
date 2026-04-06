import { api } from "@/lib/api";

export interface AdminSession {
  id: string;
  userId: string;
  token: string;
  deviceId: string;
  ipAddress: string | null;
  geoLocation: Record<string, unknown> | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  revokedAt: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
    role: string;
  };
}

export async function listSessions(params?: {
  userId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const queryParams: Record<string, string> = {};
  if (params?.userId) queryParams["userId"] = params.userId;
  if (params?.page) queryParams["page"] = String(params.page);
  if (params?.limit) queryParams["limit"] = String(params.limit);
  if (params?.sortBy) queryParams["sortBy"] = params.sortBy;
  if (params?.sortDir) queryParams["sortDir"] = params.sortDir;
  const res = await api.get<{
    data: AdminSession[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("/admin/sessions", { params: queryParams });
  return res.data;
}

export async function revokeSession(id: string) {
  await api.delete(`/admin/sessions/${id}`);
}

export async function revokeUserSessions(userId: string) {
  await api.delete(`/admin/sessions/user/${userId}`);
}
