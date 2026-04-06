// Express 5 has built-in async error handling — no need for express-async-errors
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

  // XSS protection handled by WAF middleware (waf.ts) + DOMPurify sanitization (validators/purify.ts)

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
  //  Root & Health Checks & Metrics
  // ──────────────────────────────────────────────

  /** Pretty root landing page */
  app.get("/", (_req: Request, res: Response) => {
    const uptime = process.uptime();
    const hrs = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = Math.floor(uptime % 60);
    const uptimeStr = `${hrs}h ${mins}m ${secs}s`;

    res.send(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>OMG Teams API</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#001845 0%,#023e8a 50%,#0077b6 100%);color:#fff;overflow:hidden}
    .container{text-align:center;padding:2rem;max-width:480px}
    .logo{width:80px;height:80px;margin:0 auto 1.5rem;background:rgba(255,255,255,0.15);border-radius:20px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2)}
    .logo svg{width:40px;height:40px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    h1{font-size:1.75rem;font-weight:700;margin-bottom:.25rem;letter-spacing:-0.02em}
    .subtitle{font-size:.9rem;color:rgba(255,255,255,0.7);margin-bottom:2rem}
    .card{background:rgba(255,255,255,0.1);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem}
    .status-row{display:flex;align-items:center;justify-content:center;gap:.5rem;margin-bottom:1rem}
    .dot{width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,0.6);animation:pulse 2s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    .status-text{font-size:.95rem;font-weight:600}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;text-align:left}
    .meta-item{background:rgba(255,255,255,0.08);border-radius:10px;padding:.75rem}
    .meta-label{font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.5);margin-bottom:.25rem}
    .meta-value{font-size:.85rem;font-weight:600}
    .links{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap}
    .links a{display:inline-flex;align-items:center;gap:.35rem;padding:.5rem 1rem;font-size:.8rem;font-weight:500;color:#fff;text-decoration:none;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:8px;transition:all .2s}
    .links a:hover{background:rgba(255,255,255,0.22);transform:translateY(-1px)}
    .footer{margin-top:2rem;font-size:.7rem;color:rgba(255,255,255,0.4)}
    .orb{position:fixed;border-radius:50%;filter:blur(80px);opacity:.3;pointer-events:none}
    .orb-1{width:400px;height:400px;background:#0077b6;top:-100px;right:-100px}
    .orb-2{width:300px;height:300px;background:#00b4d8;bottom:-80px;left:-80px}
  </style>
</head>
<body>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="container">
    <div class="logo">
      <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    </div>
    <h1>OMG Teams API</h1>
    <p class="subtitle">Recruitment &amp; Workforce Management Platform</p>
    <div class="card">
      <div class="status-row">
        <span class="dot"></span>
        <span class="status-text">All Systems Operational</span>
      </div>
      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">Uptime</div>
          <div class="meta-value">${uptimeStr}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Version</div>
          <div class="meta-value">v1.0.0</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Environment</div>
          <div class="meta-value">${env.isProd ? "Production" : "Development"}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Node</div>
          <div class="meta-value">${process.version}</div>
        </div>
      </div>
    </div>
    <div class="links">
      <a href="/health">Health Check</a>
      ${!env.isProd ? '<a href="/api-docs">API Docs</a>' : ""}
    </div>
    <p class="footer">&copy; ${new Date().getFullYear()} Opportunity Makers Group. All rights reserved.</p>
  </div>
</body>
</html>`);
  });

  /** Health check — pretty HTML when opened in browser, JSON for machines */
  app.get("/health", (req: Request, res: Response) => {
    const status = serviceStatus.toJSON();
    const httpStatus = status.alive ? 200 : 503;
    const accept = req.headers.accept || "";

    // Return JSON for programmatic clients (curl, monitoring, etc.)
    if (accept.includes("application/json") || !accept.includes("text/html")) {
      res.status(httpStatus).json({
        status: status.alive ? "ok" : "degraded",
        ready: status.ready,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        counts: status.counts,
        services: status.services,
      });
      return;
    }

    // Pretty HTML page for browsers
    const uptime = process.uptime();
    const hrs = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = Math.floor(uptime % 60);
    const uptimeStr = `${hrs}h ${mins}m ${secs}s`;
    const svcEntries = Object.entries(status.services) as [string, { status: string; message?: string }][];

    const svcRows = svcEntries
      .map(([name, svc]) => {
        const isOk = svc.status === "connected" || svc.status === "ready" || svc.status === "ok";
        const color = isOk ? "#22c55e" : svc.status === "degraded" ? "#f59e0b" : "#ef4444";
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        return `<div class="svc-row"><span class="svc-dot" style="background:${color};box-shadow:0 0 6px ${color}80"></span><span class="svc-name">${label}</span><span class="svc-status" style="color:${color}">${svc.status}</span></div>`;
      })
      .join("");

    res.status(httpStatus).send(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>OMG Teams — Health</title>
  <meta http-equiv="refresh" content="10"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#001845 0%,#023e8a 50%,#0077b6 100%);color:#fff;overflow:hidden}
    .container{text-align:center;padding:2rem;max-width:520px;width:100%}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:.25rem;letter-spacing:-0.02em}
    .subtitle{font-size:.85rem;color:rgba(255,255,255,0.6);margin-bottom:1.5rem}
    .main-status{display:flex;align-items:center;justify-content:center;gap:.6rem;margin-bottom:1.5rem}
    .big-dot{width:14px;height:14px;border-radius:50%;background:${status.alive ? "#22c55e" : "#ef4444"};box-shadow:0 0 12px ${status.alive ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)"};animation:pulse 2s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    .main-label{font-size:1.1rem;font-weight:600}
    .card{background:rgba(255,255,255,0.1);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:1.25rem;margin-bottom:1rem;text-align:left}
    .card-title{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.5);margin-bottom:.75rem}
    .svc-row{display:flex;align-items:center;gap:.5rem;padding:.4rem 0}
    .svc-row+.svc-row{border-top:1px solid rgba(255,255,255,0.08)}
    .svc-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .svc-name{flex:1;font-size:.85rem;font-weight:500}
    .svc-status{font-size:.75rem;font-weight:600;text-transform:capitalize}
    .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem}
    .meta-item{background:rgba(255,255,255,0.08);border-radius:10px;padding:.6rem .75rem}
    .meta-label{font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.45);margin-bottom:.2rem}
    .meta-value{font-size:.8rem;font-weight:600}
    .back{margin-top:1.25rem}
    .back a{font-size:.8rem;color:rgba(255,255,255,0.5);text-decoration:none;transition:color .2s}
    .back a:hover{color:#fff}
    .refresh-note{margin-top:.5rem;font-size:.65rem;color:rgba(255,255,255,0.3)}
    .orb{position:fixed;border-radius:50%;filter:blur(80px);opacity:.3;pointer-events:none}
    .orb-1{width:400px;height:400px;background:#0077b6;top:-100px;right:-100px}
    .orb-2{width:300px;height:300px;background:#00b4d8;bottom:-80px;left:-80px}
  </style>
</head>
<body>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="container">
    <h1>System Health</h1>
    <p class="subtitle">OMG Teams API</p>
    <div class="main-status">
      <span class="big-dot"></span>
      <span class="main-label">${status.alive ? "All Systems Operational" : "Service Degraded"}</span>
    </div>
    <div class="card">
      <div class="card-title">Services</div>
      ${svcRows || '<div style="font-size:.85rem;color:rgba(255,255,255,0.5)">No services registered</div>'}
    </div>
    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">Uptime</div>
        <div class="meta-value">${uptimeStr}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Ready</div>
        <div class="meta-value">${status.ready ? "Yes" : "No"}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Services</div>
        <div class="meta-value">${status.counts.healthy}/${status.counts.total}</div>
      </div>
    </div>
    <div class="back"><a href="/">&larr; Back to API</a></div>
    <p class="refresh-note">Auto-refreshes every 10 seconds</p>
  </div>
</body>
</html>`);
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
