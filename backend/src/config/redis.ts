import Redis, { type RedisOptions } from "ioredis";
import { env } from "./env.js";
import { logger } from "../instrument.js";
import { registerService } from "./service-init.js";

// ──────────────────────────────────────────────
//  Singleton Redis Connection
//
//  Free Redis Cloud has a 30-connection limit.
//  We use ONE shared connection for pub/sub/cache
//  and pass it to BullMQ via IORedis' connection
//  reuse. All modules import from this file.
// ──────────────────────────────────────────────

let client: Redis | undefined;
let subscriber: Redis | undefined;

function buildOptions(): RedisOptions {
  if (env.REDIS_URL) {
    return {
      lazyConnect: true,
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: true,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
    };
  }

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  };
}

/**
 * Returns the singleton Redis client for commands (GET/SET/etc.)
 * and BullMQ queue producers.
 */
export function getRedisClient(): Redis {
  if (!client) {
    client = env.REDIS_URL ? new Redis(env.REDIS_URL, buildOptions()) : new Redis(buildOptions());

    client.on("error", (err) => {
      logger.error("Redis client error", { error: err.message });
    });
  }
  return client;
}

/**
 * Returns a dedicated subscriber connection.
 * BullMQ workers need a separate subscriber connection.
 * This is the ONLY second connection we open.
 */
export function getRedisSubscriber(): Redis {
  if (!subscriber) {
    subscriber = env.REDIS_URL
      ? new Redis(env.REDIS_URL, buildOptions())
      : new Redis(buildOptions());

    subscriber.on("error", (err) => {
      logger.error("Redis subscriber error", { error: err.message });
    });
  }
  return subscriber;
}

// ──────────────────────────────────────────────
//  Service Registration
// ──────────────────────────────────────────────

registerService({
  name: "redis",
  critical: false,

  isConfigured: () => env.hasRedis,

  async connect() {
    const redis = getRedisClient();
    await redis.connect();
    const info = await redis.ping();
    logger.info(`Redis connected (PING: ${info})`);
  },

  async disconnect() {
    if (subscriber) {
      await subscriber.quit();
      subscriber = undefined;
    }
    if (client) {
      await client.quit();
      client = undefined;
    }
    logger.info("Redis disconnected");
  },

  disconnectTimeoutMs: 5_000,
});
