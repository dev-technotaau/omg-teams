import { api } from "@/lib/api";

export interface Target {
  id: string;
  recruiterId: string;
  targetType: "DAILY" | "WEEKLY" | "MONTHLY";
  targetValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  recruiter: { id: string; firstName: string; lastName: string; employeeId: string | null };
  creator: { id: string; firstName: string; lastName: string };
  achieved?: number;
}

export async function listTargets(filters?: { recruiterId?: string; isActive?: boolean }) {
  const params: Record<string, string> = {};
  if (filters?.recruiterId) params["recruiterId"] = filters.recruiterId;
  if (filters?.isActive !== undefined) params["isActive"] = String(filters.isActive);
  const res = await api.get<{ data: Target[] }>("/targets", { params });
  return res.data.data;
}

export async function createTarget(data: {
  recruiterId: string;
  targetType: string;
  targetValue: number;
  effectiveFrom: string;
  effectiveTo?: string;
}) {
  const res = await api.post<{ data: Target }>("/targets", data);
  return res.data.data;
}

export async function updateTarget(
  id: string,
  data: Partial<{ targetValue: number; effectiveTo: string; isActive: boolean }>,
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
