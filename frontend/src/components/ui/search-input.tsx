"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Clock,
  Trash2,
  ArrowRight,
  Users,
  Building2,
  FileText,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

// ──────────────────────────────────────────────
//  SearchInput — Enhanced search with:
//  - Debounced search (configurable, default 300ms)
//  - Search history (localStorage, per historyKey)
//  - Live suggestions from backend as you type
//  - Keyboard: Enter, Escape, Arrow Up/Down, Tab
//  - Click suggestion → navigate to result
// ──────────────────────────────────────────────

const MAX_HISTORY = 8;
const SUGGESTION_DEBOUNCE = 350;
const MIN_SUGGEST_LENGTH = 2;

// ── History helpers ──

function getHistory(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`search_history:${key}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(key: string, items: string[]): void {
  try {
    localStorage.setItem(`search_history:${key}`, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {}
}

function addToHistory(key: string, term: string): void {
  if (!term.trim() || term.trim().length < 2) return;
  const history = getHistory(key);
  const filtered = history.filter((h) => h.toLowerCase() !== term.trim().toLowerCase());
  filtered.unshift(term.trim());
  saveHistory(key, filtered);
}

function clearHistoryStore(key: string): void {
  try {
    localStorage.removeItem(`search_history:${key}`);
  } catch {}
}

// ── Suggestion types ──

export interface SearchSuggestion {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

type SuggestionFetcher = (query: string) => Promise<SearchSuggestion[]>;

const TYPE_ICONS: Record<string, React.ElementType> = {
  candidate: FileText,
  user: Users,
  company: Building2,
  serviceProvider: UserCheck,
  hrManager: UserCheck,
};

const TYPE_LABELS: Record<string, string> = {
  candidate: "Candidate",
  user: "User",
  company: "Company",
  serviceProvider: "SP",
  hrManager: "HR",
};

// ── Props ──

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  onSearch?: (value: string) => void;
  loading?: boolean;
  className?: string;
  /** Key for localStorage history. Omit to disable history. */
  historyKey?: string;
  /** Enable live suggestions. Pass true to use global search, or a custom fetcher. */
  suggestions?: boolean | SuggestionFetcher;
}

// ── Default fetcher using global search API ──

async function defaultSuggestionFetcher(query: string): Promise<SearchSuggestion[]> {
  const { globalSearch } = await import("@/services/search.service");
  const res = await globalSearch(query, undefined, 5);
  const flat: SearchSuggestion[] = [];
  for (const [type, items] of Object.entries(res.results)) {
    for (const item of items) {
      flat.push({ ...item, type });
    }
  }
  return flat.slice(0, 6);
}

// ── Component ──

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  onSearch,
  loading = false,
  className,
  historyKey,
  suggestions = false,
}: SearchInputProps) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // History
  const [history, setHistory] = useState<string[]>([]);

  // Suggestions
  const [suggestItems, setSuggestItems] = useState<SearchSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const fetcher: SuggestionFetcher | null =
    suggestions === true
      ? defaultSuggestionFetcher
      : typeof suggestions === "function"
        ? suggestions
        : null;

  // Combined items for keyboard navigation: history items first, then suggestions
  // Each item has a kind so we know what action to take
  type DropdownItem =
    | { kind: "history"; term: string }
    | { kind: "suggestion"; item: SearchSuggestion }
    | { kind: "view-all" };

  // When input is empty → show history only
  // When input has text → show suggestions (+ "View all results" link)
  const hasQuery = value.trim().length >= MIN_SUGGEST_LENGTH;

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const items: DropdownItem[] = [];
    if (!hasQuery) {
      for (const term of history) {
        items.push({ kind: "history", term });
      }
    } else {
      for (const item of suggestItems) {
        items.push({ kind: "suggestion", item });
      }
      if (suggestItems.length > 0) {
        items.push({ kind: "view-all" });
      }
    }
    return items;
  }, [hasQuery, history, suggestItems]);

  const showSomething = showDropdown && dropdownItems.length > 0;

  const listboxId = "search-listbox";

  // ── Fetch suggestions ──

  const fetchSuggestions = useCallback(
    (query: string) => {
      if (!fetcher || query.trim().length < MIN_SUGGEST_LENGTH) {
        setSuggestItems([]);
        return;
      }

      // Cancel previous request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setSuggestLoading(true);
      fetcher(query.trim())
        .then((items) => {
          setSuggestItems(items);
          if (items.length > 0) setShowDropdown(true);
        })
        .catch(() => {
          // Aborted or failed — ignore
        })
        .finally(() => setSuggestLoading(false));
    },
    [fetcher],
  );

  // ── Open history (on focus with empty input) ──

  const openHistory = useCallback(() => {
    if (!historyKey) return;
    const items = getHistory(historyKey);
    setHistory(items);
    setActiveIndex(-1);
    if (items.length > 0 && value.trim().length < MIN_SUGGEST_LENGTH) {
      setShowDropdown(true);
    }
  }, [historyKey, value]);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setActiveIndex(-1);
  }, []);

  // ── Execute search ──

  const executeSearch = useCallback(
    (term: string) => {
      onChange(term);
      onSearch?.(term);
      if (historyKey && term.trim().length >= 2) {
        addToHistory(historyKey, term);
      }
      closeDropdown();
    },
    [onChange, onSearch, historyKey, closeDropdown],
  );

  // ── Navigate to suggestion ──

  const navigateToSuggestion = useCallback(
    (item: SearchSuggestion) => {
      if (historyKey) addToHistory(historyKey, item.title);
      closeDropdown();
      router.push(item.url);
    },
    [historyKey, closeDropdown, router],
  );

  // ── Input change ──

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Trigger page-level search with debounce.
      // NOTE: do NOT save to history here. Saving on every debounced
      // keystroke pollutes history with prefixes ("ja", "jak", "jakh"…).
      // History is only saved on an explicit commit — Enter, suggestion
      // click, "view all" — via executeSearch / navigateToSuggestion.
      if (onSearch) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onSearch(newValue);
        }, debounceMs);
      }

      // Trigger live suggestions with separate debounce
      if (fetcher) {
        if (suggestRef.current) clearTimeout(suggestRef.current);
        if (newValue.trim().length < MIN_SUGGEST_LENGTH) {
          setSuggestItems([]);
          // Show history instead if empty
          if (historyKey) {
            const items = getHistory(historyKey);
            setHistory(items);
            if (items.length > 0) setShowDropdown(true);
            else setShowDropdown(false);
          }
          return;
        }
        suggestRef.current = setTimeout(() => fetchSuggestions(newValue), SUGGESTION_DEBOUNCE);
      }
    },
    [onChange, onSearch, debounceMs, historyKey, fetcher, fetchSuggestions],
  );

  // ── Clear ──

  const handleClear = useCallback(() => {
    onChange("");
    onSearch?.("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (suggestRef.current) clearTimeout(suggestRef.current);
    setSuggestItems([]);
    closeDropdown();
    inputRef.current?.focus();
  }, [onChange, onSearch, closeDropdown]);

  // ── History management ──

  const handleClearHistory = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (historyKey) {
        clearHistoryStore(historyKey);
        setHistory([]);
        setShowDropdown(false);
      }
    },
    [historyKey],
  );

  const removeHistoryItem = useCallback(
    (e: React.MouseEvent, term: string) => {
      e.stopPropagation();
      if (!historyKey) return;
      const updated = history.filter((h) => h !== term);
      saveHistory(historyKey, updated);
      setHistory(updated);
      if (updated.length === 0) setShowDropdown(false);
    },
    [historyKey, history],
  );

  // ── Keyboard navigation ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (showSomething && activeIndex >= 0 && activeIndex < dropdownItems.length) {
          const item = dropdownItems[activeIndex]!;
          if (item.kind === "history") executeSearch(item.term);
          else if (item.kind === "suggestion") navigateToSuggestion(item.item);
          else if (item.kind === "view-all") executeSearch(value);
        } else {
          executeSearch(value);
        }
        return;
      }

      if (e.key === "Escape") {
        if (showSomething) closeDropdown();
        else if (value) handleClear();
        else inputRef.current?.blur();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!showSomething) {
          openHistory();
        } else {
          setActiveIndex((prev) => Math.min(prev + 1, dropdownItems.length - 1));
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (showSomething) {
          setActiveIndex((prev) => {
            if (prev <= 0) {
              closeDropdown();
              return -1;
            }
            return prev - 1;
          });
        }
        return;
      }

      if (e.key === "Tab" && showSomething && activeIndex >= 0) {
        e.preventDefault();
        const item = dropdownItems[activeIndex];
        if (item?.kind === "history") {
          onChange(item.term);
          closeDropdown();
        } else if (item?.kind === "suggestion") {
          onChange(item.item.title);
          closeDropdown();
        }
      }
    },
    [
      showSomething,
      activeIndex,
      dropdownItems,
      value,
      executeSearch,
      navigateToSuggestion,
      closeDropdown,
      openHistory,
      handleClear,
      onChange,
    ],
  );

  // ── Outside click ──

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closeDropdown]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (suggestRef.current) clearTimeout(suggestRef.current);
    };
  }, []);

  // Track index for dropdown items
  let itemIndex = 0;

  return (
    <div className={cn("relative", className)}>
      {/* Input */}
      <span className="text-text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search size={16} aria-hidden="true" />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={openHistory}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-expanded={showSomething}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
        role="combobox"
        autoComplete="off"
        className={cn(
          "bg-bg-input text-text-primary placeholder:text-text-muted h-9 w-full rounded-md pr-9 pl-9 text-sm",
          "border-border-default border transition-colors",
          "focus:border-border-focus focus:ring-primary-500 focus:ring-1 focus:outline-hidden",
        )}
      />
      <span className="absolute inset-y-0 right-0 flex items-center pr-2.5">
        {loading || suggestLoading ? (
          <Spinner size="sm" />
        ) : value ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="text-text-muted hover:text-text-primary focus-visible:ring-primary-500 rounded-xs p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </span>

      {/* Dropdown */}
      {showSomething && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          className="border-border-default bg-bg-surface-raised absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border shadow-lg"
        >
          {/* History section (when input is empty) */}
          {!hasQuery && history.length > 0 && (
            <>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-text-muted text-xs font-medium">Recent searches</span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-text-muted hover:text-error-500 flex items-center gap-1 text-xs transition-colors"
                >
                  <Trash2 size={10} />
                  Clear
                </button>
              </div>
              {history.map((term) => {
                const idx = itemIndex++;
                return (
                  <div
                    key={`h-${term}`}
                    id={`search-item-${idx}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => executeSearch(term)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors",
                      idx === activeIndex
                        ? "bg-primary-50 text-primary-700"
                        : "text-text-primary hover:bg-bg-hover",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-text-muted shrink-0" />
                      <span className="truncate">{term}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => removeHistoryItem(e, term)}
                      className="text-text-muted hover:text-error-500 shrink-0 p-0.5"
                      style={{ opacity: idx === activeIndex ? 1 : 0 }}
                      aria-label={`Remove "${term}"`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Suggestion results (when input has text) */}
          {hasQuery && suggestItems.length > 0 && (
            <>
              <div className="px-3 py-1.5">
                <span className="text-text-muted text-xs font-medium">Suggestions</span>
              </div>
              {suggestItems.map((item) => {
                const idx = itemIndex++;
                const Icon = TYPE_ICONS[item.type] ?? FileText;
                const label = TYPE_LABELS[item.type] ?? item.type;
                return (
                  <div
                    key={`s-${item.type}-${item.id}`}
                    id={`search-item-${idx}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => navigateToSuggestion(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors",
                      idx === activeIndex
                        ? "bg-primary-50 text-primary-700"
                        : "text-text-primary hover:bg-bg-hover",
                    )}
                  >
                    <Icon size={14} className="text-text-muted shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-text-muted truncate text-xs">{item.subtitle}</div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        "bg-bg-muted text-text-muted",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
              {/* View all results link */}
              {(() => {
                const idx = itemIndex++;
                return (
                  <div
                    id={`search-item-${idx}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => executeSearch(value)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "border-border-default flex cursor-pointer items-center gap-2 border-t px-3 py-2 text-sm transition-colors",
                      idx === activeIndex
                        ? "bg-primary-50 text-primary-700"
                        : "text-primary-500 hover:bg-bg-hover",
                    )}
                  >
                    <ArrowRight size={12} />
                    <span>View all results for &ldquo;{value.trim()}&rdquo;</span>
                  </div>
                );
              })()}
            </>
          )}

          {/* Keyboard hints */}
          <div className="border-border-default border-t px-3 py-1.5">
            <span className="text-text-muted text-xs">
              <kbd className="bg-bg-muted rounded px-1 text-[10px]">Enter</kbd> search{" "}
              <kbd className="bg-bg-muted rounded px-1 text-[10px]">&uarr;&darr;</kbd> navigate{" "}
              <kbd className="bg-bg-muted rounded px-1 text-[10px]">Esc</kbd> close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
