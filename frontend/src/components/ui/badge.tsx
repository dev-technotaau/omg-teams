"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  removable?: boolean;
  onRemove?: () => void;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-bg-muted text-text-secondary",
  primary: "bg-primary-100 text-primary-500",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-error-100 text-error-700",
  info: "bg-info-100 text-info-700",
  outline: "border border-border-default text-text-secondary",
};

const dotColorClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-text-secondary",
  primary: "bg-primary-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-error-500",
  info: "bg-info-500",
  outline: "bg-text-secondary",
};

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

export function Badge({
  variant = "default",
  size = "md",
  dot = false,
  children,
  className,
  removable = false,
  onRemove,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full leading-none font-medium whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", dotColorClasses[variant])}
          aria-hidden="true"
        />
      )}
      {children}
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="focus:ring-border-focus ml-0.5 inline-flex shrink-0 items-center justify-center rounded-full p-0.5 hover:opacity-70 focus:ring-1 focus:outline-hidden"
          aria-label="Remove"
        >
          <X size={size === "sm" ? 10 : 12} />
        </button>
      )}
    </span>
  );
}
