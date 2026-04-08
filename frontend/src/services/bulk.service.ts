import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Bulk Operations API — Admin-only
// ──────────────────────────────────────────────

export async function bulkUpdateStage(ids: string[], stage: string) {
  const res = await api.post<{ updated: number }>("/bulk/stage", { ids, stage });
  return res.data;
}

export async function bulkUpdatePaymentStatus(ids: string[], paymentStatus: string) {
  const res = await api.post<{ updated: number }>("/bulk/payment-status", { ids, paymentStatus });
  return res.data;
}

export async function bulkAssignCompany(ids: string[], companyId: string) {
  const res = await api.post<{ updated: number }>("/bulk/assign-company", { ids, companyId });
  return res.data;
}

export type BulkRestoreItem = {
  id: string;
  entityType: "candidate" | "company" | "serviceProvider" | "hrManager" | "user";
};

export async function bulkRestore(items: BulkRestoreItem[]) {
  const res = await api.post<{ restored: number }>("/bulk/restore", { items });
  return res.data;
}
