"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";

// ──────────────────────────────────────────────
//  AuthGate
//
//  Sits inside <AuthProvider> and prevents the protected tree from
//  mounting until /auth/me has resolved. Without this, child pages
//  render their own skeletons during the auth round-trip on cold visits,
//  causing a "ghost" of the app to appear before being kicked to /login.
// ──────────────────────────────────────────────

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirect = pathname && pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // Still verifying — render a minimal full-screen loader, NOT the protected children.
  if (isLoading) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <div className="border-primary-500 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  // Auth resolved as unauthenticated — render nothing while the redirect runs.
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
