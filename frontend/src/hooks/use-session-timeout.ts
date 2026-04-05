"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Session Inactivity Warning Hook — Spec §25.3
//
//  Detects user inactivity on the client side.
//  Shows warning modal 5 minutes before server-side
//  session timeout. Activity = mouse/keyboard/scroll.
//
//  Server-side TTL is authoritative — this is
//  purely a UX convenience to prevent surprise logouts.
// ──────────────────────────────────────────────

/** Default idle timeout in ms (30 minutes, matching server default) */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
/** Warning shown 5 minutes before expiry */
const WARNING_BEFORE_MS = 5 * 60 * 1000;

interface UseSessionTimeoutOptions {
  /** Total session idle timeout in ms (should match server config). Default 30min. */
  timeoutMs?: number;
  /** Callback when session actually expires (redirect to login). */
  onExpired?: () => void;
  /** Disabled for admin (admin sessions don't have midnight reset). */
  enabled?: boolean;
}

interface UseSessionTimeoutReturn {
  /** Whether the warning modal should be shown */
  showWarning: boolean;
  /** Seconds remaining until session expires */
  secondsRemaining: number;
  /** Call this to dismiss warning and send keep-alive */
  stayLoggedIn: () => void;
}

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"] as const;

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}): UseSessionTimeoutReturn {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onExpired, enabled = true } = options;

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const lastActivityRef = useRef(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    lastActivityRef.current = Date.now();

    // Set warning timer: fires WARNING_BEFORE_MS before timeout
    const warningDelay = timeoutMs - WARNING_BEFORE_MS;
    if (warningDelay > 0) {
      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true);
        setSecondsRemaining(Math.floor(WARNING_BEFORE_MS / 1000));

        // Start countdown
        countdownRef.current = setInterval(() => {
          setSecondsRemaining((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, warningDelay);
    }

    // Set absolute expiry timer
    expiryTimerRef.current = setTimeout(() => {
      setShowWarning(false);
      onExpired?.();
    }, timeoutMs);
  }, [timeoutMs, onExpired, clearTimers]);

  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    // Send a keep-alive request to refresh server-side session TTL
    api.get("/api/auth/me").catch(() => {});
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!enabled) return;

    // Initialize lastActivity timestamp on mount
    lastActivityRef.current = Date.now();

    const handleActivity = () => {
      // Only reset if warning is not currently showing
      // (once warning shows, only explicit "Stay logged in" resets)
      if (!showWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    queueMicrotask(() => resetTimers());

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      clearTimers();
    };
  }, [enabled, resetTimers, clearTimers, showWarning]);

  return { showWarning, secondsRemaining, stayLoggedIn };
}
