import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

// ──────────────────────────────────────────────
//  Axios API Client (BFF Pattern)
//
//  All requests go through /api/proxy which
//  attaches httpOnly cookie tokens server-side.
//  Auth endpoints use /api/auth/* directly.
//
//  401 refresh is handled server-side by the BFF.
//  If we still get a 401 here, the refresh also
//  failed → session is dead → redirect to login.
// ──────────────────────────────────────────────

export const api = axios.create({
  baseURL: "/api/proxy",
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Response interceptor ──
// NOTE: 401 refresh is handled server-side by the BFF proxy.
// The client only handles the case where the BFF refresh also failed.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _authRetry?: boolean;
    };

    // 503 — maintenance mode detection
    if (error.response?.status === 503) {
      const data = error.response.data as Record<string, unknown> | undefined;
      if (data?.code === "MAINTENANCE_MODE") {
        // Dynamically import to avoid circular deps
        const { useMaintenanceStore } = await import("@/store/maintenance");
        useMaintenanceStore
          .getState()
          .setMaintenanceMode(
            true,
            data.message as string | undefined,
            data.estimatedReturnTime as string | undefined,
          );
      }
      return Promise.reject(error);
    }

    // 401 after BFF already tried refresh — retry once (transient pod switchover)
    if (error.response?.status === 401) {
      if (!originalRequest._authRetry) {
        originalRequest._authRetry = true;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return api(originalRequest);
      }
      // Second 401 → session is dead
      axios.post("/api/auth/logout", {}, { withCredentials: true }).catch(() => {});
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

// ── Typed error extractor ──
export interface ApiError {
  message: string;
  status: number;
  details?: Array<{ path: string; message: string }>;
}

export function extractApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    return {
      message: (data?.error as string) ?? (data?.message as string) ?? error.message,
      status: error.response?.status ?? 500,
      details: data?.details as ApiError["details"],
    };
  }
  return {
    message: error instanceof Error ? error.message : "An unexpected error occurred",
    status: 500,
  };
}
