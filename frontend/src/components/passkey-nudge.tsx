"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Fingerprint, X } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { isWebAuthnSupported, listCredentials } from "@/services/webauthn.service";

// ──────────────────────────────────────────────
//  Passkey Enrollment Nudge — §16 hardening
//
//  Admins are exempt from device-binding and run on a 3-day idle session,
//  so a stolen admin password is the highest-impact credential on the
//  platform. This component nudges admins to enroll a phishing-resistant
//  passkey by showing a dismissible banner on admin pages whenever they
//  have zero passkeys registered.
//
//  Behaviour:
//   • Only renders for role === "ADMIN"
//   • Only renders if WebAuthn is supported in the browser
//   • Hidden if the admin already has at least one credential
//   • "Dismiss" sets a localStorage timestamp; banner re-shows after 7 days
//     (so it stays a nudge, not a permanent annoyance)
// ──────────────────────────────────────────────

const DISMISS_KEY = "passkey-nudge-dismissed-at";
const REDISPLAY_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PasskeyNudge() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    if (!isWebAuthnSupported()) return;

    // Respect a recent dismissal — re-show only after REDISPLAY_AFTER_MS
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const dismissedAt = parseInt(raw, 10);
        if (
          Number.isFinite(dismissedAt) &&
          Date.now() - dismissedAt < REDISPLAY_AFTER_MS
        ) {
          return;
        }
      }
    } catch {
      // localStorage unavailable (private mode, SSR mismatch) — fall through
    }

    let cancelled = false;
    void listCredentials()
      .then((creds) => {
        if (!cancelled && creds.length === 0) setShow(true);
      })
      .catch(() => {
        // Endpoint unreachable — silently skip; this is a nudge, not critical
      });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="border-primary/30 bg-primary/5 mb-4 flex items-start gap-3 rounded-lg border p-4">
      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <Fingerprint size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-text-primary text-sm font-semibold">
          Set up a passkey for stronger sign-in
        </h3>
        <p className="text-text-secondary mt-0.5 text-xs">
          Replace your password with your device&apos;s fingerprint, Face ID, or Windows Hello.
          Phishing-resistant, faster, and recommended for admin accounts.
        </p>
        <Link
          href="/profile/passkeys"
          className="text-primary mt-2 inline-flex items-center text-xs font-semibold hover:underline"
        >
          Set up now →
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-text-muted hover:text-text-primary -mr-1 -mt-1 rounded p-1 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
