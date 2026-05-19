"use client";

import { useMemo, useState } from "react";
import { GripVertical, ArrowUp, ArrowDown, X, RotateCcw, Search } from "lucide-react";
import { Button, Checkbox, Input } from "@/components/ui";
import type { ColumnDef, ReportTypeColumnInfo } from "@/services/report.service";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
//  ColumnPicker — reusable for Generate, Schedule, Templates.
//
//  Layout:
//    Left panel  — searchable, grouped column pool with
//                  checkboxes. Clicking adds to (or removes from)
//                  the selection.
//    Right panel — ordered selection. Drag to reorder (HTML5
//                  drag-and-drop), arrow buttons for keyboard
//                  users, × to remove.
//
//  All state is controlled — parent owns `selectedKeys`.
// ─────────────────────────────────────────────────────────────

interface ColumnPickerProps {
  info: ReportTypeColumnInfo | null;
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  className?: string;
}

export function ColumnPicker({ info, selectedKeys, onChange, className }: ColumnPickerProps) {
  const [search, setSearch] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const pool = useMemo<ColumnDef[]>(() => info?.columns ?? [], [info]);
  const defaults = useMemo<string[]>(() => info?.defaultKeys ?? [], [info]);

  const byKey = useMemo(() => new Map(pool.map((c) => [c.key, c])), [pool]);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const filteredPool = useMemo(() => {
    if (!search.trim()) return pool;
    const q = search.trim().toLowerCase();
    return pool.filter(
      (c) => c.header.toLowerCase().includes(q) || c.key.toLowerCase().includes(q),
    );
  }, [pool, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ColumnDef[]>();
    for (const c of filteredPool) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [filteredPool]);

  const toggle = (key: string) => {
    if (selectedSet.has(key)) {
      onChange(selectedKeys.filter((k) => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  };

  const remove = (key: string) => onChange(selectedKeys.filter((k) => k !== key));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= selectedKeys.length || from === to) return;
    const next = selectedKeys.slice();
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    onChange(next);
  };

  const selectAll = () => onChange(pool.map((c) => c.key));
  const clearAll = () => onChange([]);
  const resetDefaults = () => onChange(defaults);

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null) return;
    move(dragIdx, idx);
    setDragIdx(null);
  };

  if (!info) {
    return (
      <div className={cn("text-text-secondary text-sm italic", className)}>
        Select a report type to configure columns.
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}>
      {/* Pool */}
      <div className="border-border-default flex min-h-[320px] flex-col rounded-lg border">
        <div className="border-border-default flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-text-primary text-sm font-medium">
            Available columns ({pool.length})
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={selectAll}
              className="text-text-accent text-xs hover:underline"
            >
              All
            </button>
            <span className="text-text-tertiary text-xs">·</span>
            <button
              type="button"
              onClick={resetDefaults}
              className="text-text-accent text-xs hover:underline"
            >
              Defaults
            </button>
            <span className="text-text-tertiary text-xs">·</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-text-accent text-xs hover:underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="border-border-default border-b px-3 py-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns…"
            leftIcon={Search}
          />
        </div>
        <div className="max-h-[420px] flex-1 overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <p className="text-text-secondary px-2 py-4 text-sm italic">No columns match.</p>
          ) : (
            grouped.map(([group, cols]) => (
              <div key={group} className="mb-3">
                <p className="text-text-secondary mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {cols.map((c) => (
                    <li key={c.key}>
                      <label className="hover:bg-bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1">
                        <Checkbox checked={selectedSet.has(c.key)} onChange={() => toggle(c.key)} />
                        <span className="text-text-primary text-sm">{c.header}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selected (ordered) */}
      <div className="border-border-default flex min-h-[320px] flex-col rounded-lg border">
        <div className="border-border-default flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-text-primary text-sm font-medium">
            Selected ({selectedKeys.length})
          </p>
          <Button
            variant="ghost"
            size="xs"
            leftIcon={RotateCcw}
            onClick={resetDefaults}
            type="button"
          >
            Reset
          </Button>
        </div>
        <div className="max-h-[480px] flex-1 overflow-y-auto p-2">
          {selectedKeys.length === 0 ? (
            <p className="text-text-secondary px-2 py-4 text-sm italic">
              No columns selected. Pick at least one from the left.
            </p>
          ) : (
            <ol className="space-y-1">
              {selectedKeys.map((key, idx) => {
                const def = byKey.get(key);
                if (!def) return null;
                return (
                  <li
                    key={key}
                    draggable
                    onDragStart={onDragStart(idx)}
                    onDragOver={onDragOver}
                    onDrop={onDrop(idx)}
                    className={cn(
                      "bg-bg-surface border-border-default group flex items-center gap-2 rounded border px-2 py-1.5",
                      dragIdx === idx && "opacity-50",
                    )}
                  >
                    <GripVertical
                      size={14}
                      className="text-text-tertiary cursor-grab active:cursor-grabbing"
                    />
                    <span className="text-text-tertiary w-5 text-right text-xs">{idx + 1}</span>
                    <span className="text-text-primary flex-1 truncate text-sm">
                      {def.header}
                    </span>
                    <span className="text-text-tertiary text-[10px] uppercase tracking-wide">
                      {def.group}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(idx, idx - 1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                      className="text-text-secondary hover:text-text-primary disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, idx + 1)}
                      disabled={idx === selectedKeys.length - 1}
                      aria-label="Move down"
                      className="text-text-secondary hover:text-text-primary disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(key)}
                      aria-label="Remove"
                      className="text-text-danger hover:opacity-80"
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
