// ──────────────────────────────────────────────
//  Query Helpers — generic patterns for list mutations
//
//  Most CRUD pages share the same shape:
//
//    - Read: paginated list of items
//    - Mutate: create / update / delete one item
//    - Want: instant UI update + automatic rollback if the request fails
//
//  TanStack Query supports this through `onMutate` (snapshot + apply patch),
//  `onError` (rollback to snapshot), and `onSettled` (re-fetch the truth).
//  Doing it correctly per-page is repetitive boilerplate, so we centralise
//  the patterns here. Pages just hand us the query key and a patcher fn.
//
//  All helpers are *generic* — they don't know about holidays vs companies
//  vs employees, only that the cache holds an object with an items array.
// ──────────────────────────────────────────────

import { type QueryClient, type QueryKey } from "@tanstack/react-query";
import { extractApiError, type ApiError } from "@/lib/api";
import { toast } from "sonner";

/**
 * Standard list payload shape used by every paginated endpoint in this app.
 * Most backend list endpoints return `{ items: T[], pagination: {...} }`.
 * Some return `{ data, pagination }` — pages adapt with their own type, but
 * the generic helpers operate on this common shape.
 */
export interface ListPayload<T> {
  items?: T[];
  data?: T[];
  pagination?: {
    page: number;
    pageSize?: number;
    totalPages: number;
    total: number;
  };
}

/**
 * Read the items array out of a list payload regardless of which key the
 * backend used (`items` vs `data`). Returns `[]` if neither exists.
 */
export function getItems<T>(payload: ListPayload<T> | undefined): T[] {
  if (!payload) return [];
  return payload.items ?? payload.data ?? [];
}

/**
 * Build a context object describing all the list-shaped caches affected by
 * a mutation, then patch each one with the supplied transform. Used by the
 * optimistic helpers below.
 *
 * Returns a rollback function that restores every snapshotted cache to its
 * pre-mutation value.
 */
export async function snapshotAndPatchLists<T>(
  qc: QueryClient,
  listsKey: QueryKey,
  patch: (items: T[]) => T[],
): Promise<() => void> {
  // Cancel any in-flight refetches so they don't overwrite our optimistic
  // patch with stale data after we've applied it.
  await qc.cancelQueries({ queryKey: listsKey });

  const snapshots = qc.getQueriesData<ListPayload<T>>({ queryKey: listsKey });

  for (const [key, prev] of snapshots) {
    if (!prev) continue;
    const items = getItems(prev);
    const next = patch(items);
    qc.setQueryData<ListPayload<T>>(key, {
      ...prev,
      ...(prev.items !== undefined ? { items: next } : {}),
      ...(prev.data !== undefined ? { data: next } : {}),
    });
  }

  return () => {
    for (const [key, prev] of snapshots) {
      qc.setQueryData(key, prev);
    }
  };
}

/**
 * Optimistic create — prepends a temporary record to every list cache for
 * the resource. Returns the rollback fn so the caller's `onError` can undo.
 */
export function optimisticCreate<T extends { id: string }>(
  qc: QueryClient,
  listsKey: QueryKey,
  newItem: T,
): Promise<() => void> {
  return snapshotAndPatchLists<T>(qc, listsKey, (items) => [newItem, ...items]);
}

/**
 * Optimistic update — patches an existing record in place across every
 * list cache. Matched by `id`. Returns the rollback fn.
 */
export function optimisticUpdate<T extends { id: string }>(
  qc: QueryClient,
  listsKey: QueryKey,
  id: string,
  patch: Partial<T>,
): Promise<() => void> {
  return snapshotAndPatchLists<T>(qc, listsKey, (items) =>
    items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
  );
}

/**
 * Optimistic delete — removes a record by id from every list cache.
 * Returns the rollback fn.
 */
export function optimisticDelete<T extends { id: string }>(
  qc: QueryClient,
  listsKey: QueryKey,
  id: string,
): Promise<() => void> {
  return snapshotAndPatchLists<T>(qc, listsKey, (items) =>
    items.filter((it) => it.id !== id),
  );
}

/**
 * Standard error toast for mutations. Pulls the message out of an API or
 * generic error using the existing `extractApiError` so toasts read the
 * same way as the rest of the app.
 */
export function toastApiError(err: unknown, fallback: string): ApiError {
  const apiErr = extractApiError(err);
  toast.error(apiErr.message || fallback);
  return apiErr;
}

/**
 * Generate a transient client-side id for optimistic creates that haven't
 * been confirmed by the server yet. We strip these on the next refetch.
 */
export function tempId(): string {
  return `__temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
