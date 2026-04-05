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
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <h1 className="text-4xl font-bold">Something went wrong</h1>
        <p className="mt-4 text-gray-500">A critical error occurred. Please refresh the page.</p>
        {error.digest && <p className="mt-2 text-xs text-gray-400">Error ID: {error.digest}</p>}
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
