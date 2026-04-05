"use client";

import { useEffect, useState } from "react";
import MaintenancePage from "@/app/maintenance/page";
import { useMaintenanceStore } from "@/store/maintenance";
import type { ReactNode } from "react";

// ──────────────────────────────────────────────
//  Maintenance Gate
//
//  Wraps the app and checks for maintenance mode
//  from two sources:
//  1. Feature flags fetch (Firebase Remote Config)
//  2. API 503 interceptor (Zustand store)
//
//  If maintenance is active, renders MaintenancePage
//  instead of children.
// ──────────────────────────────────────────────

interface FeatureFlags {
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceReturnTime?: string;
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const storeActive = useMaintenanceStore((s) => s.isMaintenanceMode);
  const storeMessage = useMaintenanceStore((s) => s.message);
  const storeReturnTime = useMaintenanceStore((s) => s.estimatedReturnTime);

  const [flagsLoaded, setFlagsLoaded] = useState(false);
  const [flagMaintenance, setFlagMaintenance] = useState(false);
  const [flagMessage, setFlagMessage] = useState<string | null>(null);
  const [flagReturnTime, setFlagReturnTime] = useState<string | null>(null);

  // Fetch feature flags on mount
  useEffect(() => {
    async function fetchFlags() {
      try {
        const res = await fetch(`/api/proxy/feature-flags/client?_t=${Date.now()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const json = (await res.json()) as { data?: FeatureFlags };
          const flags = json?.data;
          if (flags) {
            setFlagMaintenance(flags.maintenanceMode === true);
            setFlagMessage(flags.maintenanceMessage ?? null);
            setFlagReturnTime(flags.maintenanceReturnTime ?? null);
          }
        }
      } catch {
        // Fetch failed — don't block the app
      }
      setFlagsLoaded(true);
    }

    void fetchFlags();
  }, []);

  // Check for bypass key in URL params (admin emergency access)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bypass = params.get("bypass_maintenance");
    if (bypass) {
      sessionStorage.setItem("omg_maintenance_bypass", bypass);
    }
  }, []);

  const isBypassed =
    typeof window !== "undefined" && sessionStorage.getItem("omg_maintenance_bypass");

  // Determine if maintenance is active from either source
  const isActive = flagMaintenance || storeActive;

  // If bypassed, render children normally
  if (isBypassed) {
    return <>{children}</>;
  }

  // If maintenance is active (from either source), show maintenance page
  if (isActive) {
    const message = flagMessage || storeMessage;
    const returnTime = flagReturnTime || storeReturnTime;
    return <MaintenancePage message={message} estimatedReturnTime={returnTime} />;
  }

  // If flags haven't loaded yet, wait briefly (avoid flash)
  if (!flagsLoaded) {
    return null;
  }

  return <>{children}</>;
}
