import crypto from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Worker, type Job } from "bullmq";
import { enqueueEmail } from "./email.queue.js";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { getR2 } from "../config/storage.js";
import { logger } from "../instrument.js";
import {
  generateReport,
  cleanupExpiredReports,
  type ReportFilters,
} from "../services/report.service.js";
import { resolveScheduleConfig } from "../services/report-template.service.js";
import type { ScheduledReportJob } from "./scheduled-report.queue.js";

// ──────────────────────────────────────────────
//  Scheduled Report Worker
//
//  1. Load ScheduledReportConfig by ID
//  2. Generate XLSX report with ExcelJS
//  3. Create GeneratedReport record
//  4. Email to all active recipients
//  5. Create ReportDeliveryLog entries
// ──────────────────────────────────────────────

export function startScheduledReportWorker(): Worker {
  const worker = new Worker(
    "scheduled-report",
    async (job: Job<ScheduledReportJob>) => {
      // §20.2/20.4 — Handle cleanup jobs for expired report files
      if (job.name === "cleanup") {
        const count = await cleanupExpiredReports();
        logger.info("Report cleanup completed", { expiredCount: count });
        return;
      }
      await processScheduledReport(job);
    },
    {
      connection: getRedisClient(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "scheduled-report", status: "completed" });
    logger.debug(`Scheduled report job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "scheduled-report", status: "failed" });
    logger.error(`Scheduled report job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("scheduled-report", err.message),
    );

    // Notify admins of failure
    if (job?.data?.configId) {
      import("../services/notification-triggers.js")
        .then(({ onScheduledReportFailed }) => {
          void onScheduledReportFailed(job.data.configId, err.message);
        })
        .catch(() => {
          /* non-critical */
        });
    }
  });

  getRedisSubscriber();

  logger.info("Scheduled report worker started");
  return worker;
}

async function processScheduledReport(job: Job<ScheduledReportJob>): Promise<void> {
  const prisma = getPrisma();
  const { configId } = job.data;

  // ── 1. Load config with recipients ──
  const config = await prisma.scheduledReportConfig.findUnique({
    where: { id: configId },
    include: { recipients: { where: { removedAt: null } } },
  });

  if (!config) {
    logger.warn("Scheduled report config not found, skipping", { configId });
    return;
  }

  if (!config.isActive) {
    logger.info("Scheduled report config is inactive, skipping", { configId });
    return;
  }

  const activeRecipients = config.recipients;
  if (activeRecipients.length === 0) {
    logger.warn("Scheduled report has no active recipients, skipping", { configId });
    return;
  }

  await job.updateProgress(10);

  // ── 2. Generate XLSX report using shared service ──
  // Resolve columns + filters with template precedence (template-linked
  // schedules pick up template edits without touching the schedule row).
  const resolved = await resolveScheduleConfig(configId);
  const filters = resolved.filters as ReportFilters;
  const { buffer, fileName, columnKeys } = await generateReport(
    config.reportType,
    filters,
    resolved.columnKeys,
  );
  const fileSize = buffer.byteLength;

  await job.updateProgress(60);

  // ── 3. Upload to R2 cloud storage (if configured) ──
  let cloudUrl: string | null = null;
  let cloudStorageKey: string | null = null;
  let storageBackend: "R2" | null = null;

  if (env.hasR2) {
    try {
      const r2 = getR2();
      cloudStorageKey = `reports/${config.reportType}/${crypto.randomUUID()}_${fileName}`;
      await r2.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: cloudStorageKey,
          Body: buffer,
          ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      // Generate signed URL — never expose raw R2 URLs
      const { getSignedR2Url } = await import("../utils/signed-url.js");
      cloudUrl = await getSignedR2Url(
        cloudStorageKey,
        undefined,
        `attachment; filename="${fileName}"`,
      );
      storageBackend = "R2";

      logger.info("Report uploaded to R2", { cloudStorageKey });
    } catch (err) {
      logger.error("Failed to upload report to R2", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── 4. Create GeneratedReport record ──
  const { getSettingNumber } = await import("../services/settings.service.js");
  const retentionDays = await getSettingNumber("report_retention_days", 30);
  const generatedReport = await prisma.generatedReport.create({
    data: {
      reportType: config.reportType,
      reportName: `${config.reportName} - ${new Date().toISOString().slice(0, 10)}`,
      source: "SCHEDULED",
      ...(config.filters !== null && { filters: config.filters }),
      columnConfig: columnKeys,
      fileSize,
      cloudUrl,
      cloudStorageKey,
      storageBackend,
      expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
    },
  });

  await job.updateProgress(70);

  // ── 5. Email to all active recipients ──
  for (const recipient of activeRecipients) {
    let logId: string | undefined;
    try {
      const log = await prisma.reportDeliveryLog.create({
        data: {
          generatedReportId: generatedReport.id,
          scheduledReportConfigId: config.id,
          recipientEmail: recipient.email,
          deliveryStatus: "PENDING",
        },
      });
      logId = log.id;

      await enqueueEmail({
        to: recipient.email,
        subject: `Scheduled Report: ${config.reportName}`,
        template: "scheduled-report-delivery",
        context: {
          reportName: config.reportName,
          reportType: config.reportType,
          generatedAt: new Date().toISOString(),
          recipientEmail: recipient.email,
          downloadLink: cloudUrl ?? "",
        },
      });

      // ── 6. Update delivery log to SUCCESS ──
      await prisma.reportDeliveryLog.update({
        where: { id: logId },
        data: { deliveryStatus: "SUCCESS", sentAt: new Date() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Failed to enqueue report email", {
        configId,
        recipient: recipient.email,
        error: message,
      });

      if (logId) {
        await prisma.reportDeliveryLog.update({
          where: { id: logId },
          data: { deliveryStatus: "FAILED", failureReason: message },
        });
      } else {
        await prisma.reportDeliveryLog.create({
          data: {
            generatedReportId: generatedReport.id,
            scheduledReportConfigId: config.id,
            recipientEmail: recipient.email,
            deliveryStatus: "FAILED",
            failureReason: message,
          },
        });
      }
    }
  }

  await job.updateProgress(100);

  // Notify admins of successful scheduled report
  try {
    const { onScheduledReportSent } = await import("../services/notification-triggers.js");
    void onScheduledReportSent(config.reportName, activeRecipients.length);
  } catch {
    // non-critical
  }

  logger.info("Scheduled report generated and dispatched", {
    configId,
    reportName: config.reportName,
    reportId: generatedReport.id,
    recipientCount: activeRecipients.length,
    hasCloudUrl: !!cloudUrl,
  });
}
