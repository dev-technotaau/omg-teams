import { GetObjectCommand } from "@aws-sdk/client-s3";
import { v2 as cloudinaryV2 } from "cloudinary";
import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { getR2 } from "../config/storage.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";
import { requireAuth } from "../middleware/auth.js";
import {
  verifyDownloadToken,
  generateDownloadToken,
  getSignedDownloadUrl,
} from "../utils/signed-url.js";
import type { Request, Response } from "express";

/** Sanitize filename — strip path traversal, CRLF injection, non-ASCII */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\r\n]/g, "") // Strip CRLF (header injection)
    .replace(/[/\\]/g, "_") // Strip path separators
    .replace(/[^\w.\-() ]/g, "_") // Only safe chars
    .slice(0, 255);
}

// ──────────────────────────────────────────────
//  File Download Proxy — /api/v1/files
//
//  All file downloads go through this endpoint.
//  ✓ Auth check (JWT/session)
//  ✓ Access control (ownership or admin)
//  ✓ Audit logging (who downloaded what, when)
//  ✓ Content-Disposition enforcement
//  ✓ Signed URL generation or stream proxy
//
//  Two modes:
//  1. /api/v1/files/download/:token — token-based (for links in emails, etc.)
//  2. /api/v1/files/signed-url     — returns a short-lived signed URL
// ──────────────────────────────────────────────

const router = Router();

/**
 * POST /api/v1/files/signed-url
 * Generates a short-lived signed URL for the given storage key.
 * Requires auth. Logs access.
 */
router.post("/signed-url", requireAuth, async (req: Request, res: Response) => {
  const body = z
    .object({
      storageKey: z.string().min(1),
      disposition: z.enum(["inline", "attachment"]).default("attachment"),
      fileName: z.string().max(255).optional(),
      resourceType: z.enum(["image", "raw"]).optional(),
      backend: z.enum(["CLOUDINARY", "R2"]).optional(),
    })
    .parse(req.body);

  const { storageKey, disposition: disp } = body;
  const safeName = body.fileName ? sanitizeFilename(body.fileName) : undefined;
  const contentDisposition = safeName ? `${disp}; filename="${safeName}"` : disp;

  const signedUrl = await getSignedDownloadUrl(storageKey, {
    contentDisposition,
    backend: body.backend ?? null,
    resourceType: body.resourceType ?? (storageKey.includes("offer-letters") ? "raw" : "image"),
  });

  // Audit log
  await logFileAccess(req.user!.id, storageKey, "signed-url");

  res.status(HttpStatus.OK).json({ url: signedUrl, expiresIn: env.SIGNED_URL_TTL });
});

/**
 * POST /api/v1/files/download-token
 * Generates a short-lived download token (for embedding in links).
 * Requires auth. The token itself is verified on download.
 */
router.post("/download-token", requireAuth, (req: Request, res: Response) => {
  const body = z
    .object({
      storageKey: z.string().min(1),
      disposition: z.enum(["inline", "attachment"]).default("attachment"),
      fileName: z.string().max(255).optional(),
      backend: z.enum(["CLOUDINARY", "R2"]).optional(),
    })
    .parse(req.body);

  const safeName = body.fileName ? sanitizeFilename(body.fileName) : undefined;

  const token = generateDownloadToken(body.storageKey, req.user!.id, {
    disposition: body.disposition,
    ...(safeName !== null && safeName !== undefined && { fileName: safeName }),
    ...(body.backend && { backend: body.backend }),
  });

  res.status(HttpStatus.OK).json({ token, expiresIn: env.SIGNED_URL_TTL });
});

/**
 * GET /api/v1/files/download/:token
 * Stream-downloads a file using a signed token.
 * No auth required (token IS the auth). Used for email links, etc.
 */
router.get("/download/:token", async (req: Request, res: Response) => {
  const token = req.params["token"] as string;
  const payload = verifyDownloadToken(token);

  if (!payload) {
    throw new AppError(
      "Invalid or expired download link",
      HttpStatus.UNAUTHORIZED,
      ErrorCode.TOKEN_EXPIRED,
    );
  }

  const { storageKey, userId, disposition, fileName, backend } = payload;

  // Set headers
  const dispHeader = fileName ? `${disposition}; filename="${fileName}"` : disposition;
  res.setHeader("Content-Disposition", dispHeader);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");

  // Stream from storage
  await streamFileToResponse(storageKey, res, backend);

  // Audit log
  await logFileAccess(userId, storageKey, "token-download");
});

/**
 * Stream a file from R2 or fetch from Cloudinary and pipe to response.
 *
 * `backend` is the explicit hint carried in the download token (or null
 * for legacy tokens issued before the column existed). When null, fall
 * back to the configured-default heuristic.
 */
async function streamFileToResponse(
  storageKey: string,
  res: Response,
  backend?: "CLOUDINARY" | "R2",
): Promise<void> {
  const isCloudinary =
    backend === "CLOUDINARY" ||
    (!backend && env.hasCloudinary && !storageKey.startsWith("http"));

  if (isCloudinary) {
    // For Cloudinary, generate a short-lived signed URL and redirect
    const signedUrl = cloudinaryV2.url(storageKey, {
      sign_url: true,
      type: "authenticated",
      resource_type: "auto",
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 60, // 1 min
    });

    // Fetch and pipe instead of redirect (to enforce headers)
    const response = await fetch(signedUrl);
    if (!response.ok || !response.body) {
      throw new AppError("File not found in storage", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const arrayBuf = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuf));
    return;
  }

  if (env.hasR2) {
    const r2 = getR2();
    const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: storageKey });

    try {
      const response = await r2.send(command);
      if (!response.Body) {
        throw new AppError("File not found in storage", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
      }

      if (response.ContentType) res.setHeader("Content-Type", response.ContentType);
      if (response.ContentLength) res.setHeader("Content-Length", String(response.ContentLength));

      const body = await response.Body.transformToByteArray();
      res.send(Buffer.from(body));
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") {
        throw new AppError("File not found in storage", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
      }
      throw err;
    }
    return;
  }

  throw new AppError(
    "No storage backend configured",
    HttpStatus.INTERNAL_SERVER_ERROR,
    ErrorCode.INTERNAL_ERROR,
  );
}

// ──────────────────────────────────────────────
//  File Access Audit Logging
// ──────────────────────────────────────────────

async function logFileAccess(
  userId: string,
  storageKey: string,
  method: "signed-url" | "token-download" | "stream",
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        userId,
        action: "FILE_ACCESS",
        entityType: "File",
        entityId: storageKey,
        changes: { method, storageKey, timestamp: new Date().toISOString() },
      },
    });
    logger.debug("File access logged", { userId, storageKey, method });
  } catch (err) {
    // Non-critical — don't fail the download
    logger.warn("Failed to log file access", { userId, storageKey, error: (err as Error).message });
  }
}

export { router as fileRouter };
