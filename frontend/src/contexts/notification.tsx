"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { onForegroundMessage } from "@/lib/firebase";
import { useSocket } from "@/hooks/use-socket";
import type { ReactNode } from "react";
import type { NotificationData } from "@/types/notification";

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
  const [recent, setRecent] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Listen for real-time new notifications via Socket.IO
  useSocket<NotificationData>(
    "notification:new",
    useCallback((data: NotificationData) => {
      setRecent((prev) => [data, ...prev].slice(0, 20));
      toast.info(data.title, { description: data.message });
    }, []),
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

      // Refresh recent notifications to stay in sync
      void fetchRecent();
    });

    return () => {
      unsub?.();
    };
  }, [fetchRecent]);

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
