"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { useSocket } from "@/hooks/use-socket";

// ──────────────────────────────────────────────
//  Presence Hook — Spec Section 23.15
//
//  Primary: Firebase Firestore (real-time onSnapshot)
//  Fallback: Redis presence via API + Socket.IO events
// ──────────────────────────────────────────────

export type PresenceStatus = "online" | "idle" | "offline";

interface PresenceUpdate {
  userId: string;
  status: PresenceStatus;
}

export interface PresenceData {
  status: PresenceStatus;
  lastActiveAt: Date | null;
}

/**
 * Track presence for a set of user IDs.
 * Uses Firebase Firestore if available, falls back to Redis API + Socket.IO.
 * Returns a map of userId → { status, lastActiveAt }.
 */
export function usePresence(userIds: string[]) {
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceData>>({});

  // §23.15.4 — Primary: Firebase Firestore real-time presence
  useEffect(() => {
    if (!env.hasFirebase || userIds.length === 0) return;

    let cancelled = false;

    void (async () => {
      try {
        const { collection, query, where, onSnapshot } = await import("firebase/firestore");
        const { getFirestoreDb } = await import("@/lib/firebase");
        const fs = getFirestoreDb();

        // Firestore 'in' query max 30 items
        const chunks: string[][] = [];
        for (let i = 0; i < userIds.length; i += 30) {
          chunks.push(userIds.slice(i, i + 30));
        }

        const unsubs: (() => void)[] = [];

        for (const chunk of chunks) {
          const q = query(collection(fs, "userPresence"), where("__name__", "in", chunk));
          const unsub = onSnapshot(q, (snapshot) => {
            if (cancelled) return;
            setPresenceMap((prev) => {
              const next = { ...prev };
              snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const isOnline = Boolean(data["isOnline"]);
                const lastActiveAt = data["lastActiveAt"]?.toDate?.() ?? null;

                // Determine status from Firestore data
                let status: PresenceStatus = "offline";
                if (isOnline) {
                  // Check if idle (no activity in last 5 min)
                  if (lastActiveAt && Date.now() - lastActiveAt.getTime() > 5 * 60_000) {
                    status = "idle";
                  } else {
                    status = "online";
                  }
                }

                next[docSnap.id] = { status, lastActiveAt };
              });
              return next;
            });
          });
          unsubs.push(unsub);
        }

        return () => {
          cancelled = true;
          unsubs.forEach((u) => u());
        };
      } catch {
        // Firebase not available — will fall through to Redis fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: Redis API for initial presence (when Firebase unavailable)
  useEffect(() => {
    if (env.hasFirebase || userIds.length === 0) return;
    void (async () => {
      try {
        const res = await api.post<Record<string, { status: PresenceStatus }>>("/presence/bulk", {
          userIds,
        });
        const map: Record<string, PresenceData> = {};
        for (const [id, data] of Object.entries(res.data)) {
          map[id] = { status: data.status, lastActiveAt: null };
        }
        setPresenceMap(map);
      } catch {
        // silent
      }
    })();
  }, [userIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: Socket.IO events for real-time updates
  useSocket<PresenceUpdate>(
    "presence:update",
    useCallback((data: PresenceUpdate) => {
      setPresenceMap((prev) => ({
        ...prev,
        [data.userId]: { status: data.status, lastActiveAt: new Date() },
      }));
    }, []),
  );

  return presenceMap;
}

/**
 * Get the CSS class for a presence status dot.
 */
export function getPresenceDotClass(status: PresenceStatus): string {
  switch (status) {
    case "online":
      return "bg-success-500";
    case "idle":
      return "bg-warning-500";
    case "offline":
      return "bg-text-muted";
  }
}
