"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { requestFCMToken } from "@/lib/firebase";
import { registerPushToken, unregisterPushToken } from "@/services/notification.service";
import { getDeviceId } from "@/lib/device-id";

// ──────────────────────────────────────────────
//  usePushNotifications Hook
//
//  Manages the full lifecycle of browser push notifications:
//  1. Requests notification permission from the user
//  2. Retrieves FCM token from Firebase
//  3. Registers the token with the backend
//  4. Auto-refreshes on token change
//  5. Cleans up on unmount / logout
// ──────────────────────────────────────────────

export type PushPermission = "default" | "granted" | "denied";

interface UsePushNotificationsReturn {
  /** Current browser notification permission state */
  permission: PushPermission;
  /** Whether push notifications are currently enabled (token registered) */
  isEnabled: boolean;
  /** Whether the hook is currently requesting permission / registering */
  isLoading: boolean;
  /** Request permission and enable push notifications */
  enable: () => Promise<boolean>;
  /** Disable push notifications (unregister token) */
  disable: () => Promise<void>;
}

export function usePushNotifications(userId: string | undefined): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "default";
    return Notification.permission as PushPermission;
  });
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentTokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);

  // Auto-register if permission was already granted and user is authenticated
  useEffect(() => {
    if (!userId) return;
    if (permission !== "granted") return;
    if (registeredRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        const token = await requestFCMToken();
        if (cancelled || !token) return;

        // Only register if token changed
        if (token !== currentTokenRef.current) {
          await registerPushToken({
            endpoint: token,
            type: "FCM",
            deviceId: getDeviceId(),
          });
          currentTokenRef.current = token;
        }
        registeredRef.current = true;
        setIsEnabled(true);
      } catch (err) {
        console.warn("Auto push registration failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, permission]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    setIsLoading(true);

    try {
      // Step 1: Request browser permission
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);

      if (result !== "granted") {
        setIsLoading(false);
        return false;
      }

      // Step 2: Get FCM token
      const token = await requestFCMToken();
      if (!token) {
        setIsLoading(false);
        return false;
      }

      // Step 3: Register with backend
      await registerPushToken({
        endpoint: token,
        type: "FCM",
        deviceId: getDeviceId(),
      });

      currentTokenRef.current = token;
      registeredRef.current = true;
      setIsEnabled(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("Failed to enable push notifications:", err);
      setIsLoading(false);
      return false;
    }
  }, []);

  const disable = useCallback(async () => {
    if (!currentTokenRef.current) return;

    try {
      await unregisterPushToken(currentTokenRef.current);
    } catch {
      // Ignore — token may already be removed
    }

    currentTokenRef.current = null;
    registeredRef.current = false;
    setIsEnabled(false);
  }, []);

  return { permission, isEnabled, isLoading, enable, disable };
}
