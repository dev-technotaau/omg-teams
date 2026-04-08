"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Floating Scroll-to-Top Button
//  with circular scroll progress indicator
//  synced in real-time to scroll position
// ──────────────────────────────────────────────

export function ScrollToTop() {
  const [scrollPct, setScrollPct] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Find the scrollable <main> element (not window — layout uses overflow-y-auto on main)
    const main = document.querySelector("main");
    if (!main) return;

    let frame = 0;
    const compute = () => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = main;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) {
        setScrollPct(0);
        setVisible(false);
        return;
      }
      setScrollPct(Math.min(1, scrollTop / maxScroll));
      setVisible(scrollTop > 200);
    };

    const onScroll = () => {
      // Coalesce scroll events to one update per animation frame
      if (frame) return;
      frame = requestAnimationFrame(compute);
    };

    main.addEventListener("scroll", onScroll, { passive: true });
    compute(); // initial
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToTop = useCallback(() => {
    const main = document.querySelector("main");
    main?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // SVG circle progress
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - scrollPct);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cn(
        "fixed right-5 bottom-5 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all duration-300",
        "bg-primary-500 hover:bg-primary-600 text-white",
        "focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      {/* Circular progress ring */}
      <svg className="absolute inset-0 -rotate-90" width="44" height="44" viewBox="0 0 44 44">
        {/* Background track */}
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="3"
        />
        {/* Progress arc */}
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      {/* Arrow icon */}
      <ArrowUp size={18} className="relative z-10" />
    </button>
  );
}
