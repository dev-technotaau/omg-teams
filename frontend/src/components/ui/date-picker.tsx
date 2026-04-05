"use client";

import React from "react";
import { CalendarDatePicker } from "./calendar-date-picker";

/**
 * DatePicker — wraps CalendarDatePicker for backwards compatibility.
 * All existing usages automatically get the new calendar UI.
 */
export interface DatePickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "size"
> {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  helpText?: string;
  min?: string;
  max?: string;
  size?: "sm" | "md" | "lg";
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      error,
      helpText,
      min,
      max,
      placeholder,
      size = "md",
      className,
      id,
      disabled,
      required,
    },
    ref,
  ) => {
    return (
      <CalendarDatePicker
        ref={ref}
        value={value}
        onChange={onChange}
        label={label}
        error={error}
        helpText={helpText}
        min={min}
        max={max}
        placeholder={placeholder}
        size={size}
        className={className}
        id={id}
        disabled={disabled}
        required={required}
        showPresets
        clearable
      />
    );
  },
);

DatePicker.displayName = "DatePicker";
