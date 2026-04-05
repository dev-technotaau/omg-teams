import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Upload Service
//
//  Storage is determined server-side (no client override):
//    Profile photos, documents, offer letters → Cloudinary
//    Reports, backups → R2
// ──────────────────────────────────────────────

export interface UploadResult {
  url: string;
  storageKey: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  message?: string;
}

function buildFormData(file: File, fieldName: string): FormData {
  const form = new FormData();
  form.append(fieldName, file);
  return form;
}

async function uploadFile(endpoint: string, file: File, fieldName: string): Promise<UploadResult> {
  const form = buildFormData(file, fieldName);
  const res = await api.post<UploadResult>(endpoint, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/** Upload a profile photo */
export function uploadProfilePhoto(file: File): Promise<UploadResult> {
  return uploadFile("/uploads/profile-photo", file, "avatar");
}

/** Delete the current user's profile photo */
export async function deleteProfilePhoto(): Promise<void> {
  await api.delete("/uploads/profile-photo");
}

/** Upload a KYC document */
export function uploadKycDocument(file: File): Promise<UploadResult> {
  return uploadFile("/uploads/document", file, "document");
}

/** Upload an offer letter */
export function uploadOfferLetter(file: File): Promise<UploadResult> {
  return uploadFile("/uploads/document", file, "document");
}

/** Upload a report file */
export function uploadReport(file: File): Promise<UploadResult> {
  return uploadFile("/uploads/document", file, "document");
}

/** Generic document upload */
export function uploadDocument(file: File): Promise<UploadResult> {
  return uploadFile("/uploads/document", file, "document");
}

/** Admin: Upload profile photo for a specific user */
export function uploadProfilePhotoForUser(userId: string, file: File): Promise<UploadResult> {
  return uploadFile(`/uploads/profile-photo/${userId}`, file, "avatar");
}

/** Admin: Delete profile photo for a specific user */
export async function deleteProfilePhotoForUser(userId: string): Promise<void> {
  await api.delete(`/uploads/profile-photo/${userId}`);
}

/** Admin: Upload offer letter signature image */
export function uploadSignatureImage(file: File): Promise<UploadResult> {
  return uploadFile("/uploads/signature", file, "avatar");
}

/** Admin: Delete offer letter signature image */
export async function deleteSignatureImage(): Promise<void> {
  await api.delete("/uploads/signature");
}
