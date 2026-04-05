import { cn } from "@/lib/utils";

/**
 * Reusable circular loading spinner. Spec Section 24.19.7
 * 3 sizes (sm/md/lg). Primary brand color. White variant for dark backgrounds.
 */
export function Spinner({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-3",
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "border-primary-500 animate-spin rounded-full border-t-transparent",
        sizeClasses[size],
        className,
      )}
    />
  );
}
