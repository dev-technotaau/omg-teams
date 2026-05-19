import crypto from "node:crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v2 as cloudinaryV2 } from "cloudinary";
import { env } from "../config/env.js";
import { getR2 } from "../config/storage.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Signed URL Generation
//
//  R2:         AWS S3 presigned URLs (time-limited)
//  Cloudinary: Signed delivery URLs (time-limited)
//
//  NEVER return raw public URLs for stored files.
//  All file access goes through signed URLs or the
//  backend download proxy (/api/v1/files/:token).
// ──────────────────────────────────────────────

/**
 * Generate a time-limited signed URL for an R2 object.
 * Uses AWS SDK presigned URL with configurable TTL.
 */
export async function getSignedR2Url(
  storageKey: string,
  ttlSeconds?: number,
  contentDisposition?: string,
): Promise<string> {
  const r2 = getR2();
  const expiresIn = ttlSeconds ?? env.SIGNED_URL_TTL;

  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: storageKey,
    ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
  });

  const url = await getSignedUrl(r2, command, { expiresIn });
  return url;
}

/**
 * Generate a time-limited signed Cloudinary URL.
 * Uses Cloudinary's authenticated delivery with expiring tokens.
 */
export function getSignedCloudinaryUrl(
  publicId: string,
  resourceType: "image" | "raw" = "image",
  ttlSeconds?: number,
): string {
  const ttl = ttlSeconds ?? env.SIGNED_URL_TTL;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  // Cloudinary signed URL with expiration
  const url = cloudinaryV2.url(publicId, {
    sign_url: true,
    type: "authenticated",
    resource_type: resourceType,
    secure: true,
    expires_at: expiresAt,
  });

  return url;
}

export type StorageBackendHint = "CLOUDINARY" | "R2";

/**
 * Generate a signed download URL for any storage key.
 *
 * Pass `backend` whenever the caller knows it (every row backed by the
 * storage tables now stores this alongside the key). When `backend` is
 * null/undefined, we fall back to the legacy heuristic — preferring
 * whichever backend is currently configured — for pre-migration rows.
 */
export async function getSignedDownloadUrl(
  storageKey: string,
  opts: {
    ttlSeconds?: number;
    contentDisposition?: string;
    resourceType?: "image" | "raw";
    backend?: StorageBackendHint | null;
  } = {},
): Promise<string> {
  if (!storageKey) {
    throw new Error("No storage key provided");
  }

  // Explicit backend → trust it. This is the path every new upload takes.
  if (opts.backend === "CLOUDINARY") {
    return getSignedCloudinaryUrl(storageKey, opts.resourceType ?? "image", opts.ttlSeconds);
  }
  if (opts.backend === "R2") {
    return getSignedR2Url(storageKey, opts.ttlSeconds, opts.contentDisposition);
  }

  // Backwards-compat fallback for rows written before the storage_backend
  // column existed. Prefer Cloudinary when configured (matches the historical
  // upload-priority order in upload.controller.resolveStorage).
  if (env.hasCloudinary && !storageKey.startsWith("http")) {
    return getSignedCloudinaryUrl(storageKey, opts.resourceType ?? "image", opts.ttlSeconds);
  }

  if (env.hasR2) {
    return getSignedR2Url(storageKey, opts.ttlSeconds, opts.contentDisposition);
  }

  throw new Error("No storage backend configured for signed URL generation");
}

// ──────────────────────────────────────────────
//  Short-Lived Download Tokens
//
//  For the backend download proxy, we generate HMAC-signed
//  tokens that encode: storageKey + userId + expiry.
//  This is used by /api/v1/files/:token endpoint.
// ──────────────────────────────────────────────

interface DownloadTokenPayload {
  storageKey: string;
  userId: string;
  expiresAt: number; // Unix timestamp
  disposition: "inline" | "attachment";
  fileName?: string;
  /** Explicit storage backend — preserves backend across token roundtrips
   *  so the download endpoint doesn't have to guess from the key shape. */
  backend?: StorageBackendHint;
}

const TOKEN_SECRET = () => env.JWT_SECRET || env.COOKIE_SECRET || "fallback-token-secret";

/**
 * Generate a short-lived HMAC-signed download token.
 * Encodes file info + user + expiry into a URL-safe base64 token.
 */
export function generateDownloadToken(
  storageKey: string,
  userId: string,
  opts: {
    ttlSeconds?: number;
    disposition?: "inline" | "attachment";
    fileName?: string;
    backend?: StorageBackendHint;
  } = {},
): string {
  const ttl = opts.ttlSeconds ?? env.SIGNED_URL_TTL;
  const payload: DownloadTokenPayload = {
    storageKey,
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + ttl,
    disposition: opts.disposition ?? "attachment",
    ...(opts.fileName ? { fileName: opts.fileName } : {}),
    ...(opts.backend ? { backend: opts.backend } : {}),
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET()).update(data).digest("base64url");

  return `${data}.${signature}`;
}

/**
 * Verify and decode a download token. Returns null if invalid or expired.
 */
export function verifyDownloadToken(token: string): DownloadTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  if (!data || !signature) return null;

  // Verify HMAC
  const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET()).update(data).digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    logger.warn("Download token signature mismatch");
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as DownloadTokenPayload;

    // Check expiry
    if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
      logger.debug("Download token expired", { storageKey: payload.storageKey });
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
