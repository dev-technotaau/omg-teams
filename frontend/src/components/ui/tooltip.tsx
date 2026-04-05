"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement<{ ref?: React.Ref<HTMLElement> }>;
  delay?: number;
}

const ARROW_SIZE = 6;
const GAP = 4;

export function Tooltip({ content, side = "top", children, delay = 200 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  // Position calculation
  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();

    // Wait one frame so the tooltip element is in the DOM
    requestAnimationFrame(() => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const tipRect = tooltip.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (side) {
        case "top":
          top = rect.top - tipRect.height - ARROW_SIZE - GAP + window.scrollY;
          left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;
          break;
        case "bottom":
          top = rect.bottom + ARROW_SIZE + GAP + window.scrollY;
          left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;
          break;
        case "left":
          top = rect.top + rect.height / 2 - tipRect.height / 2 + window.scrollY;
          left = rect.left - tipRect.width - ARROW_SIZE - GAP + window.scrollX;
          break;
        case "right":
          top = rect.top + rect.height / 2 - tipRect.height / 2 + window.scrollY;
          left = rect.right + ARROW_SIZE + GAP + window.scrollX;
          break;
      }

      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
      top = Math.max(8, top);

      setCoords({ top, left });
    });
  }, [visible, side]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const arrowClasses: Record<string, string> = {
    top: "left-1/2 -translate-x-1/2 top-full border-t-bg-sidebar border-x-transparent border-b-transparent",
    bottom:
      "left-1/2 -translate-x-1/2 bottom-full border-b-bg-sidebar border-x-transparent border-t-transparent",
    left: "top-1/2 -translate-y-1/2 left-full border-l-bg-sidebar border-y-transparent border-r-transparent",
    right:
      "top-1/2 -translate-y-1/2 right-full border-r-bg-sidebar border-y-transparent border-l-transparent",
  };

  return (
    <>
      {/* Clone child and attach event handlers + ref */}
      <span
        ref={triggerRef as React.RefObject<HTMLSpanElement>}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {visible &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={cn(
              "animate-fade-in bg-bg-sidebar pointer-events-none absolute z-200 max-w-xs rounded-md px-2.5 py-1.5 text-xs text-white shadow-lg",
            )}
            style={coords ? { top: coords.top, left: coords.left } : { top: -9999, left: -9999 }}
          >
            {content}
            <span
              className={cn("absolute h-0 w-0 border-[5px]", arrowClasses[side])}
              aria-hidden="true"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
