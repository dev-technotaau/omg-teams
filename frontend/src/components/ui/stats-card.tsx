import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonLine, SkeletonCircle } from "./skeleton";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  description?: string;
  className?: string;
  loading?: boolean;
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  description,
  className,
  loading = false,
}: StatsCardProps) {
  if (loading) {
    return (
      <div className={cn("border-border-default bg-bg-surface rounded-lg border p-5", className)}>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-7 w-28" />
            <SkeletonLine className="h-3 w-16" />
          </div>
          <SkeletonCircle className="h-10 w-10" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-border-default bg-bg-surface rounded-lg border p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-text-secondary text-sm font-medium">{label}</p>
          <p className="text-text-primary mt-1 text-2xl font-semibold">{value}</p>

          <div className="mt-2 flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  trend.isPositive ? "text-success-700" : "text-error-700",
                )}
              >
                {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {trend.value}%
              </span>
            )}
            {description && <span className="text-text-muted text-xs">{description}</span>}
          </div>
        </div>

        {Icon && (
          <div className="bg-primary-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Icon size={20} className="text-primary-500" />
          </div>
        )}
      </div>
    </div>
  );
}
