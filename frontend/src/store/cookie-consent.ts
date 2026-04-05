import { create } from "zustand";

// ────────────────────────────────────────��─────
//  Cookie Consent Store
//  Simple acknowledgment — all cookies essential.
// ──────────────────────────────────────────────

const STORAGE_KEY = "omg_cookie_consent";

interface CookieConsentState {
  hasAcknowledged: boolean;
  acknowledge: () => void;
}

export const useCookieConsent = create<CookieConsentState>()(() => ({
  hasAcknowledged: typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) !== null,

  acknowledge: () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    useCookieConsent.setState({ hasAcknowledged: true });
  },
}));
