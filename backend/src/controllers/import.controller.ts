import ExcelJS from "exceljs";
import { z } from "zod";
import { logger } from "../instrument.js";
import { enqueueAsyncImport } from "../jobs/import.queue.js";
import * as importSvc from "../services/import.service.js";
import {
  ASYNC_IMPORT_THRESHOLD,
  FIELD_DEFINITIONS,
  MAX_IMPORT_ROWS,
  type DuplicateMode,
} from "../services/import.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Data Import Controller — Spec Section 23.6
// ──────────────────────────────────────────────

const previewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  /**
   * Optional fallback recruiter from the Import-page picker. Used to
   * attribute rows that don't carry their own `recruiterEmail` column.
   * Empty string and undefined are both treated as "no fallback".
   */
  fallbackRecruiterId: z.string().optional().nullable(),
});

const executeSchema = z.object({
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        values: z.record(z.string(), z.string()),
        parsed: z.record(z.string(), z.unknown()),
        errors: z.array(z.string()),
        isDuplicate: z.boolean(),
        duplicateOfId: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(MAX_IMPORT_ROWS),
  /**
   * Optional fallback recruiter — every row that doesn't supply its
   * own `recruiterEmail` falls back to this id. May be empty / null
   * if every row in the file already has a per-row recruiter.
   */
  recruiterId: z.string().optional().nullable(),
  fileName: z.string().min(1, "File name is required"),
  duplicateMode: z.enum(["skip", "flag", "overwrite"]),
});

/** GET /api/v1/import/lookups — dropdown content for the column-mapping UI */
export async function handleGetLookups(_req: Request, res: Response): Promise<void> {
  const data = await importSvc.getImportLookups();
  res.status(200).json({ data });
}

/** POST /api/v1/import/preview */
export async function handlePreviewImport(req: Request, res: Response): Promise<void> {
  const { rows, fallbackRecruiterId } = previewSchema.parse(req.body);
  const preview = await importSvc.previewImport(rows, fallbackRecruiterId ?? null);
  res.status(200).json({ data: preview });
}

/**
 * POST /api/v1/import/execute
 *
 * Decides synchronously vs queued based on row count:
 *   - ≤ ASYNC_IMPORT_THRESHOLD rows → run inline, return result
 *   - > ASYNC_IMPORT_THRESHOLD rows  → queue + return {async: true, jobId}
 */
export async function handleExecuteImport(req: Request, res: Response): Promise<void> {
  const body = executeSchema.parse(req.body);

  // Empty string is the same as "no fallback" — normalize to null
  // so the service layer doesn't have to second-guess.
  const fallbackRecruiterId =
    body.recruiterId && body.recruiterId.length > 0 ? body.recruiterId : null;

  const options: importSvc.ImportOptions = {
    recruiterId: fallbackRecruiterId,
    fileName: body.fileName,
    duplicateMode: body.duplicateMode as DuplicateMode,
  };

  // Big files: queue and return early
  if (body.rows.length > ASYNC_IMPORT_THRESHOLD) {
    const jobId = await enqueueAsyncImport({
      rows: body.rows.map((r) => ({
        ...r,
        duplicateOfId: r.duplicateOfId ?? null,
      })),
      options,
      importingUserId: req.user!.id,
    });
    logger.info("Queued large import job", {
      jobId,
      rows: body.rows.length,
      fallbackRecruiterId,
    });
    res.status(202).json({
      data: { async: true, jobId, queuedRows: body.rows.length },
    });
    return;
  }

  // Small files: run inline
  const result = await importSvc.executeImport(
    body.rows.map((r) => ({
      ...r,
      duplicateOfId: r.duplicateOfId ?? null,
    })),
    options,
    req.user!.id,
  );
  res.status(200).json({ data: { async: false, ...result } });
}

/** GET /api/v1/import/template — JSON list of column keys (legacy/UI bootstrap) */
export function handleGetImportTemplate(_req: Request, res: Response): void {
  const columns = importSvc.getTemplateColumns();
  res.status(200).json({ data: { columns } });
}

/**
 * GET /api/v1/import/template/download — XLSX template
 *
 * Sheets:
 *   1. "Import Template"  — header row + description row + example row,
 *      one column per importable field. Column header is the storage
 *      key so auto-mapping just works.
 *   2. "Reference"        — list of valid values for every enum /
 *      dropdown field, plus the company / SP / HR names that can be
 *      typed into those columns.
 *   3. "Instructions"     — short README on how to use the template.
 */
export async function handleDownloadImportTemplate(_req: Request, res: Response): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMG Teams";
  workbook.created = new Date();

  // ── Sheet 1: Import Template ──
  const sheet = workbook.addWorksheet("Import Template");
  sheet.columns = FIELD_DEFINITIONS.map((f) => ({
    header: f.key,
    key: f.key,
    width: Math.max(18, f.label.length + 4),
  }));

  // Header row — bold white on dark blue
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF001845" },
  };
  headerRow.height = 22;
  headerRow.alignment = { vertical: "middle", horizontal: "left" };

  // Description row — italic grey
  const descRow = sheet.addRow(
    Object.fromEntries(FIELD_DEFINITIONS.map((f) => [f.key, f.description])),
  );
  descRow.font = { italic: true, color: { argb: "FF666666" }, size: 10 };
  descRow.height = 32;
  descRow.alignment = { vertical: "middle", wrapText: true };

  // Example row — every column has an example
  sheet.addRow(Object.fromEntries(FIELD_DEFINITIONS.map((f) => [f.key, f.example])));

  // Freeze the first 3 rows (header + description + example) so admins
  // can scroll the data area without losing the headers.
  sheet.views = [{ state: "frozen", ySplit: 3 }];

  // Auto-filter on the header
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: FIELD_DEFINITIONS.length },
  };

  // ── Sheet 2: Reference (valid values + entity names) ──
  const refSheet = workbook.addWorksheet("Reference");
  refSheet.columns = [
    { header: "Field", key: "field", width: 26 },
    { header: "Valid Values / Notes", key: "values", width: 80 },
  ];
  const refHeader = refSheet.getRow(1);
  refHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  refHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF001845" },
  };

  // Enum fields
  for (const f of FIELD_DEFINITIONS) {
    if (f.type === "enum" && f.enumValues) {
      refSheet.addRow({
        field: f.label,
        values: f.enumValues.join(" / "),
      });
    } else if (f.type === "boolean") {
      refSheet.addRow({
        field: f.label,
        values: "Yes / No / true / false / 1 / 0",
      });
    } else if (f.type === "date") {
      refSheet.addRow({
        field: f.label,
        values: "YYYY-MM-DD or DD/MM/YYYY (e.g. 2026-04-15 or 15/04/2026)",
      });
    } else if (f.type === "phone10") {
      refSheet.addRow({ field: f.label, values: "10 digits, no +91 or spaces" });
    } else if (f.type === "recruiter-email") {
      refSheet.addRow({
        field: f.label,
        values:
          "Email of an existing recruiter (active OR inactive). Leave blank to use " +
          "the recruiter selected on the Import page. See 'Recruiters' below for the list.",
      });
    }
  }

  // Live lookup data — companies / service providers / HR managers
  refSheet.addRow({});
  const companiesHeader = refSheet.addRow({
    field: "── Companies (use exact name) ──",
    values: "",
  });
  companiesHeader.font = { bold: true };

  const lookups = await importSvc.getImportLookups();
  for (const c of lookups.companies) {
    refSheet.addRow({ field: c.name, values: "" });
  }

  refSheet.addRow({});
  const spHeader = refSheet.addRow({
    field: "── Service Providers (use exact name) ──",
    values: "",
  });
  spHeader.font = { bold: true };
  for (const s of lookups.serviceProviders) {
    const company = lookups.companies.find((c) => c.id === s.companyId);
    refSheet.addRow({
      field: s.name,
      values: company ? `linked to: ${company.name}` : "",
    });
  }

  refSheet.addRow({});
  const hrHeader = refSheet.addRow({
    field: "── HR Managers (use exact name) ──",
    values: "",
  });
  hrHeader.font = { bold: true };
  for (const h of lookups.hrManagers) {
    const company = lookups.companies.find((c) => c.id === h.companyId);
    refSheet.addRow({
      field: h.name,
      values: company ? `linked to: ${company.name}` : "",
    });
  }

  // Recruiters — for the optional `recruiterEmail` per-row attribution
  // column. Includes inactive recruiters since historical imports can
  // attribute rows to recruiters who have since left.
  refSheet.addRow({});
  const recHeader = refSheet.addRow({
    field: "── Recruiters (use exact email) ──",
    values: "Active + inactive — for the recruiterEmail column",
  });
  recHeader.font = { bold: true };
  const recruiters = await importSvc.getRecruitersForTemplate();
  for (const r of recruiters) {
    refSheet.addRow({
      field: r.email,
      values: `${r.firstName} ${r.lastName}${r.status === "ACTIVE" ? "" : ` (${r.status})`}`,
    });
  }

  // ── Sheet 3: Instructions ──
  const instr = workbook.addWorksheet("Instructions");
  instr.columns = [{ header: "Instructions", key: "text", width: 110 }];
  instr.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  instr.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF001845" },
  };
  const lines = [
    "1. Fill the rows on the 'Import Template' sheet — DELETE the description and example rows before uploading.",
    "2. The HEADER row (row 1) must remain — it's used for column auto-mapping.",
    "3. Required columns: candidateName, contactNo, zone. Other fields are optional.",
    "4. Phone numbers must be 10 digits with no +91 prefix or spaces.",
    "5. Dates accept YYYY-MM-DD or DD/MM/YYYY (or native Excel date cells).",
    "6. Yes/No fields accept: Yes, No, Y, N, true, false, 1, 0.",
    `7. Maximum ${MAX_IMPORT_ROWS.toLocaleString()} rows per file. Files larger than ` +
      `${ASYNC_IMPORT_THRESHOLD.toLocaleString()} rows are processed in the background — ` +
      "you'll get a notification when the import completes.",
    "8. The Company / Service Provider / HR Manager columns expect the EXACT name " +
      "as it appears in Master Data — see the 'Reference' sheet for the current list.",
    "9. Zone-conditional screening fields (isCtcInformed, isOffRollOkay, etc.) " +
      "only apply to West and Central zones — leave blank for other zones.",
    "10. RECRUITER ATTRIBUTION — two ways:",
    "    (a) Today's batch from one recruiter: leave the 'recruiterEmail' column blank " +
      "and pick the recruiter on the Import page. Every row will be attributed to that recruiter.",
    "    (b) Historical / multi-recruiter import: fill the 'recruiterEmail' column for each row " +
      "with the email of the recruiter who originally sourced that candidate. The picker on " +
      "the Import page becomes optional — it's only used for rows that leave the column blank.",
    "    Inactive / former recruiters ARE accepted in the recruiterEmail column for historical " +
      "accuracy, but the picker on the Import page only allows currently active recruiters.",
    "    Every row must end up with a recruiter — column OR picker fallback.",
  ];
  for (const line of lines) {
    instr.addRow({ text: line });
  }
  instr.getColumn(1).alignment = { wrapText: true, vertical: "top" };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="omg-teams-import-template.xlsx"');
  res.send(buffer);
}

/**
 * POST /api/v1/import/parse-xlsx — multipart upload, returns rows as JSON.
 */
export async function handleParseXLSX(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as never);
    // Use the first non-empty worksheet (some templates have a hidden sheet)
    const sheet = workbook.worksheets.find((s) => s.actualRowCount > 0);
    if (!sheet) {
      res.status(400).json({ error: "No data found in the uploaded workbook" });
      return;
    }

    // Headers from row 1
    const headers: string[] = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    // Body rows
    const rows: Record<string, unknown>[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const record: Record<string, unknown> = {};
      let hasData = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (!header) return;
        const val = cell.value;
        // ExcelJS may give us a richtext / formula / hyperlink object
        let normalized: unknown = val;
        if (val && typeof val === "object") {
          if (val instanceof Date) {
            normalized = val.toISOString().slice(0, 10);
          } else if ("text" in val) {
            normalized = (val as { text: unknown }).text;
          } else if ("result" in val) {
            normalized = (val as { result: unknown }).result;
          } else if ("hyperlink" in val) {
            normalized = (val as { text?: unknown; hyperlink?: unknown }).text ?? "";
          } else if ("richText" in val) {
            normalized = (val as { richText: { text: string }[] }).richText
              .map((r) => r.text)
              .join("");
          }
        }
        record[header] = normalized;
        if (normalized !== null && normalized !== undefined && String(normalized).trim() !== "") {
          hasData = true;
        }
      });
      if (hasData) rows.push(record);
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      res.status(413).json({
        error: `File exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit (got ${rows.length}).`,
      });
      return;
    }

    res.status(200).json({ data: { headers, rows, totalRows: rows.length } });
  } catch (err) {
    res.status(400).json({
      error: `Failed to parse XLSX: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
