import { DashboardSkeleton } from "@/components/ui";

/**
 * §24.19.6 — Loading state for protected route group.
 * Shows dashboard skeleton during section transitions.
 */
export default function ProtectedLoading() {
  return <DashboardSkeleton />;
}
