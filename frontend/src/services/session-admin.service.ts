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

export interface SessionSummary {
  total: number;
  admins: number;
  recruiters: number;
  managers: number;
}

export type SessionRoleFilter = "" | "ADMIN" | "EMPLOYEE";

/** "active" = currently online; "history" = revoked or idle/timed-out. */
export type SessionView = "active" | "history";

export async function listSessions(params?: {
  userId?: string;
  /** "ADMIN" / "EMPLOYEE" — empty/undefined means all roles. */
  role?: SessionRoleFilter;
  /** "active" (default) or "history" — controls which slice the API returns. */
  view?: SessionView;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const queryParams: Record<string, string> = {};
  if (params?.userId) queryParams["userId"] = params.userId;
  if (params?.role) queryParams["role"] = params.role;
  if (params?.view) queryParams["view"] = params.view;
  if (params?.page) queryParams["page"] = String(params.page);
  if (params?.limit) queryParams["limit"] = String(params.limit);
  if (params?.sortBy) queryParams["sortBy"] = params.sortBy;
  if (params?.sortDir) queryParams["sortDir"] = params.sortDir;
  const res = await api.get<{
    data: AdminSession[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    /** Token of the admin's own request session — used to flag "this is you". */
    currentSessionId: string | null;
    /** Always-global counts so summary cards stay accurate across tab filters. */
    summary: SessionSummary;
  }>("/admin/sessions", { params: queryParams });
  return res.data;
}

export async function revokeSession(id: string) {
  await api.delete(`/admin/sessions/${id}`);
}

export async function revokeUserSessions(userId: string) {
  await api.delete(`/admin/sessions/user/${userId}`);
}
