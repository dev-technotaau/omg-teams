"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// ──────────────────────────────────────────────
//  useTabSearchParam — Persist active tab in the URL
//
//  Drop-in replacement for useState<TabId> that mirrors the active
//  tab to a URL search param so it survives reloads, browser
//  back/forward, and link sharing.
//
//  Usage:
//    const [tab, setTab] = useTabSearchParam("tab", "active", [
//      "active", "history",
//    ] as const);
//
//  - `paramName` is the query-string key (default: "tab"). Pass a
//    distinct name when a page has multiple independent tab groups
//    (e.g. "view" and "role").
//  - `defaultValue` is what's used when the URL doesn't carry the
//    param OR carries an unrecognised value (defends against
//    hand-crafted URLs).
//  - `validValues` is an explicit allow-list. The hook only returns
//    a value that appears in this list, so callers can trust the
//    return type as the union T.
// ──────────────────────────────────────────────

export function useTabSearchParam<T extends string>(
  paramName: string,
  defaultValue: T,
  validValues: readonly T[],
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get(paramName);
  const current: T = (validValues as readonly string[]).includes(raw ?? "")
    ? (raw as T)
    : defaultValue;

  const setTab = useCallback(
    (next: T) => {
      // Build a new URLSearchParams from the live ones so we never
      // clobber other params (filters, sort, page, etc.).
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultValue) {
        // Keep URLs clean — omit the param when it equals the default.
        params.delete(paramName);
      } else {
        params.set(paramName, next);
      }
      const qs = params.toString();
      // replace (not push) so the back button doesn't accumulate one
      // history entry per tab click. Scroll: false so we don't jump
      // to the top of the page on every tab switch.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, paramName, defaultValue],
  );

  return [current, setTab];
}
