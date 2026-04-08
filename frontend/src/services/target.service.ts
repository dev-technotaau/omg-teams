import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Target Service — Spec Section 23.9
// ──────────────────────────────────────────────

export type TargetType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface Target {
  id: string;
  /** null = global default applied to recruiters with no individual override */
  recruiterId: string | null;
  targetType: TargetType;
  targetValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  /**
   * Recruiter is null when this row is a global default
   * (recruiterId === null).
   */
  recruiter: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
  } | null;
  creator: { id: string; firstName: string; lastName: string };
  /**
   * Current-period achievement count. Computed by the backend for
   * per-recruiter rows; always 0 for global defaults (they apply
   * to all recruiters, no single number is meaningful).
   */
  achieved?: number;
}

export interface TeamRecruiterTargets {
  recruiter: { id: string; firstName: string; lastName: string; employeeId: string | null };
  targets: Target[];
}

export async function listTargets(filters?: { recruiterId?: string; isActive?: boolean }) {
  const params: Record<string, string> = {};
  if (filters?.recruiterId) params["recruiterId"] = filters.recruiterId;
  if (filters?.isActive !== undefined) params["isActive"] = String(filters.isActive);
  const res = await api.get<{ data: Target[] }>("/targets", { params });
  return res.data.data;
}

export async function createTarget(data: {
  /** null = global default */
  recruiterId: string | null;
  targetType: TargetType;
  targetValue: number;
  effectiveFrom: string;
  effectiveTo?: string;
}) {
  const res = await api.post<{ data: Target }>("/targets", data);
  return res.data.data;
}

export async function updateTarget(
  id: string,
  data: Partial<{ targetValue: number; effectiveTo: string | null; isActive: boolean }>,
) {
  const res = await api.patch<{ data: Target }>(`/targets/${id}`, data);
  return res.data.data;
}

export async function deleteTarget(id: string) {
  await api.delete(`/targets/${id}`);
}

export async function getRecruiterTargets(recruiterId: string) {
  const res = await api.get<{ data: Target[] }>(`/targets/recruiter/${recruiterId}`);
  return res.data.data;
}

/** GET /targets/me — current recruiter shortcut for /my-targets */
export async function getMyTargets() {
  const res = await api.get<{ data: Target[] }>("/targets/me");
  return res.data.data;
}

/** GET /targets/team — RM team view */
export async function getTeamTargets() {
  const res = await api.get<{ data: TeamRecruiterTargets[] }>("/targets/team");
  return res.data.data;
}
