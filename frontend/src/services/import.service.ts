import { api } from "@/lib/api";

export interface ImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: string[];
  isDuplicate: boolean;
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
  errors: Array<{ row: number; error: string }>;
}

export async function previewImport(rows: Record<string, unknown>[]): Promise<ImportPreview> {
  const res = await api.post<{ data: ImportPreview }>("/import/preview", { rows });
  return res.data.data;
}

export async function executeImport(
  rows: ImportRow[],
  recruiterId: string,
  skipDuplicates = false,
): Promise<ImportResult> {
  const res = await api.post<{ data: ImportResult }>("/import/execute", {
    rows,
    recruiterId,
    skipDuplicates,
  });
  return res.data.data;
}

export async function getImportTemplate(): Promise<string[]> {
  const res = await api.get<{ data: { columns: string[] } }>("/import/template");
  return res.data.data.columns;
}

/** Parse an uploaded XLSX file into rows for preview */
export async function parseXlsx(file: File): Promise<Record<string, unknown>[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{ data: { rows: Record<string, unknown>[] } }>(
    "/import/parse-xlsx",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return res.data.data.rows;
}
