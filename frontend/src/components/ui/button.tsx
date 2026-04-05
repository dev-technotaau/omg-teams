"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500",
  secondary: "bg-bg-muted text-text-primary hover:bg-bg-hover focus-visible:ring-primary-500",
  outline:
    "border border-border-default text-text-secondary hover:bg-bg-hover hover:border-border-hover focus-visible:ring-primary-500",
  ghost: "text-text-secondary hover:bg-bg-hover focus-visible:ring-primary-500",
  danger: "bg-error-500 text-white hover:bg-error-700 focus-visible:ring-error-500",
  success: "bg-success-500 text-white hover:bg-success-700 focus-visible:ring-success-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
};

const iconSizeMap: Record<ButtonSize, number> = {
  xs: 14,
  sm: 16,
  md: 16,
  lg: 18,
};

const spinnerSizeMap: Record<ButtonSize, "sm" | "md"> = {
  xs: "sm",
  sm: "sm",
  md: "sm",
  lg: "md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      fullWidth = false,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={spinnerSizeMap[size]} className="border-current border-t-transparent" />
        ) : LeftIcon ? (
          <LeftIcon size={iconSizeMap[size]} aria-hidden="true" />
        ) : null}
        {children}
        {!loading && RightIcon && <RightIcon size={iconSizeMap[size]} aria-hidden="true" />}
      </button>
    );
  },
);

Button.displayName = "Button";

/* ------------------------------------------------------------------ */
/* IconButton — square button with just an icon                       */
/* ------------------------------------------------------------------ */

export interface IconButtonProps extends Omit<
  ButtonProps,
  "leftIcon" | "rightIcon" | "fullWidth" | "children"
> {
  icon: LucideIcon;
  "aria-label": string;
}

const iconButtonSizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 w-7 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = "ghost",
      size = "md",
      loading = false,
      disabled,
      icon: Icon,
      className,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          iconButtonSizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={spinnerSizeMap[size]} className="border-current border-t-transparent" />
        ) : (
          <Icon size={iconSizeMap[size]} aria-hidden="true" />
        )}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
