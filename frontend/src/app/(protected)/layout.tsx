import { AuthProvider } from "@/contexts/auth";
import { NotificationProvider } from "@/contexts/notification";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { OfflineBanner } from "@/components/offline-banner";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { FirebasePresenceProvider } from "@/components/firebase-presence-provider";
import { ScrollToTop } from "@/components/scroll-to-top";
import type { ReactNode } from "react";

/**
 * Protected layout — wraps all authenticated pages.
 * Provides AuthContext, NotificationContext, Sidebar, Header, and SessionTimeoutWarning (§25.3).
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <OfflineBanner />
        <SessionTimeoutWarning />
        <FirebasePresenceProvider />
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
            <ScrollToTop />
          </div>
        </div>
      </NotificationProvider>
    </AuthProvider>
  );
}
