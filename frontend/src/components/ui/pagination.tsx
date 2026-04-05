"use client";

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  showPageSize?: boolean;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

function generatePageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current <= 3) {
    pages.push(2, 3, 4, "ellipsis", total);
  } else if (current >= total - 2) {
    pages.push("ellipsis", total - 3, total - 2, total - 1, total);
  } else {
    pages.push("ellipsis", current - 1, current, current + 1, "ellipsis", total);
  }

  return pages;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  showPageSize = false,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  className,
}: PaginationProps) {
  const rangeStart = Math.min((page - 1) * pageSize + 1, total);
  const rangeEnd = Math.min(page * pageSize, total);

  const pageNumbers = useMemo(() => generatePageNumbers(page, totalPages), [page, totalPages]);

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const navButtonClass =
    "inline-flex items-center justify-center h-8 w-8 rounded-md text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {/* Left side: summary and optional page size */}
      <div className="text-text-secondary flex items-center gap-4 text-sm">
        <span>
          Showing {rangeStart}&ndash;{rangeEnd} of {total} results
        </span>
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size-select" className="text-text-muted text-sm">
              Per page:
            </label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border-border-default bg-bg-input text-text-primary focus:border-border-focus focus:ring-primary-500 h-8 rounded-md border px-2 text-sm focus:ring-1 focus:outline-hidden"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: page navigation */}
      {/* Compact mobile view */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          disabled={isFirstPage}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className={cn(navButtonClass, "border-border-default hover:bg-bg-hover border")}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-text-primary text-sm font-medium">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={isLastPage}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className={cn(navButtonClass, "border-border-default hover:bg-bg-hover border")}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Full desktop view */}
      <nav aria-label="Pagination" className="hidden items-center gap-1 sm:flex">
        <button
          type="button"
          disabled={isFirstPage}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          className={cn(navButtonClass, "text-text-secondary hover:bg-bg-hover")}
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          disabled={isFirstPage}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className={cn(navButtonClass, "text-text-secondary hover:bg-bg-hover")}
        >
          <ChevronLeft size={16} />
        </button>

        {pageNumbers.map((p, idx) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${idx}`}
              className="text-text-muted inline-flex h-8 w-8 items-center justify-center text-sm"
              aria-hidden="true"
            >
              &hellip;
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                navButtonClass,
                p === page ? "bg-primary-500 text-white" : "text-text-secondary hover:bg-bg-hover",
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={isLastPage}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className={cn(navButtonClass, "text-text-secondary hover:bg-bg-hover")}
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          disabled={isLastPage}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          className={cn(navButtonClass, "text-text-secondary hover:bg-bg-hover")}
        >
          <ChevronsRight size={16} />
        </button>
      </nav>
    </div>
  );
}
