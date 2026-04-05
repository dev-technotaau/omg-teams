"use client";

import React from "react";
import { CalendarDatePicker } from "./calendar-date-picker";
import { cn } from "@/lib/utils";

export interface DateRangePreset {
  label: string;
  getValue: () => [string, string];
}

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  presets?: DateRangePreset[];
  className?: string;
}

function getDefaultPresets(): DateRangePreset[] {
  const today = new Date();
  const toISO = (d: Date) => d.toISOString().split("T")[0]!;

  return [
    {
      label: "Today",
      getValue: () => {
        const d = toISO(today);
        return [d, d];
      },
    },
    {
      label: "This Week",
      getValue: () => {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        return [toISO(start), toISO(today)];
      },
    },
    {
      label: "This Month",
      getValue: () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return [toISO(start), toISO(today)];
      },
    },
    {
      label: "This Quarter",
      getValue: () => {
        const qMonth = Math.floor(today.getMonth() / 3) * 3;
        const start = new Date(today.getFullYear(), qMonth, 1);
        return [toISO(start), toISO(today)];
      },
    },
    {
      label: "This Year",
      getValue: () => {
        const start = new Date(today.getFullYear(), 0, 1);
        return [toISO(start), toISO(today)];
      },
    },
  ];
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  presets,
  className,
}: DateRangePickerProps) {
  const resolvedPresets = presets ?? getDefaultPresets();

  return (
    <div className={cn("w-full", className)}>
      {/* Presets */}
      {resolvedPresets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {resolvedPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const [start, end] = preset.getValue();
                onChange(start, end);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                "border-border-default text-text-secondary border",
                "hover:bg-bg-hover hover:text-text-primary",
                "focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Date inputs — using CalendarDatePicker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex-1">
          <CalendarDatePicker
            label="From"
            id="date-range-start"
            value={startDate}
            max={endDate || undefined}
            onChange={(val) => onChange(val, endDate)}
            size="md"
          />
        </div>
        <div className="text-text-muted hidden items-center pb-1 sm:flex">&ndash;</div>
        <div className="flex-1">
          <CalendarDatePicker
            label="To"
            id="date-range-end"
            value={endDate}
            min={startDate || undefined}
            onChange={(val) => onChange(startDate, val)}
            size="md"
          />
        </div>
      </div>
    </div>
  );
}
