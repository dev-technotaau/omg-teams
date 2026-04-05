"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Users, Building2, Briefcase, UserCheck, Shield, Loader2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { globalSearch, type SearchResult } from "@/services/search.service";
import { PageHeader, SearchInput, Card, Badge, Tabs, EmptyState } from "@/components/ui";

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
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<Record<string, SearchResult[]>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeType, setActiveType] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults({});
      setTotalCount(0);
      return;
    }
    setIsLoading(true);
    try {
      const res = await globalSearch(q, undefined, 200);
      setResults(res.results);
      setTotalCount(res.totalCount);
      setActiveType("all");
      setPage(1);
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ) void doSearch(initialQ);
  }, [initialQ, doSearch]);

  const handleSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < 2) return;
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      void doSearch(trimmed);
    },
    [router, doSearch],
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
      {!isLoading && initialQ && (
        <>
          {totalCount === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              description={`No results for "${initialQ}". Try a different search term.`}
            />
          ) : (
            <>
              {/* Type filter tabs */}
              <Tabs
                tabs={tabs}
                activeTab={activeType}
                onChange={setActiveType}
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
                      <div className="space-y-1">
                        {paginatedItems.map((r) => (
                          <a key={r.id} href={r.url}>
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
