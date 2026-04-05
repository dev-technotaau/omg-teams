"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, RefreshCw } from "lucide-react";

// ──────────────────────────────────────────────
//  §24.19.1 — PWA Install Prompt + Update Toast
// ──────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);

  // §24.19.1 — Capture beforeinstallprompt for install banner
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

  // §24.19.1 — Detect service worker update for update toast
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const checkUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
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
    sessionStorage.setItem("pwa_install_dismissed", "1");
  }, []);

  const handleUpdate = useCallback(() => {
    setShowUpdate(false);
    window.location.reload();
  }, []);

  return (
    <>
      {/* Install Banner */}
      {showInstall && (
        <div className="bg-primary-50 border-primary-200 fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border p-4 shadow-lg">
          <Download size={20} className="text-primary-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-primary-900 text-sm font-medium">Install OMG Teams</p>
            <p className="text-primary-700 text-xs">For a faster experience</p>
          </div>
          <button
            onClick={() => void handleInstall()}
            className="bg-primary-600 hover:bg-primary-700 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-white"
          >
            Install
          </button>
          <button
            onClick={handleDismissInstall}
            className="text-primary-500 hover:text-primary-700 shrink-0"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Update Toast */}
      {showUpdate && (
        <div className="bg-info-50 border-info-200 fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border p-4 shadow-lg">
          <RefreshCw size={20} className="text-info-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-info-900 text-sm font-medium">Update available</p>
            <p className="text-info-700 text-xs">A new version is ready</p>
          </div>
          <button
            onClick={handleUpdate}
            className="bg-info-600 hover:bg-info-700 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-white"
          >
            Refresh
          </button>
        </div>
      )}
    </>
  );
}
