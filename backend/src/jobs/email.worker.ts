import { Worker, type Job } from "bullmq";
import Handlebars from "handlebars";
import { env } from "../config/env.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { getSmtpTransporter } from "../config/smtp.js";
import { logger } from "../instrument.js";
import type { SendEmailJob, SendBulkEmailJob } from "./email.queue.js";

// ──────────────────────────────────────────────
//  Nodemailer Transporter — uses shared singleton
//  from config/smtp.ts (registered as a service)
// ──────────────────────────────────────────────

const getTransporter = getSmtpTransporter;

// ──────────────────────────────────────────────
//  Template Cache (avoid re-querying DB)
//
//  Uses email-template.service.ts which merges
//  DB overrides with file-based defaults from
//  src/templates/email/*.ts
// ──────────────────────────────────────────────

const compiledTemplateCache = new Map<
  string,
  { subject: HandlebarsTemplateDelegate; body: HandlebarsTemplateDelegate }
>();

async function getCompiledTemplate(
  templateKey: string,
): Promise<{ subject: HandlebarsTemplateDelegate; body: HandlebarsTemplateDelegate }> {
  const cached = compiledTemplateCache.get(templateKey);
  if (cached) return cached;

  // Use the service which merges DB customizations with file-based defaults
  const { getTemplate } = await import("../services/email-template.service.js");
  const template = await getTemplate(templateKey);

  if (!template) {
    throw new Error(`Email template not found: ${templateKey}`);
  }

  const compiled = {
    subject: Handlebars.compile(template.subject),
    body: Handlebars.compile(template.bodyHtml),
  };
  compiledTemplateCache.set(templateKey, compiled);
  return compiled;
}

// ──────────────────────────────────────────────
//  Email Worker
// ──────────────────────────────────────────────

export function startEmailWorker(): Worker {
  const worker = new Worker(
    "email",
    async (job: Job<SendEmailJob | SendBulkEmailJob>) => {
      switch (job.name) {
        case "send":
          await processSendEmail(job as Job<SendEmailJob>);
          break;
        case "send-bulk":
          await processSendBulkEmail(job as Job<SendBulkEmailJob>);
          break;
        default:
          logger.warn(`Unknown email job: ${job.name}`);
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 5,
      limiter: { max: 50, duration: 60_000 },
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "email", status: "completed" });
    logger.debug(`Email job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "email", status: "failed" });
    logger.error(`Email job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("email", err.message),
    );
  });

  // Subscribe using the shared subscriber
  getRedisSubscriber();

  logger.info("Email worker started");
  return worker;
}

async function processSendEmail(job: Job<SendEmailJob>): Promise<void> {
  const { to, subject, template, context } = job.data;

  try {
    const compiled = await getCompiledTemplate(template);
    const renderedSubject = subject || compiled.subject(context);
    const renderedBody = compiled.body(context);

    await getTransporter().sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`,
      replyTo: env.EMAIL_REPLY_TO || undefined,
      to,
      subject: renderedSubject,
      html: renderedBody,
    });

    logger.info("Email sent", { to, subject: renderedSubject, template });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to send email", { to, template, error: message });
    throw err; // re-throw so BullMQ retries
  }
}

async function processSendBulkEmail(job: Job<SendBulkEmailJob>): Promise<void> {
  const { recipients, subject, template, context } = job.data;

  const compiled = await getCompiledTemplate(template);
  const renderedSubject = subject || compiled.subject(context);
  const renderedBody = compiled.body(context);

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await getTransporter().sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`,
        replyTo: env.EMAIL_REPLY_TO || undefined,
        to: recipient,
        subject: renderedSubject,
        html: renderedBody,
      });
      sent++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Failed to send bulk email to recipient", {
        recipient,
        template,
        error: message,
      });
    }
  }

  logger.info("Bulk email batch completed", {
    template,
    total: recipients.length,
    sent,
    failed,
  });

  if (failed > 0 && sent === 0) {
    throw new Error(`All ${failed} bulk emails failed for template "${template}"`);
  }
}
