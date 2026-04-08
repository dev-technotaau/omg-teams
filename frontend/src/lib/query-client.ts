import { QueryClient } from "@tanstack/react-query";

// ──────────────────────────────────────────────
//  TanStack Query defaults — tuned for the enterprise UX patterns this app
//  uses everywhere:
//
//   - `staleTime: 30s` — most lists are fine to serve from cache for 30s
//     instead of refetching on every navigation. Pages that need fresher
//     data override per-query.
//
//   - `gcTime: 10m` — keep evicted caches around for 10 minutes so going
//     "list → detail → back to list" hits the cache instantly with no
//     skeleton flash.
//
//   - `refetchOnWindowFocus: true` — when the user tabs back in we silently
//     re-validate so they're never looking at stale data. Combined with
//     `placeholderData: keepPreviousData` per-query, the previous data
//     stays visible while the refetch runs (no skeleton flicker).
//
//   - `refetchOnReconnect: true` — same idea after a network drop.
//
//   - `retry: 1` — one retry on transient network errors, but not on 4xx
//     (handled by the per-query function).
//
//   - `mutations.retry: 0` — never auto-retry mutations; they're not
//     idempotent and double-creates are worse than a single failure toast.
// ──────────────────────────────────────────────

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: (failureCount, error) => {
          // Don't retry 4xx — those are user/auth errors, not transient.
          const status = (error as { status?: number } | undefined)?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
