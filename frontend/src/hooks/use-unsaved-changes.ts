import { useEffect } from "react";

/**
 * §5.3 / §6.1.1 — Warn user about unsaved changes on navigation.
 * Covers both browser navigation (beforeunload) and in-app navigation
 * (popstate for back/forward, and beforeunload for tab close).
 *
 * Next.js App Router doesn't support route-level guards natively,
 * so this hook uses beforeunload + popstate interception.
 */
export function useUnsavedChanges(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Browser tab close / hard navigate
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    // Browser back/forward button
    const handlePopState = () => {
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          "You have unsaved changes. Are you sure you want to leave?",
        );
        if (!confirmed) {
          // Push state back to prevent navigation
          window.history.pushState(null, "", window.location.href);
        }
      }
    };

    // Push a dummy state so popstate fires on back
    window.history.pushState(null, "", window.location.href);

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasUnsavedChanges]);
}
