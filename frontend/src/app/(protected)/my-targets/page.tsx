"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { Target as TargetIcon, TrendingUp, Calendar, Award } from "lucide-react";
import { getMyTargets, type Target } from "@/services/target.service";
import { PageHeader, Card, Progress, Badge, Spinner } from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { TARGET_TYPE_BADGE } from "@/constants/statuses";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  My Targets — Recruiter view (§23.9)
//  Shows the recruiter's active DAILY/WEEKLY/MONTHLY targets
//  with current achievement and progress.
// ──────────────────────────────────────────────

const PERIOD_LABELS: Record<Target["targetType"], { label: string; period: string; icon: typeof Calendar }> = {
  DAILY: { label: "Daily", period: "Today", icon: Calendar },
  WEEKLY: { label: "Weekly", period: "This week", icon: TrendingUp },
  MONTHLY: { label: "Monthly", period: "This month", icon: Award },
};

const TYPE_ORDER: Target["targetType"][] = ["DAILY", "WEEKLY", "MONTHLY"];

export default function MyTargetsPage() {
  const myTargetsQuery = useQuery({
    queryKey: qk.myTargets.list(),
    queryFn: async () => {
      const data = await getMyTargets();
      return [...data].sort(
        (a, b) => TYPE_ORDER.indexOf(a.targetType) - TYPE_ORDER.indexOf(b.targetType),
      );
    },
  });
  const targets = myTargetsQuery.data ?? [];
  const isLoading = myTargetsQuery.isLoading;

  // Group: which periods do we have targets for?
  const hasAnyTarget = targets.length > 0;
  const totalActive = targets.length;
  const totalAchieved = targets.filter(
    (t) => (t.achieved ?? 0) >= t.targetValue,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Targets"
        description="Track your performance against assigned targets in real time"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : !hasAnyTarget ? (
        <EmptyState
          icon={TargetIcon}
          title="No active targets"
          description="You don't have any active targets right now. Your admin will assign targets when ready — you'll get a notification."
        />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <TargetIcon size={18} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Active Targets</p>
                  <p className="text-text-primary text-xl font-bold">{totalActive}</p>
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
                    <span className="text-text-muted text-sm font-normal"> / {totalActive}</span>
                  </p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <TrendingUp size={18} className="text-info-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Avg Progress</p>
                  <p className="text-info-600 text-xl font-bold">
                    {Math.round(
                      targets.reduce(
                        (s, t) => s + Math.min(100, ((t.achieved ?? 0) / t.targetValue) * 100),
                        0,
                      ) / totalActive,
                    )}
                    %
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Per-target cards */}
          <div className="grid gap-4 lg:grid-cols-3">
            {targets.map((t) => {
              const meta = PERIOD_LABELS[t.targetType];
              const Icon = meta.icon;
              const achieved = t.achieved ?? 0;
              const remaining = Math.max(0, t.targetValue - achieved);
              const pct = Math.min(100, Math.round((achieved / t.targetValue) * 100));
              const isAchieved = achieved >= t.targetValue;
              const variant: "success" | "primary" | "warning" =
                pct >= 100 ? "success" : pct >= 50 ? "primary" : "warning";

              return (
                <Card key={t.id} padding="md">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            isAchieved ? "bg-success-100" : "bg-primary-100",
                          )}
                        >
                          <Icon
                            size={20}
                            className={isAchieved ? "text-success-600" : "text-primary-600"}
                          />
                        </div>
                        <div>
                          <p className="text-text-primary text-sm font-semibold">
                            {meta.label} Target
                          </p>
                          <p className="text-text-muted text-xs">{meta.period}</p>
                        </div>
                      </div>
                      <Badge variant={TARGET_TYPE_BADGE[t.targetType]}>{t.targetType}</Badge>
                    </div>

                    {/* Big numbers */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-text-primary text-3xl font-bold">{achieved}</p>
                        <p className="text-text-muted text-xs">
                          out of <span className="text-text-secondary font-medium">{t.targetValue}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            isAchieved ? "text-success-500" : "text-text-primary",
                          )}
                        >
                          {pct}%
                        </p>
                        <p className="text-text-muted text-xs">complete</p>
                      </div>
                    </div>

                    <Progress value={pct} variant={variant} size="md" />

                    {/* Status line */}
                    <div className="border-border-default flex items-center justify-between border-t pt-3 text-xs">
                      {isAchieved ? (
                        <span className="text-success-600 font-semibold">
                          Target achieved — great work!
                        </span>
                      ) : (
                        <span className="text-text-secondary">
                          <span className="text-text-primary font-semibold">{remaining}</span> more
                          to go
                        </span>
                      )}
                      <span className="text-text-muted">
                        {t.recruiterId === null ? "Global default" : "Personal target"}
                      </span>
                    </div>

                    {/* Date window */}
                    <div className="text-text-muted text-xs">
                      Effective {new Date(t.effectiveFrom).toLocaleDateString("en-IN")}
                      {t.effectiveTo
                        ? ` → ${new Date(t.effectiveTo).toLocaleDateString("en-IN")}`
                        : " → ongoing"}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
