import { Worker, type Job } from "bullmq";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient } from "../config/redis.js";
import { logger } from "../instrument.js";
import { executeImport } from "../services/import.service.js";
import { createNotification } from "../services/notification.service.js";
import type { AsyncImportJob } from "./import.queue.js";

// ──────────────────────────────────────────────
//  Async Candidate Import Worker — §23.6
// ──────────────────────────────────────────────

export function startImportWorker(): Worker {
  const worker = new Worker(
    "candidate-import",
    async (job: Job<AsyncImportJob>) => {
      const { rows, options, importingUserId } = job.data;
      logger.info("Async import started", {
        jobId: job.id,
        rowCount: rows.length,
        recruiterId: options.recruiterId,
        fileName: options.fileName,
      });

      const result = await executeImport(rows, options, importingUserId);

      // Notify the admin who triggered the import
      await createNotification({
        userId: importingUserId,
        type: "SYSTEM",
        title: "Import complete",
        message:
          `${options.fileName}: ${result.imported} imported, ` +
          `${result.skipped} skipped, ${result.errors} errors`,
        actionUrl: "/admin/import",
        metadata: {
          fileName: options.fileName,
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
        },
      });

      return result;
    },
    {
      connection: getRedisClient(),
      // Keep concurrency at 1 — imports are write-heavy and we don't
      // want two large jobs fighting for serial numbers / DB locks.
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "candidate-import", status: "completed" });
    logger.info(`Import job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "candidate-import", status: "failed" });
    logger.error(`Import job ${job?.id} failed`, { error: err.message });
    // Best-effort: notify the admin who triggered the job
    if (job?.data?.importingUserId) {
      void createNotification({
        userId: job.data.importingUserId,
        type: "SYSTEM",
        title: "Import failed",
        message: `${job.data.options.fileName}: ${err.message}`,
        actionUrl: "/admin/import",
      }).catch((notifyErr: unknown) => {
        logger.warn("Failed to send import-failure notification", { notifyErr });
      });
    }
  });

  logger.info("Candidate import worker started");
  return worker;
}
