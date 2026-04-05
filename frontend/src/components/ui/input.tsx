"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helpText?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  size?: InputSize;
}

const sizeClasses: Record<InputSize, string> = {
  sm: "h-8 text-sm",
  md: "h-9 text-sm",
  lg: "h-11 text-base",
};

const iconSizeMap: Record<InputSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

const leftIconPadding: Record<InputSize, string> = {
  sm: "pl-8",
  md: "pl-9",
  lg: "pl-10",
};

const rightIconPadding: Record<InputSize, string> = {
  sm: "pr-8",
  md: "pr-9",
  lg: "pr-10",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helpText,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      leftAddon,
      rightAddon,
      size = "md",
      className,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-text-secondary mb-1.5 block text-sm font-medium">
            {label}
          </label>
        )}
        <div className="relative flex">
          {leftAddon && (
            <span className="border-border-default bg-bg-muted text-text-muted inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm">
              {leftAddon}
            </span>
          )}
          <div className="relative flex-1">
            {LeftIcon && (
              <span className="text-text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                <LeftIcon size={iconSizeMap[size]} aria-hidden="true" />
              </span>
            )}
            <input
              ref={ref}
              id={inputId}
              disabled={disabled}
              aria-invalid={!!error}
              aria-describedby={
                error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
              }
              className={cn(
                "bg-bg-input text-text-primary placeholder:text-text-muted w-full",
                "border-border-default border transition-colors",
                "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
                "disabled:cursor-not-allowed disabled:opacity-50",
                sizeClasses[size],
                "px-3",
                LeftIcon && leftIconPadding[size],
                RightIcon && rightIconPadding[size],
                leftAddon
                  ? "rounded-l-none rounded-r-md"
                  : rightAddon
                    ? "rounded-l-md rounded-r-none"
                    : "rounded-md",
                error && "border-error-500 focus:border-error-500 focus:ring-error-500",
                className,
              )}
              {...props}
            />
            {RightIcon && (
              <span className="text-text-muted pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                <RightIcon size={iconSizeMap[size]} aria-hidden="true" />
              </span>
            )}
          </div>
          {rightAddon && (
            <span className="border-border-default bg-bg-muted text-text-muted inline-flex items-center rounded-r-md border border-l-0 px-3 text-sm">
              {rightAddon}
            </span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-error-500 mt-1 text-xs">
            {error}
          </p>
        )}
        {!error && helpText && (
          <p id={`${inputId}-help`} className="text-text-muted mt-1 text-xs">
            {helpText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
