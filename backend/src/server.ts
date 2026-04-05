import http from "node:http";
import { env } from "./config/env.js";
import { activeConnections } from "./config/metrics.js";
import { logger } from "./instrument.js";
import { initializeSocket } from "./socket.js";
import type express from "express";

export interface ServerOptions {
  port: number;
  host: string;
  /** Called during graceful shutdown before the server closes (e.g. disconnect services). */
  onShutdown?: (() => Promise<void>) | undefined;
}

/**
 * Creates an HTTP server from the Express app and manages its lifecycle.
 */
export function createServer(app: express.Application, options: ServerOptions): http.Server {
  const server = http.createServer(app);

  // ──────────────────────────────────────────────
  //  Socket.IO
  // ──────────────────────────────────────────────
  initializeSocket(server);

  // ──────────────────────────────────────────────
  //  Connection tracking (Prometheus gauge)
  // ──────────────────────────────────────────────
  server.on("connection", () => activeConnections.inc());
  server.on("close", () => activeConnections.dec());

  // ──────────────────────────────────────────────
  //  Graceful Shutdown
  // ──────────────────────────────────────────────
  const SHUTDOWN_TIMEOUT_MS = 10_000;

  function shutdown(signal: string): void {
    logger.info(`${signal} received — starting graceful shutdown`);

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        logger.error("Error during server close", { error: err.message });
        process.exit(1);
      }

      const teardown = options.onShutdown ? options.onShutdown() : Promise.resolve();

      teardown
        .then(() => {
          logger.info("All connections drained — exiting");
          process.exit(0);
        })
        .catch((shutdownErr: unknown) => {
          const msg = shutdownErr instanceof Error ? shutdownErr.message : String(shutdownErr);
          logger.error("Error during service shutdown", { error: msg });
          process.exit(1);
        });
    });

    // Force exit if draining takes too long
    setTimeout(() => {
      logger.warn("Shutdown timeout exceeded — forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ──────────────────────────────────────────────
  //  Start Listening
  // ──────────────────────────────────────────────
  server.listen(options.port, options.host, () => {
    logger.info(`Server listening on ${options.host}:${options.port}`, {
      port: options.port,
      host: options.host,
      nodeEnv: env.NODE_ENV,
      pid: process.pid,
    });
  });

  return server;
}
