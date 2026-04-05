/**
 * Standalone worker entry point for production Docker.
 * Starts all BullMQ workers WITHOUT the HTTP server.
 *
 * Usage: node -r source-map-support/register dist/worker-entry.js
 */

import "source-map-support/register.js";
import "./config/env.js";

// Initialize services that workers depend on
import "./config/redis.js";
import "./config/smtp.js";

import { initializeServices } from "./config/service-init.js";
import { logger } from "./instrument.js";
import { startAllWorkers, stopAllWorkers } from "./jobs/index.js";

async function main() {
  logger.info("Starting OMG Teams worker process...");

  await initializeServices();
  await startAllWorkers();

  logger.info("Worker process ready — listening for jobs");
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down workers...`);
  await stopAllWorkers();
  logger.info("Workers stopped. Exiting.");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception in worker: ${err.message}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection in worker: ${String(reason)}`);
  process.exit(1);
});

void main();
