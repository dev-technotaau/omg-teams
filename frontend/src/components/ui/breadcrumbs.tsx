"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

export function Breadcrumbs({ items, separator = "/", className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  // On mobile, show first item, ellipsis, and last 2 items when there are more than 3
  const renderMobileItems = () => {
    if (items.length <= 3) return null;

    const first = items[0];
    const lastTwo = items.slice(-2);

    return (
      <ol className="flex items-center gap-1.5 text-sm md:hidden">
        <li className="flex items-center gap-1.5">
          {first.href ? (
            <Link href={first.href} className="text-primary-500 transition-colors hover:underline">
              {first.label}
            </Link>
          ) : (
            <span className="text-text-muted">{first.label}</span>
          )}
          <span className="text-text-muted" aria-hidden="true">
            {separator}
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-text-muted">...</span>
          <span className="text-text-muted" aria-hidden="true">
            {separator}
          </span>
        </li>
        {lastTwo.map((item, idx) => {
          const isLast = idx === lastTwo.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {isLast ? (
                <span className="text-text-primary font-medium" aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <>
                  <Link
                    href={item.href}
                    className="text-primary-500 transition-colors hover:underline"
                  >
                    {item.label}
                  </Link>
                  <span className="text-text-muted" aria-hidden="true">
                    {separator}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-text-muted">{item.label}</span>
                  <span className="text-text-muted" aria-hidden="true">
                    {separator}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      {/* Mobile truncated view */}
      {renderMobileItems()}

      {/* Desktop full view (or mobile when 3 or fewer items) */}
      <ol className={cn("flex items-center gap-1.5", items.length > 3 ? "hidden md:flex" : "flex")}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {isLast ? (
                <span className="text-text-primary font-medium" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-primary-500 transition-colors hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-text-muted">{item.label}</span>
                  )}
                  <span className="text-text-muted" aria-hidden="true">
                    {separator}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
