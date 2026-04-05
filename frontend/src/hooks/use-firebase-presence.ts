"use client";

import { useEffect, useRef } from "react";
import { ref, onValue, set, onDisconnect, serverTimestamp } from "firebase/database";
import { doc, setDoc, serverTimestamp as firestoreTimestamp } from "firebase/firestore";
import { getRealtimeDb, getFirestoreDb } from "@/lib/firebase";
import { env } from "@/lib/env";
import { getDeviceId } from "@/lib/device-id";

// ──────────────────────────────────────────────
//  §23.15.3 — Firebase Presence System
//
//  Uses Firebase Realtime Database for connection
//  state detection (.info/connected + onDisconnect)
//  and Firestore for queryable persistence.
// ──────────────────────────────────────────────

/**
 * Establish Firebase presence for the authenticated user.
 * Call this once on login / app mount with the user's info.
 *
 * - Sets online: true in RTDB on connect
 * - Sets online: false via onDisconnect() when tab closes / network drops
 * - Syncs presence to Firestore for Admin/RM queries
 */
export function useFirebasePresence(
  userId: string | undefined,
  role: string | undefined,
  assignedManagerIds?: string[],
) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId || !role || !env.hasFirebase) return;

    const rtdb = getRealtimeDb();
    const fs = getFirestoreDb();
    const deviceId = getDeviceId();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

    // §23.15.3 — RTDB presence path
    const presenceRef = ref(rtdb, `/presence/${userId}`);
    const connectedRef = ref(rtdb, ".info/connected");

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // User is connected — set online
        const presenceData = {
          online: true,
          lastActiveAt: serverTimestamp(),
          connectedAt: serverTimestamp(),
          metadata: {
            role,
            deviceId,
            userAgent,
          },
        };

        void set(presenceRef, presenceData);

        // §23.15.3 — When disconnected (tab close, network drop) — automatically set offline
        void onDisconnect(presenceRef).set({
          online: false,
          lastActiveAt: serverTimestamp(),
          connectedAt: null,
          metadata: {
            role,
            deviceId,
            userAgent,
          },
        });

        // §23.15.4 — Sync to Firestore for queryable persistence
        void setDoc(
          doc(fs, "userPresence", userId),
          {
            isOnline: true,
            lastActiveAt: firestoreTimestamp(),
            lastLoginAt: firestoreTimestamp(),
            role,
            assignedManagerIds: assignedManagerIds ?? [],
          },
          { merge: true },
        );
      }
    });

    cleanupRef.current = () => {
      unsubscribe();
      // Set offline in RTDB on cleanup (component unmount / logout)
      void set(presenceRef, {
        online: false,
        lastActiveAt: serverTimestamp(),
        connectedAt: null,
        metadata: { role, deviceId, userAgent },
      });
      // Sync offline to Firestore
      void setDoc(
        doc(fs, "userPresence", userId),
        { isOnline: false, lastActiveAt: firestoreTimestamp() },
        { merge: true },
      );
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [userId, role, assignedManagerIds]);
}

/**
 * §23.15.6 — Format lastActiveAt as human-readable relative time.
 * "Active now", "Last active 5 minutes ago", "Last active 2 days ago", etc.
 */
export function formatLastActive(lastActiveAt: Date | string | null | undefined): string {
  if (!lastActiveAt) return "Never";
  const ts = typeof lastActiveAt === "string" ? new Date(lastActiveAt) : lastActiveAt;
  const now = Date.now();
  const diffMs = now - ts.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Active now";
  if (diffMin < 60) return `Last active ${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `Last active ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `Last active ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return `Last active on ${ts.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}
