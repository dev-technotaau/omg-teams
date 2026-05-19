import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Target Service — Spec Section 23.9
// ──────────────────────────────────────────────

export type TargetType = "DAILY" | "WEEKLY" | "MONTHLY";

/**
 * Derived status combining raw `isActive` with the effective-date window.
 * A row is only operationally "active" if isActive=true AND effectiveFrom ≤
 * today ≤ effectiveTo (or effectiveTo is null = ongoing).
 */
export type EffectiveStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

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
  /** Derived status that respects effectiveFrom / effectiveTo. */
  effectiveStatus?: EffectiveStatus;
  /** Positive = days until start, negative = days since start, null = unknown. */
  daysUntilStart?: number | null;
  /** Positive = days until end, negative = days past end, null = ongoing. */
  daysUntilEnd?: number | null;
  /**
   * On INDIVIDUAL rows only — the target value of the currently-active
   * global default of the same type that this individual is shadowing.
   * `null` if there is no active global default of this type (so this
   * individual isn't overriding anything).
   */
  overridesGlobalValue?: number | null;
  /**
   * On GLOBAL DEFAULT rows only — how many ACTIVE recruiters have an
   * individual override of the same type that suppresses this default
   * for them. `0` when the default is fully applied.
   */
  suppressedByRecruiterCount?: number;
}

export interface TeamRecruiterTargets {
  recruiter: { id: string; firstName: string; lastName: string; employeeId: string | null };
  targets: Target[];
}

export async function listTargets(filters?: {
  recruiterId?: string;
  isActive?: boolean;
  effectiveStatus?: EffectiveStatus;
  endingWithinDays?: number;
}) {
  const params: Record<string, string> = {};
  if (filters?.recruiterId) params["recruiterId"] = filters.recruiterId;
  if (filters?.isActive !== undefined) params["isActive"] = String(filters.isActive);
  if (filters?.effectiveStatus) params["effectiveStatus"] = filters.effectiveStatus;
  if (filters?.endingWithinDays !== undefined)
    params["endingWithinDays"] = String(filters.endingWithinDays);
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
  data: Partial<{
    targetValue: number;
    /** Backend only accepts when target is currently SCHEDULED. */
    effectiveFrom: string;
    effectiveTo: string | null;
    isActive: boolean;
  }>,
) {
  const res = await api.patch<{ data: Target }>(`/targets/${id}`, data);
  return res.data.data;
}

// ── Per-target history (§23.1 + §23.9) ───────────────────────
export interface TargetHistoryEntry {
  id: string;
  action: string; // CREATE | UPDATE | DELETE
  timestamp: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  ipAddress: string | null;
  user: { firstName: string; lastName: string; employeeId: string | null } | null;
}

export async function getTargetHistory(id: string) {
  const res = await api.get<{ data: TargetHistoryEntry[] }>(`/targets/${id}/history`);
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
