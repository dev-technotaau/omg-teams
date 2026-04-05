import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

export enum ServiceState {
  PENDING = "PENDING",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DEGRADED = "DEGRADED",
  DISCONNECTED = "DISCONNECTED",
  FAILED = "FAILED",
  NOT_CONFIGURED = "NOT_CONFIGURED",
  DISABLED = "DISABLED",
}

/** Symbols for each state used in the status report. */
const STATE_ICON: Record<ServiceState, string> = {
  [ServiceState.PENDING]: "○",
  [ServiceState.CONNECTING]: "◌",
  [ServiceState.CONNECTED]: "●",
  [ServiceState.DEGRADED]: "▲",
  [ServiceState.DISCONNECTED]: "■",
  [ServiceState.FAILED]: "✗",
  [ServiceState.NOT_CONFIGURED]: "⚠",
  [ServiceState.DISABLED]: "○",
};

export interface ServiceEntry {
  name: string;
  state: ServiceState;
  critical: boolean;
  lastCheckedAt: Date;
  error?: string | undefined;
  latencyMs?: number | undefined;
}

// ──────────────────────────────────────────────
//  Registry
// ──────────────────────────────────────────────

const services = new Map<string, ServiceEntry>();

export const serviceStatus = {
  /**
   * Register a service to be tracked.
   * Call this once per dependency during bootstrap.
   */
  register(name: string, critical = true): void {
    if (services.has(name)) {
      logger.warn(`Service "${name}" already registered — skipping`);
      return;
    }

    services.set(name, {
      name,
      state: ServiceState.PENDING,
      critical,
      lastCheckedAt: new Date(),
    });

    logger.debug(`Service registered: ${name}`, { critical });
  },

  /**
   * Update the state of a tracked service.
   */
  set(name: string, state: ServiceState, error?: string): void {
    const entry = services.get(name);
    if (!entry) {
      logger.warn(`Cannot update unknown service "${name}"`);
      return;
    }

    entry.state = state;
    entry.lastCheckedAt = new Date();
    entry.error = error;

    if (state === ServiceState.FAILED || state === ServiceState.DISCONNECTED) {
      logger.error(`Service ${name}: ${state}`, { error });
    } else if (state === ServiceState.DEGRADED || state === ServiceState.NOT_CONFIGURED) {
      logger.warn(`Service ${name}: ${state}`, { error });
    } else {
      logger.info(`Service ${name}: ${state}`);
    }
  },

  /**
   * Record connection latency for a service.
   */
  setLatency(name: string, ms: number): void {
    const entry = services.get(name);
    if (entry) entry.latencyMs = ms;
  },

  /**
   * Get a single service's status.
   */
  get(name: string): ServiceEntry | undefined {
    return services.get(name);
  },

  /**
   * Snapshot of all tracked services.
   */
  getAll(): ServiceEntry[] {
    return Array.from(services.values());
  },

  /**
   * Count services by state.
   */
  counts(): {
    total: number;
    running: number;
    failed: number;
    degraded: number;
    notConfigured: number;
    disabled: number;
    pending: number;
  } {
    const c = {
      total: 0,
      running: 0,
      failed: 0,
      degraded: 0,
      notConfigured: 0,
      disabled: 0,
      pending: 0,
    };

    for (const entry of services.values()) {
      c.total++;
      switch (entry.state) {
        case ServiceState.CONNECTED:
          c.running++;
          break;
        case ServiceState.FAILED:
          c.failed++;
          break;
        case ServiceState.DEGRADED:
          c.degraded++;
          break;
        case ServiceState.NOT_CONFIGURED:
          c.notConfigured++;
          break;
        case ServiceState.DISABLED:
          c.disabled++;
          break;
        default:
          c.pending++;
          break;
      }
    }

    return c;
  },

  /**
   * True if every critical service is CONNECTED.
   * Disabled / not-configured non-critical services don't block readiness.
   * Use for Kubernetes readiness probes.
   */
  isReady(): boolean {
    for (const entry of services.values()) {
      if (!entry.critical) continue;
      if (entry.state !== ServiceState.CONNECTED) return false;
    }
    return true;
  },

  /**
   * True if no service is FAILED.
   * Use for Kubernetes liveness probes.
   */
  isAlive(): boolean {
    for (const entry of services.values()) {
      if (entry.state === ServiceState.FAILED) return false;
    }
    return true;
  },

  /**
   * Print a formatted status report to stdout.
   */
  printReport(phase: "startup" | "shutdown" = "startup"): void {
    const all = Array.from(services.values());
    const c = this.counts();
    const ready = this.isReady();
    const alive = this.isAlive();

    const title = phase === "startup" ? "SERVICE STATUS REPORT" : "SERVICE SHUTDOWN REPORT";

    // ── Column widths ──
    const nameWidth = Math.max(20, ...all.map((s) => s.name.length + 4));
    const stateWidth = 18;
    const typeWidth = 10;
    const latencyWidth = 10;
    const totalWidth = nameWidth + stateWidth + typeWidth + latencyWidth + 5;

    const divider = "═".repeat(totalWidth);
    const thinDivider = "─".repeat(totalWidth);

    const pad = (str: string, width: number): string => str.padEnd(width);
    const center = (str: string, width: number): string => {
      const gap = width - str.length;
      const left = Math.floor(gap / 2);
      return " ".repeat(left) + str + " ".repeat(gap - left);
    };

    const lines: string[] = [];
    lines.push("");
    lines.push(`  ${divider}`);
    lines.push(`  ${center(title, totalWidth)}`);
    lines.push(`  ${divider}`);

    // ── Header ──
    lines.push(
      `  ${pad(" Service", nameWidth)} ${pad("State", stateWidth)} ${pad("Type", typeWidth)} ${pad("Latency", latencyWidth)}`,
    );
    lines.push(`  ${thinDivider}`);

    // ── Rows ──
    for (const entry of all) {
      const icon = STATE_ICON[entry.state];
      const state = `${icon} ${entry.state}`;
      const type = entry.critical ? "critical" : "optional";
      const latency = entry.latencyMs !== undefined ? `${entry.latencyMs}ms` : "—";
      const errorSuffix = entry.error !== undefined ? `  (${entry.error})` : "";

      lines.push(
        `  ${pad(` ${entry.name}`, nameWidth)} ${pad(state, stateWidth)} ${pad(type, typeWidth)} ${pad(latency, latencyWidth)}${errorSuffix}`,
      );
    }

    if (all.length === 0) {
      lines.push(`  ${center("No services registered", totalWidth)}`);
    }

    // ── Summary ──
    lines.push(`  ${thinDivider}`);

    const summaryParts: string[] = [];
    summaryParts.push(`Running: ${c.running}/${c.total}`);
    if (c.failed > 0) summaryParts.push(`Failed: ${c.failed}`);
    if (c.degraded > 0) summaryParts.push(`Degraded: ${c.degraded}`);
    if (c.notConfigured > 0) summaryParts.push(`Not Configured: ${c.notConfigured}`);
    if (c.disabled > 0) summaryParts.push(`Disabled: ${c.disabled}`);
    if (c.pending > 0) summaryParts.push(`Pending: ${c.pending}`);

    lines.push(`   ${summaryParts.join("  │  ")}`);

    // ── Final status line ──
    lines.push(`  ${thinDivider}`);

    let statusLine: string;
    if (ready && alive) {
      statusLine = "● READY";
    } else if (alive && !ready) {
      statusLine = "▲ NOT READY (critical services down)";
    } else {
      statusLine = "✗ UNHEALTHY (services failed)";
    }
    lines.push(`   Status: ${statusLine}`);
    lines.push(`  ${divider}`);
    lines.push("");

    // Print as a single block so it isn't interleaved with other logs
    console.info(lines.join("\n"));
  },

  /**
   * Structured summary for health-check endpoints.
   */
  toJSON(): {
    ready: boolean;
    alive: boolean;
    counts: Record<string, number>;
    services: Record<
      string,
      { state: ServiceState; critical: boolean; error?: string; latencyMs?: number }
    >;
  } {
    const summary: Record<
      string,
      { state: ServiceState; critical: boolean; error?: string; latencyMs?: number }
    > = {};

    for (const entry of services.values()) {
      summary[entry.name] = {
        state: entry.state,
        critical: entry.critical,
        ...(entry.error !== undefined && { error: entry.error }),
        ...(entry.latencyMs !== undefined && { latencyMs: entry.latencyMs }),
      };
    }

    return {
      ready: this.isReady(),
      alive: this.isAlive(),
      counts: this.counts(),
      services: summary,
    };
  },

  /**
   * Remove all tracked services (useful in tests).
   */
  clear(): void {
    services.clear();
  },
};
