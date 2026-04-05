/**
 * Type-safe access to NEXT_PUBLIC_ env vars.
 * These are inlined at build time by Next.js.
 */
export const env = {
  // ── App ──
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "OMG Teams",
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
  API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1",
  SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000",

  // ── Turnstile (CAPTCHA) ──
  TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",

  // ── Sentry ──
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",

  // ── Cloudinary / R2 ──
  CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
  R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "",

  // ── Firebase ──
  FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  FIREBASE_DATABASE_URL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "",
  FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "",

  // ── Web Push ──
  VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",

  // ── Google Analytics (GA4) ──
  GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",

  // ── Google Tag Manager ──
  GTM_ID: process.env.NEXT_PUBLIC_GTM_ID ?? "",

  // ── Facebook Pixel ──
  FB_PIXEL_ID: process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? "",

  // ── WebAuthn ──
  WEBAUTHN_RP_ID: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID ?? "",

  // ── Server-only (not NEXT_PUBLIC_, available in middleware / server components) ──
  BACKEND_INTERNAL_URL: process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3000",

  // ── Helpers ──
  IS_PROD: process.env.NODE_ENV === "production",
  IS_DEV: process.env.NODE_ENV === "development",

  get hasFirebase(): boolean {
    return this.FIREBASE_API_KEY !== "" && this.FIREBASE_PROJECT_ID !== "";
  },
  get hasTurnstile(): boolean {
    return this.TURNSTILE_SITE_KEY !== "";
  },
  get hasSentry(): boolean {
    return this.SENTRY_DSN !== "";
  },
  get hasGA(): boolean {
    return this.GA_MEASUREMENT_ID !== "";
  },
  get hasGTM(): boolean {
    return this.GTM_ID !== "";
  },
  get hasFBPixel(): boolean {
    return this.FB_PIXEL_ID !== "";
  },
} as const;
