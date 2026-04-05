"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type SwitchSize = "sm" | "md";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: SwitchSize;
  id?: string;
  name?: string;
  className?: string;
}

const trackSizes: Record<SwitchSize, string> = {
  sm: "h-4 w-7",
  md: "h-5 w-9",
};

const thumbSizes: Record<SwitchSize, { base: string; translate: string }> = {
  sm: { base: "h-3 w-3", translate: "translate-x-3" },
  md: { base: "h-4 w-4", translate: "translate-x-4" },
};

export function Switch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  id,
  name,
  className,
}: SwitchProps) {
  const switchId = id || (label ? `switch-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className={cn("flex items-start", className)}>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative inline-flex shrink-0 rounded-full transition-colors duration-200",
          "focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
          "disabled:cursor-not-allowed disabled:opacity-50",
          trackSizes[size],
          checked ? "bg-primary-500" : "bg-bg-muted",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block transform rounded-full bg-white shadow-xs ring-0 transition-transform duration-200",
            thumbSizes[size].base,
            "mt-0.5 ml-0.5",
            checked && thumbSizes[size].translate,
          )}
        />
      </button>
      {(label || description) && (
        <div className="ml-2.5">
          {label && (
            <label
              htmlFor={switchId}
              className={cn(
                "text-text-primary text-sm font-medium",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )}
            >
              {label}
            </label>
          )}
          {description && <p className="text-text-muted text-xs">{description}</p>}
        </div>
      )}
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={checked ? "on" : "off"} />
    </div>
  );
}
