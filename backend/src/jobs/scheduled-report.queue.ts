import { getPrisma } from "../config/database.js";
import { createQueue } from "../config/queue.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Scheduled Report Queue
//
//  Generates and emails XLSX reports based on
//  ScheduledReportConfig definitions.
// ──────────────────────────────────────────────

export const scheduledReportQueue = createQueue("scheduled-report");

export interface ScheduledReportJob {
  configId: string;
}

/**
 * Build a cron expression from a ScheduledReportConfig's frequency + timing.
 */
function buildCron(
  frequency: string,
  timing: { hour?: number; minute?: number; dayOfMonth?: number } | null,
): string {
  const hour = timing?.hour ?? 8;
  const minute = timing?.minute ?? 0;

  switch (frequency) {
    case "DAILY":
      return `${minute} ${hour} * * *`;
    case "MONTHLY":
      return `${minute} ${hour} ${timing?.dayOfMonth ?? 1} * *`;
    case "YEARLY":
      // Yearly: run on Jan 1st at the configured time
      return `${minute} ${hour} 1 1 *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

/**
 * Sync all active ScheduledReportConfig entries as repeatable BullMQ jobs.
 * Safe to call on every startup — BullMQ deduplicates by scheduler ID.
 */
export async function scheduleReportGeneration(): Promise<void> {
  const prisma = getPrisma();

  const configs = await prisma.scheduledReportConfig.findMany({
    where: { isActive: true },
  });

  for (const config of configs) {
    const timing = config.timing as {
      hour?: number;
      minute?: number;
      dayOfMonth?: number;
    } | null;
    const cron = buildCron(config.frequency, timing);
    const schedulerId = `report-${config.id}`;

    await scheduledReportQueue.upsertJobScheduler(
      schedulerId,
      { pattern: cron },
      {
        name: "generate",
        data: { configId: config.id } satisfies ScheduledReportJob,
        opts: {
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 200 },
        },
      },
    );

    logger.debug("Scheduled report job registered", {
      configId: config.id,
      reportName: config.reportName,
      cron,
    });
  }

  logger.info(`Scheduled report generation: ${configs.length} active config(s) registered`);
}

/**
 * §20.2/20.4 — Schedule auto-cleanup of expired report files (daily at 4 AM).
 * Marks expired GeneratedReport records and deletes cloud files.
 */
export async function scheduleReportCleanup(): Promise<void> {
  await scheduledReportQueue.upsertJobScheduler(
    "report-cleanup",
    { pattern: "0 4 * * *" }, // Daily at 4 AM
    {
      name: "cleanup",
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    },
  );
}
