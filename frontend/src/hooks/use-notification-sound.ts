import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  getMyPreferences,
  getQuietHours,
  isInQuietHours,
  type NotificationPreference,
} from "@/services/notification-preference.service";

// ──────────────────────────────────────────────
//  useNotificationSound
//
//  Plays a brief WebAudio chime when a notification arrives, gated by
//  the user's per-category `soundEnabled` preference. No audio asset
//  needed — the chime is generated at runtime so it works in every
//  browser without a network fetch.
//
//  Browsers block AudioContext until a user gesture; we lazily resume
//  on the first click anywhere on the page, then subsequent plays
//  work for the rest of the session.
// ──────────────────────────────────────────────

interface UseNotificationSoundReturn {
  /**
   * Play the chime if the user has soundEnabled=true for this category.
   * Pass the raw NotificationCategory value (DOCUMENT, LEAVE, TASK, …).
   */
  play: (category: string) => void;
}

export function useNotificationSound(): UseNotificationSoundReturn {
  // Cache preferences for the session — the prefs page invalidates this
  // query on save, so the toggle takes effect immediately.
  const prefsQuery = useQuery({
    queryKey: qk.notifPrefs.detail(),
    queryFn: getMyPreferences,
    staleTime: 5 * 60 * 1000,
  });
  // §11.5 — quiet hours also gate the chime. Cached separately so a stale
  // prefs cache doesn't force a quiet-hours refetch (and vice versa).
  const quietHoursQuery = useQuery({
    queryKey: qk.notifPrefs.quietHours(),
    queryFn: getQuietHours,
    staleTime: 5 * 60 * 1000,
  });

  // AudioContext is a heavy object — keep one per provider instance.
  const ctxRef = useRef<AudioContext | null>(null);
  // Chrome's autoplay policy blocks AudioContext construction until the
  // user has interacted with the page. Constructing one beforehand also
  // emits a console warning even if we never call play(). Gate ALL
  // AudioContext access on this flag so a notification arriving before
  // any user gesture is a silent skip (not a warning).
  const unlockedRef = useRef(false);

  // Build (and immediately resume) the AudioContext on the FIRST user
  // gesture. Both the construction and the resume happen inside the
  // gesture handler — only then does Chrome consider the AudioContext
  // "allowed to start" and the autoplay warning never fires.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlock = () => {
      if (unlockedRef.current) return;
      const W = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = W.AudioContext ?? W.webkitAudioContext;
      if (!Ctor) {
        unlockedRef.current = true; // No WebAudio support — flag as "done", play() will no-op
        return;
      }
      try {
        const ctx = new Ctor();
        if (ctx.state === "suspended") void ctx.resume();
        ctxRef.current = ctx;
      } catch {
        // Best-effort — leave ctxRef null, play() will no-op
      }
      unlockedRef.current = true;
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const play = useCallback(
    (category: string) => {
      const prefs = prefsQuery.data;
      if (!prefs) return; // preferences not yet loaded — skip silently
      const pref = prefs.find(
        (p: NotificationPreference) => p.category === category,
      );
      // Honour both the per-category sound toggle AND the master in-app
      // toggle — if the user disabled the whole category, no sound either.
      if (!pref || !pref.soundEnabled || !pref.isEnabled) return;

      // §11.5 — quiet hours suppress the chime. Mirrors the backend's
      // isInQuietHours check that gates Socket.IO + FCM dispatch.
      // SYSTEM and ACCOUNT bypass quiet hours (matches notification.service).
      const qh = quietHoursQuery.data;
      const bypassQuiet = category === "SYSTEM" || category === "ACCOUNT";
      if (qh && !bypassQuiet && isInQuietHours(qh)) return;

      // If the user hasn't interacted with the page yet, the AudioContext
      // can't be created without triggering Chrome's autoplay warning.
      // Silently skip — there'll be other notifications later.
      if (!unlockedRef.current) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      // Re-resume in case the browser auto-suspended after some idle time
      // (Chrome does this on hidden tabs). resume() is a no-op when running.
      if (ctx.state === "suspended") void ctx.resume();

      // Two-note chime — high then slightly lower, ~120ms total. Subtle,
      // not jarring. Volume kept low (0.08) so it's audible without
      // becoming annoying for users who get many notifications.
      try {
        const now = ctx.currentTime;
        const playTone = (freq: number, start: number, durationMs: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          // Soft attack + decay envelope so it doesn't click
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
          gain.gain.linearRampToValueAtTime(0, start + durationMs / 1000);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + durationMs / 1000 + 0.05);
        };
        playTone(880, now, 90); // A5
        playTone(659, now + 0.07, 110); // E5
      } catch {
        // Best-effort — never let an audio failure surface to the user
      }
    },
    [prefsQuery.data, quietHoursQuery.data],
  );

  return { play };
}
