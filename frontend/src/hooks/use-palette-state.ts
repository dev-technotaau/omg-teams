"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// ─────────────────────────────────────────────────────────────
//  Cmd+K palette state — recents, pinned, recent queries
//
//  All persisted to localStorage so the user's customisation
//  survives reloads + cross-tab updates (storage event sync).
// ─────────────────────────────────────────────────────────────

const PINNED_KEY = "omg.palette.pinned";
const RECENTS_KEY = "omg.palette.recents";
const RECENT_QUERIES_KEY = "omg.palette.recentQueries";

const MAX_RECENTS = 5;
const MAX_RECENT_QUERIES = 10;

function readArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeArray(key: string, value: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage may be unavailable in private mode — ignore */
  }
}

/** Hook for the pinned/favorites list (hrefs). */
export function usePinned() {
  const [pinned, setPinned] = useState<string[]>(() => readArray(PINNED_KEY));

  useEffect(() => {
    writeArray(PINNED_KEY, pinned);
  }, [pinned]);

  // Cross-tab sync — if the user pins on tab A, tab B sees it on next palette open
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PINNED_KEY) setPinned(readArray(PINNED_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const togglePin = useCallback((href: string) => {
    setPinned((prev) => (prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]));
  }, []);

  return { pinned, togglePin, isPinned: (href: string) => pinned.includes(href) };
}

/** Hook for the recents list — automatically records every visited pathname. */
export function useRecents() {
  const pathname = usePathname();
  const [recents, setRecents] = useState<string[]>(() => readArray(RECENTS_KEY));

  // Record route changes. Push to the front, dedupe, cap to MAX_RECENTS.
  // /login and the root redirect are noisy + not useful, so skip them.
  // reason: syncing external state (URL) into local state — the rule's
  // explicit allowed use case ("subscribe for updates from some external
  // system, calling setState in a callback when external state changes").
  useEffect(() => {
    if (!pathname || pathname === "/" || pathname === "/login") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecents((prev) => {
      if (prev[0] === pathname) return prev; // already most recent
      const next = [pathname, ...prev.filter((p) => p !== pathname)].slice(0, MAX_RECENTS);
      writeArray(RECENTS_KEY, next);
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENTS_KEY) setRecents(readArray(RECENTS_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    writeArray(RECENTS_KEY, []);
  }, []);

  return { recents, clearRecents };
}

/** Hook for the palette's search query history (↑ recalls last query). */
export function useRecentQueries() {
  const [queries, setQueries] = useState<string[]>(() => readArray(RECENT_QUERIES_KEY));

  const pushQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQueries((prev) => {
      const next = [trimmed, ...prev.filter((p) => p !== trimmed)].slice(0, MAX_RECENT_QUERIES);
      writeArray(RECENT_QUERIES_KEY, next);
      return next;
    });
  }, []);

  const clearQueries = useCallback(() => {
    setQueries([]);
    writeArray(RECENT_QUERIES_KEY, []);
  }, []);

  return { queries, pushQuery, clearQueries };
}
