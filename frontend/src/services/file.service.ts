import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  File Service — Secure File Access
//
//  All file downloads go through the backend proxy
//  which enforces auth, access control, audit logging,
//  and returns time-limited signed URLs.
//
//  NEVER use raw Cloudinary/R2 URLs directly.
// ──────────────────────────────────────────────

interface SignedUrlResponse {
  url: string;
  expiresIn: number;
}

interface DownloadTokenResponse {
  token: string;
  expiresIn: number;
}

/**
 * Get a time-limited signed URL for a storage key.
 * The URL expires after ~15 minutes (configurable server-side).
 */
export async function getSignedUrl(
  storageKey: string,
  opts: {
    disposition?: "inline" | "attachment";
    fileName?: string;
    resourceType?: "image" | "raw";
  } = {},
): Promise<string> {
  const res = await api.post<SignedUrlResponse>("/files/signed-url", {
    storageKey,
    ...opts,
  });
  return res.data.url;
}

/**
 * Get a download token for embedding in links (e.g., email links).
 * The token is self-contained and doesn't require auth to use.
 */
export async function getDownloadToken(
  storageKey: string,
  opts: {
    disposition?: "inline" | "attachment";
    fileName?: string;
  } = {},
): Promise<string> {
  const res = await api.post<DownloadTokenResponse>("/files/download-token", {
    storageKey,
    ...opts,
  });
  return res.data.token;
}

/**
 * Build a download URL from a token (for use in href/window.open).
 */
export function getDownloadUrl(token: string): string {
  return `/api/proxy/files/download/${token}`;
}

/**
 * Download a file via signed URL — opens in new tab.
 */
export async function downloadFile(storageKey: string, fileName?: string): Promise<void> {
  const url = await getSignedUrl(storageKey, {
    disposition: "attachment",
    fileName,
  });
  window.open(url, "_blank");
}

/**
 * Get a signed URL for an image preview (inline viewing).
 */
export async function getImagePreviewUrl(storageKey: string): Promise<string> {
  return getSignedUrl(storageKey, {
    disposition: "inline",
    resourceType: "image",
  });
}
