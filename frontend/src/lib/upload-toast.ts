import { toast } from "sonner";
import { extractApiError } from "@/lib/api";

// ─────────────────────────────────────────────────────────────
//  Upload + action toast helpers
//
//  Wraps a promise with sonner's built-in loading → success/error
//  lifecycle, using a single stable toast ID so the spinner toast
//  *becomes* the success/error toast (no stacked notifications).
//
//  Use `withUploadToast()` for any upload that hits Cloudinary / R2
//  through the BFF proxy; use `withActionToast()` for related delete
//  / update operations (no spinner difference — same API, different
//  default copy).
// ─────────────────────────────────────────────────────────────

let counter = 0;
function nextToastId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

interface UploadToastOptions {
  /** Verb shown in the toast — defaults to "Uploading". */
  verb?: string;
  /** Success message override — defaults to "<label> uploaded". */
  successMessage?: string;
  /** Error message override — defaults to the API error message. */
  errorMessage?: string;
}

/**
 * Wrap an upload promise with a loading spinner toast that transitions
 * to success / error on settle. Returns the original promise's value so
 * callers can chain `await withUploadToast(...)` and use the result.
 */
export async function withUploadToast<T>(
  label: string,
  fn: () => Promise<T>,
  opts: UploadToastOptions = {},
): Promise<T> {
  const id = nextToastId("upload");
  const verb = opts.verb ?? "Uploading";
  toast.loading(`${verb} ${label}…`, { id });
  try {
    const value = await fn();
    toast.success(opts.successMessage ?? `${label} uploaded`, { id });
    return value;
  } catch (err) {
    const message = opts.errorMessage ?? extractApiError(err).message;
    toast.error(message || `Failed to upload ${label}`, { id });
    throw err;
  }
}

interface ActionToastOptions {
  /** Loading copy — defaults to "<verb>ing <label>…". */
  loadingMessage?: string;
  /** Success copy — defaults to "<label> <pastVerb>". */
  successMessage?: string;
  /** Error message override — defaults to the API error message. */
  errorMessage?: string;
}

/**
 * Wrap a delete / update promise with a loading toast that transitions
 * to success / error. Same lifecycle as `withUploadToast` but with
 * action-friendly defaults (e.g. "Removing photo…" / "Photo removed").
 */
export async function withActionToast<T>(
  label: string,
  pastVerb: "removed" | "updated" | "saved" | "deleted",
  fn: () => Promise<T>,
  opts: ActionToastOptions = {},
): Promise<T> {
  const id = nextToastId("action");
  const presentVerbMap = {
    removed: "Removing",
    updated: "Updating",
    saved: "Saving",
    deleted: "Deleting",
  } as const;
  const loading = opts.loadingMessage ?? `${presentVerbMap[pastVerb]} ${label}…`;
  toast.loading(loading, { id });
  try {
    const value = await fn();
    toast.success(opts.successMessage ?? `${label} ${pastVerb}`, { id });
    return value;
  } catch (err) {
    const message = opts.errorMessage ?? extractApiError(err).message;
    toast.error(message || `Failed to ${pastVerb.replace(/d$/, "")} ${label}`, {
      id,
    });
    throw err;
  }
}
