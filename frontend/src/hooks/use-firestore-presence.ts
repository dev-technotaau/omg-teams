"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, type DocumentData } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { env } from "@/lib/env";

// ──────────────────────────────────────────────
//  §23.15.4 — Read presence from Firestore
//
//  Provides real-time online/offline status + lastActiveAt
//  for Admin (all users) and RM (assigned recruiters).
// ──────────────────────────────────────────────

export interface FirestorePresence {
  isOnline: boolean;
  lastActiveAt: Date | null;
  role: string;
}

/**
 * Subscribe to Firestore presence for a list of user IDs.
 * Returns a map of userId → { isOnline, lastActiveAt, role }.
 * Updates in real-time via Firestore onSnapshot.
 */
export function useFirestorePresence(userIds: string[]) {
  const [presenceMap, setPresenceMap] = useState<Record<string, FirestorePresence>>({});

  useEffect(() => {
    if (!env.hasFirebase || userIds.length === 0) return;

    const fs = getFirestoreDb();
    // Firestore 'in' query supports max 30 items per query
    const chunks: string[][] = [];
    for (let i = 0; i < userIds.length; i += 30) {
      chunks.push(userIds.slice(i, i + 30));
    }

    const unsubscribes: (() => void)[] = [];

    for (const chunk of chunks) {
      const q = query(collection(fs, "userPresence"), where("__name__", "in", chunk));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          setPresenceMap((prev) => {
            const next = { ...prev };
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as DocumentData;
              next[docSnap.id] = {
                isOnline: Boolean(data["isOnline"]),
                lastActiveAt: data["lastActiveAt"]?.toDate?.() ?? null,
                role: String(data["role"] ?? ""),
              };
            });
            return next;
          });
        },
        (err) => {
          console.error("Firestore presence subscription error:", err);
        },
      );
      unsubscribes.push(unsub);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [userIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return presenceMap;
}

/**
 * §23.15.4 — Subscribe to all online users (Admin view).
 * Uses Firestore query: where('isOnline', '==', true)
 */
export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{ userId: string; role: string; lastActiveAt: Date | null }>
  >([]);

  useEffect(() => {
    if (!env.hasFirebase) return;

    const fs = getFirestoreDb();
    const q = query(collection(fs, "userPresence"), where("isOnline", "==", true));

    const unsub = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map((d) => {
        const data = d.data() as DocumentData;
        return {
          userId: d.id,
          role: String(data["role"] ?? ""),
          lastActiveAt: data["lastActiveAt"]?.toDate?.() ?? null,
        };
      });
      setOnlineUsers(users);
    });

    return unsub;
  }, []);

  return onlineUsers;
}

/**
 * §23.15.4 — Subscribe to online recruiters under a specific RM.
 * Uses Firestore query: where('assignedManagerIds', 'array-contains', rmId)
 */
export function useRMOnlineRecruiters(rmId: string | undefined) {
  const [recruiters, setRecruiters] = useState<
    Array<{ userId: string; isOnline: boolean; lastActiveAt: Date | null }>
  >([]);

  useEffect(() => {
    if (!env.hasFirebase || !rmId) return;

    const fs = getFirestoreDb();
    const q = query(
      collection(fs, "userPresence"),
      where("assignedManagerIds", "array-contains", rmId),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const docData = d.data() as DocumentData;
        return {
          userId: d.id,
          isOnline: Boolean(docData["isOnline"]),
          lastActiveAt: docData["lastActiveAt"]?.toDate?.() ?? null,
        };
      });
      setRecruiters(data);
    });

    return unsub;
  }, [rmId]);

  return recruiters;
}
