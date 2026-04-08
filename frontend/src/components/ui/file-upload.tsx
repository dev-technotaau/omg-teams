"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onUpload?: (files: File[]) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  value?: File[];
  error?: string;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  accept,
  multiple = false,
  maxSize,
  onUpload,
  label = "Upload a file",
  description,
  disabled = false,
  value = [],
  error,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;

      const files = Array.from(fileList);

      if (maxSize) {
        const oversized = files.filter((f) => f.size > maxSize);
        if (oversized.length > 0) {
          setSizeError(
            `File${oversized.length > 1 ? "s" : ""} exceed${oversized.length === 1 ? "s" : ""} maximum size of ${formatFileSize(maxSize)}`,
          );
          return;
        }
      }

      setSizeError(null);
      onUpload?.(multiple ? [...value, ...files] : files.slice(0, 1));
    },
    [disabled, maxSize, multiple, onUpload, value],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = value.filter((_, i) => i !== index);
      onUpload?.(updated);
    },
    [value, onUpload],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const displayError = error || sizeError;

  return (
    <div className={cn("w-full", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          "focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
          disabled
            ? "border-border-default cursor-not-allowed opacity-50"
            : "border-border-default hover:border-border-hover hover:bg-bg-hover cursor-pointer",
          isDragging && "border-primary-500 bg-primary-100",
          displayError && "border-error-500",
        )}
      >
        <Upload
          size={24}
          className={cn("mb-2", isDragging ? "text-primary-500" : "text-text-muted")}
          aria-hidden="true"
        />
        <p className="text-text-primary text-sm font-medium">{label}</p>
        {/* If the caller supplies a `description`, trust it to convey the
            accept/maxSize constraints and suppress the auto-generated lines
            (otherwise we end up showing the same info twice). */}
        {description ? (
          <p className="text-text-muted mt-1 text-xs">{description}</p>
        ) : (
          <>
            {accept && <p className="text-text-muted mt-1 text-xs">Accepted: {accept}</p>}
            {maxSize && (
              <p className="text-text-muted mt-0.5 text-xs">
                Max size: {formatFileSize(maxSize)}
              </p>
            )}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Error */}
      {displayError && (
        <p role="alert" className="text-error-500 mt-1.5 text-xs">
          {displayError}
        </p>
      )}

      {/* File list */}
      {value.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Selected files">
          {value.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="border-border-default bg-bg-surface flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <FileText size={16} className="text-text-muted shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-text-primary truncate text-sm">{file.name}</p>
                <p className="text-text-muted text-xs">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(index);
                }}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                className={cn(
                  "text-text-muted shrink-0 rounded-sm p-1 transition-colors",
                  "hover:bg-bg-hover hover:text-text-primary",
                  "focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-hidden",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
