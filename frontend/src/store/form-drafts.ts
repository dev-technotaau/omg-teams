import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// ──────────────────────────────────────────────
//  Form Drafts Store
//
//  Auto-saves form data to survive page
//  refreshes and accidental navigation.
//  Persisted to localStorage.
// ──────────────────────────────────────────────

interface FormDraftsState {
  /** Key = form id (e.g. "candidate-report"), value = form data */
  drafts: Record<string, Record<string, unknown>>;
  /** Timestamps of last save */
  timestamps: Record<string, number>;

  saveDraft: (formId: string, data: Record<string, unknown>) => void;
  getDraft: (formId: string) => Record<string, unknown> | null;
  deleteDraft: (formId: string) => void;
  hasDraft: (formId: string) => boolean;
  getTimestamp: (formId: string) => number | null;
  clearAllDrafts: () => void;
}

export const useFormDrafts = create<FormDraftsState>()(
  persist(
    immer((set, get) => ({
      drafts: {},
      timestamps: {},

      saveDraft: (formId, data) =>
        set((state) => {
          state.drafts[formId] = data;
          state.timestamps[formId] = Date.now();
        }),

      getDraft: (formId) => {
        return get().drafts[formId] ?? null;
      },

      deleteDraft: (formId) =>
        set((state) => {
          delete state.drafts[formId];
          delete state.timestamps[formId];
        }),

      hasDraft: (formId) => {
        return formId in get().drafts;
      },

      getTimestamp: (formId) => {
        return get().timestamps[formId] ?? null;
      },

      clearAllDrafts: () =>
        set((state) => {
          state.drafts = {};
          state.timestamps = {};
        }),
    })),
    {
      name: "omg-form-drafts",
    },
  ),
);
