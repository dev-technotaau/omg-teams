import { env } from "../config/env.js";
import { closeAllQueues } from "../config/queue.js";
import { logger } from "../instrument.js";
import type { Worker } from "bullmq";

// ──────────────────────────────────────────────
//  Job System Bootstrap
//
//  Starts all workers when Redis is available.
//  Each queue has its own .queue.ts (producer)
//  and .worker.ts (consumer) file.
// ──────────────────────────────────────────────

const activeWorkers: Worker[] = [];

export async function startAllWorkers(): Promise<void> {
  if (!env.hasRedis) {
    logger.warn("Redis not configured — job workers disabled");
    return;
  }

  const { startEmailWorker } = await import("./email.worker.js");
  const { startStorageWorker } = await import("./storage.worker.js");
  const { startNotificationWorker } = await import("./notification.worker.js");
  const { startMidnightResetWorker } = await import("./midnight-reset.worker.js");
  const { startScheduledReportWorker } = await import("./scheduled-report.worker.js");
  const { startArchiveWorker } = await import("./archive.worker.js");
  const { startAbsentDetectionWorker } = await import("./absent-detection.worker.js");
  const { startSessionExpiryWorker } = await import("./session-expiry.worker.js");
  const { startBackupWorker } = await import("./backup.worker.js");
  const { startTorListWorker } = await import("./tor-list.worker.js");
  const { startImportWorker } = await import("./import.worker.js");
  const { startOrphanSweepWorker } = await import("./orphan-sweep.worker.js");

  activeWorkers.push(startEmailWorker());
  activeWorkers.push(startStorageWorker());
  activeWorkers.push(startNotificationWorker());
  activeWorkers.push(startMidnightResetWorker());
  activeWorkers.push(startScheduledReportWorker());
  activeWorkers.push(startArchiveWorker());
  activeWorkers.push(startAbsentDetectionWorker());
  activeWorkers.push(startSessionExpiryWorker());
  activeWorkers.push(startBackupWorker());
  activeWorkers.push(startTorListWorker());
  activeWorkers.push(startImportWorker());
  activeWorkers.push(startOrphanSweepWorker());

  // Schedule repeatable jobs
  const { scheduleMidnightReset } = await import("./midnight-reset.queue.js");
  const { scheduleReportGeneration, scheduleReportCleanup } =
    await import("./scheduled-report.queue.js");
  const {
    scheduleArchiving,
    scheduleTrashPurge,
    scheduleMonthlyAttendanceSummary,
    scheduleKycReminder,
  } = await import("./archive.queue.js");
  const { scheduleAbsentDetection } = await import("./absent-detection.queue.js");
  const { scheduleSessionExpiryChecker } = await import("./session-expiry.queue.js");
  const { scheduleNotificationCleanup } = await import("./notification.queue.js");
  const { scheduleDatabaseBackup } = await import("./backup.queue.js");
  const { scheduleTorListRefresh, torListQueue } = await import("./tor-list.queue.js");
  const { scheduleOrphanSweep } = await import("./orphan-sweep.queue.js");

  await scheduleMidnightReset();
  await scheduleReportGeneration();
  await scheduleArchiving();
  await scheduleTrashPurge();
  await scheduleMonthlyAttendanceSummary();
  await scheduleKycReminder();
  await scheduleAbsentDetection();
  await scheduleSessionExpiryChecker();
  await scheduleNotificationCleanup();
  await scheduleReportCleanup();
  await scheduleDatabaseBackup();
  await scheduleTorListRefresh();
  await scheduleOrphanSweep();
  // §16 — kick off an immediate refresh on boot so the TOR set is populated
  // even before the first cron tick. Otherwise the IP-reputation check is
  // a no-op for the first 2h after a deploy.
  await torListQueue.add("refresh-tor-exit-list", {}, { removeOnComplete: true });

  logger.info(`Started ${activeWorkers.length} job workers`);
}

export async function stopAllWorkers(): Promise<void> {
  await Promise.all(activeWorkers.map((w) => w.close()));
  activeWorkers.length = 0;
  await closeAllQueues();
  logger.info("All workers and queues stopped");
}
