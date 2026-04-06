"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { Toaster } from "sonner";
import { env } from "@/lib/env";
import { makeQueryClient } from "@/lib/query-client";
import { store, persistor } from "@/store/redux";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { PWAPrompt } from "@/components/pwa-prompt";
import { CookieConsentBanner } from "@/components/cookie-consent";
import { FaviconBadge } from "@/components/favicon-badge";
import { useEffect, type ReactNode } from "react";

const queryClient = makeQueryClient();

/** Register the PWA service worker in production */
function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);
}

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  useServiceWorker();

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            nonce={nonce}
          >
            <MaintenanceGate>{children}</MaintenanceGate>
            <FaviconBadge />
            <PWAPrompt />
            <Toaster richColors position="top-right" closeButton />
            <CookieConsentBanner />
          </ThemeProvider>
          {env.IS_DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
