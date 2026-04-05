import "express-async-errors";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response, type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import morgan from "morgan";
import passport from "passport";
import responseTime from "response-time";
import swaggerUi from "swagger-ui-express";
import xssClean from "xss-clean";
import { ZodError } from "zod";
import { createSecurityHeaders } from "./config/csp.js";
import { env } from "./config/env.js";
import { httpRequestDuration, httpRequestsTotal, metricsRouter } from "./config/metrics.js";
import { configurePassport } from "./config/passport.js";
import { serviceStatus } from "./config/service-status.js";
import { createSessionMiddleware } from "./config/session.js";
import { swaggerSpec } from "./config/swagger.js";
import { AppError } from "./exceptions/app-error.js";
import { logger } from "./instrument.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { csrfProtection, csrfTokenSetter } from "./middleware/csrf.js";
import { maintenanceMiddleware } from "./middleware/maintenance.js";
import { presenceMiddleware } from "./middleware/presence.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { wafMiddleware } from "./middleware/waf.js";
import { apiRouter } from "./routes/index.js";
import { createQueueDashboard } from "./routes/queue-dashboard.routes.js";

/**
 * Creates and configures the Express application.
 *
 * Separated from server creation so the app can be imported
 * independently for integration testing without binding to a port.
 */
export function createApp(): express.Application {
  const app = express();

  // Trust proxy (required behind reverse proxy / load balancer for
  // correct req.ip, secure cookies, and rate-limiter)
  app.set("trust proxy", 1);

  // ──────────────────────────────────────────────
  //  WAF — must be first (blocks malicious requests early)
  // ──────────────────────────────────────────────
  app.use(wafMiddleware);

  // ──────────────────────────────────────────────
  //  Security Headers + CSP
  // ──────────────────────────────────────────────
  app.use(createSecurityHeaders());
  app.disable("x-powered-by");
  app.use(hpp());

  // ──────────────────────────────────────────────
  //  CORS
  // ──────────────────────────────────────────────
  const corsOrigin =
    env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
      exposedHeaders: ["X-Response-Time"],
    }),
  );

  // ──────────────────────────────────────────────
  //  §24.3 — Request ID (unique per request)
  // ──────────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ──────────────────────────────────────────────
  //  Body Parsing & Cookies
  // ──────────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // ──────────────────────────────────────────────
  //  XSS Sanitization (strip HTML from req.body/query/params)
  // ──────────────────────────────────────────────
  app.use(xssClean());

  // ──────────────────────────────────────────────
  //  CSRF Protection (double-submit cookie)
  // ──────────────────────────────────────────────
  app.use(csrfTokenSetter);
  app.use(csrfProtection);

  // ──────────────────────────────────────────────
  //  Compression
  // ──────────────────────────────────────────────
  app.use(compression());

  // ──────────────────────────────────────────────
  //  Response Time Header
  // ──────────────────────────────────────────────
  app.use(responseTime());

  // ──────────────────────────────────────────────
  //  Prometheus Metrics Middleware
  // ──────────────────────────────────────────────
  app.use((req: Request, res: Response, next) => {
    const end = httpRequestDuration.startTimer();
    res.on("finish", () => {
      const route = (req.route as { path?: string } | undefined)?.path ?? req.path;
      const labels = { method: req.method, route, status_code: String(res.statusCode) };
      end(labels);
      httpRequestsTotal.inc(labels);
    });
    next();
  });

  // ──────────────────────────────────────────────
  //  Rate Limiting
  // ──────────────────────────────────────────────
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later." },
    }),
  );

  // ──────────────────────────────────────────────
  //  HTTP Request Logging (Morgan → structured logger)
  // ──────────────────────────────────────────────
  const morganStream = {
    write: (message: string): void => {
      logger.info(message.trim());
    },
  };

  app.use(
    morgan(env.isDev ? "dev" : "combined", {
      stream: morganStream,
      skip: (req: Request) =>
        req.url === "/health" || req.url === "/health/live" || req.url === "/health/ready",
    }),
  );

  // ──────────────────────────────────────────────
  //  Session (Redis-backed)
  // ──────────────────────────────────────────────
  if (env.hasSession) {
    app.use(createSessionMiddleware());
  }

  // ──────────────────────────────────────────────
  //  Passport Authentication
  // ──────────────────────────────────────────────
  configurePassport();
  app.use(passport.initialize());
  if (env.hasSession) {
    app.use(passport.session());
  }

  // ──────────────────────────────────────────────
  //  Swagger / OpenAPI Docs
  // ──────────────────────────────────────────────
  if (env.SWAGGER_ENABLED) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get("/api-docs.json", (_req: Request, res: Response) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });
  }

  // ──────────────────────────────────────────────
  //  Health Checks & Metrics
  // ──────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    const status = serviceStatus.toJSON();
    const httpStatus = status.alive ? 200 : 503;

    res.status(httpStatus).json({
      status: status.alive ? "ok" : "degraded",
      ready: status.ready,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      counts: status.counts,
      services: status.services,
    });
  });

  app.get("/health/ready", (_req: Request, res: Response) => {
    const ready = serviceStatus.isReady();
    res.status(ready ? 200 : 503).json({ ready });
  });

  app.get("/health/live", (_req: Request, res: Response) => {
    const alive = serviceStatus.isAlive();
    res.status(alive ? 200 : 503).json({ alive });
  });

  app.use(metricsRouter);

  // ──────────────────────────────────────────────
  //  Maintenance mode check
  // ──────────────────────────────────────────────
  app.use("/api/v1", maintenanceMiddleware);

  // ──────────────────────────────────────────────
  //  Presence tracking middleware
  // ──────────────────────────────────────────────
  app.use("/api/v1", presenceMiddleware);

  // ──────────────────────────────────────────────
  //  Bull Board Queue Dashboard (Admin-only UI)
  // ──────────────────────────────────────────────
  if (env.hasRedis) {
    const dashboardAdapter = createQueueDashboard();
    app.use("/admin/queues", requireAuth, requireAdmin, dashboardAdapter.getRouter());
  }

  // ──────────────────────────────────────────────
  //  API Routes
  // ──────────────────────────────────────────────
  app.use("/api/v1", apiRouter);

  // ──────────────────────────────────────────────
  //  404 Handler
  // ──────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  // ──────────────────────────────────────────────
  //  Global Error Handler
  // ──────────────────────────────────────────────
  const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    // AppError (custom exceptions) → structured response
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        ...(err.details && { details: err.details }),
      });
      if (!err.isOperational) {
        logger.error("Non-operational error", { message: err.message, code: err.code });
      }
      return;
    }

    // Zod validation errors → 400
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Validation Error",
        code: "VALIDATION_ERROR",
        details: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const message = err instanceof Error ? err.message : "Internal Server Error";
    const stack = err instanceof Error ? err.stack : undefined;

    logger.error("Unhandled error", { message, stack });

    res.status(500).json({
      error: env.isProd ? "Internal Server Error" : message,
      code: "INTERNAL_ERROR",
    });
  };
  app.use(errorHandler);

  return app;
}
