"use client";

import { useState, useCallback, useMemo } from "react";
import { Download, FileSpreadsheet, CheckCircle2, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { api, extractApiError } from "@/lib/api";
import { previewImport, executeImport, getImportTemplate } from "@/services/import.service";
import {
  PageHeader,
  Button,
  Card,
  FileUpload,
  Select,
  DataTable,
  Badge,
  Alert,
  Progress,
  IconButton,
  Tooltip,
  Checkbox,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/utils/download";

// ──────────────────────────────────────────────
//  Data Import — Spec Section 23.6
//  CSV/XLSX bulk import with column mapping + validation
// ──────────────────────────────────────────────

interface ParsedFile {
  name: string;
  size: number;
  headers: string[];
  rows: string[][];
}
interface PreviewRow {
  values: Record<string, string>;
  status: "valid" | "invalid" | "duplicate";
  errors?: string[];
}
interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: PreviewRow[];
}
interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  failedRows: Array<{ row: number; values: Record<string, string>; error: string }>;
}

const STEPS = ["Upload File", "Map Columns", "Validate", "Import"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines
    .slice(1)
    .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  return { headers, rows };
}

const STATUS_BADGE_VARIANT: Record<string, "success" | "danger" | "warning"> = {
  valid: "success",
  invalid: "danger",
  duplicate: "warning",
};

export default function DataImportPage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".csv") && !f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Only CSV and XLSX files are supported");
      return;
    }

    let headers: string[];
    let rows: string[][];

    if (f.name.endsWith(".csv")) {
      // CSV — parse on client
      const text = await f.text();
      const parsed = parseCSV(text);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      // §23.6 — XLSX/XLS — parse on backend via ExcelJS
      try {
        const formData = new FormData();
        formData.append("file", f);
        const res = await api.post<{
          data: { headers: string[]; rows: Record<string, unknown>[]; totalRows: number };
        }>("/import/parse-xlsx", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        headers = res.data.data.headers;
        rows = res.data.data.rows.map((row) => headers.map((h) => String(row[h] ?? "")));
      } catch (err) {
        toast.error(extractApiError(err).message);
        return;
      }
    }

    if (headers.length === 0) {
      toast.error("File appears to be empty");
      return;
    }
    setFile({ name: f.name, size: f.size, headers, rows });

    // Fetch DB columns for mapping
    try {
      const cols = await getImportTemplate();
      setDbColumns(cols);
      // Auto-map matching column names
      const autoMap: Record<string, string> = {};
      headers.forEach((h) => {
        const match = cols.find((c) => c.toLowerCase() === h.toLowerCase());
        if (match) autoMap[h] = match;
      });
      setMapping(autoMap);
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
    setStep(1);
  }, []);

  const handleFileUpload = useCallback(
    (files: File[]) => {
      if (files.length > 0) void handleFile(files[0]);
    },
    [handleFile],
  );

  const handleValidate = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const mappedRows = file.rows.map((row) => {
        const obj: Record<string, string> = {};
        file.headers.forEach((h, i) => {
          if (mapping[h]) obj[mapping[h]] = row[i] ?? "";
        });
        return obj;
      });
      const previewData = (await previewImport(mappedRows)) as unknown as PreviewResult;
      setPreview(previewData);
      setStep(2);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setIsLoading(true);
    try {
      const mappedRows = file.rows.map((row) => {
        const obj: Record<string, string> = {};
        file.headers.forEach((h, i) => {
          if (mapping[h]) obj[mapping[h]] = row[i] ?? "";
        });
        return obj;
      });
      const importData = (await executeImport(
        mappedRows as never,
        "",
        skipDuplicates,
      )) as unknown as ImportResult;
      setResult(importData);
      setStep(3);
      toast.success(`Import complete: ${importData.imported} rows imported`);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get("/import/template/download", { responseType: "blob" });
      downloadBlob(data as Blob, "import_template.xlsx");
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const downloadErrorReport = () => {
    if (!result?.failedRows.length) return;
    const headers = Object.keys(result.failedRows[0].values).join(",") + ",Error";
    const rows = result.failedRows.map((r) => Object.values(r.values).join(",") + "," + r.error);
    const blob = new Blob([headers + "\n" + rows.join("\n")], { type: "text/csv" });
    downloadBlob(blob, "import_errors.csv");
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setMapping({});
    setPreview(null);
    setResult(null);
  };

  // Column mapping select options
  const dbColumnOptions = useMemo(
    () => [
      { value: "", label: "— Skip —" },
      ...dbColumns.map((col) => ({ value: col, label: col })),
    ],
    [dbColumns],
  );

  // DataTable columns for the preview table in step 1
  const previewColumns = useMemo<Column<string[]>[]>(
    () =>
      file
        ? file.headers.map((h, i) => ({
            key: h,
            header: h,
            cell: (row: string[]) => <span className="text-text-secondary">{row[i]}</span>,
          }))
        : [],
    [file],
  );

  // DataTable columns for validation preview in step 2
  const validationColumns = useMemo<Column<PreviewRow>[]>(() => {
    if (!preview?.rows.length) return [];
    const valueKeys = Object.keys(preview.rows[0].values);
    return [
      {
        key: "status",
        header: "Status",
        cell: (row: PreviewRow) => (
          <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{row.status}</Badge>
        ),
      },
      ...valueKeys.map((k) => ({
        key: k,
        header: k,
        cell: (row: PreviewRow) => <span className="text-text-secondary">{row.values[k]}</span>,
      })),
      {
        key: "errors",
        header: "Errors",
        cell: (row: PreviewRow) => <span className="text-error-500">{row.errors?.join("; ")}</span>,
      },
    ];
  }, [preview]);

  // Progress percentage for the stepper
  const stepProgress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Data Import"
        actions={
          <Button variant="outline" leftIcon={Download} onClick={() => void downloadTemplate()}>
            Download Template
          </Button>
        }
      />

      {/* Stepper */}
      <Card padding="md">
        <div className="mb-3 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                  i < step
                    ? "bg-success-500 text-white"
                    : i === step
                      ? "bg-primary-500 text-white"
                      : "bg-bg-muted text-text-muted",
                )}
              >
                {i < step ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-sm",
                  i <= step ? "text-text-primary font-medium" : "text-text-muted",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <ChevronRight size={16} className="text-text-muted" />}
            </div>
          ))}
        </div>
        <Progress value={stepProgress} size="sm" variant="primary" />
      </Card>

      {/* Step 0: Upload */}
      {step === 0 && (
        <Card padding="lg">
          <FileUpload
            accept=".csv,.xlsx"
            label="Drag and drop a CSV or XLSX file here, or click to browse"
            description="Supported formats: CSV, XLSX"
            onUpload={handleFileUpload}
          />
        </Card>
      )}

      {/* Step 1: Column Mapping */}
      {step === 1 && file && (
        <div className="space-y-4">
          {/* File info */}
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-success-500" />
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium">{file.name}</p>
                <p className="text-text-muted text-xs">
                  {formatSize(file.size)} — {file.rows.length} rows
                </p>
              </div>
              <Tooltip content="Remove file">
                <IconButton icon={X} aria-label="Remove file" size="sm" onClick={reset} />
              </Tooltip>
            </div>
          </Card>

          {/* Mapping */}
          <Card padding="md">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">Column Mapping</h3>
            <div className="space-y-2">
              {file.headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-text-secondary w-48 truncate text-sm">{h}</span>
                  <ChevronRight size={14} className="text-text-muted" />
                  <div className="flex-1">
                    <Select
                      options={dbColumnOptions}
                      value={mapping[h] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Preview first 3 rows */}
          <DataTable<string[]>
            columns={previewColumns}
            data={file.rows.slice(0, 3)}
            getRowId={(row: string[]) => String(file!.rows.indexOf(row))}
            compact
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button
              loading={isLoading}
              disabled={Object.values(mapping).filter(Boolean).length === 0}
              onClick={() => void handleValidate()}
            >
              {isLoading ? "Validating..." : "Validate"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Validation Preview */}
      {step === 2 && preview && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total", value: preview.totalRows, variant: "info" as const },
              { label: "Valid", value: preview.validRows, variant: "success" as const },
              { label: "Invalid", value: preview.invalidRows, variant: "error" as const },
              { label: "Duplicate", value: preview.duplicateRows, variant: "warning" as const },
            ].map((c) => (
              <Card key={c.label} padding="md" className="text-center">
                <p className="text-text-muted text-xs">{c.label}</p>
                <p
                  className={cn(
                    "text-xl font-bold",
                    c.variant === "info"
                      ? "text-text-primary"
                      : c.variant === "success"
                        ? "text-success-500"
                        : c.variant === "error"
                          ? "text-error-500"
                          : "text-warning-700",
                  )}
                >
                  {c.value}
                </p>
              </Card>
            ))}
          </div>

          {/* Validation warnings/errors */}
          {preview.invalidRows > 0 && (
            <Alert variant="error" title="Validation Errors">
              {preview.invalidRows} row{preview.invalidRows !== 1 ? "s" : ""} failed validation.
              Review the errors below before importing.
            </Alert>
          )}
          {preview.duplicateRows > 0 && (
            <Alert variant="warning" title="Duplicates Detected">
              {preview.duplicateRows} duplicate row{preview.duplicateRows !== 1 ? "s" : ""} found.
            </Alert>
          )}

          <Checkbox
            checked={skipDuplicates}
            onChange={(checked) => setSkipDuplicates(checked)}
            label="Skip Duplicates"
          />

          {/* Validation table */}
          <div className="max-h-96 overflow-auto">
            <DataTable<PreviewRow>
              columns={validationColumns}
              data={preview.rows}
              getRowId={(row: PreviewRow) => String(preview!.rows.indexOf(row))}
              compact
              stickyHeader
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              loading={isLoading}
              disabled={preview.validRows === 0}
              onClick={() => void handleImport()}
            >
              {isLoading ? "Importing..." : `Import ${preview.validRows} Rows`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div className="space-y-4">
          <Card padding="lg" className="text-center">
            <CheckCircle2 size={48} className="text-success-500 mx-auto mb-3" />
            <h2 className="text-text-primary text-lg font-semibold">Import Complete</h2>
            <Progress
              value={100}
              variant="success"
              size="md"
              showLabel
              label="Complete"
              className="mx-auto mt-4 max-w-md"
            />
            <div className="mt-4 flex justify-center gap-8 text-sm">
              <div>
                <p className="text-success-500 text-2xl font-bold">{result.imported}</p>
                <p className="text-text-muted">Imported</p>
              </div>
              <div>
                <p className="text-warning-700 text-2xl font-bold">{result.skipped}</p>
                <p className="text-text-muted">Skipped</p>
              </div>
              <div>
                <p className="text-error-500 text-2xl font-bold">{result.errors}</p>
                <p className="text-text-muted">Errors</p>
              </div>
            </div>
          </Card>

          {result.errors > 0 && (
            <Alert variant="error" title="Some rows failed to import">
              {result.errors} row{result.errors !== 1 ? "s" : ""} could not be imported. Download
              the error report for details.
            </Alert>
          )}

          <div className="flex justify-center gap-3">
            {result.failedRows.length > 0 && (
              <Button variant="outline" leftIcon={Download} onClick={downloadErrorReport}>
                Download Error Report
              </Button>
            )}
            <Button onClick={reset}>Import Another File</Button>
          </div>
        </div>
      )}
    </div>
  );
}
