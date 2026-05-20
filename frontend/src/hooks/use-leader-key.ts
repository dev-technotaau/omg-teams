"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
//  useLeaderKey — Vim-style "press G, then X" navigation
//
//  Pattern: user presses a leader key (default "g"), then within
//  a short window presses a second key bound to an action. Same
//  pattern GitHub, Linear, Notion use for quick navigation.
//
//  Safety rails:
//   - Ignored when focus is in an INPUT/TEXTAREA/SELECT or a
//     contentEditable element (so typing in a field never fires)
//   - Ignored when any modifier key (Cmd/Ctrl/Alt) is held (so
//     browser shortcuts and other in-app keybindings still work)
//   - Window auto-closes after `timeoutMs` so the leader doesn't
//     stay armed if the user got distracted
// ─────────────────────────────────────────────────────────────

export interface LeaderBinding {
  /** Single character pressed AFTER the leader. Case-insensitive. */
  key: string;
  /** Fired when the binding matches. */
  action: () => void;
  /** Display label for the help overlay (e.g. "Dashboard"). */
  label: string;
}

export interface UseLeaderKeyOptions {
  /** Leader key (default "g"). */
  leader?: string;
  /** Bindings active right now. */
  bindings: LeaderBinding[];
  /** How long to wait for the second key (default 1500ms). */
  timeoutMs?: number;
  /** Set to false to fully disable (e.g. when a modal is open). */
  enabled?: boolean;
}

const DEFAULT_TIMEOUT_MS = 1500;
const TEXT_INPUT_TAGS = new Set(["TEXTAREA"]);
// Input types that accept printable keys — pressing a letter inside them
// should NOT fire a shortcut.
const TEXT_INPUT_TYPES = new Set([
  "text",
  "email",
  "password",
  "search",
  "url",
  "tel",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

function isTypingInto(el: Element | null): boolean {
  if (!el) return false;
  if (TEXT_INPUT_TAGS.has(el.tagName)) return true;
  if (el.tagName === "INPUT") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useLeaderKey(opts: UseLeaderKeyOptions): { isWaiting: boolean } {
  const { leader = "g", bindings, timeoutMs = DEFAULT_TIMEOUT_MS, enabled = true } = opts;
  const leaderLc = leader.toLowerCase();
  const [isWaiting, setIsWaiting] = useState(false);

  // Refs so the keydown listener always sees current state without having
  // to re-bind on every state change (which would race with rapid key
  // presses).
  const isWaitingRef = useRef(false);
  const bindingsRef = useRef(bindings);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const exitWait = useCallback(() => {
    isWaitingRef.current = false;
    setIsWaiting(false);
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    if (!enabled) {
      // reason: cancelling an outstanding leader-wait state when the hook
      // gets disabled (e.g. palette opens). Same pattern the rest of the
      // codebase uses for sync-prop-to-state effects.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      exitWait();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Skip when any modifier is held — those are someone else's shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Skip when the user is typing into a field
      if (isTypingInto(document.activeElement)) return;
      const key = e.key.toLowerCase();

      if (isWaitingRef.current) {
        // Second key after leader — match against bindings
        const match = bindingsRef.current.find((b) => b.key.toLowerCase() === key);
        if (match) {
          e.preventDefault();
          match.action();
        }
        // Whether matched or not, exit the wait state so the leader has to
        // be pressed again for the next sequence.
        exitWait();
        return;
      }

      if (key === leaderLc) {
        e.preventDefault();
        isWaitingRef.current = true;
        setIsWaiting(true);
        clearTimer();
        timerRef.current = setTimeout(exitWait, timeoutMs);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimer();
    };
  }, [enabled, leaderLc, timeoutMs, exitWait, clearTimer]);

  return { isWaiting };
}
