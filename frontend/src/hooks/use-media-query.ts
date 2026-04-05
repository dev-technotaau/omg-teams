import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

/**
 * Subscribe to a CSS media query. Returns true when the query matches.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // SSR fallback
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}
