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

/** POST /import/parse-xlsx — server-side XLSX parser */
export async function parseXlsx(
  file: File,
): Promise<{ headers: string[]; rows: Array<Record<string, unknown>>; totalRows: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{
    data: { headers: string[]; rows: Array<Record<string, unknown>>; totalRows: number };
  }>("/import/parse-xlsx", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}
