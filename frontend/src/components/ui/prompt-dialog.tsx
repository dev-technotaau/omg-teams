"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * Custom Prompt Dialog — replaces window.prompt().
 * Shows a modal with a text input, optional description, and confirm/cancel buttons.
 */

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
  title: string;
  description?: string;
  /** Input label */
  inputLabel?: string;
  /** Input placeholder */
  placeholder?: string;
  /** Pre-filled value */
  defaultValue?: string;
  /** Input type */
  inputType?: "text" | "email" | "number" | "search";
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "warning" | "default";
  /** Validate input — return error string or null */
  validate?: (value: string) => string | null;
}

export function PromptDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  inputLabel,
  placeholder = "",
  defaultValue = "",
  inputType = "text",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  validate,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, defaultValue]);

  const handleConfirm = useCallback(async () => {
    if (!value.trim()) {
      setError("This field is required");
      return;
    }
    if (validate) {
      const err = validate(value.trim());
      if (err) {
        setError(err);
        return;
      }
    }
    setIsLoading(true);
    try {
      await onConfirm(value.trim());
      onClose();
    } catch {
      /* stay open on error */
    } finally {
      setIsLoading(false);
    }
  }, [value, validate, onConfirm, onClose]);

  // Escape = cancel, Enter = confirm
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const confirmColors: Record<string, string> = {
    primary: "bg-primary-500 hover:bg-primary-600 text-white",
    danger: "bg-error-500 hover:bg-error-700 text-white",
    warning: "bg-warning-500 hover:bg-warning-700 text-white",
    default: "bg-primary-500 hover:bg-primary-600 text-white",
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      {/* Backdrop */}
      <div className="bg-bg-overlay absolute inset-0" onClick={onClose} />

      {/* Dialog */}
      <div className="animate-fade-in border-border-default bg-bg-surface-raised relative z-10 w-full max-w-md rounded-lg border p-6 shadow-xl">
        <h2 className="text-text-primary text-lg font-semibold">{title}</h2>
        {description && <p className="text-text-secondary mt-2 text-sm">{description}</p>}

        <div className="mt-4">
          {inputLabel && (
            <label
              htmlFor="prompt-input"
              className="text-text-secondary mb-1.5 block text-sm font-medium"
            >
              {inputLabel}
            </label>
          )}
          <input
            ref={inputRef}
            id="prompt-input"
            type={inputType}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConfirm();
            }}
            placeholder={placeholder}
            disabled={isLoading}
            className={cn(
              "border-border-default bg-bg-input text-text-primary h-10 w-full rounded-md border px-3 text-sm transition-colors",
              "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-error-500 focus:border-error-500 focus:ring-error-500",
            )}
          />
          {error && (
            <p role="alert" className="text-error-500 mt-1 text-xs">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="border-border-default text-text-secondary hover:bg-bg-hover rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={isLoading || !value.trim()}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50",
              confirmColors[variant],
            )}
          >
            {isLoading && <Spinner size="sm" className="border-white border-t-transparent" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
