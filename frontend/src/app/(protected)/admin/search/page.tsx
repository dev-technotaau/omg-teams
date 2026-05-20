"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Users, Building2, Briefcase, UserCheck, Shield, Loader2 } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { globalSearch, type SearchResult } from "@/services/search.service";
import { PageHeader, SearchInput, Card, Badge, Tabs, EmptyState } from "@/components/ui";
import { useTabSearchParam } from "@/hooks";

const SEARCH_TYPE_IDS = [
  "all",
  "candidate",
  "company",
  "serviceprovider",
  "hrmanager",
  "user",
] as const;
type SearchTypeId = (typeof SEARCH_TYPE_IDS)[number];

const TYPE_META: Record<string, { label: string; icon: typeof Users; color: string }> = {
  candidate: { label: "Candidates", icon: Users, color: "text-primary-500" },
  company: { label: "Companies", icon: Building2, color: "text-warning-700" },
  serviceprovider: {
    label: "Service Providers",
    icon: Briefcase,
    color: "text-success-700",
  },
  hrmanager: { label: "HR Managers", icon: UserCheck, color: "text-error-500" },
  user: { label: "Users", icon: Shield, color: "text-text-secondary" },
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlQ = searchParams.get("q") ?? "";

  // Page state. `query` is the controlled input value (typed text);
  // `urlQ` (derived from searchParams) is the *committed* query that
  // actually drives the fetch. Keeping these separate lets the user
  // edit the input without re-firing the search until they commit
  // (Enter) or the debounced onSearch pushes a new URL.
  const [query, setQuery] = useState(urlQ);
  const [results, setResults] = useState<Record<string, SearchResult[]>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeType, setActiveType] = useTabSearchParam<SearchTypeId>(
    "type",
    "all",
    SEARCH_TYPE_IDS,
  );
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Single source of truth: the URL drives the fetch. When `?q=` changes
  // (via handleSearch's router.push or browser back/forward), this effect
  // re-fetches. The cancellation flag prevents a stale in-flight request
  // from overwriting newer results.
  useEffect(() => {
    if (urlQ.length < 2) {
      // reason: syncing external state (URL) into local result state — the
      // rule's documented allowed pattern for "subscribe to external system
      // → setState in response". Same idiom as the sidebar's mounted flag.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({});
      setTotalCount(0);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    globalSearch(urlQ, undefined, 200)
      .then((res) => {
        if (cancelled) return;
        setResults(res.results);
        setTotalCount(res.totalCount);
        setPage(1);
      })
      .catch(() => {
        /* silent */
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [urlQ]);

  const handleSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      // Below the 2-char minimum (including empty from the Clear button):
      // drop the `q` param so the fetch effect sees urlQ === "" and
      // clears results. Without this, clearing the input leaves the
      // previous URL + results frozen.
      if (trimmed.length < 2) {
        router.push(pathname);
        setActiveType("all");
        return;
      }
      // Use current pathname so this works regardless of where the page
      // is mounted (was /search, now /admin/search). Hardcoding the path
      // is what caused the URL-flicker loop after the relocation.
      router.push(`${pathname}?q=${encodeURIComponent(trimmed)}`);
      // Reset the type tab to "all" on a fresh user-initiated search.
      // Doing this here (instead of inside the fetch effect) breaks the
      // setActiveType → searchParams → effect re-fire loop.
      setActiveType("all");
    },
    [router, pathname, setActiveType],
  );

  const typeKeys = Object.keys(results).filter((k) => results[k].length > 0);
  const displayTypes = activeType === "all" ? typeKeys : typeKeys.filter((k) => k === activeType);

  const tabs = [
    { id: "all", label: "All", badge: totalCount },
    ...typeKeys.map((type) => ({
      id: type,
      label: TYPE_META[type]?.label ?? type,
      badge: results[type].length,
    })),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Search" />

      <SearchInput
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        placeholder="Search candidates, companies, SPs, HR managers, users..."
        historyKey="global"
        suggestions
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="text-primary-500 animate-spin" />
        </div>
      )}

      {/* Results */}
      {!isLoading && urlQ && (
        <>
          {totalCount === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              description={`No results for "${urlQ}". Try a different search term.`}
            />
          ) : (
            <>
              {/* Type filter tabs */}
              <Tabs
                tabs={tabs}
                activeTab={activeType}
                onChange={(id) => setActiveType(id as SearchTypeId)}
                variant="pills"
                size="sm"
              />

              {/* Grouped Results with Pagination */}
              <div className="space-y-6">
                {displayTypes.map((type) => {
                  const meta = TYPE_META[type] ?? {
                    label: type,
                    icon: Search,
                    color: "text-text-secondary",
                  };
                  const Icon = meta.icon;
                  const allItems = results[type];
                  const paginatedItems =
                    activeType === "all"
                      ? allItems
                      : allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                  return (
                    <div key={type}>
                      <div className="mb-2 flex items-center gap-2">
                        <Icon size={16} className={meta.color} />
                        <h2 className="text-text-primary text-sm font-semibold">{meta.label}</h2>
                        <Badge variant="default" size="sm">
                          {allItems.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {paginatedItems.map((r) => (
                          // `block` is load-bearing: without it the <a> is
                          // inline and Tailwind's space-y top-margin is
                          // ignored, so the Cards stack flush together.
                          <a key={r.id} href={r.url} className="block">
                            <Card hover padding="sm" className="flex items-center justify-between">
                              <div>
                                <div className="text-text-primary text-sm font-medium">
                                  {r.title}
                                </div>
                                {r.subtitle && (
                                  <div className="text-text-muted text-xs">{r.subtitle}</div>
                                )}
                              </div>
                              <Badge variant="outline" size="sm">
                                {type}
                              </Badge>
                            </Card>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination for filtered type */}
              {activeType !== "all" &&
                (() => {
                  const items = results[activeType] ?? [];
                  const totalPages = Math.ceil(items.length / PAGE_SIZE);
                  if (totalPages <= 1) return null;
                  return (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-text-muted text-xs">
                        Page {page} of {totalPages} ({items.length} results)
                      </p>
                      <div className="flex gap-1">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage(page - 1)}
                          className="border-border-default rounded-sm border px-3 py-1 text-sm disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage(page + 1)}
                          className="border-border-default rounded-sm border px-3 py-1 text-sm disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </>
          )}
        </>
      )}
    </div>
  );
}
