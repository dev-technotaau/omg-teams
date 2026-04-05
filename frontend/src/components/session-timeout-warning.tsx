"use client";

import { useAuth } from "@/contexts/auth";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

// ──────────────────────────────────────────────
//  Session Timeout Warning — Spec §25.3
//
//  Shows a modal 5 minutes before session expires
//  due to inactivity. User can click "Stay Logged In"
//  to send keep-alive and reset the timer.
// ──────────────────────────────────────────────

export function SessionTimeoutWarning() {
  const { logout, user } = useAuth();
  const router = useRouter();

  const handleExpired = useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  const { showWarning, secondsRemaining, stayLoggedIn } = useSessionTimeout({
    enabled: !!user,
    onExpired: handleExpired,
  });

  if (!showWarning) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay =
    minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Session Expiring Soon</h2>
        <p className="mb-4 text-sm text-gray-600">
          Your session will expire in{" "}
          <span className="font-mono font-bold text-amber-600">{timeDisplay}</span> due to
          inactivity. Click below to stay logged in.
        </p>
        <div className="flex gap-3">
          <button
            onClick={stayLoggedIn}
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 flex-1 rounded-md px-4 py-2 text-sm font-medium text-white focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
          >
            Stay Logged In
          </button>
          <button
            onClick={handleExpired}
            className="focus:ring-primary-500 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
