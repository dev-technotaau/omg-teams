import crypto from "node:crypto";
import path from "node:path";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v2 as cloudinaryV2 } from "cloudinary";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { getR2 } from "../config/storage.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Upload Controller
//
//  Storage routing (FIXED — no query param override):
//    Profile photos, documents, signatures, offer letters → Cloudinary
//    Backups, reports → R2
//    Fallback: whichever backend is configured
// ──────────────────────────────────────────────

type StorageTarget = "r2" | "cloudinary";

function resolveStorage(): StorageTarget {
  // Fixed assignment: Cloudinary for user-facing assets, R2 for bulk/backup
  if (env.hasCloudinary) return "cloudinary";
  if (env.hasR2) return "r2";

  throw new AppError(
    "No storage backend configured. Set R2 or Cloudinary credentials.",
    HttpStatus.INTERNAL_SERVER_ERROR,
    ErrorCode.INTERNAL_ERROR,
  );
}

function extFromMime(mimetype: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mimetype] ?? (path.extname(mimetype).replace(".", "") || "bin");
}

async function uploadBufferToR2(buffer: Buffer, key: string, contentType: string): Promise<void> {
  const r2 = getR2();
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: "attachment", // Force download, prevent inline rendering
    }),
  );
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<{ publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinaryV2.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        type: "authenticated", // Require signed URLs for access (not public)
      },
      (err, result) => {
        if (err || !result) {
          reject(err ? new Error(err.message) : new Error("Cloudinary upload returned no result"));
          return;
        }
        resolve({ publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/**
 * POST /api/v1/uploads/profile-photo
 * Uploads a profile photo and updates the user record.
 */
export async function uploadProfilePhoto(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError("No file provided", HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }

  // Allow admin to upload for another user
  const targetUserId = (req.params["userId"] as string | undefined) ?? req.user!.id;

  // If uploading for another user, require admin role
  if (targetUserId !== req.user!.id && req.user!.role !== "ADMIN") {
    throw new AppError(
      "Only admin can upload photos for other users",
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN,
    );
  }

  const ext = extFromMime(file.mimetype);
  const timestamp = Date.now();
  let fileBuffer: Buffer;
  if (file.buffer) {
    fileBuffer = file.buffer;
  } else {
    const fs = await import("node:fs/promises");
    fileBuffer = await fs.readFile(file.path);
  }

  // §24.11 — Image processing: resize, compress, strip EXIF
  try {
    const { processImage } = await import("../middleware/upload.js");
    fileBuffer = await processImage(fileBuffer, { maxWidth: 800, maxHeight: 800, quality: 85 });
  } catch (err) {
    logger.warn("Image processing failed, using original", { error: (err as Error).message });
  }

  // Cleanup: fetch old storage key before uploading new one
  const prisma = getPrisma();
  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { profilePhotoStorageKey: true },
  });
  const oldStorageKey = existingUser?.profilePhotoStorageKey;

  let storageKey: string;
  const target = resolveStorage();

  if (target === "r2") {
    storageKey = `avatars/${targetUserId}/${timestamp}.${ext}`;
    await uploadBufferToR2(fileBuffer, storageKey, file.mimetype);
    logger.info("Profile photo uploaded to R2", { userId: targetUserId, storageKey });
  } else {
    const result = await uploadBufferToCloudinary(fileBuffer, `avatars/${targetUserId}`);
    storageKey = result.publicId;
    logger.info("Profile photo uploaded to Cloudinary", {
      userId: targetUserId,
      publicId: storageKey,
    });
  }

  // Generate a signed URL for immediate use (short-lived)
  const { getSignedDownloadUrl } = await import("../utils/signed-url.js");
  const signedUrl = await getSignedDownloadUrl(storageKey);

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      profilePhotoUrl: signedUrl,
      profilePhotoStorageKey: storageKey,
    },
  });

  // Delete old photo from storage (§30.3.1)
  if (oldStorageKey && oldStorageKey !== storageKey) {
    try {
      if (env.hasCloudinary && oldStorageKey.includes("/")) {
        await cloudinaryV2.uploader.destroy(oldStorageKey);
        logger.info("Old profile photo deleted from Cloudinary", {
          userId: targetUserId,
          oldKey: oldStorageKey,
        });
      } else if (env.hasR2) {
        const r2 = getR2();
        await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: oldStorageKey }));
        logger.info("Old profile photo deleted from R2", {
          userId: targetUserId,
          oldKey: oldStorageKey,
        });
      }
    } catch (err) {
      logger.warn("Failed to delete old profile photo from storage", {
        userId: targetUserId,
        oldKey: oldStorageKey,
        err,
      });
    }
  }

  res.status(HttpStatus.OK).json({
    url: signedUrl,
    storageKey,
    message: "Profile photo updated successfully",
  });
}

/**
 * POST /api/v1/uploads/document
 * Uploads a document to R2 and returns the URL + storage key.
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError("No file provided", HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }

  const userId = req.user!.id;
  const ext = extFromMime(file.mimetype);
  const hash = crypto.randomBytes(8).toString("hex");
  const timestamp = Date.now();
  let fileBuffer: Buffer;
  if (file.buffer) {
    fileBuffer = file.buffer;
  } else {
    const fs = await import("node:fs/promises");
    fileBuffer = await fs.readFile(file.path);
  }

  // §29.3 — Strip EXIF metadata from document images (Aadhaar, PAN photos)
  if (file.mimetype.startsWith("image/")) {
    try {
      const { processImage } = await import("../middleware/upload.js");
      // Larger dimensions for documents (don't over-compress identity cards)
      fileBuffer = await processImage(fileBuffer, { maxWidth: 2048, maxHeight: 2048, quality: 90 });
    } catch (err) {
      logger.warn("Document image EXIF strip failed, using original", {
        error: (err as Error).message,
      });
    }
  }

  let storageKey: string;
  const target = resolveStorage();

  if (target === "r2") {
    storageKey = `documents/${userId}/${timestamp}-${hash}.${ext}`;
    await uploadBufferToR2(fileBuffer, storageKey, file.mimetype);
    logger.info("Document uploaded to R2", { userId, storageKey });
  } else {
    const result = await uploadBufferToCloudinary(fileBuffer, `documents/${userId}`);
    storageKey = result.publicId;
    logger.info("Document uploaded to Cloudinary", { userId, publicId: storageKey });
  }

  // Return storageKey — frontend uses /files/signed-url to get access
  const { getSignedDownloadUrl } = await import("../utils/signed-url.js");
  const signedUrl = await getSignedDownloadUrl(storageKey, {
    resourceType: file.mimetype.startsWith("image/") ? "image" : "raw",
  });

  res.status(HttpStatus.OK).json({
    url: signedUrl,
    storageKey,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  });
}

/**
 * DELETE /api/v1/uploads/profile-photo
 * Removes the user's profile photo from storage and clears the DB record.
 */
/**
 * POST /api/v1/uploads/signature
 * Uploads an offer letter signature image and stores URL in PlatformSettings.
 */
export async function uploadSignatureImage(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError("No file provided", HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }

  let fileBuffer: Buffer;
  if (file.buffer) {
    fileBuffer = file.buffer;
  } else {
    const fs = await import("node:fs/promises");
    fileBuffer = await fs.readFile(file.path);
  }

  // Resize signature image — keep it small for PDF embedding
  try {
    const { processImage } = await import("../middleware/upload.js");
    fileBuffer = await processImage(fileBuffer, { maxWidth: 400, maxHeight: 200, quality: 90 });
  } catch (err) {
    logger.warn("Signature image processing failed, using original", {
      error: (err as Error).message,
    });
  }

  // Delete old signature from storage if exists
  const { getSetting, updateSetting } = await import("../services/settings.service.js");
  const existing = await getSetting("offer_letter_signature_storage_key");
  const oldKey = existing?.value as string | null;

  let storageKey: string;
  const target = resolveStorage();

  if (target === "r2") {
    storageKey = `signatures/offer-letter-${Date.now()}.${extFromMime(file.mimetype)}`;
    await uploadBufferToR2(fileBuffer, storageKey, file.mimetype);
  } else {
    const result = await uploadBufferToCloudinary(fileBuffer, "signatures");
    storageKey = result.publicId;
  }

  // Clean up old file
  if (oldKey && oldKey !== storageKey) {
    try {
      if (env.hasCloudinary && oldKey.includes("/")) {
        await cloudinaryV2.uploader.destroy(oldKey);
      } else if (env.hasR2) {
        const r2 = getR2();
        await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: oldKey }));
      }
    } catch (err) {
      logger.warn("Failed to delete old signature image", { oldKey, err });
    }
  }

  // Generate signed URL for the response and for PDF embedding
  const { getSignedDownloadUrl } = await import("../utils/signed-url.js");
  const signedUrl = await getSignedDownloadUrl(storageKey);

  // Store storage key (NOT raw URL) in PlatformSettings
  const userId = req.user!.id;
  await updateSetting("offer_letter_signature_url", signedUrl, userId, "offer_letter");
  await updateSetting("offer_letter_signature_storage_key", storageKey, userId, "offer_letter");

  logger.info("Signature image uploaded", { storageKey });
  res
    .status(HttpStatus.OK)
    .json({ url: signedUrl, storageKey, message: "Signature image uploaded" });
}

/**
 * DELETE /api/v1/uploads/signature
 * Removes the offer letter signature image from storage and settings.
 */
export async function deleteSignatureImage(_req: Request, res: Response): Promise<void> {
  const { getSetting, updateSetting } = await import("../services/settings.service.js");
  const existing = await getSetting("offer_letter_signature_storage_key");
  const storageKey = existing?.value as string | null;

  if (!storageKey) {
    throw new AppError(
      "No signature image to delete",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Delete from storage
  try {
    if (env.hasCloudinary && storageKey.includes("/")) {
      await cloudinaryV2.uploader.destroy(storageKey);
    } else if (env.hasR2) {
      const r2 = getR2();
      await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: storageKey }));
    }
  } catch (err) {
    logger.warn("Failed to delete signature image from storage, clearing settings anyway", {
      storageKey,
      err,
    });
  }

  const userId = _req.user!.id;
  await updateSetting("offer_letter_signature_url", null, userId, "offer_letter");
  await updateSetting("offer_letter_signature_storage_key", null, userId, "offer_letter");

  logger.info("Signature image deleted", { storageKey });
  res.status(HttpStatus.OK).json({ message: "Signature image removed" });
}

/**
 * DELETE /api/v1/uploads/profile-photo
 * Removes the user's profile photo from storage and clears the DB record.
 */
export async function deleteProfilePhoto(req: Request, res: Response): Promise<void> {
  const targetUserId = (req.params["userId"] as string | undefined) ?? req.user!.id;

  // If deleting for another user, require admin role
  if (targetUserId !== req.user!.id && req.user!.role !== "ADMIN") {
    throw new AppError(
      "Only admin can remove photos for other users",
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN,
    );
  }

  const userId = targetUserId;
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhotoStorageKey: true },
  });

  if (!user?.profilePhotoStorageKey) {
    throw new AppError(
      "No profile photo to delete",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Attempt to delete from storage
  try {
    if (env.hasR2) {
      const r2 = getR2();
      await r2.send(
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: user.profilePhotoStorageKey }),
      );
      logger.info("Profile photo deleted from R2", { userId, key: user.profilePhotoStorageKey });
    } else if (env.hasCloudinary) {
      await cloudinaryV2.uploader.destroy(user.profilePhotoStorageKey);
      logger.info("Profile photo deleted from Cloudinary", {
        userId,
        publicId: user.profilePhotoStorageKey,
      });
    }
  } catch (err) {
    logger.warn("Failed to delete profile photo from storage, clearing DB anyway", { userId, err });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { profilePhotoUrl: null, profilePhotoStorageKey: null },
  });

  res.status(HttpStatus.OK).json({ message: "Profile photo removed" });
}
