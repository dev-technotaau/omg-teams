"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { useFirebasePresence } from "@/hooks/use-firebase-presence";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { registerMessagingSW } from "@/lib/firebase";

/**
 * §23.15.3 — Establishes Firebase presence on mount for the authenticated user.
 * Sets online: true in RTDB, registers onDisconnect handler,
 * syncs to Firestore for queryable presence.
 * Also registers FCM service worker and manages push notification tokens.
 * Renders nothing — purely a side-effect provider.
 */
export function FirebasePresenceProvider() {
  const { user } = useAuth();

  useFirebasePresence(user?.id, user?.role, undefined);

  // Manage push notification token lifecycle (register/unregister)
  usePushNotifications(user?.id);

  // Register FCM service worker once on mount (client-side only)
  useEffect(() => {
    void registerMessagingSW();
  }, []);

  return null;
}
