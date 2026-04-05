"use client";

import React, { useCallback, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  disabled?: boolean;
}

export type TabVariant = "underline" | "pills" | "bordered";
export type TabSize = "sm" | "md";

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: TabVariant;
  size?: TabSize;
  fullWidth?: boolean;
  className?: string;
}

const sizeClasses: Record<TabSize, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
};

const iconSizes: Record<TabSize, number> = {
  sm: 14,
  md: 16,
};

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "underline",
  size = "md",
  fullWidth = false,
  className,
}: TabsProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const setTabRef = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) {
        tabRefs.current.set(id, el);
      } else {
        tabRefs.current.delete(id);
      }
    },
    [],
  );

  const enabledTabs = tabs.filter((t) => !t.disabled);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = enabledTabs.findIndex((t) => t.id === activeTab);
      let nextIndex = -1;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % enabledTabs.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        return;
      }

      if (nextIndex >= 0) {
        const nextTab = enabledTabs[nextIndex];
        onChange(nextTab.id);
        tabRefs.current.get(nextTab.id)?.focus();
      }
    },
    [activeTab, enabledTabs, onChange],
  );

  const getTabClasses = (tab: TabItem) => {
    const isActive = tab.id === activeTab;
    const base = cn(
      "inline-flex items-center font-medium transition-colors relative",
      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
      "disabled:pointer-events-none disabled:opacity-50",
      sizeClasses[size],
      fullWidth && "flex-1 justify-center",
    );

    switch (variant) {
      case "underline":
        return cn(
          base,
          "rounded-none border-b-2",
          isActive
            ? "border-primary-500 text-primary-500"
            : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-default",
        );
      case "pills":
        return cn(
          base,
          "rounded-full",
          isActive
            ? "bg-primary-500 text-white"
            : "bg-bg-muted text-text-secondary hover:text-text-primary hover:bg-bg-hover",
        );
      case "bordered":
        return cn(
          base,
          "rounded-md border",
          isActive
            ? "border-border-default bg-bg-surface-raised text-text-primary"
            : "border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover",
        );
      default:
        return base;
    }
  };

  const containerClasses = cn(
    "flex overflow-x-auto scrollbar-none", // §18 — responsive horizontal scroll on small screens
    fullWidth && "w-full",
    variant === "underline" && "border-b border-border-default",
    variant === "pills" && "gap-1",
    variant === "bordered" && "gap-1 border-b border-border-default pb-0",
    className,
  );

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={containerClasses}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            ref={setTabRef(tab.id)}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={getTabClasses(tab)}
          >
            {Icon && <Icon size={iconSizes[size]} aria-hidden="true" />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  isActive && variant === "pills"
                    ? "bg-white/20 text-white"
                    : "bg-primary-100 text-primary-500",
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
