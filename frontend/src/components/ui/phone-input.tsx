"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  PhoneInput — country selector + national number
//
//  Stores value as combined E.164 string (e.g. "+919876543210").
//  Default country: India (IN).
//
//  Keyboard: type to filter, ↑/↓ to navigate, Enter to select,
//  Esc to close.
// ──────────────────────────────────────────────

// Country display names come from the browser's built-in Intl.DisplayNames
// (no extra dependency, fully localized, always up to date with the platform).
const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const ALL_COUNTRIES: ReadonlyArray<{
  iso: CountryCode;
  name: string;
  code: string;
  flag: string;
}> = (() => {
  const out: Array<{ iso: CountryCode; name: string; code: string; flag: string }> = [];
  for (const iso of getCountries()) {
    let code: string;
    try {
      code = getCountryCallingCode(iso);
    } catch {
      continue;
    }
    const name = displayNames?.of(iso) ?? iso;
    // Flag emoji from regional indicator codepoints
    const flag = String.fromCodePoint(
      ...iso.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
    );
    out.push({ iso, name, code, flag });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
})();

const DEFAULT_COUNTRY: CountryCode = "IN";

export interface PhoneInputProps {
  /** E.164 string like "+919876543210", or "" for empty */
  value: string;
  onChange: (value: string) => void;
  /** Fires whenever validity flips. Use this in parent forms to gate Submit. */
  onValidChange?: (isValid: boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Parent-supplied error overrides built-in validation message */
  error?: string;
  /** Treat empty as invalid (default false — empty is "not yet entered") */
  required?: boolean;
  id?: string;
  className?: string;
  /** ISO country code to start with when value is empty. Defaults to IN. */
  defaultCountry?: CountryCode;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      onValidChange,
      onBlur,
      disabled,
      placeholder,
      error,
      required = false,
      id,
      className,
      defaultCountry = DEFAULT_COUNTRY,
    },
    ref,
  ) => {
    // Parse incoming E.164 → split country + national number
    const parsed = useMemo(() => {
      if (!value) return null;
      // Accept legacy bare numbers by assuming the default country
      const trial = value.startsWith("+") ? value : `+${getCountryCallingCode(defaultCountry)}${value}`;
      return parsePhoneNumberFromString(trial);
    }, [value, defaultCountry]);

    const [country, setCountry] = useState<CountryCode>(
      parsed?.country ?? defaultCountry,
    );
    const [nationalNumber, setNationalNumber] = useState<string>(
      parsed?.nationalNumber ?? (value && !value.startsWith("+") ? value : ""),
    );

    // Re-sync local state when parent value changes externally
    useEffect(() => {
      if (parsed) {
        // reason: syncing local state from controlled prop is the intended pattern here
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCountry(parsed.country ?? defaultCountry);
        setNationalNumber(parsed.nationalNumber);
      } else if (!value) {
        setNationalNumber("");
      }
    }, [parsed, value, defaultCountry]);

    // Live validation. Empty + not required → "neutral" (not invalid).
    // Empty + required → invalid. Non-empty → use libphonenumber to check
    // length and per-country format. We track `touched` so we don't
    // scream "invalid!" before the user has typed anything.
    const [touched, setTouched] = useState(false);
    const validation = useMemo(() => {
      if (!value) {
        return { isValid: !required, showError: required && touched };
      }
      const p = parsePhoneNumberFromString(value);
      const ok = p?.isValid() ?? false;
      return { isValid: ok, showError: !ok && touched };
    }, [value, required, touched]);

    // Notify parent on validity flips
    const lastValidRef = useRef<boolean | null>(null);
    useEffect(() => {
      if (lastValidRef.current !== validation.isValid) {
        lastValidRef.current = validation.isValid;
        onValidChange?.(validation.isValid);
      }
    }, [validation.isValid, onValidChange]);

    const builtInError = validation.showError
      ? !value
        ? "Phone number is required"
        : `Invalid phone number for ${ALL_COUNTRIES.find((c) => c.iso === (parsed?.country ?? country))?.name ?? "this country"}`
      : undefined;
    const effectiveError = error ?? builtInError;

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightedIdx, setHighlightedIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Focus search when opened
    useEffect(() => {
      if (open) {
        // reason: reset transient picker UI when popup opens
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSearch("");
        setHighlightedIdx(0);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    }, [open]);

    const filtered = useMemo(() => {
      if (!search.trim()) return ALL_COUNTRIES;
      const q = search.toLowerCase().trim();
      return ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.includes(q) ||
          c.iso.toLowerCase().includes(q) ||
          `+${c.code}`.includes(q),
      );
    }, [search]);

    // Keep highlighted item in view
    useEffect(() => {
      if (!open) return;
      const item = listRef.current?.querySelector(
        `[data-idx="${highlightedIdx}"]`,
      ) as HTMLElement | null;
      item?.scrollIntoView({ block: "nearest" });
    }, [highlightedIdx, open]);

    const selectCountry = (iso: CountryCode) => {
      setCountry(iso);
      setOpen(false);
      // Re-emit combined value with the new country code
      const code = getCountryCallingCode(iso);
      const combined = nationalNumber ? `+${code}${nationalNumber}` : "";
      onChange(combined);
    };

    const handleNumberChange = (raw: string) => {
      // Strip everything except digits
      const digits = raw.replace(/\D/g, "");
      setNationalNumber(digits);
      setTouched(true);
      const code = getCountryCallingCode(country);
      onChange(digits ? `+${code}${digits}` : "");
    };

    const handleBlur = () => {
      setTouched(true);
      onBlur?.();
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = filtered[highlightedIdx];
        if (target) selectCountry(target.iso);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };

    const currentCountry = ALL_COUNTRIES.find((c) => c.iso === country);

    return (
      <div className="w-full" ref={containerRef}>
        <div className="relative flex">
          {/* Country selector button (left addon) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "border-border-default bg-bg-muted text-text-primary inline-flex h-9 items-center gap-1 rounded-l-md border border-r-0 px-2.5 text-sm transition-colors",
              "hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50",
              effectiveError && "border-error-500",
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="text-base leading-none">{currentCountry?.flag ?? "🏳️"}</span>
            <span className="text-text-secondary text-xs">+{currentCountry?.code ?? ""}</span>
            <ChevronDown size={12} className="text-text-muted" />
          </button>

          {/* National number input */}
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={nationalNumber}
            onChange={(e) => handleNumberChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder ?? "Phone number"}
            aria-invalid={!!effectiveError}
            className={cn(
              "bg-bg-input text-text-primary placeholder:text-text-muted h-9 flex-1 rounded-r-md border border-l-0 px-3 text-sm transition-colors",
              "border-border-default focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
              "disabled:cursor-not-allowed disabled:opacity-50",
              effectiveError && "border-error-500 focus:border-error-500 focus:ring-error-500",
              className,
            )}
          />

          {/* Country dropdown panel */}
          {open && (
            <div
              className="border-border-default bg-bg-surface absolute top-full left-0 z-50 mt-1 w-72 rounded-md border shadow-lg"
              role="listbox"
            >
              <div className="border-border-default border-b p-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="text-text-muted absolute top-1/2 left-2.5 -translate-y-1/2"
                  />
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setHighlightedIdx(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search country or code…"
                    className="bg-bg-input text-text-primary placeholder:text-text-muted border-border-default focus:border-border-focus focus:ring-primary-500 h-8 w-full rounded-md border pr-3 pl-8 text-sm focus:ring-1 focus:outline-hidden"
                  />
                </div>
              </div>
              <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="text-text-muted px-3 py-4 text-center text-xs">
                    No countries match &ldquo;{search}&rdquo;
                  </p>
                ) : (
                  filtered.map((c, idx) => (
                    <button
                      key={c.iso}
                      type="button"
                      data-idx={idx}
                      onClick={() => selectCountry(c.iso)}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                        idx === highlightedIdx
                          ? "bg-bg-hover"
                          : "hover:bg-bg-hover",
                        c.iso === country && "text-primary-600 font-medium",
                      )}
                      role="option"
                      aria-selected={c.iso === country}
                    >
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-text-muted text-xs">+{c.code}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {effectiveError && (
          <p role="alert" className="text-error-500 mt-1 text-xs">
            {effectiveError}
          </p>
        )}
      </div>
    );
  },
);

PhoneInput.displayName = "PhoneInput";

/**
 * Validate that a value is a parseable E.164 phone number.
 * Use this in form-level validation or before submit.
 */
export function isValidPhone(value: string): boolean {
  if (!value) return false;
  const parsed = parsePhoneNumberFromString(value);
  return parsed?.isValid() ?? false;
}
