"use client";

import { useEffect, useRef } from "react";
import { useAppSelector } from "@/store/redux";

// ──────────────────────────────────────────────
//  Favicon Badge
//
//  Draws the unread notification count on top of
//  the existing favicon and swaps the <link rel="icon">
//  href. Restores the original favicon when count drops
//  to 0 or on unmount.
//
//  Completely self-contained, fail-safe (any error →
//  silent restore of the original favicon).
// ──────────────────────────────────────────────

const BADGE_COLOR = "#ef4444"; // red-500
const BADGE_TEXT_COLOR = "#ffffff";
const SIZE = 64;

/** Find the current favicon <link> element (prefers PNG > ICO > first one). */
function getFaviconLink(): HTMLLinkElement | null {
  if (typeof document === "undefined") return null;
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"),
  );
  if (links.length === 0) return null;
  const png = links.find((l) => l.type === "image/png");
  if (png) return png;
  return links[0] ?? null;
}

export function FaviconBadge() {
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount);
  const originalHrefRef = useRef<string | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const link = getFaviconLink();
    if (!link) return;

    // Cache the original href once
    if (originalHrefRef.current === null) {
      originalHrefRef.current = link.href;
    }

    // If count is 0, restore the original favicon
    if (unreadCount <= 0) {
      link.href = originalHrefRef.current;
      return;
    }

    // Lazy-load the base image (once)
    const drawBadge = (img: HTMLImageElement) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 1. Draw the base logo
        ctx.drawImage(img, 0, 0, SIZE, SIZE);

        // 2. Draw the red badge circle (top-right)
        const r = 18;
        const cx = SIZE - r - 2;
        const cy = r + 2;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = BADGE_COLOR;
        ctx.fill();

        // 3. Draw the count text
        const label = unreadCount > 9 ? "9+" : String(unreadCount);
        ctx.fillStyle = BADGE_TEXT_COLOR;
        ctx.font = `bold ${label.length > 1 ? 22 : 26}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx, cy + 1);

        // 4. Swap the favicon
        link.href = canvas.toDataURL("image/png");
      } catch {
        // Canvas tainted or any other failure — restore original
        if (originalHrefRef.current) link.href = originalHrefRef.current;
      }
    };

    if (baseImageRef.current?.complete) {
      drawBadge(baseImageRef.current);
      return;
    }

    const img = new Image();
    // Use the cached original to avoid drawing badges on an already-badged icon
    img.src = originalHrefRef.current;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      baseImageRef.current = img;
      drawBadge(img);
    };
    img.onerror = () => {
      // Image failed to load — leave the favicon alone
    };
  }, [unreadCount]);

  // Restore on unmount
  useEffect(() => {
    return () => {
      const link = getFaviconLink();
      if (link && originalHrefRef.current) {
        link.href = originalHrefRef.current;
      }
    };
  }, []);

  return null;
}
