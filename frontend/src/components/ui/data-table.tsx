"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Inbox,
  LayoutGrid,
  LayoutList,
  Columns3,
  AlignJustify,
  Pin,
  PinOff,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { Drawer } from "./drawer";
import { Select } from "./select";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/use-click-outside";
import { TableSkeleton } from "./skeleton";
import { EmptyState } from "./empty-state";
import { PAGE_SIZE_OPTIONS } from "@/constants/pagination";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  className?: string;
  /** Whether this column can be hidden via column visibility toggle. Defaults to true. */
  hideable?: boolean;
  /** Whether this column starts hidden. */
  defaultHidden?: boolean;
}

export type ViewType = "table" | "card";
export type RowDensity = "compact" | "default" | "spacious";

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  // Sorting
  sortKey?: string;
  sortDir?: "asc" | "desc";
  /**
   * Called when sort changes. `key` is `null` when the user clears sort
   * (3-state cycle: none → asc → desc → none).
   */
  onSort?: (key: string | null, dir: "asc" | "desc" | null) => void;
  // Pagination
  page?: number;
  totalPages?: number;
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Selection
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  getRowId?: (row: T) => string;
  // Row click
  onRowClick?: (row: T) => void;
  // Bulk actions
  bulkActions?: {
    label: string;
    icon?: LucideIcon;
    onClick: (ids: Set<string>) => void;
    variant?: "danger" | "default";
  }[];
  // Quick export
  onExport?: () => void;
  exportLabel?: string;
  // §23.17 — Print button
  showPrint?: boolean;
  // View toggle
  viewType?: ViewType;
  onViewTypeChange?: (type: ViewType) => void;
  cardRenderer?: (row: T) => React.ReactNode;
  // §12.3 — View By / group-by support
  groupByKey?: string;
  groupByLabel?: string;
  groupByOptions?: { value: string; label: string }[];
  onGroupByChange?: (key: string) => void;
  getGroupValue?: (row: T) => string;
  // §12.3 — Quick filters (predefined one-click filter buttons)
  quickFilters?: { label: string; value: string; active?: boolean }[];
  onQuickFilter?: (value: string) => void;
  // Display options
  striped?: boolean;
  stickyHeader?: boolean;
  compact?: boolean;
  className?: string;

  // ── Column visibility toggle ──
  enableColumnVisibility?: boolean;

  // ── Row density toggle ──
  density?: RowDensity;
  onDensityChange?: (density: RowDensity) => void;

  // ── Pinned / bookmarked rows ──
  pinnedIds?: Set<string>;
  onPinChange?: (ids: Set<string>) => void;

  // ── Detail panel (slide-over drawer) ──
  detailRenderer?: (row: T) => React.ReactNode;
  detailTitle?: (row: T) => string;

  // ── Keyboard navigation (j/k, Enter, Space, /) ──
  enableKeyboardNav?: boolean;
  /** Ref to the search input element — pressing "/" focuses it */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;

  // ── Collapsible group-by sections ──
  collapsibleGroups?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function defaultGetRowId<T>(row: T): string {
  const r = row as Record<string, unknown>;
  return String(r.id ?? r._id ?? "");
}

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

const VIRTUALIZATION_THRESHOLD = 50;
const ROW_HEIGHT = 44;
const ROW_HEIGHT_COMPACT = 36;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyIcon = Inbox,
  emptyTitle = "No data",
  emptyDescription = "There are no records to display.",
  sortKey,
  sortDir,
  onSort,
  page = 1,
  totalPages = 1,
  total,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  selectable = false,
  selectedIds,
  onSelectionChange,
  getRowId = defaultGetRowId,
  onRowClick,
  bulkActions,
  onExport,
  exportLabel = "Export",
  showPrint,
  viewType = "table",
  onViewTypeChange,
  cardRenderer,
  groupByKey,
  groupByLabel = "Group by",
  groupByOptions,
  onGroupByChange,
  getGroupValue,
  quickFilters,
  onQuickFilter,
  striped = false,
  stickyHeader = false,
  compact = false,
  className,
  enableColumnVisibility = false,
  density: densityProp,
  onDensityChange,
  pinnedIds,
  onPinChange,
  detailRenderer,
  detailTitle,
  enableKeyboardNav = false,
  searchInputRef,
  collapsibleGroups = false,
}: DataTableProps<T>) {
  const checkboxAllRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  /* ── Column Visibility ── */
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const col of columns) {
      if (col.defaultHidden) init[col.key] = false;
    }
    return init;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  // Close column visibility dropdown on outside click / touch + Escape key
  useClickOutside(columnMenuRef, () => {
    if (showColumnMenu) setShowColumnMenu(false);
  });
  useEffect(() => {
    if (!showColumnMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowColumnMenu(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showColumnMenu]);

  const visibleColumns = useMemo(
    () => columns.filter((col) => columnVisibility[col.key] !== false),
    [columns, columnVisibility],
  );

  const toggleColumnVisibility = useCallback((key: string) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: prev[key] === false }));
  }, []);

  /* ── Row Density ── */
  const [localDensity, setLocalDensity] = useState<RowDensity>("default");
  const density = densityProp ?? localDensity;
  const handleDensityChange = useCallback(
    (d: RowDensity) => {
      if (onDensityChange) onDensityChange(d);
      else setLocalDensity(d);
    },
    [onDensityChange],
  );

  const cellPad =
    density === "compact" || compact
      ? "px-3 py-1.5"
      : density === "spacious"
        ? "px-5 py-4"
        : "px-4 py-3";
  const headerPad =
    density === "compact" || compact
      ? "px-3 py-2"
      : density === "spacious"
        ? "px-5 py-3.5"
        : "px-4 py-3";
  const textSize =
    density === "compact" || compact ? "text-xs" : density === "spacious" ? "text-sm" : "text-sm";
  const estimatedRowHeight =
    density === "compact" || compact
      ? ROW_HEIGHT_COMPACT
      : density === "spacious"
        ? 56
        : ROW_HEIGHT;

  /* ── Pinned rows ── */
  const sortedData = useMemo(() => {
    if (!pinnedIds || pinnedIds.size === 0) return data;
    const pinned: T[] = [];
    const rest: T[] = [];
    for (const row of data) {
      if (pinnedIds.has(getRowId(row))) pinned.push(row);
      else rest.push(row);
    }
    return [...pinned, ...rest];
  }, [data, pinnedIds, getRowId]);

  const togglePin = useCallback(
    (id: string) => {
      if (!onPinChange || !pinnedIds) return;
      const next = new Set(pinnedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onPinChange(next);
    },
    [pinnedIds, onPinChange],
  );

  /* ── Detail panel (slide-over) ── */
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const detailRow = useMemo(
    () => (detailRowId ? (sortedData.find((r) => getRowId(r) === detailRowId) ?? null) : null),
    [detailRowId, sortedData, getRowId],
  );

  /* ── Row selection toggle (defined before keyboard nav so it can be referenced) ── */
  const toggleRow = useCallback(
    (id: string) => {
      if (!onSelectionChange || !selectedIds) return;
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
    },
    [onSelectionChange, selectedIds],
  );

  /* ── Keyboard navigation ── */
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);

  useEffect(() => {
    if (!enableKeyboardNav) return;
    const container = tableContainerRef.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      // "/" focuses search
      if (e.key === "/" && searchInputRef?.current) {
        e.preventDefault();
        searchInputRef.current.focus();
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      )
        return;

      const maxIndex = sortedData.length - 1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.min(prev + 1, maxIndex));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && focusedRowIndex >= 0) {
        e.preventDefault();
        const row = sortedData[focusedRowIndex];
        if (row && detailRenderer) {
          setDetailRowId(getRowId(row));
        } else if (row && onRowClick) {
          onRowClick(row);
        }
      } else if (e.key === " " && focusedRowIndex >= 0 && selectable) {
        e.preventDefault();
        const row = sortedData[focusedRowIndex];
        if (row) toggleRow(getRowId(row));
      } else if (e.key === "x" && focusedRowIndex >= 0 && onPinChange) {
        e.preventDefault();
        const row = sortedData[focusedRowIndex];
        if (row) togglePin(getRowId(row));
      } else if (e.key === "Escape") {
        setFocusedRowIndex(-1);
        setDetailRowId(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    enableKeyboardNav,
    focusedRowIndex,
    sortedData,
    getRowId,
    detailRenderer,
    onRowClick,
    selectable,
    onPinChange,
    searchInputRef,
    togglePin,
    toggleRow,
  ]);

  /* ── Collapsible groups ── */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((groupVal: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupVal)) next.delete(groupVal);
      else next.add(groupVal);
      return next;
    });
  }, []);

  /* Virtualization — only active when rows exceed threshold */
  const shouldVirtualize = sortedData.length >= VIRTUALIZATION_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 10,
    enabled: shouldVirtualize,
  });

  /* Selection helpers */
  const allIds = useMemo(() => sortedData.map((row) => getRowId(row)), [sortedData, getRowId]);
  const selectedCount = selectedIds?.size ?? 0;
  const allSelected = selectedCount > 0 && selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  // Sync indeterminate state on the "select all" checkbox
  const setCheckboxAllRef = useCallback(
    (el: HTMLInputElement | null) => {
      (checkboxAllRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      if (el) el.indeterminate = someSelected;
    },
    [someSelected],
  );

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allIds));
    }
  }, [allSelected, allIds, onSelectionChange]);

  /* Pagination helpers */
  const rangeStart = total != null ? (page - 1) * pageSize + 1 : null;
  const rangeEnd = total != null ? Math.min(page * pageSize, total) : null;

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  /* ---------------------------------------------------------------- */
  /*  Row renderer (shared between virtual and non-virtual)           */
  /* ---------------------------------------------------------------- */

  const renderRow = useCallback(
    (row: T, rowIndex: number) => {
      const rowId = getRowId(row);
      const isSelected = selectedIds?.has(rowId);
      const isPinned = pinnedIds?.has(rowId);
      const isFocused = enableKeyboardNav && rowIndex === focusedRowIndex;
      const isClickable = !!onRowClick || !!detailRenderer;

      const handleClick = () => {
        if (detailRenderer) {
          setDetailRowId((prev) => (prev === rowId ? null : rowId));
        } else if (onRowClick) {
          onRowClick(row);
        }
      };

      return (
        <tr
          key={rowId || rowIndex}
          onClick={isClickable ? handleClick : undefined}
          onKeyDown={
            isClickable
              ? (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick();
                  }
                }
              : undefined
          }
          tabIndex={isClickable ? 0 : undefined}
          role={isClickable ? "button" : undefined}
          data-row-index={rowIndex}
          className={cn(
            "border-border-default border-b transition-colors last:border-b-0",
            textSize,
            "hover:bg-bg-hover",
            isClickable &&
              "focus-visible:ring-primary-500 cursor-pointer focus-visible:ring-2 focus-visible:outline-hidden",
            striped && rowIndex % 2 === 1 && "bg-bg-muted/30",
            isSelected && "bg-primary-100/30",
            isPinned && "bg-warning-50 border-l-warning-400 border-l-2",
            isFocused && "ring-primary-500 ring-2 ring-inset",
            detailRowId === rowId && "bg-primary-50",
          )}
        >
          {/* Pin indicator */}
          {onPinChange && (
            <td className={cn("w-8", cellPad)}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(rowId);
                }}
                className={cn(
                  "rounded p-0.5 transition-colors",
                  isPinned
                    ? "text-warning-500"
                    : "text-text-muted opacity-0 group-hover:opacity-100 hover:opacity-100",
                )}
                aria-label={isPinned ? "Unpin row" : "Pin row"}
                title={isPinned ? "Unpin" : "Pin to top"}
              >
                {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
            </td>
          )}
          {selectable && (
            <td className={cn("w-10", cellPad)}>
              <input
                type="checkbox"
                checked={isSelected ?? false}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleRow(rowId);
                }}
                onClick={(e) => e.stopPropagation()}
                className="border-border-default accent-primary-500 h-4 w-4 cursor-pointer rounded-sm"
                aria-label={`Select row ${rowId}`}
              />
            </td>
          )}
          {visibleColumns.map((col) => {
            const cellValue = col.cell
              ? col.cell(row)
              : (row as Record<string, unknown>)[col.key] != null
                ? String((row as Record<string, unknown>)[col.key])
                : "";
            // Don't propagate clicks from the actions column — buttons inside
            // should not also trigger the row's detail drawer / onRowClick.
            const isActionsCell = col.key === "actions";

            return (
              <td
                key={col.key}
                onClick={isActionsCell ? (e) => e.stopPropagation() : undefined}
                className={cn(
                  "text-text-primary align-middle",
                  cellPad,
                  alignClasses[col.align ?? "left"],
                  col.className,
                )}
              >
                {cellValue}
              </td>
            );
          })}
          {/* Detail expand indicator */}
          {detailRenderer && (
            <td className={cn("w-8", cellPad)}>
              <ChevronRightIcon
                size={14}
                className={cn(
                  "text-text-muted transition-transform",
                  detailRowId === rowId && "rotate-90",
                )}
              />
            </td>
          )}
        </tr>
      );
    },
    [
      getRowId,
      selectedIds,
      pinnedIds,
      onPinChange,
      onRowClick,
      detailRenderer,
      selectable,
      cellPad,
      textSize,
      striped,
      visibleColumns,
      toggleRow,
      togglePin,
      enableKeyboardNav,
      focusedRowIndex,
      detailRowId,
    ],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} />;
  }

  if (sortedData.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  const colSpanCount =
    visibleColumns.length + (selectable ? 1 : 0) + (onPinChange ? 1 : 0) + (detailRenderer ? 1 : 0);

  return (
    <div ref={tableContainerRef} className={cn("w-full", className)}>
      {/* Toolbar: sort + group-by + export + view toggle + density + column visibility */}
      {(onExport ||
        onViewTypeChange ||
        onGroupByChange ||
        enableColumnVisibility ||
        onDensityChange ||
        densityProp ||
        (onSort && columns.some((c) => c.sortable))) && (
        <div className="mb-2 flex items-center justify-end gap-2">
          {/* Sort by dropdown + direction toggle (mirrors clickable header sort) */}
          {onSort && columns.some((c) => c.sortable) && (
            <div className="flex items-center gap-1">
              <Select
                size="sm"
                value={sortKey ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) {
                    onSort(null, null);
                  } else {
                    onSort(next, sortDir ?? "asc");
                  }
                }}
                options={[
                  { value: "", label: "Sort by…" },
                  ...columns
                    .filter((c) => c.sortable)
                    .map((c) => ({ value: c.key, label: c.header })),
                ]}
                className="w-auto min-w-36"
              />
              <button
                type="button"
                disabled={!sortKey}
                onClick={() =>
                  sortKey && onSort(sortKey, sortDir === "asc" ? "desc" : "asc")
                }
                className="border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover inline-flex h-8 w-8 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={sortDir === "desc" ? "Sort descending" : "Sort ascending"}
                title={sortDir === "desc" ? "Descending" : "Ascending"}
              >
                {sortDir === "desc" ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />}
              </button>
            </div>
          )}
          {/* §12.3 — View By / group-by selector */}
          {onGroupByChange && groupByOptions && (
            <Select
              size="sm"
              value={groupByKey ?? ""}
              onChange={(e) => onGroupByChange(e.target.value)}
              options={[
                { value: "", label: `${groupByLabel}: None` },
                ...groupByOptions.map((opt) => ({
                  value: opt.value,
                  label: `${groupByLabel}: ${opt.label}`,
                })),
              ]}
              className="w-auto min-w-40"
            />
          )}
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition"
            >
              <Download size={14} />
              {exportLabel}
            </button>
          )}
          {showPrint && (
            <button
              type="button"
              onClick={() => window.print()}
              className="border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition"
              data-print="hide"
            >
              <Download size={14} />
              Print
            </button>
          )}
          {/* Density toggle */}
          {(onDensityChange || densityProp != null) && (
            <div className="border-border-default flex overflow-hidden rounded-md border">
              {(["compact", "default", "spacious"] as RowDensity[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDensityChange(d)}
                  className={cn(
                    "inline-flex h-8 items-center justify-center px-2 text-[10px] font-medium transition",
                    density === d
                      ? "bg-primary-500 text-white"
                      : "bg-bg-surface text-text-secondary hover:bg-bg-hover",
                  )}
                  aria-label={`${d} density`}
                  title={d[0]!.toUpperCase() + d.slice(1)}
                >
                  <AlignJustify size={d === "compact" ? 10 : d === "spacious" ? 16 : 13} />
                </button>
              ))}
            </div>
          )}
          {/* Column visibility */}
          {enableColumnVisibility && (
            <div className="relative" ref={columnMenuRef}>
              <button
                type="button"
                onClick={() => setShowColumnMenu((v) => !v)}
                className="border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition"
                aria-label="Toggle columns"
                aria-expanded={showColumnMenu}
                aria-haspopup="true"
              >
                <Columns3 size={14} />
                Columns
              </button>
              {showColumnMenu && (
                <div
                  role="menu"
                  className="border-border-default bg-bg-surface-raised absolute right-0 z-20 mt-1 w-48 rounded-lg border p-2 shadow-lg"
                >
                  {columns
                    .filter((c) => c.hideable !== false && c.key !== "actions")
                    .map((col) => (
                      <label
                        key={col.key}
                        className="hover:bg-bg-hover flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={columnVisibility[col.key] !== false}
                          onChange={() => toggleColumnVisibility(col.key)}
                          className="accent-primary-500 h-3.5 w-3.5 rounded-sm"
                        />
                        <span className="text-text-primary">{col.header}</span>
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}
          {onViewTypeChange && cardRenderer && (
            <div className="border-border-default flex overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => onViewTypeChange("table")}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center transition",
                  viewType === "table"
                    ? "bg-primary-500 text-white"
                    : "bg-bg-surface text-text-secondary hover:bg-bg-hover",
                )}
                aria-label="Table view"
              >
                <LayoutList size={14} />
              </button>
              <button
                type="button"
                onClick={() => onViewTypeChange("card")}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center transition",
                  viewType === "card"
                    ? "bg-primary-500 text-white"
                    : "bg-bg-surface text-text-secondary hover:bg-bg-hover",
                )}
                aria-label="Card view"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* §12.3 — Quick filter buttons */}
      {quickFilters && quickFilters.length > 0 && onQuickFilter && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {quickFilters.map((qf) => (
            <button
              key={qf.value}
              type="button"
              onClick={() => onQuickFilter(qf.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                qf.active
                  ? "bg-primary-500 text-white"
                  : "border-border-default bg-bg-surface text-text-secondary hover:bg-bg-hover border",
              )}
            >
              {qf.label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectable && selectedCount > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="border-primary-100 bg-primary-100/40 mb-2 flex items-center gap-3 rounded-lg border px-4 py-2">
          <span className="text-text-primary text-sm font-medium">{selectedCount} selected</span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => action.onClick(selectedIds ?? new Set())}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                    action.variant === "danger"
                      ? "bg-error-100 text-error-700 hover:bg-error-500 hover:text-white"
                      : "bg-bg-surface text-text-primary hover:bg-bg-hover",
                  )}
                >
                  {ActionIcon && <ActionIcon size={14} />}
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Card view */}
      {viewType === "card" && cardRenderer ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedData.map((row, i) => (
            <div key={getRowId(row) || i}>{cardRenderer(row)}</div>
          ))}
        </div>
      ) : (
        /* Table view */
        <div
          ref={parentRef}
          className={cn(
            "border-border-default overflow-x-auto rounded-lg border",
            shouldVirtualize && "max-h-[600px] overflow-y-auto",
          )}
        >
          <table className={cn("w-full border-collapse", textSize)}>
            {/* Head */}
            <thead>
              <tr
                className={cn(
                  "border-border-default bg-bg-muted/50 border-b",
                  (stickyHeader || shouldVirtualize) && "sticky top-0 z-10",
                )}
              >
                {onPinChange && <th className={cn("w-8", headerPad)} />}
                {selectable && (
                  <th className={cn("w-10", headerPad)}>
                    <input
                      ref={setCheckboxAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="border-border-default accent-primary-500 h-4 w-4 cursor-pointer rounded-sm"
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => {
                  const isSorted = sortKey === col.key;
                  const canSort = col.sortable && onSort;
                  const cycleSort = () => {
                    if (!onSort) return;
                    if (sortKey !== col.key) {
                      onSort(col.key, "asc");
                    } else if (sortDir === "asc") {
                      onSort(col.key, "desc");
                    } else {
                      onSort(null, null);
                    }
                  };

                  return (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        "text-text-secondary align-middle font-medium whitespace-nowrap",
                        headerPad,
                        alignClasses[col.align ?? "left"],
                        canSort && "hover:text-text-primary cursor-pointer select-none",
                        col.className,
                      )}
                      onClick={canSort ? cycleSort : undefined}
                      onKeyDown={
                        canSort
                          ? (e: React.KeyboardEvent) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                cycleSort();
                              }
                            }
                          : undefined
                      }
                      tabIndex={canSort ? 0 : undefined}
                      role={canSort ? "button" : undefined}
                      aria-sort={
                        isSorted ? (sortDir === "asc" ? "ascending" : "descending") : undefined
                      }
                    >
                      {canSort ? (
                        <span className="inline-flex items-center gap-1 align-middle">
                          {col.header}
                          <span className="inline-flex flex-col" aria-hidden="true">
                            {isSorted ? (
                              sortDir === "asc" ? (
                                <ChevronUp size={14} className="text-primary-500" />
                              ) : (
                                <ChevronDown size={14} className="text-primary-500" />
                              )
                            ) : (
                              <ChevronsUpDown size={14} className="opacity-40" />
                            )}
                          </span>
                        </span>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
                {detailRenderer && <th className={cn("w-8", headerPad)} />}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {shouldVirtualize ? (
                <>
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        colSpan={colSpanCount}
                        style={{ height: virtualizer.getVirtualItems()[0]!.start, padding: 0 }}
                      />
                    </tr>
                  )}
                  {virtualizer
                    .getVirtualItems()
                    .map((virtualRow) =>
                      renderRow(sortedData[virtualRow.index]!, virtualRow.index),
                    )}
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        colSpan={colSpanCount}
                        style={{
                          height:
                            virtualizer.getTotalSize() -
                            (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                          padding: 0,
                        }}
                      />
                    </tr>
                  )}
                </>
              ) : groupByKey && getGroupValue ? (
                // §12.3 — Render rows with collapsible group section headers
                (() => {
                  let lastGroup = "";
                  const rows: React.ReactNode[] = [];

                  sortedData.forEach((row, rowIndex) => {
                    const groupVal = getGroupValue(row);
                    const showHeader = groupVal !== lastGroup;

                    if (showHeader && lastGroup !== "") {
                      // Close previous group
                    }

                    if (showHeader) {
                      lastGroup = groupVal;
                      const isCollapsed = collapsibleGroups && collapsedGroups.has(groupVal);
                      const groupCount = sortedData.filter(
                        (r) => getGroupValue(r) === groupVal,
                      ).length;

                      rows.push(
                        <tr
                          key={`group-${groupVal}`}
                          className="bg-bg-muted hover:bg-bg-hover cursor-pointer"
                          onClick={collapsibleGroups ? () => toggleGroup(groupVal) : undefined}
                        >
                          <td
                            colSpan={colSpanCount}
                            className="text-text-secondary px-4 py-2 text-xs font-semibold tracking-wider uppercase"
                          >
                            <span className="inline-flex items-center gap-2">
                              {collapsibleGroups && (
                                <ChevronRightIcon
                                  size={14}
                                  className={cn(
                                    "transition-transform",
                                    !isCollapsed && "rotate-90",
                                  )}
                                />
                              )}
                              {groupVal || "Ungrouped"}
                              <span className="bg-bg-surface text-text-muted rounded-full px-2 py-0.5 text-[10px] font-normal">
                                {groupCount}
                              </span>
                            </span>
                          </td>
                        </tr>,
                      );
                    }

                    const isCollapsed = collapsibleGroups && collapsedGroups.has(groupVal);
                    if (!isCollapsed) {
                      rows.push(
                        <React.Fragment key={getRowId(row) || rowIndex}>
                          {renderRow(row, rowIndex)}
                        </React.Fragment>,
                      );
                    }
                  });
                  return rows;
                })()
              ) : (
                sortedData.map((row, rowIndex) => renderRow(row, rowIndex))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination bar */}
      {onPageChange && totalPages >= 1 && (
        <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          {/* Left: summary + page size selector */}
          <div className="text-text-secondary flex items-center gap-4">
            {rangeStart != null && rangeEnd != null && total != null && (
              <span>
                Showing {rangeStart}&ndash;{rangeEnd} of {total}
              </span>
            )}
            {/* §12.1 — Rows per page selector (always shown when pagination active) */}
            <div className="flex items-center gap-2">
              <label htmlFor="dt-page-size" className="text-text-muted text-xs">
                Per page:
              </label>
              <Select
                id="dt-page-size"
                size="sm"
                value={String(pageSize)}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  if (onPageSizeChange) {
                    onPageSizeChange(newSize);
                  } else if (onPageChange) {
                    // Fallback: store in URL and reload at page 1
                    const url = new URL(window.location.href);
                    url.searchParams.set("pageSize", String(newSize));
                    url.searchParams.set("page", "1");
                    window.history.replaceState(null, "", url.toString());
                    onPageChange(1);
                  }
                }}
                options={PAGE_SIZE_OPTIONS.map((opt) => ({
                  value: String(opt),
                  label: String(opt),
                }))}
                className="w-20 min-w-0"
              />
            </div>
          </div>

          {/* Right: page navigation */}
          {totalPages > 1 && (
            <nav className="flex items-center gap-1" aria-label="Pagination">
              {/* First */}
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(1)}
                className="text-text-secondary hover:bg-bg-hover inline-flex h-8 w-8 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-40"
                aria-label="First page"
              >
                <ChevronsLeft size={16} />
              </button>
              {/* Previous */}
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="text-text-secondary hover:bg-bg-hover inline-flex h-8 w-8 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page numbers */}
              {pageNumbers.map((p, i) =>
                p === "ellipsis" ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="text-text-muted inline-flex h-8 w-8 items-center justify-center"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition",
                      p === page
                        ? "bg-primary-500 text-white"
                        : "text-text-secondary hover:bg-bg-hover",
                    )}
                    aria-current={p === page ? "page" : undefined}
                    aria-label={`Page ${p}`}
                  >
                    {p}
                  </button>
                ),
              )}

              {/* Next */}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="text-text-secondary hover:bg-bg-hover inline-flex h-8 w-8 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
              {/* Last */}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(totalPages)}
                className="text-text-secondary hover:bg-bg-hover inline-flex h-8 w-8 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-40"
                aria-label="Last page"
              >
                <ChevronsRight size={16} />
              </button>
            </nav>
          )}
        </div>
      )}

      {/* ── Keyboard nav hint ── */}
      {enableKeyboardNav && focusedRowIndex >= 0 && (
        <div className="text-text-muted mt-1 text-[10px]">
          <kbd className="bg-bg-muted rounded px-1">j/k</kbd> navigate{" "}
          <kbd className="bg-bg-muted rounded px-1">Enter</kbd> open{" "}
          {selectable && (
            <>
              <kbd className="bg-bg-muted rounded px-1">Space</kbd> select{" "}
            </>
          )}
          {onPinChange && (
            <>
              <kbd className="bg-bg-muted rounded px-1">x</kbd> pin{" "}
            </>
          )}
          <kbd className="bg-bg-muted rounded px-1">Esc</kbd> close
        </div>
      )}

      {/* ── Detail panel slide-over ── */}
      {detailRenderer && (
        <Drawer
          open={!!detailRow}
          onClose={() => setDetailRowId(null)}
          title={detailRow && detailTitle ? detailTitle(detailRow) : "Details"}
          size="lg"
        >
          {detailRow && detailRenderer(detailRow)}
        </Drawer>
      )}
    </div>
  );
}
