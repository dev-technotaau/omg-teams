/**
 * §24.19.6 — Root loading page with logo + spinner.
 * Shown during initial app load and top-level route transitions.
 */
export default function Loading() {
  return (
    <div className="bg-bg-page flex min-h-screen flex-col items-center justify-center gap-4">
      {/* Platform logo / name */}
      <div className="animate-pulse">
        <h1 className="text-primary-500 text-2xl font-bold tracking-tight">OMG Teams</h1>
      </div>
      {/* Spinner */}
      <div
        className="border-primary-500 h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent"
        role="status"
        aria-label="Loading"
      />
      <p className="text-text-muted text-sm">Loading...</p>
    </div>
  );
}
