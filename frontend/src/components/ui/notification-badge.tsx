"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface NotificationBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function NotificationBadge({ count, max = 99, className }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const display = count > max ? `${max}+` : String(count);

  return (
    <span
      aria-label={`${count} notifications`}
      className={cn(
        "absolute -top-1.5 -right-1.5 z-10",
        "inline-flex items-center justify-center",
        "h-[18px] min-w-[18px] rounded-full px-1",
        "bg-error-500 text-[10px] leading-none font-bold text-white",
        "animate-badge-in pointer-events-none",
        className,
      )}
    >
      {display}
      <style jsx>{`
        @keyframes badge-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-badge-in {
          animation: badge-in 0.2s ease-out forwards;
        }
      `}</style>
    </span>
  );
}
