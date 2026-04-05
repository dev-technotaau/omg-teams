"use client";

import React, { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  indeterminate?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

export function Checkbox({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  error,
  indeterminate = false,
  id,
  name,
  className,
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const checkboxId =
    id || (label ? `checkbox-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const isChecked = indeterminate ? false : checked;

  return (
    <div className={cn("flex items-start", className)}>
      <div className="relative flex h-5 items-center">
        <input
          ref={inputRef}
          type="checkbox"
          id={checkboxId}
          name={name}
          checked={isChecked}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${checkboxId}-error` : description ? `${checkboxId}-desc` : undefined
          }
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <div
          aria-hidden="true"
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-sm border transition-colors",
            "peer-focus-visible:ring-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-1",
            disabled && "cursor-not-allowed opacity-50",
            !disabled && "cursor-pointer",
            checked || indeterminate
              ? "border-primary-500 bg-primary-500"
              : "border-border-default bg-bg-input",
            error && !checked && !indeterminate && "border-error-500",
          )}
          onClick={() => {
            if (!disabled) {
              inputRef.current?.click();
            }
          }}
        >
          {checked && !indeterminate && <Check size={12} className="text-white" strokeWidth={3} />}
          {indeterminate && <Minus size={12} className="text-white" strokeWidth={3} />}
        </div>
      </div>
      {(label || description) && (
        <div className="ml-2.5">
          {label && (
            <label
              htmlFor={checkboxId}
              className={cn(
                "text-text-primary text-sm font-medium",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p id={`${checkboxId}-desc`} className="text-text-muted text-xs">
              {description}
            </p>
          )}
        </div>
      )}
      {error && (
        <p id={`${checkboxId}-error`} role="alert" className="text-error-500 mt-0.5 ml-2.5 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
