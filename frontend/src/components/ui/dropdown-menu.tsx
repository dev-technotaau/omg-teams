"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  description?: string;
}

export interface MenuGroup {
  label?: string;
  items: MenuItem[];
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  groups: MenuGroup[];
  align?: "left" | "right";
  side?: "bottom" | "top";
  className?: string;
}

export function DropdownMenu({
  trigger,
  groups,
  align = "left",
  side = "bottom",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Build a flat list of all enabled items for keyboard navigation
  const flatItems = groups.flatMap((g) => g.items.filter((item) => !item.disabled));

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
          setFocusedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % flatItems.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(flatItems.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) {
            const item = flatItems[focusedIndex];
            if (item.onClick) item.onClick();
            if (item.href) window.location.href = item.href;
            close();
          }
          break;
        case "Tab":
          close();
          break;
      }
    },
    [open, focusedIndex, flatItems, close],
  );

  let flatCounter = -1;

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
      onKeyDown={handleKeyDown}
    >
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setFocusedIndex(-1);
        }}
      >
        {trigger}
      </div>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            "border-border-default bg-bg-surface-raised absolute z-50 min-w-[200px] rounded-md border py-1 shadow-lg",
            "animate-fade-in",
            align === "left" ? "left-0" : "right-0",
            side === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
          )}
        >
          {groups.map((group, groupIdx) => (
            <div key={groupIdx} role="group">
              {groupIdx > 0 && <div className="bg-border-default my-1 h-px" role="separator" />}
              {group.label && (
                <div className="text-text-muted px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                if (!item.disabled) flatCounter++;
                const currentFlatIdx = item.disabled ? -1 : flatCounter;
                const Icon = item.icon;

                const itemContent = (
                  <>
                    {Icon && <Icon size={16} aria-hidden="true" className="shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className={cn(item.danger && "text-error-500")}>{item.label}</div>
                      {item.description && (
                        <div className="text-text-muted mt-0.5 text-xs">{item.description}</div>
                      )}
                    </div>
                  </>
                );

                const baseClass = cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                  "focus-visible:outline-hidden",
                  item.disabled
                    ? "opacity-50 cursor-not-allowed"
                    : cn(
                        "cursor-pointer hover:bg-bg-hover",
                        item.danger ? "text-error-500" : "text-text-primary",
                        currentFlatIdx === focusedIndex && "bg-bg-hover",
                      ),
                );

                if (item.href && !item.disabled) {
                  return (
                    <a
                      key={item.label}
                      ref={(el) => {
                        if (currentFlatIdx >= 0) itemRefs.current[currentFlatIdx] = el;
                      }}
                      href={item.href}
                      role="menuitem"
                      tabIndex={-1}
                      className={baseClass}
                      onClick={() => close()}
                    >
                      {itemContent}
                    </a>
                  );
                }

                return (
                  <button
                    key={item.label}
                    ref={(el) => {
                      if (currentFlatIdx >= 0) itemRefs.current[currentFlatIdx] = el;
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    disabled={item.disabled}
                    className={baseClass}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      close();
                    }}
                  >
                    {itemContent}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
