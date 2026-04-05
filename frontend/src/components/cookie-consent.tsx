"use client";

import { Cookie } from "lucide-react";
import { useCookieConsent } from "@/store/cookie-consent";

// ─────────────────────────────────────────���────
//  Cookie Consent Banner
//  Simple acknowledgment — all cookies essential.
// ──────────────────────────────────────────────

export function CookieConsentBanner() {
  const { hasAcknowledged, acknowledge } = useCookieConsent();

  if (hasAcknowledged) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-9999 p-4">
      <div className="bg-bg-surface border-border-default mx-auto flex max-w-xl items-center gap-3 rounded-xl border px-5 py-4 shadow-2xl">
        <Cookie size={18} className="text-primary-500 shrink-0" />
        <p className="text-text-secondary flex-1 text-sm">
          We use cookies for authentication, security, and platform functionality.
        </p>
        <button
          onClick={acknowledge}
          className="bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
