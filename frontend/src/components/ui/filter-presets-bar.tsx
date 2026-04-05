"use client";

import { useState } from "react";
import { Bookmark, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterPreset } from "@/hooks/use-filter-presets";

export interface FilterPresetsBarProps {
  presets: FilterPreset[];
  activePresetId: string | null;
  onApply: (id: string) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  className?: string;
}

export function FilterPresetsBar({
  presets,
  activePresetId,
  onApply,
  onSave,
  onDelete,
  onClear,
  className,
}: FilterPresetsBarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleSave = () => {
    if (!newName.trim()) return;
    onSave(newName.trim());
    setNewName("");
    setIsAdding(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Bookmark size={14} className="text-text-muted shrink-0" />
      <span className="text-text-muted text-xs font-medium">Presets:</span>

      {presets.map((p) => (
        <div key={p.id} className="group relative">
          <button
            onClick={() => {
              if (activePresetId === p.id) {
                onClear();
              } else {
                onApply(p.id);
              }
            }}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activePresetId === p.id
                ? "bg-primary-500 text-white"
                : "border-border-default bg-bg-surface text-text-secondary hover:bg-bg-hover border",
            )}
          >
            {p.name}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(p.id);
            }}
            className="bg-error-500 absolute -top-1.5 -right-1.5 hidden h-4 w-4 items-center justify-center rounded-full text-white group-hover:flex"
            aria-label={`Delete preset "${p.name}"`}
          >
            <X size={10} />
          </button>
        </div>
      ))}

      {isAdding ? (
        <div className="flex items-center gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setIsAdding(false);
                setNewName("");
              }
            }}
            placeholder="Preset name..."
            autoFocus
            className="border-border-default bg-bg-input h-7 w-32 rounded-md border px-2 text-xs focus:outline-hidden"
          />
          <button
            onClick={handleSave}
            disabled={!newName.trim()}
            className="text-success-500 hover:text-success-600 disabled:opacity-40"
            aria-label="Save preset"
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => {
              setIsAdding(false);
              setNewName("");
            }}
            className="text-text-muted hover:text-text-primary"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="border-border-default text-text-muted hover:text-text-primary hover:bg-bg-hover flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs transition"
        >
          <Plus size={12} />
          Save Current
        </button>
      )}
    </div>
  );
}
