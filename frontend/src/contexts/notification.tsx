"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { onForegroundMessage } from "@/lib/firebase";
import { useSocket } from "@/hooks/use-socket";
import {
  useAppDispatch,
  setUnreadCount,
  incrementUnreadCount,
} from "@/store/redux";
import { getUnreadCount } from "@/services/notification.service";
import type { ReactNode } from "react";
import type { NotificationData } from "@/types/notification";

const UNREAD_POLL_INTERVAL = 60_000; // 60 seconds

// ──────────────────────────────────────────────
//  Notification Context
//
//  Provides real-time notification state and
//  actions for the header bell + notifications page.
//  Handles both Socket.IO (in-app) and FCM (foreground push).
// ──────────────────────────────────────────────

interface NotificationContextValue {
  /** Recent notifications for the dropdown */
  recent: NotificationData[];
  /** Fetch latest notifications from API */
  fetchRecent: () => Promise<void>;
  /** Mark a single notification as read */
  markRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllRead: () => Promise<void>;
  /** Clear all notifications */
  clearAll: () => Promise<void>;
  /** Loading state */
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [recent, setRecent] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Source 1: REST polling (authoritative count) ──
  const syncUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      dispatch(setUnreadCount(count));
    } catch {
      // silent — don't spam on network errors
    }
  }, [dispatch]);

  useEffect(() => {
    // Fetch on mount
    void syncUnreadCount();

    // Poll every 60s
    const interval = setInterval(() => {
      void syncUnreadCount();
    }, UNREAD_POLL_INTERVAL);

    // Refresh on tab focus (user coming back)
    const onFocus = () => void syncUnreadCount();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncUnreadCount]);

  // ── Source 3 + 4: Service worker push messages → dispatch increment ──
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined;
      if (data?.type === "PUSH_RECEIVED" || data?.type === "FCM_BACKGROUND_RECEIVED") {
        // Re-sync to get authoritative count from server
        void syncUnreadCount();
      }
    };

    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    };
  }, [syncUnreadCount]);

  const fetchRecent = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ data: NotificationData[] }>("/notifications", {
        params: { limit: "20" }, // §11.2.1 — shows last 20-30 notifications
      });
      setRecent(res.data.data ?? []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // silent
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all");
      setRecent((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      toast.error("Failed to mark all as read");
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await api.delete("/notifications/clear-all");
      setRecent([]);
    } catch {
      toast.error("Failed to clear notifications");
    }
  }, []);

  // ── Source 2: Socket.IO real-time ──
  // A new notification arrived — bump local list + unread count optimistically
  useSocket<NotificationData>(
    "notification:new",
    useCallback(
      (data: NotificationData) => {
        setRecent((prev) => [data, ...prev].slice(0, 20));
        dispatch(incrementUnreadCount());
        toast.info(data.title, { description: data.message });
      },
      [dispatch],
    ),
  );

  // Backend also pushes authoritative unread-count on mark-as-read/delete events
  useSocket<{ unreadCount: number }>(
    "notification:count",
    useCallback(
      (data: { unreadCount: number }) => {
        dispatch(setUnreadCount(data.unreadCount));
      },
      [dispatch],
    ),
  );

  // Listen for foreground FCM messages (when tab IS focused)
  // These arrive via Firebase Messaging when the app is in the foreground.
  // Background messages are handled by the service worker (firebase-messaging-sw.js).
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? payload.data?.title ?? "New Notification";
      const body = payload.notification?.body ?? payload.data?.body ?? "";

      // Show toast for foreground FCM messages
      // (Socket.IO will typically deliver the same notification first,
      //  but FCM can arrive when Socket.IO is disconnected)
      toast.info(title, { description: body });

      // Optimistically bump unread count, then re-sync to get authoritative value
      dispatch(incrementUnreadCount());
      void syncUnreadCount();

      // Refresh recent notifications to stay in sync
      void fetchRecent();
    });

    return () => {
      unsub?.();
    };
  }, [fetchRecent, dispatch, syncUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{ recent, fetchRecent, markRead, markAllRead, clearAll, isLoading }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
