import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Duplicate Management Service
// ──────────────────────────────────────────────

/** Admin: Merge duplicates, keeping the primary candidate */
export async function mergeDuplicates(groupId: string, primaryCandidateId: string) {
  const res = await api.post<{ data: unknown }>(`/duplicates/${groupId}/merge`, {
    primaryCandidateId,
  });
  return res.data.data;
}
