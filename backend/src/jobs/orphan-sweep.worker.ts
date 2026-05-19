import { v2 as cloudinary } from "cloudinary";
import { Worker, type Job } from "bullmq";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Orphan Storage Sweep Worker — Spec Section 30.3.4
//
//  Scans Cloudinary `avatars/` for files not referenced by any
//  User.profilePhotoStorageKey and deletes them. Safety net for
//  the cleanup paths in upload.controller — without this, any
//  failed cleanup (network blip, race condition) leaks the file
//  on Cloudinary forever.
//
//  Only sweeps Cloudinary. R2 avatar leaks would need a parallel
//  job; today profile photos go to Cloudinary in every running
//  deployment (R2 is only the fallback when Cloudinary is absent).
// ──────────────────────────────────────────────

const CLOUDINARY_PAGE_SIZE = 500; // Cloudinary max per page
const DELETE_BATCH_SIZE = 100; // Cloudinary delete_resources accepts up to 100 per call

export function startOrphanSweepWorker(): Worker {
  const worker = new Worker(
    "orphan-sweep",
    async (job: Job) => {
      logger.info("Starting orphan sweep", { jobId: job.id });
      await runOrphanSweep(job);
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "orphan-sweep", status: "completed" });
    logger.debug(`Orphan sweep job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "orphan-sweep", status: "failed" });
    logger.error(`Orphan sweep job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("orphan-sweep", err.message),
    );
  });

  getRedisSubscriber();
  logger.info("Orphan sweep worker started");
  return worker;
}

interface CloudinaryListResponse {
  resources: Array<{ public_id: string }>;
  next_cursor?: string;
}

/**
 * §30.3.4 — Compare Cloudinary avatars/ contents to DB references
 * and delete orphans.
 */
async function runOrphanSweep(job: Job): Promise<void> {
  if (!env.hasCloudinary) {
    logger.warn("Cloudinary not configured — orphan sweep skipped");
    return;
  }

  // 1. Collect every public_id under avatars/ on Cloudinary (paginated).
  const cloudinaryKeys = new Set<string>();
  let nextCursor: string | undefined;
  let pages = 0;

  do {
    const opts: Record<string, unknown> = {
      type: "authenticated", // Matches upload type in upload.controller
      prefix: "avatars/",
      resource_type: "image",
      max_results: CLOUDINARY_PAGE_SIZE,
    };
    if (nextCursor) opts["next_cursor"] = nextCursor;

    const result = (await cloudinary.api.resources(opts)) as CloudinaryListResponse;
    for (const r of result.resources) cloudinaryKeys.add(r.public_id);
    nextCursor = result.next_cursor;
    pages++;

    await job.updateProgress(Math.min(50, pages * 5));
  } while (nextCursor);

  logger.info("Cloudinary avatars enumerated", {
    cloudinaryCount: cloudinaryKeys.size,
    pages,
  });

  // 2. Collect every referenced storage key from the database.
  // Include both CLOUDINARY-tagged rows AND legacy rows where the column is
  // NULL (we don't know which backend they're in, so we keep them — better
  // to skip than to delete a referenced file).
  const prisma = getPrisma();
  const dbRows = await prisma.user.findMany({
    where: { profilePhotoStorageKey: { not: null } },
    select: { profilePhotoStorageKey: true },
  });
  const referencedKeys = new Set(
    dbRows.map((r) => r.profilePhotoStorageKey).filter((k): k is string => k !== null),
  );

  await job.updateProgress(60);

  // 3. Orphans = on Cloudinary, not in DB.
  const orphans: string[] = [];
  for (const key of cloudinaryKeys) {
    if (!referencedKeys.has(key)) orphans.push(key);
  }

  if (orphans.length === 0) {
    logger.info("Orphan sweep complete — no orphans found", {
      cloudinaryCount: cloudinaryKeys.size,
      referencedCount: referencedKeys.size,
    });
    return;
  }

  logger.warn("Orphan sweep — orphans detected", {
    orphanCount: orphans.length,
    cloudinaryCount: cloudinaryKeys.size,
    referencedCount: referencedKeys.size,
    sample: orphans.slice(0, 5),
  });

  // 4. Delete in batches (Cloudinary accepts up to 100 public_ids per call).
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += DELETE_BATCH_SIZE) {
    const batch = orphans.slice(i, i + DELETE_BATCH_SIZE);
    try {
      await cloudinary.api.delete_resources(batch, {
        type: "authenticated",
        resource_type: "image",
        invalidate: true,
      });
      deleted += batch.length;
    } catch (err) {
      logger.warn("Orphan delete batch failed", {
        batchStart: i,
        batchSize: batch.length,
        error: (err as Error).message,
      });
    }
    await job.updateProgress(60 + Math.floor((i / orphans.length) * 40));
  }

  await job.updateProgress(100);
  logger.info("Orphan sweep complete", {
    orphansFound: orphans.length,
    orphansDeleted: deleted,
  });
}
