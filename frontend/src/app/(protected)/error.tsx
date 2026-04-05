"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * §24.19.9 — Protected routes error boundary.
 * Renders within the app layout (sidebar/header stay visible).
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Protected route error:", error);
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="text-error-500 mb-4">
        <svg
          width="40"
          height="40"
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
      <h2 className="text-text-primary text-2xl font-bold">Something went wrong</h2>
      <p className="text-text-secondary mt-2 max-w-md text-center text-sm">
        This section encountered an error. The rest of the application is still working.
      </p>
      {error.digest && <p className="text-text-muted mt-1 text-xs">Error ID: {error.digest}</p>}
      <div className="mt-5 flex gap-3">
        <button
          onClick={reset}
          className="bg-primary-500 hover:bg-primary-600 rounded-md px-5 py-2 text-sm font-medium text-white transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="border-border-default text-text-primary hover:bg-bg-hover rounded-md border px-5 py-2 text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
