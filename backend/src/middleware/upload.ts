import multer, { type FileFilterCallback } from "multer";
import { env } from "../config/env.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  File Upload Middleware (multer)
//  §24.11 — Profile photo + document uploads
//  Security: MIME filter → magic bytes (blocking) → virus scan → process
// ──────────────────────────────────────────────

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
]);

// All MIME types that are valid across the platform
const ALL_ALLOWED_MAGIC_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // file-type detects docx/xlsx as these
  "application/zip",
]);

// Memory storage always — never persist unscanned files to disk
const storage = multer.memoryStorage();

function imageFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `File type "${file.mimetype}" is not allowed. Accepted: jpeg, png, webp`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
      ),
    );
  }
}

function documentFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (DOCUMENT_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `File type "${file.mimetype}" is not allowed. Accepted: pdf, jpeg, png, docx, xlsx`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
      ),
    );
  }
}

/**
 * Single avatar/profile photo upload.
 * Max 5 MB, image types only.
 */
export const avatarUpload = multer({
  storage,
  limits: { fileSize: env.AVATAR_UPLOAD_MAX_SIZE },
  fileFilter: imageFilter,
}).single("avatar");

/**
 * Single document upload.
 * Max 10 MB, common document types.
 */
export const documentUpload = multer({
  storage,
  limits: { fileSize: env.DOCUMENT_UPLOAD_MAX_SIZE },
  fileFilter: documentFilter,
}).single("document");

/**
 * Bulk file upload — up to 10 files, max 10 MB each.
 */
export const bulkUpload = multer({
  storage,
  limits: { fileSize: env.DOCUMENT_UPLOAD_MAX_SIZE },
  fileFilter: documentFilter,
}).array("files", 10);

// ──────────────────────────────────────────────
//  §24.11 — Magic bytes validation (BLOCKING)
//  Rejects upload if content doesn't match declared type.
// ──────────────────────────────────────────────

/**
 * Middleware: validate uploaded file's magic bytes match expected type.
 * Run AFTER multer middleware to inspect the actual buffer.
 * BLOCKING — rejects on detection failure.
 */
export async function validateMagicBytes(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const file = req.file;
  if (!file?.buffer) {
    next();
    return;
  }

  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const result = await fileTypeFromBuffer(file.buffer);

    if (!result) {
      // Blocking: reject files whose content type cannot be determined
      logger.warn("Magic bytes detection failed — file rejected", {
        declared: file.mimetype,
        originalName: file.originalname,
      });
      next(
        new AppError(
          "Could not determine file type from content. Upload rejected.",
          HttpStatus.BAD_REQUEST,
          ErrorCode.FILE_TYPE_NOT_ALLOWED,
        ),
      );
      return;
    }

    // Verify detected type is in allowed set
    if (!ALL_ALLOWED_MAGIC_TYPES.has(result.mime)) {
      logger.warn("Magic bytes type not allowed", {
        declared: file.mimetype,
        detected: result.mime,
        originalName: file.originalname,
      });
      next(
        new AppError(
          `File content type "${result.mime}" is not allowed`,
          HttpStatus.BAD_REQUEST,
          ErrorCode.FILE_TYPE_NOT_ALLOWED,
        ),
      );
      return;
    }

    // For images specifically, ensure declared MIME matches detected MIME
    if (IMAGE_MIME_TYPES.has(file.mimetype) && result.mime !== file.mimetype) {
      logger.warn("Image MIME mismatch", {
        declared: file.mimetype,
        detected: result.mime,
        originalName: file.originalname,
      });
      next(
        new AppError(
          `File content does not match declared type. Detected: ${result.mime}`,
          HttpStatus.BAD_REQUEST,
          ErrorCode.FILE_TYPE_NOT_ALLOWED,
        ),
      );
      return;
    }

    logger.debug("Magic bytes validation passed", {
      declared: file.mimetype,
      detected: result.mime,
    });
    next();
  } catch (err) {
    // Blocking: treat detection errors as rejections in production
    logger.error("Magic bytes validation error — file rejected", {
      error: (err as Error).message,
      originalName: file.originalname,
    });
    next(
      new AppError(
        "File validation failed. Please try again.",
        HttpStatus.BAD_REQUEST,
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
      ),
    );
  }
}

// ──────────────────────────────────────────────
//  Virus Scanning Middleware (VirusTotal API)
//  Scans file buffer via VirusTotal REST API before storage.
//  Free tier: 500 requests/day, 4 requests/minute.
//  Gracefully degrades if API key is not configured.
// ──────────────────────────────────────────────

const VT_API_BASE = "https://www.virustotal.com/api/v3";

/**
 * Upload a file to VirusTotal for scanning.
 * Returns the analysis ID for polling results.
 */
async function vtUploadFile(buffer: Buffer, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), fileName);

  const response = await fetch(`${VT_API_BASE}/files`, {
    method: "POST",
    headers: { "x-apikey": env.VIRUSTOTAL_API_KEY },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VirusTotal upload failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data: { id: string } };
  return data.data.id;
}

/**
 * Poll VirusTotal for analysis results.
 * Returns { malicious, suspicious, undetected } counts.
 */
async function vtGetAnalysis(analysisId: string): Promise<{
  status: "completed" | "queued" | "in-progress";
  malicious: number;
  suspicious: number;
}> {
  const response = await fetch(`${VT_API_BASE}/analyses/${analysisId}`, {
    headers: { "x-apikey": env.VIRUSTOTAL_API_KEY },
  });

  if (!response.ok) {
    throw new Error(`VirusTotal analysis fetch failed (${response.status})`);
  }

  const data = (await response.json()) as {
    data: {
      attributes: {
        status: "completed" | "queued" | "in-progress";
        stats: { malicious: number; suspicious: number; undetected: number };
      };
    };
  };

  const { status, stats } = data.data.attributes;
  return { status, malicious: stats.malicious, suspicious: stats.suspicious };
}

/**
 * Scan a buffer with VirusTotal. Uploads file, polls for result.
 * Returns { infected, details }.
 */
async function virusTotalScan(
  buffer: Buffer,
  fileName: string,
): Promise<{ infected: boolean; details?: string }> {
  const analysisId = await vtUploadFile(buffer, fileName);

  // Poll for results — VirusTotal typically completes in 15-60 seconds.
  // We poll up to 6 times with 5-second intervals (30s max wait).
  const MAX_POLLS = 6;
  const POLL_INTERVAL = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const result = await vtGetAnalysis(analysisId);

    if (result.status === "completed") {
      if (result.malicious > 0) {
        return {
          infected: true,
          details: `${result.malicious} engine(s) detected malware, ${result.suspicious} suspicious`,
        };
      }
      return { infected: false };
    }
  }

  // Analysis didn't complete in time — treat as inconclusive
  // In production: fail-closed (reject). In dev: allow.
  throw new Error("VirusTotal analysis timed out after 30 seconds");
}

/**
 * Middleware: scan uploaded file for malware via VirusTotal.
 * Run AFTER magic bytes validation. Rejects infected files.
 * If VirusTotal API key is not configured, allows the upload with a debug log.
 */
export async function scanForViruses(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const file = req.file;
  if (!file?.buffer) {
    next();
    return;
  }

  if (!env.hasVirusTotal) {
    logger.debug("VirusTotal not configured — skipping virus scan");
    next();
    return;
  }

  try {
    const result = await virusTotalScan(file.buffer, file.originalname);

    if (result.infected) {
      logger.error("VIRUS DETECTED — upload rejected", {
        details: result.details,
        originalName: file.originalname,
        size: file.size,
        userId: req.user?.id,
      });
      next(
        new AppError(
          "File rejected: malware detected",
          HttpStatus.BAD_REQUEST,
          ErrorCode.FILE_INFECTED,
        ),
      );
      return;
    }

    logger.info("Virus scan passed", { originalName: file.originalname });
    next();
  } catch (err) {
    // In production, reject on scan failure (fail-closed)
    // In development, allow with warning (fail-open)
    if (env.isProd) {
      logger.error("Virus scan failed — rejecting upload (fail-closed)", {
        error: (err as Error).message,
      });
      next(
        new AppError(
          "File scan failed. Please try again later.",
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCode.SERVICE_UNAVAILABLE,
        ),
      );
    } else {
      logger.warn("Virus scan unavailable — allowing upload (dev mode)", {
        error: (err as Error).message,
      });
      next();
    }
  }
}

// ──────────────────────────────────────────────
//  Per-User Upload Rate Limiting
//  Tracks daily upload volume per user in Redis.
//  Default: 100 MB/day per user.
// ──────────────────────────────────────────────

/**
 * Middleware: enforce per-user daily upload quota via Redis.
 */
export async function uploadRateLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    next();
    return;
  }

  const fileSize = req.file?.size ?? 0;
  if (fileSize === 0) {
    next();
    return;
  }

  try {
    const { getRedisClient } = await import("../config/redis.js");
    const redis = getRedisClient();

    // Key: upload_quota:{userId}:{YYYY-MM-DD}
    const today = new Date().toISOString().slice(0, 10);
    const key = `upload_quota:${userId}:${today}`;

    const current = parseInt((await redis.get(key)) ?? "0", 10);
    const maxBytes = env.UPLOAD_DAILY_LIMIT_MB * 1024 * 1024;

    if (current + fileSize > maxBytes) {
      logger.warn("Upload daily quota exceeded", {
        userId,
        current,
        fileSize,
        maxBytes,
      });
      next(
        new AppError(
          `Daily upload limit of ${env.UPLOAD_DAILY_LIMIT_MB} MB exceeded. Try again tomorrow.`,
          HttpStatus.TOO_MANY_REQUESTS,
          ErrorCode.RATE_LIMIT_EXCEEDED,
        ),
      );
      return;
    }

    // Increment and set TTL (expires at end of day)
    await redis.incrby(key, fileSize);
    await redis.expire(key, 86400); // 24h TTL
    next();
  } catch (err) {
    // Redis failure — allow upload but log warning
    logger.warn("Upload rate limit check failed, allowing", { error: (err as Error).message });
    next();
  }
}

// ──────────────────────────────────────────────
//  §24.11 — Image processing (resize, compress, EXIF strip)
//  Uses sharp for production-grade image optimization.
// ──────────────────────────────────────────────

/**
 * Process an image buffer: resize to max dimensions, compress, strip EXIF.
 * Returns the processed buffer.
 */
export async function processImage(
  buffer: Buffer,
  opts: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const maxWidth = opts.maxWidth ?? 800;
  const maxHeight = opts.maxHeight ?? 800;
  const quality = opts.quality ?? 85;

  const processed = await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation then strip EXIF
    .resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  logger.debug("Image processed", {
    originalSize: buffer.length,
    processedSize: processed.length,
    maxWidth,
    maxHeight,
  });

  return processed;
}
