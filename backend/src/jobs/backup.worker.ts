import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Worker, type Job } from "bullmq";
import { env } from "../config/env.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  §24.8 — Database Backup Worker
//
//  Runs pg_dump to create a daily backup, stores locally
//  or uploads to R2/S3. Manages retention (30 days daily).
// ──────────────────────────────────────────────

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const RETENTION_DAYS = 30;

export function startBackupWorker(): Worker {
  const worker = new Worker(
    "database-backup",
    async (job: Job) => {
      logger.info("Starting database backup", { jobId: job.id });
      await runDatabaseBackup(job);
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "database-backup", status: "completed" });
    logger.debug(`Backup job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "database-backup", status: "failed" });
    logger.error(`Backup job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("database-backup", err.message),
    );
  });

  getRedisSubscriber();
  logger.info("Database backup worker started");
  return worker;
}

async function runDatabaseBackup(job: Job): Promise<void> {
  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `omg-teams-backup-${timestamp}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, fileName);

  await job.updateProgress(10);

  // Run pg_dump (pipe through gzip for compression)
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL not configured — cannot create backup");
  }

  try {
    execSync(`pg_dump "${dbUrl}" | gzip > "${filePath}"`, {
      timeout: 300000, // 5 min timeout
      stdio: "pipe",
    });
    logger.info("Database backup created", { filePath, fileName });
  } catch (err) {
    logger.error("pg_dump failed", { error: (err as Error).message });
    throw err;
  }

  await job.updateProgress(60);

  // Upload to R2 if configured
  if (env.hasR2) {
    try {
      const { getR2 } = await import("../config/storage.js");
      const r2 = getR2();
      const fileBuffer = readFileSync(filePath);
      const r2Key = `backups/${fileName}`;

      await r2.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: r2Key,
          Body: fileBuffer,
          ContentType: "application/gzip",
        }),
      );

      logger.info("Backup uploaded to R2", { key: r2Key, size: fileBuffer.length });
    } catch (uploadErr) {
      logger.error("Failed to upload backup to R2 — local copy retained", {
        error: (uploadErr as Error).message,
      });
    }
  } else {
    logger.info("R2 not configured — backup stored locally only", { fileName });
  }

  await job.updateProgress(80);

  // Clean up old backups (retention policy: 30 days)
  cleanupOldBackups();

  await job.updateProgress(100);

  // Notify admins
  try {
    const { onDatabaseBackupComplete } = await import("../services/notification-triggers.js");
    void onDatabaseBackupComplete();
  } catch {
    // non-critical
  }

  logger.info("Database backup job completed", { fileName });
}

/** Remove backup files older than RETENTION_DAYS */
function cleanupOldBackups(): void {
  if (!existsSync(BACKUP_DIR)) return;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = readdirSync(BACKUP_DIR);

  for (const file of files) {
    if (!file.startsWith("omg-teams-backup-")) continue;
    const filePath = path.join(BACKUP_DIR, file);
    try {
      const stat = statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        unlinkSync(filePath);
        logger.info("Removed old backup", { file });
      }
    } catch {
      // skip unreadable files
    }
  }
}
