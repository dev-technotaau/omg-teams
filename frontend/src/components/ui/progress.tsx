"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type ProgressVariant = "primary" | "success" | "warning" | "danger";
export type ProgressSize = "sm" | "md" | "lg";

export interface ProgressProps {
  value?: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

const variantClasses: Record<ProgressVariant, string> = {
  primary: "bg-primary-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-error-500",
};

const sizeClasses: Record<ProgressSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

export function Progress({
  value,
  max = 100,
  variant = "primary",
  size = "md",
  showLabel = false,
  label,
  animated = false,
  className,
}: ProgressProps) {
  const isIndeterminate = value === undefined;
  const percentage = isIndeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const displayLabel = label || `${Math.round(percentage)}%`;

  return (
    <div className={cn("w-full", className)}>
      {showLabel && !isIndeterminate && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-text-secondary text-xs font-medium">{displayLabel}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={isIndeterminate ? "Loading" : displayLabel}
        className={cn("bg-bg-muted w-full overflow-hidden rounded-full", sizeClasses[size])}
      >
        {isIndeterminate ? (
          <div
            className={cn(
              "animate-indeterminate h-full w-1/3 rounded-full",
              variantClasses[variant],
            )}
            style={{
              animation: "indeterminate 1.5s ease-in-out infinite",
            }}
          />
        ) : (
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              variantClasses[variant],
              animated && "bg-stripes animate-stripes",
            )}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      <style jsx>{`
        @keyframes indeterminate {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(200%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .bg-stripes {
          background-image: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.2) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255, 255, 255, 0.2) 50%,
            rgba(255, 255, 255, 0.2) 75%,
            transparent 75%,
            transparent
          );
          background-size: 1rem 1rem;
        }
        .animate-stripes {
          animation: stripes 0.75s linear infinite;
        }
        @keyframes stripes {
          0% {
            background-position: 1rem 0;
          }
          100% {
            background-position: 0 0;
          }
        }
        .animate-indeterminate {
          animation: indeterminate 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
