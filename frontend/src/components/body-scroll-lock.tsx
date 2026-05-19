"use client";

import { useEffect } from "react";

// ──────────────────────────────────────────────
//  BodyScrollLock
//
//  Adds `overflow: hidden` to <html> and <body> while mounted, restoring
//  the previous values on unmount. Used by the protected layout so that
//  scrolling is handled exclusively by the inner `<main overflow-y-auto>`.
//
//  Without this, tiny pixel offsets (toaster portals, fixed banners,
//  invisible script tags) leaked past 100vh and showed an outer document
//  scrollbar in addition to the inner main scrollbar — visible as a
//  "double scrollbar" on every page (the outer one scrolled the whole
//  page including header + sidebar).
//
//  Scoped to the protected layout via component lifetime so the login /
//  maintenance pages (which use `min-h-screen` and may need to scroll on
//  very small screens) are unaffected.
// ──────────────────────────────────────────────

export function BodyScrollLock(): null {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);
  return null;
}
