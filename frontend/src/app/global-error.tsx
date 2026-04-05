"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary (last resort). Spec Section 24.19
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // §24.14 — Report to Sentry
  useEffect(() => {
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-bg-page text-text-primary flex min-h-screen flex-col items-center justify-center px-4">
        <h1 className="text-4xl font-bold">Something went wrong</h1>
        <p className="text-text-secondary mt-4">A critical error occurred. Please refresh the page.</p>
        {error.digest && <p className="text-text-muted mt-2 text-xs">Error ID: {error.digest}</p>}
        <button
          onClick={reset}
          className="bg-primary-600 hover:bg-primary-700 mt-6 rounded-md px-6 py-2.5 text-sm font-medium text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
