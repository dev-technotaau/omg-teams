"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// ──────────────────────────────────────────────
//  Main scroll restoration
//
//  The protected layout puts the page scroll on <main> rather than on
//  <body>, which means browser-native scroll restoration (and Next's
//  default scroll handling) does nothing useful — both only work on
//  body/html scroll. This component fills the gap:
//
//    - Saves the scroll position of <main> per pathname into
//      sessionStorage on every scroll (rAF-throttled).
//    - Restores it on mount and on every pathname change.
//    - Tolerates async page content: retries the restore for up to
//      ~1.5s in case the saved position isn't reachable yet because
//      the page is still loading data.
//    - Bails out of the retry loop the moment the user actually
//      scrolls or interacts so it never fights manual scrolling.
// ──────────────────────────────────────────────

const SCROLL_KEY_PREFIX = "omg.scroll.";

export function MainScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const key = SCROLL_KEY_PREFIX + pathname;
    let target = 0;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) target = Number(saved) || 0;
    } catch {
      /* sessionStorage may be unavailable in private mode */
    }

    let isRestoring = target > 0;
    let cancelled = false;
    let attempts = 0;
    let raf = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Save handler — skipped while a restore is in progress ──
    const save = () => {
      raf = 0;
      if (isRestoring) return;
      try {
        sessionStorage.setItem(key, String(main.scrollTop));
      } catch {
        /* ignore */
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(save);
    };
    main.addEventListener("scroll", onScroll, { passive: true });

    // User interaction abandons the restore retry loop. Without this
    // the retry loop would fight someone trying to scroll right after
    // a reload.
    const onUserInput = () => {
      cancelled = true;
      isRestoring = false;
    };
    main.addEventListener("wheel", onUserInput, { passive: true, once: true });
    main.addEventListener("touchmove", onUserInput, { passive: true, once: true });
    main.addEventListener("keydown", onUserInput, { once: true });

    if (target > 0) {
      const tryRestore = () => {
        if (cancelled) return;
        main.scrollTop = target;
        // The browser clamps scrollTop to (scrollHeight - clientHeight),
        // so if the page content hasn't loaded yet the assignment will
        // silently clamp to a smaller value. We retry until either the
        // assignment sticks or we run out of attempts.
        if (Math.abs(main.scrollTop - target) < 2) {
          // Give the scroll event one frame to settle, then re-enable
          // saving so subsequent user scrolls get persisted.
          setTimeout(() => {
            isRestoring = false;
          }, 100);
          return;
        }
        attempts++;
        if (attempts < 30) {
          retryTimer = setTimeout(tryRestore, 50);
        } else {
          isRestoring = false;
        }
      };
      tryRestore();
    } else {
      // Fresh navigation to a page we have no record of — start at top.
      main.scrollTop = 0;
    }

    return () => {
      cancelled = true;
      isRestoring = false;
      main.removeEventListener("scroll", onScroll);
      main.removeEventListener("wheel", onUserInput);
      main.removeEventListener("touchmove", onUserInput);
      main.removeEventListener("keydown", onUserInput);
      if (raf) cancelAnimationFrame(raf);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [pathname]);

  return null;
}
