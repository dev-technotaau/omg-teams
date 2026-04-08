"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Select — fully custom combobox
//
//  Rendered as a themed button + portal popup so it matches the rest of
//  the UI (no OS-native dropdown). Backed by a hidden native <select> so
//  form submission, react-hook-form `register()`, `name`, and ref all
//  continue to work exactly like a real <select>.
//
//  Features:
//    - Single-select (default): persistent value + check mark indicator
//    - Multi-select (`multiple`): checkbox list, value is string[]
//    - Command-menu (`resetOnSelect`): fires onChange then resets value
//      (useful for "Insert Field…" / "Symbol…" toolbar dropdowns)
//
//  Keyboard support:
//    - Enter / Space / ArrowDown → open
//    - ArrowUp / ArrowDown       → move highlight
//    - Home / End                → first / last
//    - Enter                     → select (single) / toggle (multi)
//    - Escape                    → close
//    - A–Z / 0–9                 → type-ahead jump
// ──────────────────────────────────────────────

export type SelectSize = "sm" | "md" | "lg";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  helpText?: string;
  options: SelectOption[];
  placeholder?: string;
  size?: SelectSize;
  /** Allow multiple selections — value becomes string[] */
  multiple?: boolean;
  /**
   * Command-menu mode: after firing onChange the internal value resets to
   * empty so the button shows the placeholder again. Useful for "Insert…"
   * dropdowns where the select triggers an action rather than storing state.
   */
  resetOnSelect?: boolean;
  /**
   * Show an inline search input at the top of the dropdown that substring-
   * filters options as the user types. Enter selects the highlighted match.
   */
  searchable?: boolean;
}

const sizeClasses: Record<SelectSize, string> = {
  sm: "h-8 text-sm",
  md: "h-9 text-sm",
  lg: "h-11 text-base",
};

/**
 * Dispatch a native `change` event on a hidden single select so that React's
 * synthetic onChange (and react-hook-form's register) fires as expected.
 */
function setSelectValue(select: HTMLSelectElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(select, value);
  } else {
    select.value = value;
  }
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * For multi-select: set the `selected` property on each option to match
 * the given values, then dispatch a change event.
 */
function setMultiSelectValues(select: HTMLSelectElement, values: string[]) {
  const set = new Set(values);
  for (const option of Array.from(select.options)) {
    option.selected = set.has(option.value);
  }
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helpText,
      options,
      placeholder,
      size = "md",
      className,
      id,
      disabled,
      value,
      defaultValue,
      onChange,
      name,
      required,
      multiple = false,
      resetOnSelect = false,
      searchable = false,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const selectId = id || reactId;
    const buttonRef = useRef<HTMLButtonElement>(null);
    const hiddenRef = useRef<HTMLSelectElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const typeaheadRef = useRef({ buffer: "", timer: 0 });
    const [searchQuery, setSearchQuery] = useState("");

    // Forward the hidden-select ref outward
    React.useImperativeHandle(ref, () => hiddenRef.current as HTMLSelectElement, []);

    // Internal value tracking
    const [internalSingle, setInternalSingle] = useState<string>(() => {
      if (multiple) return "";
      if (value !== undefined) return Array.isArray(value) ? "" : String(value);
      if (defaultValue !== undefined) return Array.isArray(defaultValue) ? "" : String(defaultValue);
      return "";
    });

    const [internalMulti, setInternalMulti] = useState<string[]>(() => {
      if (!multiple) return [];
      if (value !== undefined) return toArray(value);
      if (defaultValue !== undefined) return toArray(defaultValue);
      return [];
    });

    // Sync external controlled value
    useEffect(() => {
      if (value === undefined) return;
      if (multiple) {
        // reason: controlled value sync from parent prop
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInternalMulti(toArray(value));
      } else {
        setInternalSingle(Array.isArray(value) ? "" : String(value));
      }
    }, [value, multiple]);

    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    const enabledOptions = useMemo(() => options.filter((o) => !o.disabled), [options]);

    // §searchable — Substring filter when searchable. Empty/blank options
    // (placeholder rows like { value: "", label: "Select state" }) are hidden
    // while a query is active so they don't get accidentally picked.
    const displayedOptions = useMemo(() => {
      if (!searchable || !searchQuery.trim()) return options;
      const q = searchQuery.trim().toLowerCase();
      return options.filter((o) => o.value !== "" && o.label.toLowerCase().includes(q));
    }, [options, searchable, searchQuery]);

    const selectedValues = useMemo(
      () => (multiple ? internalMulti : internalSingle ? [internalSingle] : []),
      [multiple, internalMulti, internalSingle],
    );
    const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

    // Display label on the button
    const displayLabel = useMemo(() => {
      if (multiple) {
        if (internalMulti.length === 0) return placeholder ?? "Select...";
        if (internalMulti.length === 1) {
          return options.find((o) => o.value === internalMulti[0])?.label ?? placeholder ?? "";
        }
        return `${internalMulti.length} selected`;
      }
      const opt = options.find((o) => o.value === internalSingle);
      return opt?.label ?? placeholder ?? "Select...";
    }, [multiple, internalMulti, internalSingle, options, placeholder]);

    const hasSelection = multiple ? internalMulti.length > 0 : !!internalSingle;

    // ── Commit logic ──
    const commitSingleValue = useCallback(
      (next: string) => {
        setInternalSingle(next);
        if (hiddenRef.current) {
          setSelectValue(hiddenRef.current, next);
        }
        if (resetOnSelect) {
          // Reset UI after the caller has had a chance to react
          setTimeout(() => {
            setInternalSingle("");
            if (hiddenRef.current) setSelectValue(hiddenRef.current, "");
          }, 0);
        }
      },
      [resetOnSelect],
    );

    const toggleMultiValue = useCallback(
      (value: string) => {
        setInternalMulti((prev) => {
          const next = prev.includes(value)
            ? prev.filter((v) => v !== value)
            : [...prev, value];
          if (hiddenRef.current) {
            setMultiSelectValues(hiddenRef.current, next);
          }
          return next;
        });
      },
      [],
    );

    // ── Positioning ──
    const positionMenu = useCallback(() => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedHeight = Math.min(options.length * 36 + 8, 280);
      const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        maxHeight: Math.max(spaceBelow, spaceAbove) - 16,
      });
    }, [options.length]);

    useLayoutEffect(() => {
      if (isOpen) positionMenu();
    }, [isOpen, positionMenu]);

    useEffect(() => {
      if (!isOpen) return;
      const onScroll = () => positionMenu();
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
      };
    }, [isOpen, positionMenu]);

    // Click outside closes
    useEffect(() => {
      if (!isOpen) return;
      const onDown = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          !buttonRef.current?.contains(target) &&
          !listRef.current?.contains(target) &&
          !searchInputRef.current?.contains(target)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, [isOpen]);

    // Scroll highlighted option into view
    useEffect(() => {
      if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
      const item = listRef.current.querySelectorAll<HTMLLIElement>("li[role='option']")[
        highlightedIndex
      ];
      item?.scrollIntoView({ block: "nearest" });
    }, [highlightedIndex, isOpen]);

    const openMenu = useCallback(() => {
      if (disabled) return;
      setIsOpen(true);
      if (searchable) setSearchQuery("");
      // Highlight current selection (or first selected in multi, or first enabled)
      if (multiple) {
        if (internalMulti.length > 0) {
          const firstSelectedIdx = options.findIndex((o) => internalMulti.includes(o.value));
          setHighlightedIndex(firstSelectedIdx >= 0 ? firstSelectedIdx : options.findIndex((o) => !o.disabled));
        } else {
          setHighlightedIndex(options.findIndex((o) => !o.disabled));
        }
      } else {
        const currentIdx = options.findIndex((o) => o.value === internalSingle);
        if (currentIdx >= 0 && !options[currentIdx]?.disabled) {
          setHighlightedIndex(currentIdx);
        } else {
          setHighlightedIndex(options.findIndex((o) => !o.disabled));
        }
      }
    }, [disabled, options, internalSingle, internalMulti, multiple, searchable]);

    // §searchable — Auto-focus the search input when the menu opens, and
    // reset highlight to the first match whenever the query changes.
    useEffect(() => {
      if (!isOpen || !searchable) return;
      // Defer until after the portal has mounted
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }, [isOpen, searchable]);

    useEffect(() => {
      if (!searchable || !isOpen) return;
      const firstEnabled = displayedOptions.findIndex((o) => !o.disabled);
      // reason: reset highlight when filter results change
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighlightedIndex(firstEnabled);
    }, [searchable, searchQuery, displayedOptions, isOpen]);

    const moveHighlight = useCallback(
      (direction: 1 | -1) => {
        if (!displayedOptions.length) return;
        setHighlightedIndex((prev) => {
          let next = prev;
          for (let i = 0; i < displayedOptions.length; i++) {
            next = (next + direction + displayedOptions.length) % displayedOptions.length;
            if (!displayedOptions[next]?.disabled) return next;
          }
          return prev;
        });
      },
      [displayedOptions],
    );

    const selectHighlighted = useCallback(() => {
      if (highlightedIndex < 0) return;
      const opt = displayedOptions[highlightedIndex];
      if (!opt || opt.disabled) return;
      if (multiple) {
        toggleMultiValue(opt.value);
        // Keep the menu open for multi-select
      } else {
        commitSingleValue(opt.value);
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }, [highlightedIndex, displayedOptions, multiple, toggleMultiValue, commitSingleValue]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;

        if (!isOpen) {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu();
          }
          return;
        }

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            moveHighlight(1);
            break;
          case "ArrowUp":
            e.preventDefault();
            moveHighlight(-1);
            break;
          case "Home":
            e.preventDefault();
            setHighlightedIndex(displayedOptions.findIndex((o) => !o.disabled));
            break;
          case "End":
            e.preventDefault();
            for (let i = displayedOptions.length - 1; i >= 0; i--) {
              if (!displayedOptions[i]?.disabled) {
                setHighlightedIndex(i);
                break;
              }
            }
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            selectHighlighted();
            break;
          case "Escape":
            e.preventDefault();
            setIsOpen(false);
            buttonRef.current?.focus();
            break;
          case "Tab":
            setIsOpen(false);
            break;
          default:
            // Type-ahead — disabled in searchable mode (the input handles text)
            if (searchable) break;
            if (e.key.length === 1 && /[\w\s]/.test(e.key)) {
              window.clearTimeout(typeaheadRef.current.timer);
              typeaheadRef.current.buffer += e.key.toLowerCase();
              typeaheadRef.current.timer = window.setTimeout(() => {
                typeaheadRef.current.buffer = "";
              }, 500);
              const idx = enabledOptions.findIndex((o) =>
                o.label.toLowerCase().startsWith(typeaheadRef.current.buffer),
              );
              if (idx >= 0) {
                const realIdx = options.indexOf(enabledOptions[idx]!);
                setHighlightedIndex(realIdx);
              }
            }
        }
      },
      [disabled, isOpen, openMenu, moveHighlight, displayedOptions, selectHighlighted, enabledOptions, searchable, options],
    );

    // The hidden <select> needs its value passed correctly for controlled mode
    const hiddenValueProp = useMemo(() => {
      if (value === undefined) {
        return multiple ? internalMulti : internalSingle;
      }
      return value;
    }, [value, multiple, internalMulti, internalSingle]);

    return (
      <div className={cn("min-w-44", className)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-text-secondary mb-1.5 block text-sm font-medium"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {/* Hidden native select — keeps form submission, RHF register, and refs working */}
          <select
            ref={hiddenRef}
            id={selectId}
            name={name}
            value={hiddenValueProp}
            defaultValue={value === undefined ? defaultValue : undefined}
            onChange={onChange}
            required={required}
            disabled={disabled}
            multiple={multiple}
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            {...rest}
          >
            {!multiple && placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Visible trigger button */}
          <button
            ref={buttonRef}
            type="button"
            disabled={disabled}
            onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
            onKeyDown={handleKeyDown}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-describedby={
              error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined
            }
            className={cn(
              "bg-bg-input text-text-primary w-full cursor-pointer rounded-md pr-9 pl-3 text-left",
              "border-border-default border transition-colors",
              "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
              "disabled:cursor-not-allowed disabled:opacity-50",
              sizeClasses[size],
              error && "border-error-500 focus:border-error-500 focus:ring-error-500",
            )}
          >
            <span
              className={cn(
                "block truncate",
                !hasSelection && "text-text-muted",
              )}
            >
              {displayLabel}
            </span>
          </button>
          <span className="text-text-muted pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <ChevronDown
              size={16}
              className={cn("transition-transform", isOpen && "rotate-180")}
              aria-hidden="true"
            />
          </span>

          {/* Portal popup */}
          {isOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                style={menuStyle}
                className="animate-fade-in bg-bg-surface-raised border-border-default z-9999 flex flex-col overflow-hidden rounded-md border shadow-xl"
              >
                {searchable && (
                  <div className="border-border-default border-b p-1.5">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="bg-bg-input text-text-primary border-border-default focus:border-border-focus focus:ring-primary-500 h-8 w-full rounded border px-2 text-sm focus:ring-1 focus:outline-hidden"
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveHighlight(1);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveHighlight(-1);
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          selectHighlighted();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setIsOpen(false);
                          buttonRef.current?.focus();
                        } else if (e.key === "Tab") {
                          setIsOpen(false);
                        }
                      }}
                    />
                  </div>
                )}
              <ul
                ref={listRef}
                role="listbox"
                aria-labelledby={selectId}
                aria-multiselectable={multiple}
                className="overflow-y-auto py-1"
              >
                {displayedOptions.length === 0 && (
                  <li className="text-text-muted px-3 py-2 text-sm">No matches</li>
                )}
                {displayedOptions.map((opt, idx) => {
                  const isSelected = selectedSet.has(opt.value);
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (opt.disabled) return;
                        if (multiple) {
                          toggleMultiValue(opt.value);
                        } else {
                          commitSingleValue(opt.value);
                          setIsOpen(false);
                          buttonRef.current?.focus();
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                        opt.disabled && "text-text-muted cursor-not-allowed opacity-50",
                        !opt.disabled && isHighlighted && "bg-bg-hover",
                        !multiple && !opt.disabled && isSelected && "text-primary-500 font-medium",
                      )}
                    >
                      {multiple && (
                        <span
                          className={cn(
                            "border-border-default flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            isSelected && "border-primary-500 bg-primary-500",
                          )}
                          aria-hidden="true"
                        >
                          {isSelected && <Check size={12} className="text-white" />}
                        </span>
                      )}
                      <span className="flex-1 truncate">{opt.label}</span>
                      {!multiple && isSelected && (
                        <Check size={14} className="shrink-0" aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </ul>
              </div>,
              document.body,
            )}
        </div>

        {error && (
          <p id={`${selectId}-error`} role="alert" className="text-error-500 mt-1 text-xs">
            {error}
          </p>
        )}
        {!error && helpText && (
          <p id={`${selectId}-help`} className="text-text-muted mt-1 text-xs">
            {helpText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
