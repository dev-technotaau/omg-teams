import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { env } from "./env.js";
import { logger } from "../instrument.js";
import { registerService } from "./service-init.js";

// ──────────────────────────────────────────────
//  Connection Pool
// ──────────────────────────────────────────────

let pool: pg.Pool | undefined;
let prisma: PrismaClient | undefined;

function createPool(): pg.Pool {
  // At runtime, always use DATABASE_URL (pooler). DATABASE_DIRECT_URL is only for Prisma CLI migrations.
  const connectionString = env.DATABASE_URL;

  const sslConfig =
    env.DATABASE_SSL_MODE === "disable"
      ? false
      : { rejectUnauthorized: env.DATABASE_SSL_MODE === "verify-full" };

  return new pg.Pool({
    connectionString,
    max: env.DATABASE_POOL_SIZE,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT * 1000,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT * 1000,
    ssl: sslConfig,
  });
}

// ──────────────────────────────────────────────
//  Prisma Client Singleton (Prisma 7 Adapter)
// ──────────────────────────────────────────────

function createPrismaClient(pgPool: pg.Pool): PrismaClient {
  const adapter = new PrismaPg(pgPool);

  const logLevels: { level: "query" | "info" | "warn" | "error"; emit: "event" }[] = env.isDev
    ? [
        { level: "query", emit: "event" },
        { level: "warn", emit: "event" },
        { level: "error", emit: "event" },
      ]
    : [
        { level: "warn", emit: "event" },
        { level: "error", emit: "event" },
      ];

  const client = new PrismaClient({
    adapter,
    log: logLevels,
  });

  // ── Event logging ──
  client.$on("warn", (e) => {
    logger.warn("Prisma warning", { message: e.message });
  });

  client.$on("error", (e) => {
    logger.error("Prisma error", { message: e.message });
  });

  if (env.isDev) {
    client.$on("query", (e) => {
      logger.debug("Prisma query", {
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    });
  }

  return client;
}

/**
 * Returns the singleton PrismaClient instance.
 * Creates it on first call (lazy initialization).
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    pool = createPool();
    prisma = createPrismaClient(pool);
  }
  return prisma;
}

/**
 * Returns the underlying pg Pool (for raw queries or health checks).
 */
export function getPool(): pg.Pool {
  if (!pool) {
    getPrisma(); // triggers pool + client creation
  }

  return pool!;
}

// ──────────────────────────────────────────────
//  Service Registration
// ──────────────────────────────────────────────

registerService({
  name: "postgres",
  critical: true,

  isConfigured: () => env.hasDatabaseUrl,

  async connect() {
    const client = getPrisma();
    // Prisma 7 with adapter connects lazily on first query.
    // Force a connection check by running a simple query.
    await client.$queryRawUnsafe("SELECT 1");
    logger.info("Prisma connected to PostgreSQL", {
      poolSize: env.DATABASE_POOL_SIZE,
      sslMode: env.DATABASE_SSL_MODE,
    });
  },

  async disconnect() {
    if (prisma) {
      await prisma.$disconnect();
      prisma = undefined;
    }
    if (pool) {
      await pool.end();
      pool = undefined;
    }
    logger.info("PostgreSQL disconnected");
  },

  disconnectTimeoutMs: 10_000,
});
