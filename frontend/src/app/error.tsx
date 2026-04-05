"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * §24.19.9 — Route-level error boundary.
 * Catches runtime errors and shows branded fallback UI.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
    // §24.14 — Report to Sentry
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
      {/* Warning icon */}
      <div className="text-error-500 mb-4">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1 className="text-foreground text-3xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-center">
        An unexpected error occurred. Please try again or go back to the dashboard.
      </p>
      {error.digest && (
        <p className="text-muted-foreground mt-2 text-xs">Error ID: {error.digest}</p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground rounded-md px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="border-border text-foreground hover:bg-muted rounded-md border px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>

      {/* §24.19.9 — Dev-mode stack trace for debugging */}
      {isDev && error.stack && (
        <pre className="bg-muted text-muted-foreground mt-8 max-h-64 max-w-2xl overflow-auto rounded-md p-4 text-left text-xs">
          {error.stack}
        </pre>
      )}
    </div>
  );
}
