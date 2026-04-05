"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * §24.19.5 — Custom 404 page with branded design.
 */
export default function NotFound() {
  const router = useRouter();

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-secondary-700 text-6xl font-extrabold">404</h1>
      <p className="text-foreground mt-4 text-lg font-semibold">Page not found</p>
      <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground rounded-md px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Go to Dashboard
        </Link>
        <button
          onClick={() => router.back()}
          className="border-border text-foreground hover:bg-muted rounded-md border px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
