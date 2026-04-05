import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ──────────────────────────────────────────────
//  Table Filters Store
//
//  Persists filter state across navigation so
//  users don't lose their position when they
//  navigate away and come back.
// ──────────────────────────────────────────────

interface TableFilterState {
  /** Per-table filter maps. Key = table id (e.g. "admin-users") */
  filters: Record<string, Record<string, string>>;
  /** Per-table page state */
  pages: Record<string, number>;

  setFilter: (tableId: string, key: string, value: string) => void;
  setFilters: (tableId: string, filters: Record<string, string>) => void;
  clearFilters: (tableId: string) => void;
  getFilter: (tableId: string, key: string, fallback?: string) => string;

  setPage: (tableId: string, page: number) => void;
  getPage: (tableId: string) => number;
  resetPage: (tableId: string) => void;
}

export const useTableFilters = create<TableFilterState>()(
  immer((set, get) => ({
    filters: {},
    pages: {},

    setFilter: (tableId, key, value) =>
      set((state) => {
        if (!state.filters[tableId]) state.filters[tableId] = {};
        state.filters[tableId]![key] = value;
        // Reset page when filter changes
        state.pages[tableId] = 1;
      }),

    setFilters: (tableId, filters) =>
      set((state) => {
        state.filters[tableId] = filters;
        state.pages[tableId] = 1;
      }),

    clearFilters: (tableId) =>
      set((state) => {
        state.filters[tableId] = {};
        state.pages[tableId] = 1;
      }),

    getFilter: (tableId, key, fallback = "") => {
      return get().filters[tableId]?.[key] ?? fallback;
    },

    setPage: (tableId, page) =>
      set((state) => {
        state.pages[tableId] = page;
      }),

    getPage: (tableId) => {
      return get().pages[tableId] ?? 1;
    },

    resetPage: (tableId) =>
      set((state) => {
        state.pages[tableId] = 1;
      }),
  })),
);
