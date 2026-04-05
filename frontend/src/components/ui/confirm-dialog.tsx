"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * Custom Confirmation Dialog. Spec Section 30.4
 * - Custom-styled modal (not browser native)
 * - Clear title, body, consequence
 * - Cancel + destructive button
 * - Escape = cancel, Enter ≠ confirm
 * - Loading state during async action
 */

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, onClose]);

  // Escape = cancel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus cancel button on open
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const confirmColors = {
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
        <p className="text-text-secondary mt-2 text-sm">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={isLoading}
            className="border-border-default text-text-secondary hover:bg-bg-hover rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={isLoading}
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
