// ──────────────────────────────────────────────
//  Notification Types
// ──────────────────────────────────────────────

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  /** NotificationCategory enum from backend (DOCUMENT, LEAVE, ATTENDANCE, etc.) */
  type: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: NotificationData[];
  unreadCount: number;
  pagination?: {
    page: number;
    total: number;
    totalPages: number;
  };
}
