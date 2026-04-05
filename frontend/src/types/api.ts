// ──────────────────────────────────────────────
//  Shared API Types
// ──────────────────────────────────────────────

/** Standard paginated response envelope */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Standard API error shape */
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, string[]>;
}

/** Select option for dropdowns */
export interface SelectOption<V = string> {
  value: V;
  label: string;
}
