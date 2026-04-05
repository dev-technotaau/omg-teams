"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options: RadioOption[];
  orientation?: "horizontal" | "vertical";
  error?: string;
  className?: string;
  label?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  orientation = "vertical",
  error,
  className,
  label,
}: RadioGroupProps) {
  return (
    <fieldset className={cn("w-full", className)} aria-invalid={!!error}>
      {label && <legend className="text-text-secondary mb-2 text-sm font-medium">{label}</legend>}
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-2.5" : "flex-row flex-wrap gap-4",
        )}
      >
        {options.map((option) => {
          const optionId = `${name}-${option.value}`;
          const isSelected = value === option.value;
          const isDisabled = option.disabled ?? false;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex items-start",
                isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )}
            >
              <div className="relative flex h-5 items-center">
                <input
                  type="radio"
                  id={optionId}
                  name={name}
                  value={option.value}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => onChange?.(option.value)}
                  className="peer sr-only"
                />
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                    "peer-focus-visible:ring-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-1",
                    isSelected ? "border-primary-500" : "border-border-default",
                    error && !isSelected && "border-error-500",
                  )}
                >
                  {isSelected && <span className="bg-primary-500 h-2 w-2 rounded-full" />}
                </div>
              </div>
              <div className="ml-2.5">
                <span className="text-text-primary text-sm font-medium">{option.label}</span>
                {option.description && (
                  <p className="text-text-muted text-xs">{option.description}</p>
                )}
              </div>
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-error-500 mt-1.5 text-xs">
          {error}
        </p>
      )}
    </fieldset>
  );
}
