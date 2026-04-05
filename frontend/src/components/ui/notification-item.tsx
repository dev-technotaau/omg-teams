"use client";

import { Badge } from "./badge";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Shared Notification Item — Used in header dropdown & notifications page
// ──────────────────────────────────────────────

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: NotificationData;
  /** compact = header dropdown, full = notifications page */
  variant?: "compact" | "full";
  onClick?: () => void;
  actions?: React.ReactNode;
}

export function NotificationItem({
  notification: n,
  variant = "full",
  onClick,
  actions,
}: NotificationItemProps) {
  const isCompact = variant === "compact";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter") onClick();
            }
          : undefined
      }
      className={cn(
        "border-border-default hover:bg-bg-hover flex w-full flex-col gap-0.5 border-b px-4 text-left transition-colors",
        isCompact ? "py-3" : "py-4",
        !n.isRead && "bg-primary-50",
        onClick && "cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-text-primary font-medium", isCompact ? "text-sm" : "text-sm")}>
          {n.title}
        </span>
        <div className="flex items-center gap-2">
          {!n.isRead && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
          {actions}
        </div>
      </div>

      <span className={cn("text-text-muted", isCompact ? "line-clamp-1 text-xs" : "text-sm")}>
        {n.message}
      </span>

      <div className="mt-0.5 flex items-center gap-2">
        {n.type && !isCompact && (
          <Badge variant="outline" size="sm">
            {n.type.replace("_", " ")}
          </Badge>
        )}
        <span className={cn("text-text-muted", isCompact ? "text-[10px]" : "text-xs")}>
          {new Date(n.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            ...(isCompact ? {} : { year: "numeric", hour: "2-digit", minute: "2-digit" }),
          })}
        </span>
      </div>
    </div>
  );
}
