import { Worker, type Job } from "bullmq";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";
import { runArchiving } from "../services/archive.service.js";
import { autoPurgeTrash } from "../services/trash.service.js";

// ──────────────────────────────────────────────
//  Archive Worker — Spec Section 23.5
//
//  Processes monthly archiving of aged records.
// ──────────────────────────────────────────────

export function startArchiveWorker(): Worker {
  const worker = new Worker(
    "archive",
    async (job: Job) => {
      // §29.7.2 — KYC reminder for employees with incomplete documents
      if (job.name === "kyc-reminder") {
        logger.info("Running KYC reminder job");
        try {
          const { getPrisma } = await import("../config/database.js");
          const prisma = getPrisma();
          const { createNotification } = await import("../services/notification.service.js");
          const { getKycStatus } = await import("../services/document.service.js");

          // Find all active non-admin employees
          const employees = await prisma.user.findMany({
            where: { status: "ACTIVE", role: { not: "ADMIN" }, deletedAt: null },
            select: { id: true, firstName: true, lastName: true },
          });

          let remindersSent = 0;
          for (const emp of employees) {
            const kyc = await getKycStatus(emp.id);
            if (kyc.status !== "Complete" && kyc.status !== "N/A") {
              await createNotification({
                userId: emp.id,
                type: "DOCUMENT",
                title: "KYC Reminder",
                message: `You have ${kyc.required - kyc.verified} document(s) pending. Please upload all required documents to complete your KYC.`,
                actionUrl: "/documents",
              });
              remindersSent++;
            }
          }
          logger.info("KYC reminders sent", { remindersSent });

          // §29.9 — Check for documents expiring within 30 days
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          const expiringDocs = await prisma.employeeDocument.findMany({
            where: {
              expiryDate: { not: null, lte: thirtyDaysFromNow },
              status: "VERIFIED",
            },
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
              documentType: { select: { name: true } },
            },
          });
          for (const doc of expiringDocs) {
            const daysUntil = Math.ceil(
              (doc.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            const msg =
              daysUntil <= 0
                ? `Your ${doc.documentType.name} has expired. Please re-upload an updated document.`
                : `Your ${doc.documentType.name} expires in ${daysUntil} day(s). Please upload an updated document before expiry.`;
            await createNotification({
              userId: doc.user.id,
              type: "DOCUMENT",
              title: daysUntil <= 0 ? "Document Expired" : "Document Expiring Soon",
              message: msg,
              actionUrl: "/documents",
            });
          }
          if (expiringDocs.length > 0) {
            logger.info("Document expiry reminders sent", { count: expiringDocs.length });
          }
        } catch (err) {
          logger.error("KYC reminder job failed", { error: (err as Error).message });
        }
        return;
      }

      // §27.12 — Monthly attendance summary notification
      if (job.name === "attendance-summary") {
        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthName = prevMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        logger.info("Generating monthly attendance summary notification", { month: monthName });
        try {
          const { getPrisma } = await import("../config/database.js");
          const prisma = getPrisma();
          // Notify all admins
          const admins = await prisma.user.findMany({
            where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
            select: { id: true },
          });
          const { createNotification } = await import("../services/notification.service.js");
          for (const admin of admins) {
            await createNotification({
              userId: admin.id,
              type: "SYSTEM",
              title: "Monthly Attendance Summary Ready",
              message: `The attendance summary for ${monthName} is ready for review. Check the Attendance page or generate a Monthly Attendance Report.`,
              actionUrl: "/admin/attendance",
            });
          }
          logger.info("Monthly attendance summary notifications sent", {
            adminCount: admins.length,
          });
        } catch (err) {
          logger.error("Failed to send monthly attendance summary", {
            error: (err as Error).message,
          });
        }
        return;
      }

      // §23.7 — Handle trash auto-purge jobs
      if (job.name === "trash-purge") {
        logger.info("Starting weekly trash purge job", { jobId: job.id });
        const { getSettingNumber } = await import("../services/settings.service.js");
        const purgeDays = await getSettingNumber("trash_auto_purge_days", 90);
        const purgeResult = await autoPurgeTrash(purgeDays);
        logger.info("Trash purge completed", { jobId: job.id, ...purgeResult });
        // §23.7 — Notify admins of purge results
        if (purgeResult.purged > 0) {
          try {
            const { onStorageCleanupComplete } =
              await import("../services/notification-triggers.js");
            void onStorageCleanupComplete(purgeResult.purged);
          } catch {
            // non-critical
          }
        }
        return;
      }

      logger.info("Starting monthly archiving job", { jobId: job.id });
      const result = await runArchiving();
      logger.info("Archiving job completed", { jobId: job.id, ...result });

      // Notify admins
      try {
        const { onScheduledReportSent } = await import("../services/notification-triggers.js");
        const total = Object.values(result.archived).reduce((sum, n) => sum + n, 0);
        if (total > 0) {
          void onScheduledReportSent(`Data Archiving (${total} records)`, 0);
        }
      } catch {
        // non-critical
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "archive", status: "completed" });
    logger.debug(`Archive job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "archive", status: "failed" });
    logger.error(`Archive job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("archive", err.message),
    );
  });

  getRedisSubscriber();
  logger.info("Archive worker started");
  return worker;
}
