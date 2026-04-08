"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  X,
  RefreshCw,
  Search,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { api, extractApiError } from "@/lib/api";
import {
  executeImport,
  getImportLookups,
  getImportTemplate,
  parseXlsx,
  previewImport,
  type DuplicateMode,
  type ExecuteResponse,
  type ImportLookups,
  type ImportPreview,
  type ImportResult,
  type ImportRow,
} from "@/services/import.service";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  FileUpload,
  FormField,
  IconButton,
  Input,
  PageHeader,
  Progress,
  RadioGroup,
  Select,
  Spinner,
  Tooltip,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/utils/download";

// ──────────────────────────────────────────────
//  Data Import — Spec Section 23.6
//
//  4-step wizard:
//    0. Upload + Optional fallback recruiter
//    1. Column mapping
//    2. Validation preview + duplicate-mode picker
//    3. Results (with retry of failed rows)
//
//  Recruiter attribution: rows that include a `recruiterEmail` column
//  are attributed per-row (supports historical / multi-recruiter
//  imports). Rows without that column fall back to the recruiter
//  picked on Step 0. The picker is optional — leave it blank if every
//  row in the file already carries its own recruiterEmail.
// ──────────────────────────────────────────────

interface ParsedFile {
  name: string;
  size: number;
  headers: string[];
  /** Row data as { headerName: cellValue } so we don't depend on order */
  rows: Array<Record<string, unknown>>;
}

interface Recruiter {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
}

const STEPS = ["Upload", "Map Columns", "Validate", "Import"];

const DUPLICATE_MODE_OPTIONS = [
  {
    value: "skip" as const,
    label: "Skip duplicates",
    description: "Existing records win — duplicate rows are ignored",
  },
  {
    value: "flag" as const,
    label: "Import & flag",
    description: "Insert anyway and flag as duplicate (review on Duplicates page)",
  },
  {
    value: "overwrite" as const,
    label: "Overwrite existing",
    description: "Update the existing record in place with the new values",
  },
];

const STATUS_BADGE_VARIANT: Record<string, "success" | "danger" | "warning"> = {
  valid: "success",
  invalid: "danger",
  duplicate: "warning",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function rowStatus(row: ImportRow): "valid" | "invalid" | "duplicate" {
  if (row.errors.length > 0) return "invalid";
  if (row.isDuplicate) return "duplicate";
  return "valid";
}

export default function DataImportPage() {
  // ── Wizard state ──
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [recruiterId, setRecruiterId] = useState("");
  const [recruiterSearch, setRecruiterSearch] = useState("");

  // Server state — recruiters list (one-time, cached)
  const recruitersQuery = useQuery({
    queryKey: qk.users.list({ role: "RECRUITER", status: "ACTIVE", limit: 500 }),
    queryFn: async () => {
      const res = await api.get<{ data: Recruiter[] }>("/users", {
        params: { role: "RECRUITER", limit: "500", status: "ACTIVE" },
      });
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const recruiters = useMemo(() => recruitersQuery.data ?? [], [recruitersQuery.data]);

  // Column mapping: file header → DB column key
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [lookups, setLookups] = useState<ImportLookups | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Preview / result
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const filteredRecruiters = useMemo(() => {
    if (!recruiterSearch.trim()) return recruiters;
    const q = recruiterSearch.toLowerCase();
    return recruiters.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        (r.employeeId ?? "").toLowerCase().includes(q),
    );
  }, [recruiters, recruiterSearch]);

  const selectedRecruiter = recruiters.find((r) => r.id === recruiterId);

  // ── Step 0 → 1: file dropped ──
  const handleFile = useCallback(async (f: File) => {
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      toast.error("Only CSV and XLSX files are supported");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10 MB limit");
      return;
    }

    setIsLoading(true);
    try {
      let headers: string[];
      let rows: Array<Record<string, unknown>>;

      if (lower.endsWith(".csv")) {
        // Robust CSV parsing — RFC 4180 compliant. Handles quoted values
        // with embedded commas, escaped quotes, and CRLF line endings —
        // all of which the previous naive .split(",") version got wrong.
        const text = await f.text();
        const parsed = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });
        if (parsed.errors.length > 0) {
          const firstErr = parsed.errors[0];
          if (firstErr) {
            toast.error(`CSV parse error on row ${firstErr.row}: ${firstErr.message}`);
          }
        }
        headers = parsed.meta.fields ?? [];
        rows = parsed.data;
      } else {
        // XLSX → backend (ExcelJS handles dates/formulas/richtext properly)
        const parsed = await parseXlsx(f);
        headers = parsed.headers;
        rows = parsed.rows;
      }

      if (headers.length === 0 || rows.length === 0) {
        toast.error("File appears to be empty");
        return;
      }

      setFile({ name: f.name, size: f.size, headers, rows });

      // Fetch DB columns + lookups in parallel
      const [cols, lk] = await Promise.all([getImportTemplate(), getImportLookups()]);
      setDbColumns(cols);
      setLookups(lk);

      // Auto-map case-insensitively + by snake_case / kebab-case fallback
      const autoMap: Record<string, string> = {};
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const dbByNorm = new Map(cols.map((c) => [norm(c), c]));
      for (const h of headers) {
        const match = dbByNorm.get(norm(h));
        if (match) autoMap[h] = match;
      }
      setMapping(autoMap);

      setStep(1);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileUpload = useCallback(
    (files: File[]) => {
      if (files.length > 0) void handleFile(files[0]!);
    },
    [handleFile],
  );

  // ── Step 1 → 2: validate ──
  // Note: the recruiter picker is optional. If the file has a
  // `recruiterEmail` column for every row, the picker can be left
  // blank (historical / multi-recruiter imports). If neither is
  // provided, the backend marks rows as invalid in the preview.
  const handleValidate = useCallback(async () => {
    if (!file) return;
    const fileHasRecruiterColumn = Object.values(mapping).includes("recruiterEmail");
    if (!recruiterId && !fileHasRecruiterColumn) {
      toast.error(
        "Pick a fallback recruiter, or map a column to 'recruiterEmail' for per-row attribution",
      );
      return;
    }
    setIsLoading(true);
    try {
      // Re-key each row by the chosen DB column (drop unmapped headers)
      const mappedRows = file.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const [header, dbCol] of Object.entries(mapping)) {
          if (!dbCol) continue;
          obj[dbCol] = row[header];
        }
        return obj;
      });
      const previewData = await previewImport(mappedRows, recruiterId || null);
      setPreview(previewData);
      setStep(2);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [file, mapping, recruiterId]);

  // ── Step 2 → 3: import ──
  const runImport = useCallback(
    async (rowsToImport: ImportRow[]) => {
      if (!file) return;
      setIsLoading(true);
      try {
        const response: ExecuteResponse = await executeImport(rowsToImport, {
          recruiterId: recruiterId || null,
          fileName: file.name,
          duplicateMode,
        });
        if (response.async) {
          setAsyncJobId(response.jobId);
          setResult({
            totalProcessed: response.queuedRows,
            imported: 0,
            skipped: 0,
            errors: 0,
            failedRows: [],
          });
          toast.success(
            `Queued ${response.queuedRows} rows — you'll get a notification when done`,
          );
        } else {
          setResult(response);
          toast.success(`Import complete: ${response.imported} rows imported`);
        }
        setStep(3);
      } catch (err) {
        toast.error(extractApiError(err).message);
      } finally {
        setIsLoading(false);
      }
    },
    [file, recruiterId, duplicateMode],
  );

  const handleImport = useCallback(() => {
    if (!preview) return;
    void runImport(preview.rows);
  }, [preview, runImport]);

  // ── Step 3: retry failed rows (re-validate then re-import) ──
  const handleRetryFailed = useCallback(async () => {
    if (!result || result.failedRows.length === 0) return;
    setIsLoading(true);
    try {
      // Build raw rows from the failed values, re-run preview, then import
      const rawRows = result.failedRows.map((r) => r.values);
      const newPreview = await previewImport(rawRows);
      setPreview(newPreview);
      setResult(null);
      setStep(2);
      toast.success(`Re-validated ${rawRows.length} rows — review and import again`);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [result]);

  // ── Step 3: download error report (XLSX, properly escaped) ──
  const downloadErrorReport = useCallback(() => {
    if (!result?.failedRows.length) return;
    // Use the same XLSX library the rest of the app uses — handles
    // commas, quotes, newlines in cell values without corruption.
    const allKeys = new Set<string>();
    for (const r of result.failedRows) {
      for (const k of Object.keys(r.values)) allKeys.add(k);
    }
    const keys = Array.from(allKeys);
    const aoa: Array<Array<string | number>> = [
      ["Row #", ...keys, "Error"],
      ...result.failedRows.map((r) => [
        r.rowNumber,
        ...keys.map((k) => r.values[k] ?? ""),
        r.error,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Errors");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "import_errors.xlsx");
  }, [result]);

  const downloadTemplate = useCallback(async () => {
    try {
      const { data } = await api.get("/import/template/download", { responseType: "blob" });
      downloadBlob(data as Blob, "omg-teams-import-template.xlsx");
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setFile(null);
    setMapping({});
    setPreview(null);
    setResult(null);
    setAsyncJobId(null);
  }, []);

  // ── Derived ──
  const dbColumnOptions = useMemo(
    () => [
      { value: "", label: "— Skip —" },
      ...dbColumns.map((col) => ({ value: col, label: col })),
    ],
    [dbColumns],
  );

  // Step 1 mini preview — only first 3 rows of the parsed file.
  // Wrap each row with a synthetic __idx so DataTable's getRowId
  // (which only receives the row, not its index) has a stable key.
  const previewMiniRows = useMemo(
    () =>
      file
        ? file.rows.slice(0, 3).map((row, idx) => ({ ...row, __idx: idx }))
        : [],
    [file],
  );

  const previewMini = useMemo<Column<Record<string, unknown>>[]>(
    () =>
      file
        ? file.headers.map((h: string) => ({
            key: h,
            header: h,
            cell: (row: Record<string, unknown>) => (
              <span className="text-text-secondary">{String(row[h] ?? "")}</span>
            ),
          }))
        : [],
    [file],
  );

  // Step 2 validation table — derived from preview.rows
  const validationColumns = useMemo<Column<ImportRow>[]>(() => {
    if (!preview?.rows.length) return [];
    const valueKeys = Object.keys(preview.rows[0]!.values);
    return [
      {
        key: "row",
        header: "Row",
        width: "60px",
        cell: (row) => <span className="text-text-muted text-xs">#{row.rowNumber}</span>,
      },
      {
        key: "status",
        header: "Status",
        width: "100px",
        cell: (row) => (
          <Badge variant={STATUS_BADGE_VARIANT[rowStatus(row)]!}>{rowStatus(row)}</Badge>
        ),
      },
      ...valueKeys.map((k) => ({
        key: k,
        header: k,
        cell: (row: ImportRow) => (
          <span className="text-text-secondary">{row.values[k]}</span>
        ),
      })),
      {
        key: "errors",
        header: "Errors",
        cell: (row: ImportRow) => (
          <span className="text-error-500 text-xs">{row.errors.join("; ")}</span>
        ),
      },
    ];
  }, [preview]);

  const stepProgress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Data Import"
        description="Bulk import candidate reports from CSV or XLSX (up to 10,000 rows)"
        actions={
          <Button variant="outline" leftIcon={Download} onClick={() => void downloadTemplate()}>
            Download Template
          </Button>
        }
      />

      {/* Stepper */}
      <Card padding="md">
        <div className="mb-3 flex items-center gap-2 overflow-x-auto">
          {STEPS.map((label, i) => (
            <div key={label} className="flex shrink-0 items-center gap-2">
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

      {/* Step 0: Upload + (optional) fallback recruiter picker */}
      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recruiter picker (optional fallback) */}
          <Card padding="md">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">
              1. Fallback Recruiter <span className="text-text-muted font-normal">(optional)</span>
            </h3>
            <p className="text-text-muted mb-3 text-xs">
              Rows that don&apos;t carry their own <code className="bg-bg-muted rounded px-1">recruiterEmail</code> column
              will be attributed to this recruiter. <strong>Leave blank</strong> if you&apos;re importing
              historical or multi-recruiter data and every row already has its own
              <code className="bg-bg-muted rounded px-1"> recruiterEmail</code> column.
            </p>
            <FormField label="Recruiter">
              <div className="relative">
                <Search
                  size={14}
                  className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
                />
                <Input
                  value={recruiterSearch}
                  onChange={(e) => setRecruiterSearch(e.target.value)}
                  placeholder="Search recruiters by name or employee ID..."
                  className="pl-8"
                />
              </div>
              {recruiterSearch && !selectedRecruiter && (
                <div className="border-border-default bg-bg-surface mt-1 max-h-40 overflow-y-auto rounded-md border">
                  {filteredRecruiters.length === 0 ? (
                    <p className="text-text-muted px-3 py-2 text-xs">No matches</p>
                  ) : (
                    filteredRecruiters.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setRecruiterId(r.id);
                          setRecruiterSearch(`${r.firstName} ${r.lastName}`);
                        }}
                        className="hover:bg-bg-hover block w-full px-3 py-1.5 text-left text-sm"
                      >
                        {r.firstName} {r.lastName}{" "}
                        <span className="text-text-muted">({r.employeeId ?? "—"})</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedRecruiter && (
                <div className="border-success-500 bg-success-50 mt-2 flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-success-600" />
                    <span className="text-text-primary text-sm font-medium">
                      {selectedRecruiter.firstName} {selectedRecruiter.lastName}
                      <span className="text-text-muted ml-2 text-xs">
                        {selectedRecruiter.employeeId ?? "—"}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRecruiterId("");
                      setRecruiterSearch("");
                    }}
                    className="text-text-muted hover:text-text-primary"
                    aria-label="Clear recruiter"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </FormField>
          </Card>

          {/* File upload */}
          <Card padding="md">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">2. Upload File</h3>
            <p className="text-text-muted mb-3 text-xs">
              Need a starter? Click <strong>Download Template</strong> above.
            </p>
            <FileUpload
              accept=".csv,.xlsx,.xls"
              label="Drag a CSV or XLSX file here, or click to browse"
              description="CSV or XLSX, up to 10 MB / 10,000 rows"
              onUpload={handleFileUpload}
            />
          </Card>
        </div>
      )}

      {/* Step 1: Column mapping */}
      {step === 1 && file && (
        <div className="space-y-4">
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-success-500" />
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium">{file.name}</p>
                <p className="text-text-muted text-xs">
                  {formatSize(file.size)} — {file.rows.length} rows
                  {selectedRecruiter ? (
                    <>
                      {" · fallback: "}
                      <span className="text-text-secondary">
                        {selectedRecruiter.firstName} {selectedRecruiter.lastName}
                      </span>
                    </>
                  ) : (
                    <>
                      {" · "}
                      <span className="text-warning-700">no fallback recruiter</span>
                    </>
                  )}
                </p>
              </div>
              <Tooltip content="Remove file">
                <IconButton icon={X} aria-label="Remove file" size="sm" onClick={reset} />
              </Tooltip>
            </div>
          </Card>

          {lookups && (
            <Alert variant="info">
              <strong>{lookups.companies.length}</strong> companies,{" "}
              <strong>{lookups.serviceProviders.length}</strong> service providers,{" "}
              <strong>{lookups.hrManagers.length}</strong> HR managers available for name
              resolution. Names must match exactly (case-insensitive).
            </Alert>
          )}

          {!recruiterId && !Object.values(mapping).includes("recruiterEmail") && (
            <Alert variant="warning" title="No recruiter attribution configured">
              You haven&apos;t picked a fallback recruiter, and no column is mapped to{" "}
              <code className="bg-bg-muted rounded px-1">recruiterEmail</code>. Either map a
              column to <code className="bg-bg-muted rounded px-1">recruiterEmail</code> for
              per-row attribution, or go back to Step 0 and pick a fallback recruiter.
            </Alert>
          )}

          <Card padding="md">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">Column Mapping</h3>
            <p className="text-text-muted mb-4 text-xs">
              Match each column from your file to a database field. Auto-mapped columns are
              pre-filled — adjust as needed. Unmapped columns are skipped.
            </p>
            <div className="space-y-2">
              {file.headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-text-secondary w-48 truncate text-sm" title={h}>
                    {h}
                  </span>
                  <ChevronRight size={14} className="text-text-muted shrink-0" />
                  <div className="flex-1">
                    <Select
                      options={dbColumnOptions}
                      value={mapping[h] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [h]: e.target.value }))
                      }
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* First 3 rows preview */}
          <Card padding="sm">
            <h3 className="text-text-primary mb-2 text-sm font-semibold">
              File preview (first 3 rows)
            </h3>
            <div className="max-h-64 overflow-auto">
              <DataTable<Record<string, unknown>>
                columns={previewMini}
                data={previewMiniRows}
                getRowId={(row) => String((row as { __idx: number }).__idx)}
                compact
              />
            </div>
          </Card>

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

      {/* Step 2: Validation preview */}
      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total", value: preview.totalRows, color: "text-text-primary" },
              { label: "Valid", value: preview.validRows, color: "text-success-500" },
              { label: "Invalid", value: preview.invalidRows, color: "text-error-500" },
              { label: "Duplicate", value: preview.duplicateRows, color: "text-warning-700" },
            ].map((c) => (
              <Card key={c.label} padding="md" className="text-center">
                <p className="text-text-muted text-xs">{c.label}</p>
                <p className={cn("text-xl font-bold", c.color)}>{c.value}</p>
              </Card>
            ))}
          </div>

          {preview.invalidRows > 0 && (
            <Alert variant="error" title="Validation Errors">
              {preview.invalidRows} row{preview.invalidRows !== 1 ? "s" : ""} failed
              validation. Fix or download the file with annotations before importing.
            </Alert>
          )}
          {preview.duplicateRows > 0 && (
            <Alert variant="warning" title="Duplicates Detected">
              {preview.duplicateRows} duplicate row{preview.duplicateRows !== 1 ? "s" : ""}{" "}
              found. Choose how to handle them below.
            </Alert>
          )}

          {/* Duplicate handling */}
          <Card padding="md">
            <h3 className="text-text-primary mb-3 text-sm font-semibold">
              Duplicate handling
            </h3>
            <RadioGroup
              name="duplicateMode"
              value={duplicateMode}
              onChange={(v) => setDuplicateMode(v as DuplicateMode)}
              options={DUPLICATE_MODE_OPTIONS}
            />
          </Card>

          {/* Validation table */}
          <Card padding="sm">
            <div className="max-h-112 overflow-auto">
              <DataTable<ImportRow>
                columns={validationColumns}
                data={preview.rows}
                getRowId={(row) => String(row.rowNumber)}
                compact
                stickyHeader
              />
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              loading={isLoading}
              disabled={preview.validRows === 0 && preview.duplicateRows === 0}
              onClick={() => void handleImport()}
            >
              {isLoading
                ? "Importing..."
                : `Import ${preview.validRows + (duplicateMode === "skip" ? 0 : preview.duplicateRows)} Rows`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div className="space-y-4">
          <Card padding="lg" className="text-center">
            {asyncJobId ? (
              <>
                <Spinner size="lg" />
                <h2 className="text-text-primary mt-4 text-lg font-semibold">
                  Import queued
                </h2>
                <p className="text-text-muted mt-2 text-sm">
                  {result.totalProcessed.toLocaleString()} rows are being processed in the
                  background. You&apos;ll get a notification (and an email) when it&apos;s
                  done.
                </p>
                <p className="text-text-muted mt-2 text-xs">Job ID: {asyncJobId}</p>
              </>
            ) : (
              <>
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
              </>
            )}
          </Card>

          {result.errors > 0 && (
            <Alert variant="error" title="Some rows failed to import">
              {result.errors} row{result.errors !== 1 ? "s" : ""} could not be imported.
              Download the error report or click <strong>Retry failed rows</strong> to fix
              and re-validate them in place.
            </Alert>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            {result.failedRows.length > 0 && (
              <>
                <Button variant="outline" leftIcon={Download} onClick={downloadErrorReport}>
                  Download Error Report
                </Button>
                <Button
                  variant="outline"
                  leftIcon={RefreshCw}
                  loading={isLoading}
                  onClick={() => void handleRetryFailed()}
                >
                  Retry Failed Rows
                </Button>
              </>
            )}
            <Button onClick={reset}>Import Another File</Button>
          </div>
        </div>
      )}

    </div>
  );
}
