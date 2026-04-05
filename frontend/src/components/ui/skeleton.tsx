import { cn } from "@/lib/utils";

/**
 * Skeleton loading primitives. Spec Section 24.19.8
 * Shimmer/pulse placeholder UI matching page structure.
 */

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("bg-bg-muted h-4 animate-pulse rounded-sm", className)} />;
}

export function SkeletonCircle({ className }: { className?: string }) {
  return <div className={cn("bg-bg-muted h-10 w-10 animate-pulse rounded-full", className)} />;
}

export function SkeletonRect({ className }: { className?: string }) {
  return <div className={cn("bg-bg-muted h-24 animate-pulse rounded-md", className)} />;
}

export function SkeletonButton({ className }: { className?: string }) {
  return <div className={cn("bg-bg-muted h-9 w-24 animate-pulse rounded-md", className)} />;
}

/** Page-specific: Dashboard skeleton */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRect key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SkeletonRect className="h-64" />
        <SkeletonRect className="h-64" />
      </div>
    </div>
  );
}

/** Page-specific: Data table skeleton */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLine key={i} className="flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: 6 }).map((_, j) => (
            <SkeletonLine key={j} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
