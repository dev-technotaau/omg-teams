"use client";

import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

// ──────────────────────────────────────────────
//  Offline Connectivity Banner
//  Shows status bar when network drops/returns
// ──────────────────────────────────────────────

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      // Defer setState to avoid synchronous call in effect body
      const timer = setTimeout(() => setShowReconnected(false), 0);
      return () => clearTimeout(timer);
    } else if (wasOfflineRef.current) {
      const showTimer = setTimeout(() => setShowReconnected(true), 0);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(timer);
      };
    }
  }, [isOnline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 right-0 left-0 z-9999 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 ${
        !isOnline ? "bg-warning-500 text-white" : "bg-success-500 text-white"
      } `}
    >
      {!isOnline ? (
        <>
          <WifiOff size={16} />
          <span>You&apos;re offline. Some features may be unavailable.</span>
        </>
      ) : (
        <>
          <Wifi size={16} />
          <span>You&apos;re back online!</span>
        </>
      )}
    </div>
  );
}
