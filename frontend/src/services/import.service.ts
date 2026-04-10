import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Import Service (frontend) — Spec Section 23.6
// ──────────────────────────────────────────────

export type DuplicateMode = "skip" | "flag" | "overwrite";

export interface ImportRow {
  rowNumber: number;
  /** Raw values keyed by column name (always strings for the UI) */
  values: Record<string, string>;
  /** Parsed/validated values keyed by Prisma column (only set for valid rows) */
  parsed: Record<string, unknown>;
  errors: string[];
  isDuplicate: boolean;
  duplicateOfId: string | null;
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ImportRow[];
}

export interface ImportResult {
  totalProcessed: number;
  imported: number;
  skipped: number;
  errors: number;
  failedRows: Array<{
    rowNumber: number;
    values: Record<string, string>;
    error: string;
  }>;
}

/** Returned by `executeImport` — either inline result or queued job info */
export type ExecuteResponse =
  | ({ async: false } & ImportResult)
  | { async: true; jobId: string; queuedRows: number };

export interface ImportLookups {
  companies: Array<{ id: string; name: string }>;
  serviceProviders: Array<{ id: string; name: string; companyId: string }>;
  hrManagers: Array<{ id: string; name: string; companyId: string }>;
  zones: string[];
  paymentStatuses: string[];
  hrFeedbackOptions: string[];
}

/** GET /import/template — list of column keys (one per importable field) */
export async function getImportTemplate(): Promise<string[]> {
  const res = await api.get<{ data: { columns: string[] } }>("/import/template");
  return res.data.data.columns;
}

/** GET /import/lookups — dropdown content for the column-mapping screen */
export async function getImportLookups(): Promise<ImportLookups> {
  const res = await api.get<{ data: ImportLookups }>("/import/lookups");
  return res.data.data;
}

/**
 * POST /import/preview — validate + dedupe + return preview rows.
 *
 * `fallbackRecruiterId` is the recruiter selected on the Import-page
 * picker. It's the safety net for rows that don't carry their own
 * `recruiterEmail` column. Pass `null` if every row in the file is
 * expected to have its own per-row recruiter (historical imports).
 */
export async function previewImport(
  rows: Array<Record<string, unknown>>,
  fallbackRecruiterId: string | null = null,
): Promise<ImportPreview> {
  const res = await api.post<{ data: ImportPreview }>("/import/preview", {
    rows,
    fallbackRecruiterId,
  });
  return res.data.data;
}

/**
 * POST /import/execute — actually write rows to the DB.
 *
 * `recruiterId` is the optional fallback. Rows that supply their own
 * `recruiterEmail` column take priority; rows that don't fall back to
 * this id. May be `null` for historical imports where every row has
 * its own recruiter column.
 */
export async function executeImport(
  rows: ImportRow[],
  options: {
    recruiterId: string | null;
    fileName: string;
    duplicateMode: DuplicateMode;
  },
): Promise<ExecuteResponse> {
  const res = await api.post<{ data: ExecuteResponse }>("/import/execute", {
    rows,
    ...options,
  });
  return res.data.data;
}

export interface ParseXlsxResult {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  /** Per-column mapping report: which uploaded header mapped to which field key */
  columnMapping?: Array<{ uploaded: string; mappedTo: string | null }>;
  /** Uploaded headers that couldn't be matched to any known field */
  unmappedHeaders?: string[];
  /** Required fields not found in any uploaded column */
  missingRequiredFields?: string[];
}

/** POST /import/parse-xlsx — server-side XLSX parser */
export async function parseXlsx(file: File): Promise<ParseXlsxResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{ data: ParseXlsxResult }>("/import/parse-xlsx", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

/** POST /import/parse-csv — server-side CSV parser with alias-based header resolution */
export async function parseCsv(file: File): Promise<ParseXlsxResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{ data: ParseXlsxResult }>("/import/parse-csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

// ── Batch import types ──

export interface BatchParsedFile {
  fileName: string;
  fileSize: number;
  status: "parsed" | "error";
  data?: ParseXlsxResult;
  error?: string;
  /** Present when this entry was auto-merged from multiple source files */
  mergedFrom?: string[];
}

export interface BatchParseResponse {
  files: BatchParsedFile[];
}

/** POST /import/batch-parse — parse multiple files at once */
export async function batchParse(files: File[]): Promise<BatchParseResponse> {
  const form = new FormData();
  for (const f of files) {
    form.append("files", f);
  }
  const res = await api.post<{ data: BatchParseResponse }>("/import/batch-parse", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000, // 2 min for large batches
  });
  return res.data.data;
}

