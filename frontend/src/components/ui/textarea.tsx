"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  resize?: "none" | "vertical" | "both";
}

const resizeClasses: Record<string, string> = {
  none: "resize-none",
  vertical: "resize-y",
  both: "resize",
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, helpText, resize = "vertical", className, id, disabled, rows = 3, ...props },
    ref,
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-text-secondary mb-1.5 block text-sm font-medium"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${textareaId}-error` : helpText ? `${textareaId}-help` : undefined
          }
          className={cn(
            "bg-bg-input text-text-primary placeholder:text-text-muted w-full rounded-md px-3 py-2 text-sm",
            "border-border-default border transition-colors",
            "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
            "disabled:cursor-not-allowed disabled:opacity-50",
            resizeClasses[resize],
            error && "border-error-500 focus:border-error-500 focus:ring-error-500",
            className,
          )}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} role="alert" className="text-error-500 mt-1 text-xs">
            {error}
          </p>
        )}
        {!error && helpText && (
          <p id={`${textareaId}-help`} className="text-text-muted mt-1 text-xs">
            {helpText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
