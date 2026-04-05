import { logger } from "../instrument.js";
import { serviceStatus, ServiceState } from "./service-status.js";

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

export interface ServiceDefinition {
  /** Unique name used in logs and status registry. */
  name: string;

  /** Connect / warm-up the service. Throw on failure. */
  connect: () => Promise<void> | void;

  /** Tear down the service gracefully. */
  disconnect: () => Promise<void> | void;

  /**
   * If true, the app will abort startup when this service fails.
   * Non-critical services log the error and continue.
   * @default true
   */
  critical?: boolean | undefined;

  /**
   * Set to false to explicitly disable this service.
   * Disabled services are skipped during init and marked DISABLED.
   * @default true
   */
  enabled?: boolean | undefined;

  /**
   * Optional check that runs before connect().
   * Return false if the service lacks required config (e.g. missing env vars).
   * The service will be marked NOT_CONFIGURED and skipped.
   */
  isConfigured?: (() => boolean) | undefined;

  /**
   * Names of services that must be connected before this one starts.
   * Ensures correct initialization order (e.g. cache after database).
   */
  dependsOn?: string[] | undefined;

  /**
   * Per-service timeout for disconnect() during shutdown.
   * @default 5000
   */
  disconnectTimeoutMs?: number | undefined;
}

// ──────────────────────────────────────────────
//  Internal State
// ──────────────────────────────────────────────

const registry: ServiceDefinition[] = [];
const initialized: string[] = [];

// ──────────────────────────────────────────────
//  Registration
// ──────────────────────────────────────────────

/**
 * Register a service to be initialized during bootstrap.
 *
 * @example
 * ```ts
 * registerService({
 *   name: "postgres",
 *   connect: async () => { await prisma.$connect(); },
 *   disconnect: async () => { await prisma.$disconnect(); },
 *   isConfigured: () => !!process.env["DATABASE_URL"],
 * });
 *
 * registerService({
 *   name: "email",
 *   connect: async () => { await mailer.verify(); },
 *   disconnect: async () => { mailer.close(); },
 *   critical: false,
 *   enabled: process.env["ENABLE_EMAIL"] === "true",
 * });
 * ```
 */
export function registerService(definition: ServiceDefinition): void {
  const critical = definition.critical ?? true;
  registry.push({ ...definition, critical });
  serviceStatus.register(definition.name, critical);
}

// ──────────────────────────────────────────────
//  Initialization
// ──────────────────────────────────────────────

/**
 * Boot all registered services in dependency order.
 *
 * Flow per service:
 *   1. enabled === false  → DISABLED, skip
 *   2. isConfigured?.() === false → NOT_CONFIGURED, skip (fail if critical)
 *   3. connect() → CONNECTED or FAILED / DEGRADED
 *
 * Prints a status report table when done.
 */
export async function initializeServices(): Promise<void> {
  const sorted = topologicalSort(registry);

  logger.info("Starting service initialization", {
    services: sorted.map((s) => s.name),
  });

  for (const svc of sorted) {
    const critical = svc.critical ?? true;

    // ── Disabled ──
    if (svc.enabled === false) {
      serviceStatus.set(svc.name, ServiceState.DISABLED);
      continue;
    }

    // ── Not configured ──
    if (svc.isConfigured && !svc.isConfigured()) {
      serviceStatus.set(svc.name, ServiceState.NOT_CONFIGURED);
      if (critical) {
        serviceStatus.printReport("startup");
        throw new Error(`Critical service "${svc.name}" is not configured — aborting startup`);
      }
      continue;
    }

    // ── Connect ──
    try {
      serviceStatus.set(svc.name, ServiceState.CONNECTING);

      const start = Date.now();
      await svc.connect();
      const elapsed = Date.now() - start;

      serviceStatus.set(svc.name, ServiceState.CONNECTED);
      serviceStatus.setLatency(svc.name, elapsed);
      initialized.push(svc.name);

      logger.info(`Service "${svc.name}" connected`, { ms: elapsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (critical) {
        serviceStatus.set(svc.name, ServiceState.FAILED, message);
        serviceStatus.printReport("startup");
        throw new Error(`Critical service "${svc.name}" failed to initialize: ${message}`, {
          cause: err,
        });
      }

      serviceStatus.set(svc.name, ServiceState.DEGRADED, message);
      logger.warn(`Non-critical service "${svc.name}" failed — continuing`, {
        error: message,
      });
    }
  }

  serviceStatus.printReport("startup");
}

// ──────────────────────────────────────────────
//  Shutdown
// ──────────────────────────────────────────────

const DEFAULT_DISCONNECT_TIMEOUT_MS = 5_000;

/**
 * Gracefully disconnect all initialized services in reverse order.
 *
 * Each service gets its own timeout (default 5 s). If disconnect()
 * exceeds the timeout the error is logged and the next service proceeds.
 * A shutdown status report is printed when done.
 */
export async function shutdownServices(): Promise<void> {
  const toShutdown = [...initialized].reverse();

  logger.info("Shutting down services", { services: toShutdown });

  for (const name of toShutdown) {
    const svc = registry.find((s) => s.name === name);
    if (!svc) continue;

    const timeout = svc.disconnectTimeoutMs ?? DEFAULT_DISCONNECT_TIMEOUT_MS;

    try {
      await Promise.race([
        svc.disconnect(),
        new Promise<never>((_resolve, reject) =>
          setTimeout(
            () => reject(new Error(`Disconnect timed out after ${timeout}ms`)),
            timeout,
          ).unref(),
        ),
      ]);

      serviceStatus.set(svc.name, ServiceState.DISCONNECTED);
      logger.info(`Service "${svc.name}" disconnected`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      serviceStatus.set(svc.name, ServiceState.FAILED, message);
      logger.error(`Error disconnecting service "${svc.name}"`, {
        error: message,
      });
    }
  }

  initialized.length = 0;
  serviceStatus.printReport("shutdown");
}

// ──────────────────────────────────────────────
//  Topological Sort (Kahn's Algorithm)
// ──────────────────────────────────────────────

function topologicalSort(defs: ServiceDefinition[]): ServiceDefinition[] {
  const byName = new Map(defs.map((d) => [d.name, d]));

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const def of defs) {
    if (!inDegree.has(def.name)) inDegree.set(def.name, 0);
    if (!dependents.has(def.name)) dependents.set(def.name, []);

    for (const dep of def.dependsOn ?? []) {
      if (!byName.has(dep)) {
        throw new Error(`Service "${def.name}" depends on "${dep}" which is not registered`);
      }
      inDegree.set(def.name, (inDegree.get(def.name) ?? 0) + 1);

      const depList = dependents.get(dep) ?? [];
      if (!dependents.has(dep)) dependents.set(dep, depList);
      depList.push(def.name);
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: ServiceDefinition[] = [];

  while (queue.length > 0) {
    const name = queue.shift()!;

    const def = byName.get(name)!;
    sorted.push(def);

    for (const dependent of dependents.get(name) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== defs.length) {
    throw new Error("Circular dependency detected among registered services");
  }

  return sorted;
}
