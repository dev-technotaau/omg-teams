"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, Trash2, CheckCheck, MailOpen } from "lucide-react";
import { api } from "@/lib/api";
import {
  PageHeader,
  Button,
  IconButton,
  Tooltip,
  EmptyState,
  ConfirmDialog,
  SearchInput,
  NotificationItem as NotificationItemUI,
  Checkbox,
} from "@/components/ui";
import type { NotificationData } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NOTIFICATION_CATEGORIES } from "@/constants/notification-categories";
import { NOTIFICATION_PAGE_SIZE } from "@/constants/pagination";
import { useLocalStorage, useDebounce } from "@/hooks";
import type { PaginatedNotifications } from "@/types/notification";

// §11.2.2 — Read/unread filter options
const READ_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useLocalStorage("notif-category-filter", "");
  const [readFilter, setReadFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(NOTIFICATION_PAGE_SIZE),
      };
      if (categoryFilter) params["category"] = categoryFilter;
      if (readFilter) params["readFilter"] = readFilter;
      if (debouncedSearch) params["search"] = debouncedSearch;
      const res = await api.get<PaginatedNotifications>("/notifications", { params });
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, categoryFilter, readFilter, debouncedSearch]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    void fetchData();
  };

  const markUnread = async (id: string) => {
    await api.patch(`/notifications/${id}/unread`);
    void fetchData();
  };

  const markAllRead = async () => {
    await api.patch("/notifications/read-all");
    void fetchData();
  };

  // §11.2.2 — Bulk actions for selected notifications
  const bulkMarkRead = async () => {
    await Promise.all([...selectedIds].map((id) => api.patch(`/notifications/${id}/read`)));
    setSelectedIds(new Set());
    void fetchData();
  };

  const bulkMarkUnread = async () => {
    await Promise.all([...selectedIds].map((id) => api.patch(`/notifications/${id}/unread`)));
    setSelectedIds(new Set());
    void fetchData();
  };

  const bulkDelete = async () => {
    await Promise.all([...selectedIds].map((id) => api.delete(`/notifications/${id}`)));
    setSelectedIds(new Set());
    void fetchData();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const clearAll = async () => {
    await api.delete("/notifications/clear-all");
    setShowClearConfirm(false);
    void fetchData();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={CheckCheck}
              onClick={() => void markAllRead()}
            >
              Mark All Read
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={Trash2}
              onClick={() => setShowClearConfirm(true)}
            >
              Clear All
            </Button>
          </>
        }
      />

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category Filter */}
        <div className="border-border-default bg-bg-muted flex w-fit gap-1 rounded-lg border p-1">
          {NOTIFICATION_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setCategoryFilter(cat.value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                categoryFilter === cat.value
                  ? "bg-bg-surface text-text-primary shadow-xs"
                  : "text-text-muted",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* §11.2.2 — Read/unread filter */}
        <div className="border-border-default bg-bg-muted flex gap-1 rounded-lg border p-1">
          {READ_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setReadFilter(opt.value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                readFilter === opt.value
                  ? "bg-bg-surface text-text-primary shadow-xs"
                  : "text-text-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* §11.2.2 — Search */}
        <SearchInput
          value={searchInput}
          onChange={(v) => {
            setSearchInput(v);
            setPage(1);
          }}
          placeholder="Search notifications..."
          historyKey="notifications"
          className="max-w-xs flex-1"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-muted h-16 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You are all caught up!" />
      ) : (
        <>
          {/* §11.2.2 — Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="border-primary-100 bg-primary-100/40 flex items-center gap-3 rounded-lg border px-4 py-2">
              <span className="text-text-primary text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                leftIcon={Check}
                onClick={() => void bulkMarkRead()}
              >
                Mark Read
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={MailOpen}
                onClick={() => void bulkMarkUnread()}
              >
                Mark Unread
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={Trash2}
                onClick={() => void bulkDelete()}
              >
                Delete
              </Button>
            </div>
          )}

          <div className="border-border-default overflow-hidden rounded-lg border">
            {/* Select all header */}
            <div className="border-border-default bg-bg-muted/50 flex items-center gap-3 border-b px-4 py-2">
              <Checkbox
                checked={selectedIds.size === notifications.length && notifications.length > 0}
                onChange={toggleSelectAll}
              />
              <span className="text-text-muted text-xs">
                {selectedIds.size > 0
                  ? `${selectedIds.size} of ${notifications.length} selected`
                  : "Select all"}
              </span>
            </div>
            {notifications.map((n) => (
              <div
                key={n.id}
                className="border-border-default flex items-start gap-2 border-b last:border-b-0"
              >
                <div className="flex shrink-0 items-center px-2 pt-4">
                  <Checkbox checked={selectedIds.has(n.id)} onChange={() => toggleSelect(n.id)} />
                </div>
                <div className="min-w-0 flex-1">
                  <NotificationItemUI
                    notification={n}
                    variant="full"
                    actions={
                      !n.isRead ? (
                        <Tooltip content="Mark as read">
                          <IconButton
                            icon={Check}
                            aria-label="Mark as read"
                            variant="ghost"
                            size="sm"
                            onClick={() => void markRead(n.id)}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip content="Mark as unread">
                          <IconButton
                            icon={MailOpen}
                            aria-label="Mark as unread"
                            variant="ghost"
                            size="sm"
                            onClick={() => void markUnread(n.id)}
                          />
                        </Tooltip>
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-text-muted text-xs">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="border-border-default rounded-sm border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="border-border-default rounded-sm border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* §11.2.2 — Clear All confirmation dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => void clearAll()}
        title="Clear All Notifications"
        description="Clear all notifications? They will be removed from your notification panel but remain in your notification history."
        confirmLabel="Clear All"
        variant="danger"
      />
    </div>
  );
}
