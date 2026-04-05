import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env.js";
import { registerService } from "./service-init.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  SMTP / Nodemailer — Service Registration
//
//  The actual transporter singleton is created here
//  and reused by the email worker. Verifies SMTP
//  connectivity during startup.
// ──────────────────────────────────────────────

let transporter: Transporter | undefined;

export function getSmtpTransporter(): Transporter {
  if (!transporter) {
    if (!env.hasSmtp) {
      throw new Error("SMTP is not configured — cannot send email");
    }
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
  return transporter;
}

registerService({
  name: "smtp",
  critical: false,
  isConfigured: () => env.hasSmtp,
  connect: async () => {
    const t = getSmtpTransporter();
    await t.verify();
    logger.info("SMTP connection verified", { host: env.SMTP_HOST, port: env.SMTP_PORT });
  },
  disconnect: () => {
    if (transporter) {
      transporter.close();
      transporter = undefined;
      logger.info("SMTP transporter closed");
    }
  },
});
