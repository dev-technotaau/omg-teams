/**
 * Instrumentation & Observability Bootstrap
 *
 * This module MUST be imported before any other application code
 * (except env.ts which loads .env first).
 */
import { env } from "./config/env.js";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
};

const currentLevel: LogLevel = LOG_LEVEL_MAP[env.LOG_LEVEL.toLowerCase()] ?? LogLevel.INFO;

function formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta && { meta }),
  };
  return JSON.stringify(entry);
}

export const logger = {
  error(message: string, meta?: Record<string, unknown>): void {
    if (currentLevel >= LogLevel.ERROR) {
      console.error(formatMessage("error", message, meta));
    }
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    if (currentLevel >= LogLevel.WARN) {
      console.warn(formatMessage("warn", message, meta));
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    if (currentLevel >= LogLevel.INFO) {
      console.info(formatMessage("info", message, meta));
    }
  },

  debug(message: string, meta?: Record<string, unknown>): void {
    if (currentLevel >= LogLevel.DEBUG) {
      console.debug(formatMessage("debug", message, meta));
    }
  },
};

logger.info("Instrumentation initialized", { logLevel: LogLevel[currentLevel] });
