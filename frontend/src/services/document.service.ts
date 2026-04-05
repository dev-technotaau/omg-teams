import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Document Service
// ──────────────────────────────────────────────

/** View/download a document file by ID */
export async function viewDocument(id: string): Promise<string> {
  const res = await api.get<{ url: string }>(`/documents/${id}/view`);
  return res.data.url;
}

/** Admin: Change document status (any direction) */
export async function changeDocumentStatus(id: string, status: string, reason?: string) {
  await api.patch(`/documents/${id}/status`, { status, reason });
}
