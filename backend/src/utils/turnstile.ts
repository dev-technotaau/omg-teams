import { env } from "../config/env.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Cloudflare Turnstile Server-Side Verification
// ──────────────────────────────────────────────

interface TurnstileResponse {
  success: boolean;
  "error-codes": string[];
  challenge_ts: string;
  hostname: string;
}

/**
 * Verify a Turnstile token server-side.
 * Returns true if valid, false if invalid or Turnstile is not configured.
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  if (!env.hasTurnstile) {
    // Skip verification if not configured (dev mode)
    logger.warn("Turnstile not configured — skipping verification");
    return true;
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.CF_TURNSTILE_SECRET_KEY,
        response: token,
        ...(remoteIp && { remoteip: remoteIp }),
      }),
    });

    const data = (await response.json()) as TurnstileResponse;

    if (!data.success) {
      logger.warn("Turnstile verification failed", { errors: data["error-codes"] });
    }

    return data.success;
  } catch (err) {
    logger.error("Turnstile verification error", {
      error: (err as Error).message,
    });
    return false;
  }
}
