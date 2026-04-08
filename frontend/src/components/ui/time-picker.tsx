"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Clock, ChevronUp, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface TimePickerProps {
  value?: string; // "HH:mm" or "HH:mm:ss"
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  helpText?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  /** Show seconds picker */
  showSeconds?: boolean;
  /** 12-hour format with AM/PM */
  use12Hour?: boolean;
  /** Step for minutes (default 1) */
  minuteStep?: number;
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseTime(val: string): { h: number; m: number; s: number } {
  if (!val) return { h: 0, m: 0, s: 0 };
  const parts = val.split(":").map(Number);
  return { h: parts[0] ?? 0, m: parts[1] ?? 0, s: parts[2] ?? 0 };
}

function formatTime(h: number, m: number, s: number, showSeconds: boolean): string {
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  if (showSeconds) {
    const ss = String(s).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}`;
}

function to12Hour(h: number): { hour12: number; period: "AM" | "PM" } {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour12, period };
}

function to24Hour(h12: number, period: "AM" | "PM"): number {
  if (period === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

function formatDisplay(val: string, use12Hour: boolean): string {
  if (!val) return "";
  const { h, m } = parseTime(val);
  if (use12Hour) {
    const { hour12, period } = to12Hour(h);
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Quick time options                                                 */
/* ------------------------------------------------------------------ */

function getQuickTimes(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    times.push(`${String(h).padStart(2, "0")}:30`);
  }
  return times;
}

/* ------------------------------------------------------------------ */
/*  Spinner subcomponent                                               */
/* ------------------------------------------------------------------ */

function Spinner({
  value,
  min,
  max,
  onChange,
  label,
  padWidth = 2,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  padWidth?: number;
}) {
  const increment = () => onChange(value >= max ? min : value + 1);
  const decrement = () => onChange(value <= min ? max : value - 1);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-text-muted text-[9px] font-medium uppercase">{label}</span>
      <button
        type="button"
        onClick={increment}
        className="text-text-muted hover:text-text-primary hover:bg-bg-hover rounded p-0.5 transition"
        aria-label={`Increase ${label}`}
        tabIndex={-1}
      >
        <ChevronUp size={16} />
      </button>
      <div className="bg-bg-muted text-text-primary flex h-10 w-12 items-center justify-center rounded-lg text-lg font-semibold tabular-nums">
        {String(value).padStart(padWidth, "0")}
      </div>
      <button
        type="button"
        onClick={decrement}
        className="text-text-muted hover:text-text-primary hover:bg-bg-hover rounded p-0.5 transition"
        aria-label={`Decrease ${label}`}
        tabIndex={-1}
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
  (
    {
      value = "",
      onChange,
      label,
      error,
      helpText,
      placeholder = "Pick a time",
      disabled = false,
      size = "md",
      showSeconds = false,
      use12Hour = false,
      minuteStep: _minuteStep = 1,
      clearable = true,
      className,
      id,
      required,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"spinner" | "list">("spinner");
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputId = id || (label ? `tp-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    const { h, m, s } = useMemo(() => parseTime(value), [value]);
    const [period, setPeriod] = useState<"AM" | "PM">(() => to12Hour(h).period);

    // Emit change
    const emit = useCallback(
      (newH: number, newM: number, newS: number) => {
        onChange?.(formatTime(newH, newM, newS, showSeconds));
      },
      [onChange, showSeconds],
    );

    const setHour = useCallback(
      (newH: number) => {
        if (use12Hour) {
          emit(to24Hour(newH, period), m, s);
        } else {
          emit(newH, m, s);
        }
      },
      [emit, m, s, use12Hour, period],
    );
    const setMinute = useCallback((newM: number) => emit(h, newM, s), [emit, h, s]);
    const setSecond = useCallback((newS: number) => emit(h, m, newS), [emit, h, m]);
    const togglePeriod = useCallback(() => {
      const newPeriod = period === "AM" ? "PM" : "AM";
      setPeriod(newPeriod);
      const { hour12 } = to12Hour(h);
      emit(to24Hour(hour12, newPeriod), m, s);
    }, [period, h, m, s, emit]);

    // Close on click outside
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
        )
          setOpen(false);
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [open]);

    // Popover positioning
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    useEffect(() => {
      if (!open || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow > 340 ? rect.bottom + 4 : rect.top - 340;
      setPopoverStyle({
        position: "fixed",
        top: Math.max(4, top),
        left: Math.max(4, Math.min(rect.left, window.innerWidth - 280)),
        zIndex: 9999,
      });
    }, [open]);

    const quickTimes = useMemo(() => getQuickTimes(), []);
    const displayHour = use12Hour ? to12Hour(h).hour12 : h;

    return (
      <div className={cn("w-full", className)}>
        {label && (
          <label htmlFor={inputId} className="text-text-secondary mb-1.5 block text-sm font-medium">
            {label}
            {required && <span className="text-error-500 ml-0.5">*</span>}
          </label>
        )}

        <input ref={ref} type="hidden" name={inputId} value={value} />

        <button
          ref={triggerRef}
          type="button"
          id={inputId}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "bg-bg-input text-text-primary relative w-full rounded-md pl-9 text-left",
            "border-border-default border transition-colors",
            "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
            "disabled:cursor-not-allowed disabled:opacity-50",
            sizeClasses[size],
            // Reserve room for the clear (X) button when shown so the time
            // text doesn't bleed under it.
            clearable && value && !disabled ? "pr-8" : "pr-3",
            !value && "text-text-muted",
            error && "border-error-500",
          )}
        >
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <Clock size={16} className="text-text-muted" />
          </span>
          <span className="truncate">{value ? formatDisplay(value, use12Hour) : placeholder}</span>
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.("");
              }}
              className="text-text-muted hover:text-text-primary absolute inset-y-0 right-0 flex items-center pr-2"
              aria-label="Clear time"
            >
              <X size={14} />
            </span>
          )}
        </button>

        {error && (
          <p role="alert" className="text-error-500 mt-1 text-xs">
            {error}
          </p>
        )}
        {!error && helpText && <p className="text-text-muted mt-1 text-xs">{helpText}</p>}

        {/* Popover */}
        {open &&
          typeof window !== "undefined" &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Time picker"
              style={popoverStyle}
              className="border-border-default bg-bg-surface-raised animate-fade-in w-[270px] rounded-xl border shadow-xl"
            >
              {/* Tabs */}
              <div className="flex border-b">
                <button
                  type="button"
                  onClick={() => setTab("spinner")}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium transition",
                    tab === "spinner"
                      ? "border-primary-500 text-primary-600 border-b-2"
                      : "text-text-muted",
                  )}
                >
                  Spinner
                </button>
                <button
                  type="button"
                  onClick={() => setTab("list")}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium transition",
                    tab === "list"
                      ? "border-primary-500 text-primary-600 border-b-2"
                      : "text-text-muted",
                  )}
                >
                  Quick Select
                </button>
              </div>

              {tab === "spinner" && (
                <div className="flex items-center justify-center gap-2 p-4">
                  <Spinner
                    value={displayHour}
                    min={use12Hour ? 1 : 0}
                    max={use12Hour ? 12 : 23}
                    onChange={setHour}
                    label="Hour"
                  />
                  <span className="text-text-muted mt-4 text-xl font-bold">:</span>
                  <Spinner value={m} min={0} max={59} onChange={setMinute} label="Min" />
                  {showSeconds && (
                    <>
                      <span className="text-text-muted mt-4 text-xl font-bold">:</span>
                      <Spinner value={s} min={0} max={59} onChange={setSecond} label="Sec" />
                    </>
                  )}
                  {use12Hour && (
                    <div className="ml-1 flex flex-col gap-1">
                      <span className="text-text-muted text-[9px] font-medium uppercase">
                        Period
                      </span>
                      <button
                        type="button"
                        onClick={togglePeriod}
                        className={cn(
                          "rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                          "bg-primary-100 text-primary-700 hover:bg-primary-200",
                        )}
                      >
                        {period}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === "list" && (
                <div className="max-h-[240px] overflow-y-auto p-2">
                  <div className="grid grid-cols-4 gap-1">
                    {quickTimes.map((t) => {
                      const isSelected = value === t || value === `${t}:00`;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            onChange?.(showSeconds ? `${t}:00` : t);
                            setOpen(false);
                          }}
                          className={cn(
                            "rounded-md px-1 py-1.5 text-xs font-medium transition-colors",
                            isSelected
                              ? "bg-primary-500 text-white"
                              : "hover:bg-bg-hover text-text-primary",
                          )}
                        >
                          {use12Hour ? formatDisplay(t, true) : t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    emit(now.getHours(), now.getMinutes(), now.getSeconds());
                    setOpen(false);
                  }}
                  className="text-primary-500 hover:text-primary-600 text-xs font-medium"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="bg-primary-500 hover:bg-primary-600 rounded-md px-3 py-1 text-xs font-medium text-white"
                >
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

TimePicker.displayName = "TimePicker";
