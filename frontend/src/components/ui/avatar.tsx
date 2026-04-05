"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getInitials as getInitialsUtil } from "@/utils/format";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "busy" | "away";
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const statusSizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-1.5 w-1.5 border",
  sm: "h-2 w-2 border",
  md: "h-2.5 w-2.5 border-2",
  lg: "h-3 w-3 border-2",
  xl: "h-4 w-4 border-2",
};

const statusColorClasses: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-success-500",
  offline: "bg-gray-400",
  busy: "bg-error-500",
  away: "bg-warning-500",
};

const bgPalette = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-pink-500",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const getInitials = getInitialsUtil;

export function Avatar({ src, alt, name, size = "md", status, className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;
  const initials = name ? getInitials(name) : "?";
  const bgClass = name ? bgPalette[hashName(name) % bgPalette.length] : "bg-gray-400";

  return (
    <span
      className={cn("relative inline-flex shrink-0", sizeClasses[size], className)}
      role="img"
      aria-label={alt || name || "Avatar"}
    >
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt || name || "Avatar"}
          onError={() => setImgError(true)}
          className={cn("h-full w-full rounded-full object-cover", sizeClasses[size])}
        />
      ) : (
        <span
          className={cn(
            "inline-flex h-full w-full items-center justify-center rounded-full font-medium text-white select-none",
            bgClass,
          )}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      {status && (
        <span
          className={cn(
            "border-bg-surface absolute right-0 bottom-0 rounded-full",
            statusSizeClasses[size],
            statusColorClasses[status],
          )}
          aria-label={status}
        />
      )}
    </span>
  );
}
