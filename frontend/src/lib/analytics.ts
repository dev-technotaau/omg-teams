import { env } from "./env";

// ──────────────────────────────────────────────
//  Analytics Event Helpers
//
//  Unified API to send events to GA4, GTM dataLayer,
//  and Facebook Pixel. Safe to call even if a
//  tracker isn't configured (no-ops silently).
// ──────────────────────────────────────────────

// Global type declarations for tracker globals
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    fbq?: (...args: unknown[]) => void;
  }
}

/** Send a GA4 event via gtag */
export function gaEvent(action: string, params?: Record<string, string | number | boolean>) {
  if (!env.hasGA || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", action, params);
}

/** Push to GTM dataLayer */
export function gtmEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.dataLayer) return;
  window.dataLayer.push({ event, ...data });
}

/** Send a Facebook Pixel standard or custom event */
export function fbEvent(event: string, params?: Record<string, string | number>) {
  if (!env.hasFBPixel || typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}

/**
 * Track an event across all configured analytics platforms.
 * Use this for key business events (login, signup, report submission, etc.)
 */
export function trackEvent(action: string, params?: Record<string, string | number | boolean>) {
  gaEvent(action, params);
  gtmEvent(action, params as Record<string, unknown>);
  fbEvent(action, params as Record<string, string | number>);
}

/** Track a page view (called on route change) */
export function trackPageView(url: string) {
  // GA4
  if (env.hasGA && typeof window !== "undefined" && window.gtag) {
    window.gtag("config", env.GA_MEASUREMENT_ID, { page_path: url });
  }
  // FB Pixel
  if (env.hasFBPixel && typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "PageView");
  }
  // GTM gets pageviews automatically via dataLayer
}
