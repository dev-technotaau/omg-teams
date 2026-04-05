"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlineEditCellProps {
  value: string;
  onSave: (newValue: string) => void | Promise<void>;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineEditCell({
  value,
  onSave,
  type = "text",
  options,
  placeholder,
  className,
  disabled = false,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) {
      setEditValue(value);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing, value]);

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue);
      setEditing(false);
    } catch {
      /* stay in edit mode */
    } finally {
      setSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  if (disabled) {
    return <span className={className}>{value || placeholder || "\u2014"}</span>;
  }

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className={cn(
          "group hover:bg-bg-hover inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors",
          className,
        )}
        title="Click to edit"
      >
        <span>{value || placeholder || "\u2014"}</span>
        <Pencil
          size={10}
          className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {type === "select" && options ? (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Auto-save on select change
            void (async () => {
              setSaving(true);
              try {
                await onSave(e.target.value);
                setEditing(false);
              } finally {
                setSaving(false);
              }
            })();
          }}
          onBlur={handleCancel}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="border-primary-500 bg-bg-input h-7 rounded border px-1.5 text-xs focus:outline-hidden"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => void handleSave()}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder={placeholder}
          className="border-primary-500 bg-bg-input h-7 w-full min-w-[60px] rounded border px-1.5 text-xs focus:outline-hidden"
        />
      )}
      {type === "text" && (
        <>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="text-success-500 hover:text-success-600 shrink-0"
            aria-label="Save"
          >
            <Check size={14} />
          </button>
          <button
            onClick={handleCancel}
            className="text-text-muted hover:text-text-primary shrink-0"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
