import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";
import { logger } from "../instrument.js";
import { registerService } from "./service-init.js";

// ──────────────────────────────────────────────
//  Cloudflare R2 (S3-compatible)
// ──────────────────────────────────────────────

let r2Client: S3Client | undefined;

export function getR2(): S3Client {
  r2Client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return r2Client;
}

registerService({
  name: "cloudflare-r2",
  critical: false,
  isConfigured: () => env.hasR2,

  connect() {
    getR2();
    logger.info("Cloudflare R2 client initialized", { bucket: env.R2_BUCKET });
    return Promise.resolve();
  },

  disconnect() {
    if (r2Client) {
      r2Client.destroy();
      r2Client = undefined;
    }
    return Promise.resolve();
  },
});

// ──────────────────────────────────────────────
//  Cloudinary
// ──────────────────────────────────────────────

registerService({
  name: "cloudinary",
  critical: false,
  isConfigured: () => env.hasCloudinary,

  async connect() {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    const result = (await cloudinary.api.ping()) as { status: string };
    logger.info("Cloudinary connected", { status: result.status });
  },

  disconnect() {
    return Promise.resolve();
  },
});

export { cloudinary };

// ──────────────────────────────────────────────
//  Shared R2 Deletion Helper
// ──────────────────────────────────────────────

/**
 * Delete one or more objects from R2. Silently ignores errors
 * (object may already be gone). Safe to call with empty keys.
 */
export async function deleteR2Objects(keys: string[]): Promise<number> {
  if (keys.length === 0 || !env.hasR2) return 0;
  const r2 = getR2();
  let deleted = 0;
  for (const key of keys) {
    if (!key) continue;
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
      deleted++;
    } catch (err) {
      logger.warn("Failed to delete R2 object (may already be gone)", {
        key,
        error: (err as Error).message,
      });
    }
  }
  return deleted;
}

/**
 * Delete storage objects from BOTH R2 and Cloudinary.
 * Since profile photos, documents, and offer letters may be in either backend,
 * we attempt deletion from both — the wrong one silently fails (object not found).
 */
export async function deleteStorageObjects(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;

  let deleted = 0;

  for (const key of keys) {
    if (!key) continue;

    // Try Cloudinary (profile photos, documents, offer letters go here)
    if (env.hasCloudinary) {
      try {
        const result = (await cloudinary.uploader.destroy(key, { invalidate: true })) as {
          result: string;
        };
        if (result.result === "ok") {
          deleted++;
          continue; // Found and deleted — skip R2 attempt
        }
      } catch {
        // Not in Cloudinary, try R2
      }
    }

    // Try R2 (backups, reports, or fallback)
    if (env.hasR2) {
      try {
        await getR2().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
        deleted++;
      } catch {
        // Not in R2 either — already gone or never existed
      }
    }
  }

  if (deleted > 0) {
    logger.info("Storage objects deleted", { requested: keys.length, deleted });
  }

  return deleted;
}
