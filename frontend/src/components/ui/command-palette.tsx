"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowRight, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  /** Optional href — when present, Enter pushes via router and Shift+Enter
   *  opens in a new tab. onSelect is still called on plain Enter. */
  href?: string;
  /** Plain-Enter handler (or any navigation that doesn't need a new tab).
   *  Called inside the palette's keyboard / click handlers; the palette
   *  closes after it returns. */
  onSelect: () => void;
  /** Free-text aliases — fuzzy-matched alongside the label. */
  keywords?: string[];
  /** Optional trailing slot (e.g. a pin / star button) rendered at the
   *  far right of the row. Click handler should `stopPropagation()` so
   *  the palette doesn't treat the click as a select. */
  trailing?: React.ReactNode;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups?: CommandGroup[];
  /** Optional callback fired when the user submits a non-empty query (Enter).
   *  Used to push the query to the history list for ↑-recall on next open. */
  onSubmitQuery?: (query: string) => void;
  /** Optional history list — when the input is empty, ↑ cycles through these
   *  (most-recent first), filling the input. Once the user types again, the
   *  cycle resets. */
  history?: string[];
}

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (lowerText.includes(lowerQuery)) return true;

  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

export function CommandPalette({
  open,
  onClose,
  groups = [],
  onSubmitQuery,
  history = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Shell-style history cursor — only meaningful when query is empty.
  // Reset to -1 (no history) every time the user types something new.
  const [historyCursor, setHistoryCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            fuzzyMatch(item.label, query) || item.keywords?.some((kw) => fuzzyMatch(kw, query)),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  // Flat list of all visible items for keyboard nav
  const flatItems = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setFocusedIndex(0);
      setHistoryCursor(-1);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset focused index + history cursor when the user actively types
  useEffect(() => {
    setFocusedIndex(0);
    if (query.length > 0) setHistoryCursor(-1);
  }, [query]);

  // Scroll focused item into view
  useEffect(() => {
    if (!listRef.current) return;
    const focused = listRef.current.querySelector("[data-focused='true']");
    if (focused) {
      focused.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
          break;
        case "ArrowUp":
          // Shell-style history recall — only when the input is empty.
          // Once the user types anything, ↑ goes back to moving focus.
          if (query.length === 0 && history.length > 0) {
            e.preventDefault();
            const nextCursor = Math.min(historyCursor + 1, history.length - 1);
            setHistoryCursor(nextCursor);
            const next = history[nextCursor];
            if (next !== undefined) setQuery(next);
            return;
          }
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter": {
          e.preventDefault();
          const item = flatItems[focusedIndex];
          if (!item) return;
          // Shift+Enter on an href item → open in a new tab. Plain Enter
          // always closes the palette and runs onSelect.
          if (e.shiftKey && item.href && typeof window !== "undefined") {
            window.open(item.href, "_blank", "noopener,noreferrer");
            onClose();
          } else {
            item.onSelect();
            onClose();
          }
          if (onSubmitQuery && query.trim().length > 0) onSubmitQuery(query);
          break;
        }
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, focusedIndex, onClose, onSubmitQuery, query, history, historyCursor],
  );

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-fade-in border-border-default bg-bg-surface-raised relative z-10 w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="border-border-default flex items-center gap-3 border-b px-4 py-3">
          <Search size={18} className="text-text-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="text-text-primary placeholder:text-text-muted flex-1 bg-transparent text-sm focus:outline-hidden"
            aria-label="Search commands"
            aria-activedescendant={
              flatItems[focusedIndex] ? `command-item-${flatItems[focusedIndex].id}` : undefined
            }
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-autocomplete="list"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="text-text-muted hover:bg-bg-hover hover:text-text-primary shrink-0 rounded-md p-1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          className="max-h-[50vh] overflow-y-auto p-2"
        >
          {filteredGroups.length === 0 ? (
            <div className="text-text-muted py-8 text-center text-sm">No results found.</div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label}>
                <div className="text-text-muted px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  runningIndex++;
                  const isFocused = runningIndex === focusedIndex;
                  const currentIndex = runningIndex;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      id={`command-item-${item.id}`}
                      role="option"
                      aria-selected={isFocused}
                      data-focused={isFocused}
                      className={cn(
                        "group/cmd flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                        isFocused
                          ? "bg-bg-hover text-text-primary"
                          : "text-text-secondary hover:bg-bg-hover",
                      )}
                      onClick={() => {
                        item.onSelect();
                        if (onSubmitQuery && query.trim().length > 0) onSubmitQuery(query);
                        onClose();
                      }}
                      onMouseEnter={() => setFocusedIndex(currentIndex)}
                    >
                      {Icon ? (
                        <Icon size={16} aria-hidden="true" className="shrink-0" />
                      ) : (
                        <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="border-border-default bg-bg-muted text-text-muted shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                          {item.shortcut}
                        </kbd>
                      )}
                      {item.trailing && (
                        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          {item.trailing}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-border-default text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs">
          <span className="flex items-center gap-1">
            <kbd className="border-border-default bg-bg-muted rounded-sm border px-1 py-0.5 font-mono">
              &uarr;&darr;
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border-border-default bg-bg-muted rounded-sm border px-1 py-0.5 font-mono">
              &crarr;
            </kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border-border-default bg-bg-muted rounded-sm border px-1 py-0.5 font-mono">
              &#x21E7;&crarr;
            </kbd>
            New tab
          </span>
          {query.length === 0 && history.length > 0 && (
            <span className="flex items-center gap-1">
              <kbd className="border-border-default bg-bg-muted rounded-sm border px-1 py-0.5 font-mono">
                &uarr;
              </kbd>
              History
            </span>
          )}
          <span className="flex items-center gap-1">
            <kbd className="border-border-default bg-bg-muted rounded-sm border px-1 py-0.5 font-mono">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to register Ctrl+K / Cmd+K and manage open state for the command palette.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen, onClose: () => setOpen(false) };
}
