import { AuthProvider } from "@/contexts/auth";
import { NotificationProvider } from "@/contexts/notification";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { OfflineBanner } from "@/components/offline-banner";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { FirebasePresenceProvider } from "@/components/firebase-presence-provider";
import { MainScrollRestore } from "@/components/main-scroll-restore";
import { ScrollToTop } from "@/components/scroll-to-top";
import { AuthGate } from "@/components/auth-gate";
import { BodyScrollLock } from "@/components/body-scroll-lock";
import type { ReactNode } from "react";

/**
 * Protected layout — wraps all authenticated pages.
 * Provides AuthContext, NotificationContext, Sidebar, Header, and SessionTimeoutWarning (§25.3).
 *
 * AuthGate ensures protected children never render until /auth/me has resolved,
 * so unauthenticated visitors are redirected to /login without seeing any
 * skeleton flash of the protected pages.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <NotificationProvider>
          <BodyScrollLock />
          <OfflineBanner />
          <SessionTimeoutWarning />
          <FirebasePresenceProvider />
          <MainScrollRestore />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
              <ScrollToTop />
            </div>
          </div>
        </NotificationProvider>
      </AuthGate>
    </AuthProvider>
  );
}
