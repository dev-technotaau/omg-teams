"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Wrench, RefreshCw, Mail, Clock, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMaintenanceStore } from "@/store/maintenance";

// ──────────────────────────────────────────────
//  Maintenance Mode Page — Spec §24.18
//
//  Full-screen page with:
//  - Animated gradient background orbs
//  - Rotating status messages
//  - Countdown timer (from Firebase Remote Config)
//  - Auto-refresh polling every 30s
//  - Keyboard shortcut (R to refresh)
// ──────────────────────────────────────────────

const STATUS_MESSAGES = [
  "Upgrading system components...",
  "Optimizing database performance...",
  "Deploying latest improvements...",
  "Running security patches...",
  "Enhancing platform reliability...",
  "Configuring new features...",
  "Fine-tuning search algorithms...",
  "Improving application speed...",
];

const AUTO_REFRESH_INTERVAL = 30_000;
const SUPPORT_EMAIL = "info@opportunitymakers.in";

interface MaintenancePageProps {
  message?: string | null;
  estimatedReturnTime?: string | null;
}

export default function MaintenancePage(props: MaintenancePageProps = {}) {
  const storeMessage = useMaintenanceStore((s) => s.message);
  const storeReturnTime = useMaintenanceStore((s) => s.estimatedReturnTime);

  const { theme, setTheme } = useTheme();
  const message = props.message || storeMessage;
  const estimatedReturnTime = props.estimatedReturnTime || storeReturnTime;

  const [statusIndex, setStatusIndex] = useState(0);
  const [countdown, setCountdown] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // Rotate status messages every 4s
  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!estimatedReturnTime) {
      queueMicrotask(() => setCountdown(null));
      return;
    }

    const target = new Date(estimatedReturnTime).getTime();
    if (Number.isNaN(target) || target <= Date.now()) {
      queueMicrotask(() => setCountdown(null));
      return;
    }

    function updateCountdown() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        window.location.reload();
        return;
      }
      setCountdown({
        hours: Math.floor(diff / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      });
    }

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [estimatedReturnTime]);

  // Auto-refresh: poll feature flags (bypass Axios 503 interceptor with raw fetch)
  const reloadTriggered = useRef(false);
  useEffect(() => {
    async function checkMaintenance() {
      if (reloadTriggered.current) return;
      try {
        const url = `/api/proxy/feature-flags/client?fresh=true&_t=${Date.now()}`;
        const res = await fetch(url, { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.maintenanceMode === false) {
            reloadTriggered.current = true;
            window.location.reload();
          }
        }
      } catch {
        // Network error — keep showing maintenance page
      }
    }

    const timer = setInterval(checkMaintenance, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut: press R to refresh
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "r" || e.key === "R") {
        if (
          (e.target as HTMLElement).tagName === "INPUT" ||
          (e.target as HTMLElement).tagName === "TEXTAREA"
        )
          return;
        handleRefresh();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRefresh]);

  return (
    <div className="bg-bg-page relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Theme toggle — top right corner */}
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="text-text-secondary hover:text-text-primary hover:bg-bg-hover fixed top-4 right-4 z-50 rounded-lg p-2 transition-colors"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Animated background orbs */}
      <motion.div
        className="from-primary-500/20 pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-linear-to-br to-blue-500/10 blur-3xl"
        animate={{ x: [0, 60, -30, 0], y: [0, -40, 50, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-linear-to-br from-purple-500/15 to-pink-500/10 blur-3xl"
        animate={{ x: [0, -50, 40, 0], y: [0, 60, -30, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-linear-to-br from-emerald-500/15 to-teal-500/10 blur-3xl"
        animate={{ x: [0, 40, -60, 0], y: [0, -50, 30, 0], scale: [1, 1.1, 0.9, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Main content card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 mx-4 w-full max-w-lg"
      >
        <div className="border-border-default bg-bg-surface rounded-2xl border p-8 shadow-xl sm:p-12">
          {/* Animated icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center"
          >
            <motion.div
              className="bg-primary-100 absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="bg-primary-100 relative flex h-20 w-20 items-center justify-center rounded-full">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Settings className="text-primary-500 h-10 w-10" />
              </motion.div>
              <motion.div
                className="absolute -right-1 -bottom-1"
                animate={{ rotate: [-10, 10, -10] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="bg-bg-surface flex h-8 w-8 items-center justify-center rounded-full shadow-md">
                  <Wrench className="text-primary-500 h-4 w-4" />
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-text-primary mb-3 text-center text-2xl font-bold sm:text-3xl"
          >
            Scheduled Maintenance
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-text-secondary mb-6 text-center"
          >
            {message ||
              "We're performing scheduled maintenance to improve your experience. We'll be back online shortly."}
          </motion.p>

          {/* Rotating status message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-6 flex h-8 items-center justify-center"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={statusIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="text-primary-500 text-sm font-medium"
              >
                {STATUS_MESSAGES[statusIndex]}
              </motion.span>
            </AnimatePresence>
          </motion.div>

          {/* Progress dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-8 flex items-center justify-center gap-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="bg-primary-500 h-2.5 w-2.5 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              />
            ))}
          </motion.div>

          {/* Countdown timer */}
          {countdown && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-8"
            >
              <div className="text-text-muted mb-2 flex items-center justify-center gap-1.5 text-xs font-medium tracking-wider uppercase">
                <Clock className="h-3.5 w-3.5" />
                Estimated return
              </div>
              <div className="flex items-center justify-center gap-3">
                {[
                  { label: "Hours", value: countdown.hours },
                  { label: "Min", value: countdown.minutes },
                  { label: "Sec", value: countdown.seconds },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="border-border-default bg-bg-page text-text-primary flex h-14 w-14 items-center justify-center rounded-lg border text-xl font-bold tabular-nums">
                      {String(value).padStart(2, "0")}
                    </div>
                    <span className="text-text-muted mt-1 block text-[10px] font-medium tracking-wider uppercase">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Divider */}
          <div className="border-border-default mb-6 border-t" />

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <button
              onClick={handleRefresh}
              className="bg-primary-500 hover:bg-primary-600 focus:ring-primary-500/50 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-hidden"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="border-border-default text-text-secondary hover:bg-bg-hover focus:ring-primary-500/50 inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors focus:ring-2 focus:outline-hidden"
            >
              <Mail className="h-4 w-4" />
              Contact Support
            </a>
          </motion.div>

          {/* Keyboard hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-text-muted mt-6 text-center text-xs"
          >
            Press{" "}
            <kbd className="border-border-default bg-bg-page rounded-sm border px-1.5 py-0.5 font-mono text-[10px]">
              R
            </kbd>{" "}
            to refresh
          </motion.p>
        </div>

        {/* Auto-refresh indicator */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-text-muted mt-4 text-center text-xs"
        >
          This page automatically checks for updates every 30 seconds
        </motion.p>
      </motion.div>
    </div>
  );
}
