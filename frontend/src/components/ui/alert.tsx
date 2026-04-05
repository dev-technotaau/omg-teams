"use client";

import React from "react";
import { Info, CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

const variantConfig: Record<
  AlertVariant,
  { containerClass: string; iconClass: string; titleClass: string; defaultIcon: LucideIcon }
> = {
  info: {
    containerClass: "border-l-4 border-primary-500 bg-primary-100",
    iconClass: "text-primary-500",
    titleClass: "text-primary-600",
    defaultIcon: Info,
  },
  success: {
    containerClass: "border-l-4 border-success-500 bg-success-100",
    iconClass: "text-success-500",
    titleClass: "text-success-700",
    defaultIcon: CheckCircle,
  },
  warning: {
    containerClass: "border-l-4 border-warning-500 bg-warning-100",
    iconClass: "text-warning-500",
    titleClass: "text-warning-700",
    defaultIcon: AlertTriangle,
  },
  error: {
    containerClass: "border-l-4 border-error-500 bg-error-100",
    iconClass: "text-error-500",
    titleClass: "text-error-700",
    defaultIcon: XCircle,
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  dismissible = false,
  onDismiss,
  icon,
  actions,
  className,
}: AlertProps) {
  const config = variantConfig[variant];
  const Icon = icon || config.defaultIcon;

  return (
    <div role="alert" className={cn("relative rounded-md p-4", config.containerClass, className)}>
      <div className="flex gap-3">
        <div className={cn("mt-0.5 shrink-0", config.iconClass)}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          {title && <h3 className={cn("text-sm font-semibold", config.titleClass)}>{title}</h3>}
          {children && (
            <div className={cn("text-text-secondary text-sm", title && "mt-1")}>{children}</div>
          )}
          {actions && <div className="mt-3 flex gap-2">{actions}</div>}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-text-muted hover:text-text-primary focus-visible:ring-primary-500 shrink-0 rounded-md p-1 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:outline-hidden"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
