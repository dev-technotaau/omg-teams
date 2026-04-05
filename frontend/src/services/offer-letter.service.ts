import { api } from "@/lib/api";

export interface OfferLetter {
  id: string;
  userId: string;
  referenceNumber: string;
  variant: "TEMPLATE" | "TIPTAP_EDITOR";
  dynamicFields: Record<string, unknown> | null;
  editorContent: string | null;
  generatedFileUrl: string | null;
  isArchived: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
    email: string;
  };
  generator: { id: string; firstName: string; lastName: string };
}

export async function listOfferLetters(params?: {
  userId?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams: Record<string, string> = {};
  if (params?.userId) queryParams["userId"] = params.userId;
  if (params?.page) queryParams["page"] = String(params.page);
  if (params?.limit) queryParams["limit"] = String(params.limit);
  const res = await api.get<{
    data: OfferLetter[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("/offer-letters", { params: queryParams });
  return res.data;
}

export async function getOfferLetter(id: string) {
  const res = await api.get<{ data: OfferLetter }>(`/offer-letters/${id}`);
  return res.data.data;
}

export async function createOfferLetter(data: {
  userId: string;
  variant: string;
  dynamicFields?: Record<string, unknown>;
  editorContent?: string;
}) {
  const res = await api.post<{ data: OfferLetter }>("/offer-letters", data);
  return res.data.data;
}

export async function updateOfferLetter(
  id: string,
  data: Partial<{ dynamicFields: Record<string, unknown>; editorContent: string }>,
) {
  const res = await api.patch<{ data: OfferLetter }>(`/offer-letters/${id}`, data);
  return res.data.data;
}

export async function archiveOfferLetter(id: string) {
  await api.patch(`/offer-letters/${id}/archive`);
}

export async function generateOfferLetterPdf(id: string) {
  const res = await api.post<{ data: { fileUrl: string; fileHash: string } }>(
    `/offer-letters/${id}/generate-pdf`,
  );
  return res.data.data;
}

/** Preview PDF as blob URL (without saving to storage) */
export async function previewOfferLetterPdf(id: string): Promise<string> {
  const res = await api.get(`/offer-letters/${id}/preview`, { responseType: "blob" });
  return URL.createObjectURL(res.data as Blob);
}
