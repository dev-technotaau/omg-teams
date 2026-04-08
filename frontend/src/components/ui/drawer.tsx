"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "left" | "right";
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<DrawerProps["size"]>, string> = {
  sm: "w-80",
  md: "w-96",
  lg: "w-[32rem]",
};

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
  size = "md",
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // Auto-focus and restore
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const focusable = drawerRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])',
        );
        focusable?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  if (!open || typeof window === "undefined") return null;

  const slideAnim = side === "left" ? "animate-slide-in-from-left" : "animate-slide-in-from-right";
  const positionClass = side === "left" ? "left-0" : "right-0";

  return createPortal(
    <div className="fixed inset-0 z-100 flex">
      {/* Overlay */}
      <div
        className="animate-fade-in bg-bg-overlay absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleKeyDown}
        className={cn(
          "border-border-default bg-bg-surface-raised absolute top-0 flex h-full max-w-full flex-col shadow-xl",
          positionClass,
          sizeClasses[size],
          slideAnim,
          side === "left" ? "border-r" : "border-l",
        )}
      >
        {/* Header */}
        <div className="border-border-default flex items-center justify-between border-b px-6 py-4">
          {title && <h2 className="text-text-primary text-lg font-semibold">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:bg-bg-hover hover:text-text-primary focus-visible:ring-border-focus ml-auto shrink-0 rounded-md p-1 focus:outline-hidden focus-visible:ring-2"
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-border-default flex items-center justify-end gap-3 border-t px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
