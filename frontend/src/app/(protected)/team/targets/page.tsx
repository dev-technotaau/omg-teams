"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { Target as TargetIcon, Users, Award, TrendingUp, Search } from "lucide-react";
import { getTeamTargets, type Target } from "@/services/target.service";
import { PageHeader, Card, Progress, Badge, Spinner, Input } from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { TARGET_TYPE_BADGE } from "@/constants/statuses";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Team Targets — RM view (§23.9)
//  Read-only matrix of recruiter × target type with achievement.
// ──────────────────────────────────────────────

const TYPE_ORDER: Target["targetType"][] = ["DAILY", "WEEKLY", "MONTHLY"];

export default function TeamTargetsPage() {
  const [search, setSearch] = useState("");

  const teamTargetsQuery = useQuery({
    queryKey: qk.targets.list({ scope: "team" }),
    queryFn: getTeamTargets,
  });
  const data = useMemo(() => teamTargetsQuery.data ?? [], [teamTargetsQuery.data]);
  const isLoading = teamTargetsQuery.isLoading;

  // Filter recruiters by name search
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (row) =>
        `${row.recruiter.firstName} ${row.recruiter.lastName}`.toLowerCase().includes(q) ||
        (row.recruiter.employeeId ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  // Aggregate stats — across the WHOLE team, not the filtered subset, so the
  // numbers stay stable as the user types in the search box.
  const allTargets = data.flatMap((r) => r.targets);
  const totalTargets = allTargets.length;
  const totalAchieved = allTargets.filter((t) => (t.achieved ?? 0) >= t.targetValue).length;
  const recruitersCount = data.length;
  const recruitersWithTargets = data.filter((r) => r.targets.length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Targets"
        description="Read-only view of target progress for every recruiter assigned to you"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : recruitersCount === 0 ? (
        <EmptyState
          icon={Users}
          title="No recruiters assigned"
          description="You don't have any recruiters in your team yet. Ask your admin to assign some."
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Users size={18} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Recruiters</p>
                  <p className="text-text-primary text-xl font-bold">{recruitersCount}</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <TargetIcon size={18} className="text-info-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">With Targets</p>
                  <p className="text-info-600 text-xl font-bold">{recruitersWithTargets}</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Award size={18} className="text-success-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Achieved</p>
                  <p className="text-success-600 text-xl font-bold">
                    {totalAchieved}
                    <span className="text-text-muted text-sm font-normal"> / {totalTargets}</span>
                  </p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <TrendingUp size={18} className="text-warning-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Avg Progress</p>
                  <p className="text-warning-600 text-xl font-bold">
                    {totalTargets === 0
                      ? 0
                      : Math.round(
                          allTargets.reduce(
                            (s, t) =>
                              s + Math.min(100, ((t.achieved ?? 0) / t.targetValue) * 100),
                            0,
                          ) / totalTargets,
                        )}
                    %
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search
              size={14}
              className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recruiters by name or employee ID..."
              className="pl-8"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description="No recruiters match your search."
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((row) => {
                const sortedTargets = [...row.targets].sort(
                  (a, b) => TYPE_ORDER.indexOf(a.targetType) - TYPE_ORDER.indexOf(b.targetType),
                );
                return (
                  <Card key={row.recruiter.id} padding="md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-text-primary text-base font-semibold">
                          {row.recruiter.firstName} {row.recruiter.lastName}
                        </p>
                        <p className="text-text-muted text-xs">
                          {row.recruiter.employeeId ?? "—"}
                        </p>
                      </div>
                      {sortedTargets.length === 0 && (
                        <Badge variant="default">No active targets</Badge>
                      )}
                    </div>

                    {sortedTargets.length > 0 && (
                      <div className="border-border-default mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
                        {sortedTargets.map((t) => {
                          const achieved = t.achieved ?? 0;
                          const pct = Math.min(100, Math.round((achieved / t.targetValue) * 100));
                          const isAchieved = achieved >= t.targetValue;
                          const variant: "success" | "primary" | "warning" =
                            pct >= 100 ? "success" : pct >= 50 ? "primary" : "warning";
                          return (
                            <div
                              key={t.id}
                              className="border-border-default rounded-md border p-3"
                            >
                              <div className="flex items-center justify-between">
                                <Badge
                                  variant={TARGET_TYPE_BADGE[t.targetType]}
                                  size="sm"
                                >
                                  {t.targetType}
                                </Badge>
                                <span
                                  className={cn(
                                    "text-sm font-bold",
                                    isAchieved ? "text-success-500" : "text-text-primary",
                                  )}
                                >
                                  {pct}%
                                </span>
                              </div>
                              <div className="mt-2 flex items-baseline gap-1.5">
                                <span className="text-text-primary text-lg font-semibold">
                                  {achieved}
                                </span>
                                <span className="text-text-muted text-xs">
                                  / {t.targetValue}
                                </span>
                              </div>
                              <Progress
                                value={pct}
                                variant={variant}
                                size="sm"
                                className="mt-2"
                              />
                              {t.recruiterId === null && (
                                <p className="text-text-muted mt-2 text-[10px] uppercase tracking-wide">
                                  Global default
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
