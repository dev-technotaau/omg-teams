import { env } from "../config/env.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Google Analytics — Server-Side Events
//
//  Uses the GA4 Measurement Protocol to send
//  events from the backend (e.g. sign-up,
//  subscription, report generation).
// ──────────────────────────────────────────────

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";

interface GAEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

/**
 * Send a server-side event to Google Analytics.
 * Requires GA_MEASUREMENT_ID and GA_API_SECRET.
 */
export async function trackEvent(clientId: string, event: GAEvent): Promise<void> {
  if (!env.GA_MEASUREMENT_ID || !env.GA_API_SECRET) {
    return; // GA not configured — silently skip
  }

  try {
    const url = `${GA_ENDPOINT}?measurement_id=${env.GA_MEASUREMENT_ID}&api_secret=${env.GA_API_SECRET}`;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        events: [event],
      }),
    });
  } catch (err) {
    logger.error("GA event failed", {
      event: event.name,
      error: (err as Error).message,
    });
  }
}
