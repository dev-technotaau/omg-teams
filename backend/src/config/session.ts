import { RedisStore } from "connect-redis";
import session from "express-session";
import { env } from "./env.js";
import { getRedisClient } from "./redis.js";
import { logger } from "../instrument.js";
import type { RequestHandler } from "express";

// ──────────────────────────────────────────────
//  Redis-backed Session Middleware
//
//  Uses the singleton Redis connection via
//  connect-redis. Session data is stored in
//  Redis with a configurable TTL.
// ──────────────────────────────────────────────

export function createSessionMiddleware(): RequestHandler {
  const store = new RedisStore({
    client: getRedisClient(),
    prefix: "sess:",
    ttl: Math.floor(env.SESSION_MAX_AGE / 1000),
  });

  store.on("error", (err: Error) => {
    logger.error("Session store error", { error: err.message });
  });

  return session({
    store,
    secret: env.SESSION_SECRET,
    name: "sid",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "strict",
      maxAge: env.SESSION_MAX_AGE,
    },
  });
}
