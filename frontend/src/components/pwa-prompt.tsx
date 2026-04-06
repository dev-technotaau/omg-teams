"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, RefreshCw, Share } from "lucide-react";

// ──────────────────────────────────────────────
//  §24.19.1 — PWA Install Prompt + Update Toast
// ──────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Detect iOS Safari (no beforeinstallprompt support) */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

/** Detect if already running as installed PWA */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  );
}

export function PWAPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);

  // §24.19.1 — Capture beforeinstallprompt for install banner (Chromium)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show install banner once per session
      if (!sessionStorage.getItem("pwa_install_dismissed")) {
        setShowInstall(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // §24.19.1 — iOS Safari: show manual "Add to Home Screen" prompt
  useEffect(() => {
    if (isIOS() && !isStandalone() && !sessionStorage.getItem("pwa_install_dismissed")) {
      setShowIOSInstall(true);
    }
  }, []);

  // §24.19.1 — Detect service worker update for update toast
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    // When the controller changes (new SW took over), reload the page once
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const checkUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // Case A: a waiting worker already exists when we mounted
        if (registration.waiting && navigator.serviceWorker.controller) {
          setShowUpdate(true);
        }

        // Case B: a new worker appears later during this session
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // Only show the banner if the page is currently controlled by an
            // OLDER SW. On first-ever install there's no controller — nothing
            // to "update" from, so we stay silent.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setShowUpdate(true);
            }
          });
        });
      } catch {
        // non-critical
      }
    };
    void checkUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
    }
    setInstallPrompt(null);
  }, [installPrompt]);

  const handleDismissInstall = useCallback(() => {
    setShowInstall(false);
    setShowIOSInstall(false);
    sessionStorage.setItem("pwa_install_dismissed", "1");
  }, []);

  const handleUpdate = useCallback(async () => {
    setShowUpdate(false);
    if (!("serviceWorker" in navigator)) {
      window.location.reload();
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const waiting = registration?.waiting;
      if (waiting) {
        // Tell the waiting worker to activate. The controllerchange listener
        // set up in the useEffect above will then reload the page.
        waiting.postMessage({ type: "SKIP_WAITING" });
      } else {
        // No waiting worker (shouldn't happen — banner was shown) — just reload
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, []);

  // If nothing to show, render nothing (skip the fixed container too)
  if (!showInstall && !showIOSInstall && !showUpdate) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col gap-3 sm:left-auto sm:max-w-sm">
      {/* Install Banner — Chromium (Android, Desktop) */}
      {showInstall && (
        <div className="bg-primary-50 border-primary-200 hover:border-primary-300 pointer-events-auto flex items-center gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl">
          <Download size={20} className="text-primary-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-primary-900 text-sm font-medium">Install OMG Teams</p>
            <p className="text-primary-700 text-xs">For a faster experience</p>
          </div>
          <button
            onClick={() => void handleInstall()}
            className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
          >
            Install
          </button>
          <button
            onClick={handleDismissInstall}
            className="text-primary-500 hover:bg-primary-100 hover:text-primary-700 active:bg-primary-200 shrink-0 cursor-pointer rounded-md p-1 transition-all duration-200 hover:scale-110"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Install Banner — iOS Safari */}
      {showIOSInstall && (
        <div className="bg-primary-50 border-primary-200 hover:border-primary-300 pointer-events-auto flex items-center gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl">
          <Share size={20} className="text-primary-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-primary-900 text-sm font-medium">Install OMG Teams</p>
            <p className="text-primary-700 text-xs">
              Tap <Share size={12} className="inline" /> then &quot;Add to Home Screen&quot;
            </p>
          </div>
          <button
            onClick={handleDismissInstall}
            className="text-primary-500 hover:bg-primary-100 hover:text-primary-700 active:bg-primary-200 shrink-0 cursor-pointer rounded-md p-1 transition-all duration-200 hover:scale-110"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Update Toast */}
      {showUpdate && (
        <div className="bg-info-50 border-info-200 hover:border-info-300 pointer-events-auto flex items-center gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl">
          <RefreshCw size={20} className="text-info-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-info-900 text-sm font-medium">Update available</p>
            <p className="text-info-700 text-xs">A new version is ready</p>
          </div>
          <button
            onClick={() => void handleUpdate()}
            className="bg-info-600 hover:bg-info-700 active:bg-info-800 shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
