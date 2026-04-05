import { api } from "@/lib/api";

export interface CandidateReport {
  id: string;
  globalSerialNumber: number;
  zone: string;
  candidateName: string | null;
  contactNo: string | null;
  emailId: string | null;
  state: string | null;
  location: string | null;
  profile: string | null;
  status: string | null;
  candidateStage: string;
  createdAt: string;
  recruiter: { id: string; firstName: string; lastName: string; employeeId: string | null };
  company: { id: string; name: string } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listCandidates(
  params?: Record<string, string>,
): Promise<PaginatedResponse<CandidateReport>> {
  const res = await api.get<PaginatedResponse<CandidateReport>>("/candidates", { params });
  return res.data;
}

export async function getCandidate(id: string): Promise<CandidateReport> {
  const res = await api.get<{ report: CandidateReport }>(`/candidates/${id}`);
  return res.data.report;
}

export async function createCandidate(data: Record<string, unknown>): Promise<CandidateReport> {
  const res = await api.post<{ report: CandidateReport }>("/candidates", data);
  return res.data.report;
}

export async function updateCandidate(
  id: string,
  data: Record<string, unknown>,
): Promise<CandidateReport> {
  const res = await api.patch<{ report: CandidateReport }>(`/candidates/${id}`, data);
  return res.data.report;
}

export async function deleteCandidate(id: string): Promise<void> {
  await api.delete(`/candidates/${id}`);
}

export async function checkDuplicates(data: { contactNo?: string; emailId?: string }) {
  const res = await api.post<{ duplicates: unknown[]; hasDuplicates: boolean }>(
    "/duplicates/check",
    data,
  );
  return res.data;
}

export async function getNextInvoiceNumber(): Promise<string> {
  const res = await api.get<{ invoiceNumber: string }>("/candidates/next-invoice");
  return res.data.invoiceNumber;
}

export async function updateCandidateStage(id: string, stage: string, notes?: string) {
  const res = await api.patch<{ report: CandidateReport }>(`/candidates/${id}/stage`, {
    stage,
    notes,
  });
  return res.data.report;
}

export async function getCandidateStageHistory(id: string) {
  const res = await api.get<{
    history: Array<{
      id: string;
      fromStage: string;
      toStage: string;
      changedAt: string;
      notes: string | null;
    }>;
  }>(`/candidates/${id}/stage-history`);
  return res.data.history;
}
