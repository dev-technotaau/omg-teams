import { env } from "./env.js";
import { registerService } from "./service-init.js";
import { serviceStatus, ServiceState } from "./service-status.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  OpenTelemetry Configuration
//
//  Initializes tracing when OTEL_ENABLED=true.
//  Exports traces to OTLP endpoint (Honeycomb,
//  Jaeger, Grafana Tempo, etc.)
//
//  MUST be called before any other imports that
//  should be instrumented (Express, pg, ioredis).
// ──────────────────────────────────────────────

let otelSdk: { shutdown: () => Promise<void> } | undefined;

// Register for service-status tracking (connect is manual — called pre-boot)
registerService({
  name: "opentelemetry",
  critical: false,
  isConfigured: () => env.hasOtel,
  connect: async () => {
    // No-op — actual init happens in initOpenTelemetry() which runs pre-boot
    // State is set to CONNECTED inside that function
  },
  disconnect: async () => {
    if (otelSdk) {
      await otelSdk.shutdown();
      otelSdk = undefined;
      logger.info("OpenTelemetry SDK shut down");
    }
  },
});

export async function initOpenTelemetry(): Promise<void> {
  if (!env.hasOtel) {
    logger.debug("OpenTelemetry disabled");
    return;
  }

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");

  const headers: Record<string, string> = {};
  if (env.HONEYCOMB_API_KEY) {
    headers["x-honeycomb-team"] = env.HONEYCOMB_API_KEY;
  }

  const exporter = new OTLPTraceExporter({
    url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers,
  });

  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  otelSdk = sdk;
  serviceStatus.set("opentelemetry", ServiceState.CONNECTED);
  logger.info("OpenTelemetry initialized", {
    serviceName: env.OTEL_SERVICE_NAME,
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });
}
