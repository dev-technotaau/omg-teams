"use client";

import { useState, useCallback } from "react";

export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

const STORAGE_PREFIX = "filter_presets_";

function getStorageKey(pageKey: string) {
  return `${STORAGE_PREFIX}${pageKey}`;
}

export function useFilterPresets(pageKey: string) {
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(getStorageKey(pageKey));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const persist = useCallback(
    (next: FilterPreset[]) => {
      setPresets(next);
      try {
        localStorage.setItem(getStorageKey(pageKey), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [pageKey],
  );

  const savePreset = useCallback(
    (name: string, filters: Record<string, string>) => {
      const preset: FilterPreset = {
        id: crypto.randomUUID(),
        name,
        filters,
        createdAt: new Date().toISOString(),
      };
      persist([...presets, preset]);
      setActivePresetId(preset.id);
      return preset;
    },
    [presets, persist],
  );

  const deletePreset = useCallback(
    (id: string) => {
      persist(presets.filter((p) => p.id !== id));
      if (activePresetId === id) setActivePresetId(null);
    },
    [presets, persist, activePresetId],
  );

  const renamePreset = useCallback(
    (id: string, name: string) => {
      persist(presets.map((p) => (p.id === id ? { ...p, name } : p)));
    },
    [presets, persist],
  );

  const applyPreset = useCallback(
    (id: string): Record<string, string> | null => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return null;
      setActivePresetId(id);
      return preset.filters;
    },
    [presets],
  );

  const clearActive = useCallback(() => {
    setActivePresetId(null);
  }, []);

  return {
    presets,
    activePresetId,
    savePreset,
    deletePreset,
    renamePreset,
    applyPreset,
    clearActive,
  };
}
