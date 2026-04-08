/**
 * Application Entry Point
 *
 * Import order matters:
 *  1. source-map-support — readable stack traces in compiled JS
 *  2. env / instrument   — config + logging before anything else
 *  3. service configs    — register all services (postgres, redis, r2, cloudinary, sentry, firebase, otel, bullmq, smtp, virustotal, socketio, vapid)
 *  4. app / server       — application bootstrap
 */
/* eslint-disable import-x/order -- Entry point: import order is load-order sensitive */
import "source-map-support/register";
import { env, validateEnv } from "./config/env.js";
import { logger } from "./instrument.js";
import "./config/database.js";
import "./config/redis.js";
import "./config/storage.js";
import "./config/sentry.js";
import "./config/firebase.js";
import { initOpenTelemetry } from "./config/otel.js";
import "./config/queue.js";
import "./config/smtp.js";
import "./config/virustotal.js";
import "./socket.js";
import "./services/push.service.js";
import { createApp } from "./app.js";
import { createServer } from "./server.js";
import { initializeServices, shutdownServices } from "./config/service-init.js";
import { startAllWorkers, stopAllWorkers } from "./jobs/index.js";
/* eslint-enable import-x/order */

// ──────────────────────────────────────────────
//  Process-Level Error Handlers
// ──────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — shutting down", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection — shutting down", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});

// ──────────────────────────────────────────────
//  Bootstrap
// ──────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  // Validate env early so typos surface immediately
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    for (const err of envErrors) {
      logger.error(`Env validation: ${err}`);
    }
    throw new Error("Environment validation failed — see errors above");
  }

  await initOpenTelemetry();
  await initializeServices();

  // Ensure every PlatformSetting key the admin UI shows has a row in DB.
  // Idempotent — only inserts missing keys, never overwrites existing values.
  const { ensureDefaultsOnBoot } = await import("./services/settings.service.js");
  await ensureDefaultsOnBoot();

  await startAllWorkers();

  const app = createApp();

  const shutdown = async (): Promise<void> => {
    await stopAllWorkers();
    await shutdownServices();
  };

  createServer(app, { port: env.PORT, host: env.HOST, onShutdown: shutdown });
}

bootstrap().catch((err: unknown) => {
  logger.error("Bootstrap failed", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
