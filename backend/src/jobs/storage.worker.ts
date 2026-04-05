import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Worker, type Job } from "bullmq";
import sharp from "sharp";
import { env } from "../config/env.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { getR2 } from "../config/storage.js";
import { logger } from "../instrument.js";
import type { ImageProcessJob, FileCleanupJob, CloudinaryUploadJob } from "./storage.queue.js";

// ──────────────────────────────────────────────
//  Storage Worker
// ──────────────────────────────────────────────

export function startStorageWorker(): Worker {
  const worker = new Worker(
    "storage",
    async (job: Job<ImageProcessJob | FileCleanupJob | CloudinaryUploadJob>) => {
      switch (job.name) {
        case "image-process":
          await processImage(job as Job<ImageProcessJob>);
          break;
        case "file-cleanup":
          await processCleanup(job as Job<FileCleanupJob>);
          break;
        case "cloudinary-upload":
          await processCloudinaryUpload(job as Job<CloudinaryUploadJob>);
          break;
        default:
          logger.warn(`Unknown storage job: ${job.name}`);
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 3,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "storage", status: "completed" });
    logger.debug(`Storage job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "storage", status: "failed" });
    logger.error(`Storage job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("storage", err.message),
    );
  });

  getRedisSubscriber();

  logger.info("Storage worker started");
  return worker;
}

/** Download from R2, process with sharp (resize/format), re-upload */
async function processImage(job: Job<ImageProcessJob>): Promise<void> {
  const { fileKey, bucket, transforms } = job.data;

  if (!env.hasR2) {
    logger.warn("R2 not configured — skipping image processing", { fileKey });
    return;
  }

  const r2 = getR2();
  const targetBucket = bucket || env.R2_BUCKET;

  // Download original
  const getCmd = new GetObjectCommand({ Bucket: targetBucket, Key: fileKey });
  const response = await r2.send(getCmd);
  const body = await response.Body?.transformToByteArray();
  if (!body) {
    throw new Error(`Empty body for key: ${fileKey}`);
  }

  await job.updateProgress(30);

  // Process with sharp
  let pipeline = sharp(Buffer.from(body));
  if (transforms.width || transforms.height) {
    pipeline = pipeline.resize(transforms.width, transforms.height, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  if (transforms.format === "webp") {
    pipeline = pipeline.webp({ quality: 80 });
  } else if (transforms.format === "jpeg" || transforms.format === "jpg") {
    pipeline = pipeline.jpeg({ quality: 85 });
  } else if (transforms.format === "png") {
    pipeline = pipeline.png({ compressionLevel: 8 });
  }

  const processed = await pipeline.toBuffer();

  await job.updateProgress(70);

  // Re-upload processed image (same key, overwrite)
  const contentType =
    transforms.format === "webp"
      ? "image/webp"
      : transforms.format === "png"
        ? "image/png"
        : "image/jpeg";

  const putCmd = new PutObjectCommand({
    Bucket: targetBucket,
    Key: fileKey,
    Body: processed,
    ContentType: contentType,
  });
  await r2.send(putCmd);

  await job.updateProgress(100);
  logger.info("Image processed and re-uploaded", { fileKey, size: processed.length });
}

/** Delete keys from R2 */
async function processCleanup(job: Job<FileCleanupJob>): Promise<void> {
  const { keys, bucket } = job.data;

  if (!env.hasR2) {
    logger.warn("R2 not configured — skipping file cleanup", { count: keys.length });
    return;
  }

  const r2 = getR2();
  const targetBucket = bucket || env.R2_BUCKET;
  let deleted = 0;

  for (const key of keys) {
    try {
      const cmd = new DeleteObjectCommand({ Bucket: targetBucket, Key: key });
      await r2.send(cmd);
      deleted++;
    } catch (err) {
      logger.error("Failed to delete R2 object", { key, error: (err as Error).message });
    }
  }

  await job.updateProgress(100);
  logger.info("File cleanup completed", { requested: keys.length, deleted, bucket: targetBucket });
}

/** Upload to Cloudinary via SDK */
async function processCloudinaryUpload(job: Job<CloudinaryUploadJob>): Promise<void> {
  const { localPath, folder, resourceType } = job.data;

  if (!env.hasCloudinary) {
    logger.warn("Cloudinary not configured — skipping upload", { localPath });
    return;
  }

  const { cloudinary } = await import("../config/storage.js");

  const result = await cloudinary.uploader.upload(localPath, {
    folder,
    resource_type: resourceType,
    type: "authenticated", // Require signed URLs for access
  });

  await job.updateProgress(100);
  logger.info("Cloudinary upload completed", {
    publicId: result.public_id,
    url: result.secure_url,
  });
}
