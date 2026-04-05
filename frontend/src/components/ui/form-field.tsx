import React from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  helpText?: string;
  /** §23.18 — Info tooltip shown as ℹ️ icon next to the label */
  tooltip?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  helpText,
  tooltip,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-text-secondary mb-1.5 flex items-center gap-1 text-sm font-medium"
        >
          {label}
          {required && (
            <span className="text-error-500 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
          {tooltip && (
            <Tooltip content={tooltip} side="top">
              <span
                className="text-text-muted cursor-help text-xs"
                aria-label="Info"
                tabIndex={0}
                role="img"
              >
                ℹ️
              </span>
            </Tooltip>
          )}
        </label>
      )}
      {children}
      {error && (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="text-error-500 mt-1 text-xs"
        >
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={htmlFor ? `${htmlFor}-help` : undefined} className="text-text-muted mt-1 text-xs">
          {helpText}
        </p>
      )}
    </div>
  );
}
