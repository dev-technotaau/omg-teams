import { api } from "@/lib/api";

export interface Draft {
  id: string;
  recruiterId: string;
  zone: string | null;
  formData: Record<string, unknown>;
  lastSavedAt: string;
}

export async function saveDraft(
  zone: string | null,
  formData: Record<string, unknown>,
): Promise<Draft> {
  const res = await api.put<{ draft: Draft }>("/drafts", { zone, formData });
  return res.data.draft;
}

export async function getDraft(): Promise<Draft | null> {
  const res = await api.get<{ draft: Draft | null }>("/drafts");
  return res.data.draft;
}

export async function deleteDraft(): Promise<void> {
  await api.delete("/drafts");
}
