"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

/* ------------------------------------------------------------------ */
/*  Quick presets                                                      */
/* ------------------------------------------------------------------ */

function getPresets(): { label: string; value: Date }[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);

  return [
    { label: "Today", value: now },
    { label: "Yesterday", value: yesterday },
    { label: "A week ago", value: weekAgo },
    { label: "A month ago", value: monthAgo },
  ];
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CalendarDatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  helpText?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  showPresets?: boolean;
  showMonthYearDropdown?: boolean;
  /** Allow clearing the value */
  clearable?: boolean;
  className?: string;
  id?: string;
  required?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: "h-8 text-xs",
  md: "h-9 text-sm",
  lg: "h-11 text-base",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CalendarDatePicker = React.forwardRef<HTMLInputElement, CalendarDatePickerProps>(
  (
    {
      value = "",
      onChange,
      label,
      error,
      helpText,
      placeholder = "Pick a date",
      min,
      max,
      disabled = false,
      size = "md",
      showPresets = false,
      showMonthYearDropdown: _showMonthYearDropdown = true,
      clearable = true,
      className,
      id,
      required,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<"days" | "months" | "years">("days");
    const selectedDate = useMemo(() => parseISO(value), [value]);
    const [viewMonth, setViewMonth] = useState(
      () => selectedDate?.getMonth() ?? new Date().getMonth(),
    );
    const [viewYear, setViewYear] = useState(
      () => selectedDate?.getFullYear() ?? new Date().getFullYear(),
    );

    // Sync view month/year when value changes externally
    useEffect(() => {
      if (selectedDate) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync controlled view state
        setViewMonth(selectedDate.getMonth());
        setViewYear(selectedDate.getFullYear());
      }
    }, [selectedDate]);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputId = id || (label ? `cdp-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    const minDate = useMemo(() => parseISO(min ?? ""), [min]);
    const maxDate = useMemo(() => parseISO(max ?? ""), [max]);

    // Close on click outside
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
          setView("days");
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
          setView("days");
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [open]);

    const isDisabledDate = useCallback(
      (d: Date) => {
        if (minDate && d < minDate) return true;
        if (maxDate && d > maxDate) return true;
        return false;
      },
      [minDate, maxDate],
    );

    const selectDate = useCallback(
      (d: Date) => {
        if (isDisabledDate(d)) return;
        onChange?.(toISO(d));
        setOpen(false);
        setView("days");
      },
      [onChange, isDisabledDate],
    );

    const prevMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((y) => y - 1);
      } else setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((y) => y + 1);
      } else setViewMonth((m) => m + 1);
    };

    const weeks = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

    // Format display value
    const displayValue = selectedDate
      ? `${selectedDate.getDate()} ${SHORT_MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
      : "";

    // Year range for year picker
    const yearRange = useMemo(() => {
      const center = viewYear;
      const start = center - 6;
      const years: number[] = [];
      for (let y = start; y <= start + 11; y++) years.push(y);
      return years;
    }, [viewYear]);

    // Popover positioning
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    useEffect(() => {
      if (!open || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow > 380 ? rect.bottom + 4 : rect.top - 380;
      setPopoverStyle({
        position: "fixed",
        top: Math.max(4, top),
        left: Math.max(4, Math.min(rect.left, window.innerWidth - 320)),
        zIndex: 9999,
      });
    }, [open]);

    return (
      <div className={cn("w-full", className)}>
        {label && (
          <label htmlFor={inputId} className="text-text-secondary mb-1.5 block text-sm font-medium">
            {label}
            {required && <span className="text-error-500 ml-0.5">*</span>}
          </label>
        )}

        {/* Hidden native input for form compatibility */}
        <input ref={ref} type="hidden" name={inputId} value={value} />

        {/* Trigger wrapper — `relative` lives on this div (not the button)
            so the absolute icons have a guaranteed positioning context. A
            previous bug placed them on the button, which in some browser
            contexts wasn't establishing a containing block, letting the
            calendar icon escape upward to the modal body. */}
        <div className="relative w-full">
          <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-2.5">
            <Calendar size={16} className="text-text-muted" aria-hidden="true" />
          </span>
          <button
            ref={triggerRef}
            type="button"
            id={inputId}
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={open}
            data-invalid={!!error || undefined}
            aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
            className={cn(
              "bg-bg-input text-text-primary w-full rounded-md pr-8 pl-9 text-left",
              "border-border-default border transition-colors",
              "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
              "disabled:cursor-not-allowed disabled:opacity-50",
              sizeClasses[size],
              !displayValue && "text-text-muted",
              error && "border-error-500 focus:border-error-500 focus:ring-error-500",
            )}
          >
            <span className="truncate">{displayValue || placeholder}</span>
          </button>
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.("");
              }}
              className="text-text-muted hover:text-text-primary absolute inset-y-0 right-0 z-10 flex items-center pr-2"
              aria-label="Clear date"
            >
              <X size={14} />
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

        {/* Calendar Popover */}
        {open &&
          typeof window !== "undefined" &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-modal="false"
              aria-label="Date picker"
              style={popoverStyle}
              className="border-border-default bg-bg-surface-raised animate-fade-in w-[310px] rounded-xl border shadow-xl"
            >
              {/* ── Header ── */}
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y - 1)}
                    className="text-text-muted hover:text-text-primary rounded p-1"
                    aria-label="Previous year"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="text-text-muted hover:text-text-primary rounded p-1"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>

                {/* Month / Year — clickable to switch views */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setView((v) => (v === "months" ? "days" : "months"))}
                    className={cn(
                      "hover:bg-bg-hover rounded-md px-2 py-1 text-sm font-semibold transition",
                      view === "months" && "bg-primary-100 text-primary-700",
                    )}
                  >
                    {MONTHS[viewMonth]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView((v) => (v === "years" ? "days" : "years"))}
                    className={cn(
                      "hover:bg-bg-hover rounded-md px-2 py-1 text-sm font-semibold transition",
                      view === "years" && "bg-primary-100 text-primary-700",
                    )}
                  >
                    {viewYear}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="text-text-muted hover:text-text-primary rounded p-1"
                    aria-label="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y + 1)}
                    className="text-text-muted hover:text-text-primary rounded p-1"
                    aria-label="Next year"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>

              {/* ── Day Grid ── */}
              {view === "days" && (
                <div className="p-3">
                  {/* Day labels */}
                  <div className="mb-1 grid grid-cols-7 text-center">
                    {DAY_LABELS.map((d) => (
                      <div key={d} className="text-text-muted py-1 text-[11px] font-medium">
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Weeks */}
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 text-center">
                      {week.map((day, di) => {
                        if (!day) return <div key={di} />;
                        const disabled = isDisabledDate(day);
                        const selected = selectedDate && isSameDay(day, selectedDate);
                        const today = isToday(day);
                        return (
                          <button
                            key={di}
                            type="button"
                            disabled={disabled}
                            onClick={() => selectDate(day)}
                            className={cn(
                              "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                              disabled && "text-text-muted cursor-not-allowed opacity-30",
                              !disabled && !selected && "hover:bg-bg-hover",
                              selected && "bg-primary-500 font-semibold text-white",
                              !selected && today && "border-primary-500 border font-semibold",
                              !selected && !today && !disabled && "text-text-primary",
                            )}
                            aria-label={`${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`}
                            aria-current={selected ? "date" : undefined}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Today shortcut */}
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <button
                      type="button"
                      onClick={() => selectDate(new Date())}
                      className="text-primary-500 hover:text-primary-600 text-xs font-medium"
                    >
                      Today
                    </button>
                    {clearable && value && (
                      <button
                        type="button"
                        onClick={() => {
                          onChange?.("");
                          setOpen(false);
                        }}
                        className="text-text-muted hover:text-error-500 text-xs"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Month Grid ── */}
              {view === "months" && (
                <div className="grid grid-cols-3 gap-2 p-3">
                  {SHORT_MONTHS.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setViewMonth(i);
                        setView("days");
                      }}
                      className={cn(
                        "rounded-lg py-2 text-sm font-medium transition-colors",
                        i === viewMonth
                          ? "bg-primary-500 text-white"
                          : "hover:bg-bg-hover text-text-primary",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Year Grid ── */}
              {view === "years" && (
                <div className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setViewYear((y) => y - 12)}
                      className="text-text-muted hover:text-text-primary rounded p-1"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-text-secondary text-xs font-medium">
                      {yearRange[0]}–{yearRange[yearRange.length - 1]}
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewYear((y) => y + 12)}
                      className="text-text-muted hover:text-text-primary rounded p-1"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {yearRange.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setViewYear(y);
                          setView("months");
                        }}
                        className={cn(
                          "rounded-lg py-2 text-sm font-medium transition-colors",
                          y === viewYear
                            ? "bg-primary-500 text-white"
                            : "hover:bg-bg-hover text-text-primary",
                          y === new Date().getFullYear() &&
                            y !== viewYear &&
                            "border-primary-500 border",
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Quick presets ── */}
              {showPresets && view === "days" && (
                <div className="border-t px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {getPresets().map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => selectDate(p.value)}
                        className="border-border-default text-text-secondary hover:bg-bg-hover rounded-md border px-2 py-1 text-[11px] font-medium transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

CalendarDatePicker.displayName = "CalendarDatePicker";
