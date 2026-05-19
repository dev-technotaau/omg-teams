"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
//  Combobox — controlled type-ahead select with optional
//  inline "+ Add [value]" backfill (creatable mode).
//
//  Separate from the existing <Select> because that one is
//  backed by a hidden native <select>, which can't model
//  "value not in the option list yet" — exactly what we need
//  for the Location/Profile backfill flow.
//
//  - Controlled `value` (string label) + `onChange(label)`
//  - `options` is the searchable pool; the user can also type
//    a value that's NOT in the pool when `creatable` is true.
//  - `onCreate(label)` is called when the user picks the
//    "+ Add" footer entry (click), presses Enter on a no-match
//    query, or blurs the input with a non-matching value. The
//    parent is responsible for persisting the new option and
//    refreshing the list — Combobox then calls `onChange` with
//    the persisted label.
// ─────────────────────────────────────────────────────────────

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  /** Currently committed value (the option's `label`/text). */
  value: string;
  onChange: (next: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Show the "+ Add [value]" footer when no option matches. */
  creatable?: boolean;
  /**
   * Called when the user creates a new entry — either by clicking
   * the "+ Add" footer, pressing Enter on a no-match, or blurring
   * with non-matching text. Should persist + return the new label.
   * Throw to cancel the commit (the input stays mounted with the
   * typed value so the user can retry).
   */
  onCreate?: (label: string) => Promise<string> | string;
  /** Disables onCreate (and hides the footer) — e.g. "pick a state first". */
  createDisabledReason?: string | null;
  name?: string;
  id?: string;
  className?: string;
  /** Fired on blur AFTER any commit has settled. */
  onBlur?: () => void;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  creatable = false,
  onCreate,
  createDisabledReason,
  name,
  id,
  className,
  onBlur,
}: ComboboxProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  // Keep query mirrored to the committed value while the menu is closed
  // (the user isn't actively typing).
  useEffect(() => {
    if (!isOpen) setQuery(value);
  }, [value, isOpen]);

  const normalizedQuery = query.trim();
  const queryLc = normalizedQuery.toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(queryLc) || o.value.toLowerCase().includes(queryLc),
    );
  }, [options, normalizedQuery, queryLc]);

  const exactMatch = useMemo(
    () =>
      normalizedQuery
        ? options.find(
            (o) =>
              o.label.toLowerCase() === queryLc || o.value.toLowerCase() === queryLc,
          )
        : null,
    [options, normalizedQuery, queryLc],
  );

  const canCreate = creatable && !exactMatch && normalizedQuery.length > 0 && !createDisabledReason;
  const totalRows = filtered.length + (canCreate ? 1 : 0);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setHighlight(0);
  }, [disabled]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setHighlight(0);
  }, []);

  // Position the portal menu under the input
  useEffect(() => {
    if (!isOpen || !wrapperRef.current) return;
    const update = () => {
      const r = wrapperRef.current!.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        maxHeight: Math.min(320, window.innerHeight - r.bottom - 12),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, closeMenu]);

  const commitOption = useCallback(
    (opt: ComboboxOption) => {
      onChange(opt.label);
      setQuery(opt.label);
      closeMenu();
    },
    [onChange, closeMenu],
  );

  const commitNew = useCallback(async () => {
    if (!onCreate || !normalizedQuery || creating) return;
    setCreating(true);
    try {
      const committedLabel = await onCreate(normalizedQuery);
      onChange(committedLabel);
      setQuery(committedLabel);
      closeMenu();
    } catch {
      // Parent surfaces the error (toast). Keep menu open so user can retry.
    } finally {
      setCreating(false);
    }
  }, [onCreate, normalizedQuery, creating, onChange, closeMenu]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) openMenu();
      else setHighlight((h) => Math.min(totalRows - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && highlight < filtered.length) {
        const opt = filtered[highlight];
        if (opt) commitOption(opt);
      } else if (canCreate) {
        void commitNew();
      } else if (exactMatch) {
        commitOption(exactMatch);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(value);
      closeMenu();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  };

  const handleBlur = () => {
    // If the user typed a brand-new value and tabs/clicks away, persist it
    // (matches the "leaving typed as it is will create/backfill" requirement).
    setTimeout(() => {
      if (menuRef.current && document.activeElement && menuRef.current.contains(document.activeElement)) {
        return;
      }
      if (exactMatch) {
        if (exactMatch.label !== value) onChange(exactMatch.label);
        setQuery(exactMatch.label);
      } else if (canCreate) {
        void commitNew();
      } else if (!normalizedQuery && value) {
        // Cleared the input — propagate the empty string
        onChange("");
      } else {
        // Reset to last committed value
        setQuery(value);
      }
      setIsOpen(false);
      onBlur?.();
    }, 0);
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Hidden native input so RHF / form posts still pick up the value */}
      {name && <input type="hidden" name={name} value={value} />}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlight(0);
          }}
          onFocus={openMenu}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn(
            "bg-bg-input text-text-primary placeholder:text-text-muted w-full",
            "border-border-default border transition-colors rounded-md",
            "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "h-9 text-sm pl-3 pr-9",
          )}
        />
        <span className="text-text-muted pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
          <ChevronDown
            size={16}
            className={cn("transition-transform", isOpen && "rotate-180")}
            aria-hidden="true"
          />
        </span>
      </div>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="animate-fade-in bg-bg-surface-raised border-border-default z-9999 flex flex-col overflow-hidden rounded-md border shadow-xl"
          >
            <ul role="listbox" className="overflow-y-auto py-1">
              {filtered.length === 0 && !canCreate && (
                <li className="text-text-muted px-3 py-2 text-sm italic">
                  {createDisabledReason ?? "No matches"}
                </li>
              )}
              {filtered.map((opt, i) => {
                const isHighlighted = i === highlight;
                const isSelected = opt.label === value;
                return (
                  <li key={opt.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commitOption(opt)}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                        isHighlighted ? "bg-bg-muted" : "hover:bg-bg-muted",
                        isSelected && "text-primary-700 font-medium",
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check size={14} className="text-primary-600" />}
                    </button>
                  </li>
                );
              })}
              {canCreate && (
                <li role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void commitNew()}
                    onMouseEnter={() => setHighlight(filtered.length)}
                    disabled={creating}
                    className={cn(
                      "border-border-default text-text-accent flex w-full items-center gap-1.5 border-t px-3 py-1.5 text-left text-sm",
                      filtered.length === highlight ? "bg-bg-muted" : "hover:bg-bg-muted",
                      creating && "opacity-60",
                    )}
                  >
                    <Plus size={14} />
                    <span>
                      {creating ? "Adding" : "Add"} &quot;
                      <span className="font-medium">{normalizedQuery}</span>&quot;
                    </span>
                  </button>
                </li>
              )}
            </ul>
            {createDisabledReason && filtered.length > 0 && (
              <div className="border-border-default text-text-muted border-t px-3 py-1 text-[11px] italic">
                {createDisabledReason}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
