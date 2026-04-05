import { type Request, type Response, Router } from "express";
import promClient from "prom-client";
import { env } from "./env.js";

// ──────────────────────────────────────────────
//  Prometheus Metrics
// ──────────────────────────────────────────────

// Collect default Node.js metrics (CPU, memory, event loop, GC)
promClient.collectDefaultMetrics({
  prefix: "omg_teams_",
  labels: { app: "backend", env: env.NODE_ENV },
});

// ── Custom metrics ──

export const httpRequestDuration = new promClient.Histogram({
  name: "omg_teams_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestsTotal = new promClient.Counter({
  name: "omg_teams_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
});

export const activeConnections = new promClient.Gauge({
  name: "omg_teams_active_connections",
  help: "Number of active connections",
});

export const jobsProcessed = new promClient.Counter({
  name: "omg_teams_jobs_processed_total",
  help: "Total number of background jobs processed",
  labelNames: ["queue", "status"] as const,
});

// ── Metrics endpoint router ──

export const metricsRouter = Router();

metricsRouter.get("/metrics", async (_req: Request, res: Response) => {
  res.set("Content-Type", promClient.register.contentType);
  const metrics = await promClient.register.metrics();
  res.end(metrics);
});

export { promClient };
