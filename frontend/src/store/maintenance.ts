import { create } from "zustand";

// ──────────────────────────────────────────────
//  Maintenance Mode Store
//
//  Populated from two sources:
//  1. Feature flags fetch (on app init)
//  2. API 503 interceptor (on any API call)
// ──────────────────────────────────────────────

interface MaintenanceState {
  isMaintenanceMode: boolean;
  message: string | null;
  estimatedReturnTime: string | null;

  setMaintenanceMode: (
    active: boolean,
    message?: string | undefined,
    estimatedReturn?: string | undefined,
  ) => void;
  clearMaintenanceMode: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  isMaintenanceMode: false,
  message: null,
  estimatedReturnTime: null,

  setMaintenanceMode: (active, message, estimatedReturn) =>
    set({
      isMaintenanceMode: active,
      message: message ?? null,
      estimatedReturnTime: estimatedReturn ?? null,
    }),

  clearMaintenanceMode: () =>
    set({
      isMaintenanceMode: false,
      message: null,
      estimatedReturnTime: null,
    }),
}));
