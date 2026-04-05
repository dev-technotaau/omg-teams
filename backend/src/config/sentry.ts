import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { logger } from "../instrument.js";
import { registerService } from "./service-init.js";

// ──────────────────────────────────────────────
//  Sentry Error Tracking
// ──────────────────────────────────────────────

registerService({
  name: "sentry",
  critical: false,
  isConfigured: () => env.hasSentry,

  // eslint-disable-next-line @typescript-eslint/require-await
  async connect() {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      release:
        env.SENTRY_RELEASE || `omg-teams-backend@${process.env["npm_package_version"] ?? "0.0.0"}`,
      tracesSampleRate: env.isProd ? 0.2 : 1.0,
      profilesSampleRate: env.isProd ? 0.1 : 0,
      integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
      beforeSend(event) {
        // Strip sensitive data
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
        return event;
      },
    });

    logger.info("Sentry initialized", { environment: env.NODE_ENV });
  },

  async disconnect() {
    await Sentry.close(2000);
  },
});

export { Sentry };
