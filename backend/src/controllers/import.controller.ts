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

// ── Header normalisation helpers ──
// Historical sheets use wildly different header names for the same 48 fields.
// The alias map below covers every realistic variation so column matching
// "just works" regardless of header naming, order, or casing.

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Comprehensive alias → field-key map. Each field gets:
 *   - Its camelCase storage key ("candidateName")
 *   - Its human label from FIELD_DEFINITIONS ("Candidate Name")
 *   - Every plausible historical variation an admin sheet might use
 *
 * All lookups happen on the slugified form so case, spaces, hyphens,
 * underscores, dots, and special chars are all irrelevant.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  zone: [
    "zone", "region", "area zone", "territory",
  ],
  dateSourced: [
    "date sourced", "sourced date", "sourcing date", "date of sourcing",
    "profile date", "date added", "created date", "entry date",
  ],
  candidateName: [
    "candidate name", "name", "full name", "candidate full name",
    "name of candidate", "applicant name", "applicant", "person name",
    "employee name", "emp name",
  ],
  contactNo: [
    "contact no", "contact number", "phone", "phone no", "phone number",
    "mobile", "mobile no", "mobile number", "cell", "cell no", "cell number",
    "contact", "telephone", "tel", "mob no", "mob", "ph no",
    "candidate contact", "candidate mobile", "candidate phone",
  ],
  state: [
    "state", "candidate state", "home state", "current state",
  ],
  location: [
    "location", "city", "candidate location", "candidate city",
    "home city", "current city", "current location", "place",
  ],
  profile: [
    "profile", "job profile", "role", "job role", "position",
    "designation applied", "applied for", "job title applied",
  ],
  yearsOfExperience: [
    "years of experience", "experience", "exp", "total experience",
    "work experience", "yrs of exp", "years exp", "experience years",
    "total exp", "exp years", "experience in years",
  ],
  currentCtc: [
    "current ctc", "ctc", "current salary", "salary", "present ctc",
    "existing ctc", "current compensation", "cur ctc", "present salary",
    "current ctc lpa", "ctc lpa", "current ctc in lpa",
  ],
  currentDesignation: [
    "current designation", "designation", "current role", "current title",
    "job title", "present designation", "current position",
  ],
  currentOrganization: [
    "current organization", "current organisation", "organization",
    "organisation", "current company", "current employer", "employer",
    "company name current", "present company", "present organisation",
    "present organization", "org",
  ],
  emailId: [
    "email id", "email", "email address", "e mail", "e-mail",
    "candidate email", "mail", "mail id", "email id of candidate",
  ],
  higherQualification: [
    "higher qualification", "qualification", "highest qualification",
    "education", "highest degree", "degree", "highest education",
    "educational qualification", "qual",
  ],
  expectedCtc: [
    "expected ctc", "expected salary", "expected compensation",
    "exp ctc", "expected ctc lpa", "desired ctc", "desired salary",
  ],
  diplomaPartFull: [
    "diploma part full", "diploma", "diploma type", "diploma part or full",
    "part full", "diploma category",
  ],
  graduationPercent: [
    "graduation percent", "graduation %", "graduation percentage",
    "grad percent", "grad %", "ug percentage", "ug percent", "ug %",
    "graduation marks", "degree percentage", "degree %",
  ],
  graduationYear: [
    "graduation year", "grad year", "year of graduation",
    "ug year", "ug passing year", "degree year", "graduation passing year",
  ],
  twelfthPassingYear: [
    "12th passing year", "12th year", "xii passing year", "xii year",
    "12 passing year", "hsc year", "hsc passing year", "12th pass year",
    "intermediate year", "inter year", "plus two year",
  ],
  twelfthPercent: [
    "12th percent", "12th %", "12th percentage", "xii percent", "xii %",
    "12 percent", "hsc percent", "hsc %", "hsc percentage",
    "12th marks", "intermediate %", "inter %",
  ],
  tenthPassingYear: [
    "10th passing year", "10th year", "x passing year", "x year",
    "10 passing year", "ssc year", "ssc passing year", "10th pass year",
    "matriculation year",
  ],
  tenthPercent: [
    "10th percent", "10th %", "10th percentage", "x percent", "x %",
    "10 percent", "ssc percent", "ssc %", "ssc percentage",
    "10th marks", "matriculation %",
  ],
  dateOfBirth: [
    "date of birth", "dob", "birth date", "birthday", "d.o.b",
    "d o b", "date birth",
  ],
  noticePeriod: [
    "notice period", "notice", "np", "notice period days",
    "notice period in days", "serving notice", "notice time",
  ],
  remarks: [
    "remarks", "remark", "notes", "note", "comments", "comment",
    "additional remarks", "additional notes", "observations",
  ],
  isCtcInformed: [
    "is ctc informed", "ctc informed", "ctc informed?",
    "is ctc communicated", "ctc communicated",
  ],
  isOffRollOkay: [
    "is off roll okay", "off roll okay", "off roll ok", "offroll okay",
    "off roll", "is offroll ok", "off-roll okay",
  ],
  isOnRollExplained: [
    "on roll 18 month explained", "on roll explained",
    "18 month explained", "onroll explained", "on-roll 18-month explained",
  ],
  hasTwoWheeler: [
    "has two wheeler", "two wheeler", "2 wheeler", "two wheeler licence",
    "has two wheeler licence", "two wheeler license", "bike",
    "has 2 wheeler", "two wheeler + licence",
  ],
  communicationSkill: [
    "communication skill", "communication", "comm skill",
    "communication rating", "communication skills", "comm skills",
    "communication skill 1 10", "comm score",
  ],
  status: [
    "status", "candidate status", "record status", "profile status",
    "current status",
  ],
  recruiterEmail: [
    "recruiter email", "recruiter", "recruiter mail", "sourced by",
    "sourced by email", "recruiter e-mail", "recruiter id",
    "assigned recruiter", "recruiter name",
  ],
  companyName: [
    "company", "company name", "client", "client name",
    "client company", "hiring company",
  ],
  serviceProviderName: [
    "service provider", "service provider name", "sp", "sp name",
    "staffing partner", "vendor", "vendor name", "staffing agency",
  ],
  hrManagerName: [
    "hr manager", "hr manager name", "hr name", "hr",
    "hiring manager", "hr contact", "hr person", "spoc",
    "hr spoc", "client hr",
  ],
  adminLocation: [
    "location admin", "admin location", "posting location",
    "work location", "job location", "office location",
  ],
  adminState: [
    "state admin", "admin state", "posting state",
    "work state", "job state",
  ],
  dateOfJoining: [
    "date of joining", "doj", "joining date", "join date",
    "start date", "date joined", "onboarding date",
  ],
  invoiceDate: [
    "invoice date", "inv date", "bill date", "billing date",
  ],
  invoiceNumber: [
    "invoice number", "invoice no", "inv no", "inv number",
    "bill no", "bill number", "invoice #",
  ],
  invoiceAmountTotal: [
    "invoice amount total", "invoice amount", "total amount",
    "invoice total", "bill amount", "total invoice amount",
    "amount", "inv amount",
  ],
  gstAmount: [
    "gst amount", "gst", "tax amount", "gst value",
    "gst amt", "tax",
  ],
  amountReceived: [
    "amount received", "received amount", "payment received",
    "amt received", "collection", "received",
  ],
  tdsAmount: [
    "tds amount", "tds", "tds deducted", "tds amt",
    "tds value", "tax deducted",
  ],
  paymentStatus: [
    "payment status", "pay status", "payment state",
    "invoice status", "collection status",
  ],
  paymentDate: [
    "payment date", "pay date", "date of payment",
    "collection date", "paid date", "received date",
  ],
  cvSharedOnDate: [
    "cv shared on date", "cv shared date", "cv shared on",
    "cv sent date", "resume shared date", "resume sent date",
    "cv date", "shared date", "profile shared date",
  ],
  hrFeedback: [
    "feedback from hr", "hr feedback", "feedback", "client feedback",
    "hr response", "hr status", "client response",
  ],
};

// Build the slug → key lookup from aliases + FIELD_DEFINITIONS
const _headerToKey = new Map<string, string>();
for (const f of FIELD_DEFINITIONS) {
  _headerToKey.set(slug(f.key), f.key);
  _headerToKey.set(slug(f.label), f.key);
}
for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
  for (const alias of aliases) {
    _headerToKey.set(slug(alias), key);
  }
}

/**
 * Try to resolve an uploaded column header to a known field key.
 * Returns the field key if matched, or the original header if not.
 */
function resolveHeader(raw: string): string {
  const trimmed = raw.trim();
  const s = slug(trimmed);
  return _headerToKey.get(s) ?? trimmed;
}

// ── Reusable buffer parsers (used by single-file + batch endpoints) ──

/**
 * Parse an XLSX buffer into raw headers + raw rows.
 * Handles ExcelJS cell types (Date, richText, formula, hyperlink).
 */
async function parseXlsxBuffer(
  buffer: Buffer,
): Promise<{ rawHeaders: string[]; rawRows: Record<string, unknown>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets.find((s) => s.actualRowCount > 0);
  if (!sheet) throw new Error("No data found in the uploaded workbook");

  const rawHeaders: string[] = [];
  const resolvedHeaders: string[] = [];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = String(cell.value ?? "").trim();
    rawHeaders[colNumber - 1] = raw;
    resolvedHeaders[colNumber - 1] = resolveHeader(raw);
  });

  const rawRows: Record<string, unknown>[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const record: Record<string, unknown> = {};
    let hasData = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = resolvedHeaders[colNumber - 1];
      if (!header) return;
      const val = cell.value;
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
      // Key by the RESOLVED header so downstream consumers get field keys
      record[header] = normalized;
      if (normalized !== null && normalized !== undefined && String(normalized).trim() !== "") {
        hasData = true;
      }
    });
    if (hasData) rawRows.push(record);
  }

  // Return rawHeaders (original names) — buildResolvedResult uses these
  // for the mapping report. The rows are already keyed by resolved names.
  return { rawHeaders, rawRows };
}

/**
 * Parse a CSV buffer into raw headers + raw rows.
 */
async function parseCsvBuffer(
  buffer: Buffer,
): Promise<{ rawHeaders: string[]; rawRows: Record<string, unknown>[] }> {
  const Papa = await import("papaparse");
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0]!;
    logger.warn("CSV parse warning", { row: first.row, message: first.message });
  }
  const rawHeaders = parsed.meta.fields ?? [];
  const rawRows = parsed.data;
  return { rawHeaders, rawRows };
}

/**
 * Determine file type from multer file and parse buffer.
 */
async function parseFileBuffer(
  file: Express.Multer.File,
): Promise<{ rawHeaders: string[]; rawRows: Record<string, unknown>[] }> {
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".csv") || file.mimetype === "text/csv") {
    return parseCsvBuffer(file.buffer);
  }
  return parseXlsxBuffer(file.buffer);
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
    const { rawHeaders, rawRows } = await parseXlsxBuffer(req.file.buffer);
    if (rawHeaders.length === 0 || rawRows.length === 0) {
      res.status(400).json({ error: "No data found in the uploaded workbook" });
      return;
    }
    if (rawRows.length > MAX_IMPORT_ROWS) {
      res.status(413).json({
        error: `File exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit (got ${rawRows.length}).`,
      });
      return;
    }
    const result = buildResolvedResult(rawHeaders, rawRows);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({
      error: `Failed to parse XLSX: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}

/**
 * Shared: given raw headers and parsed rows (keyed by raw header),
 * resolve headers via the alias map, re-key rows, and build the
 * mapping report. Used by both XLSX and CSV parsers.
 */
function buildResolvedResult(
  rawHeaders: string[],
  rawRows: Record<string, unknown>[],
) {
  const resolvedHeaders = rawHeaders.map((h) => resolveHeader(h));
  const knownKeySet = new Set(FIELD_DEFINITIONS.map((f) => f.key));
  const mappedKeys = new Set(resolvedHeaders.filter((h) => knownKeySet.has(h)));
  const unmappedHeaders = rawHeaders.filter(
    (_h, i) => !knownKeySet.has(resolvedHeaders[i]!),
  );
  const missingFields = FIELD_DEFINITIONS
    .filter((f) => f.required && !mappedKeys.has(f.key))
    .map((f) => f.label);

  // Re-key rows from raw header → resolved header
  const rows: Record<string, unknown>[] = rawRows.map((rawRow) => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < rawHeaders.length; i++) {
      const rawH = rawHeaders[i]!;
      const resolved = resolvedHeaders[i]!;
      if (rawRow[rawH] !== undefined) {
        record[resolved] = rawRow[rawH];
      }
    }
    return record;
  });

  const columnMapping = rawHeaders.map((raw, i) => ({
    uploaded: raw,
    mappedTo: knownKeySet.has(resolvedHeaders[i]!) ? resolvedHeaders[i]! : null,
  }));

  return {
    headers: resolvedHeaders,
    rows,
    totalRows: rows.length,
    columnMapping,
    unmappedHeaders,
    missingRequiredFields: missingFields,
  };
}

/**
 * POST /api/v1/import/parse-csv — multipart upload, returns rows as JSON.
 */
export async function handleParseCSV(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  try {
    const { rawHeaders, rawRows } = await parseCsvBuffer(req.file.buffer);
    if (rawHeaders.length === 0 || rawRows.length === 0) {
      res.status(400).json({ error: "No data found in the uploaded CSV" });
      return;
    }
    if (rawRows.length > MAX_IMPORT_ROWS) {
      res.status(413).json({
        error: `File exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit (got ${rawRows.length}).`,
      });
      return;
    }
    const result = buildResolvedResult(rawHeaders, rawRows);
    res.status(200).json({ data: result });
  } catch (err) {
    res.status(400).json({
      error: `Failed to parse CSV: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}

// ══════════════════════════════════════════════
//  Batch Import — multi-file endpoint with
//  automatic merge detection
// ══════════════════════════════════════════════

/** The field key used to detect and join mergeable files */
const MERGE_KEY = "contactNo";
/**
 * Column-overlap threshold: two files whose non-key column overlap is
 * below this ratio are considered complementary (different views of the
 * same candidates) and will be auto-merged.
 */
const MERGE_OVERLAP_THRESHOLD = 0.5;

interface BatchResult {
  fileName: string;
  fileSize: number;
  status: "parsed" | "error";
  data?: ReturnType<typeof buildResolvedResult>;
  error?: string;
  /** If this entry was created by merging multiple source files */
  mergedFrom?: string[];
}

/**
 * Detect which parsed files are complementary (share contactNo values
 * with different column sets) and merge them into combined entries.
 *
 * Algorithm:
 *   1. Separate files into those with MERGE_KEY and those without.
 *   2. Among files with the key, build a graph: two files are "linked"
 *      if they share at least one contactNo value AND their non-key
 *      columns overlap below MERGE_OVERLAP_THRESHOLD.
 *   3. Connected components in that graph form merge groups.
 *   4. Merge each group's rows by contactNo (union of all columns).
 *   5. Return merged entries + independent files unchanged.
 */
function detectAndMerge(
  parsed: Array<{
    fileName: string;
    fileSize: number;
    data: ReturnType<typeof buildResolvedResult>;
  }>,
): BatchResult[] {
  // Split into files with and without the merge key
  const withKey: typeof parsed = [];
  const withoutKey: typeof parsed = [];
  for (const p of parsed) {
    if (p.data.headers.includes(MERGE_KEY)) {
      withKey.push(p);
    } else {
      withoutKey.push(p);
    }
  }

  // If 0 or 1 file has the key, no merging possible
  if (withKey.length <= 1) {
    return parsed.map((p) => ({
      fileName: p.fileName,
      fileSize: p.fileSize,
      status: "parsed" as const,
      data: p.data,
    }));
  }

  // Build contactNo value sets per file
  const valueSets: Set<string>[] = withKey.map((p) => {
    const s = new Set<string>();
    for (const row of p.data.rows) {
      const v = row[MERGE_KEY];
      if (v !== undefined && v !== null && String(v).trim()) {
        s.add(String(v).trim());
      }
    }
    return s;
  });

  // Build non-key column sets per file
  const colSets: Set<string>[] = withKey.map((p) => {
    const s = new Set(p.data.headers.filter((h) => h !== MERGE_KEY));
    return s;
  });

  // Build adjacency: two files are "complementary" if they share
  // contactNo values AND have low column overlap
  const n = withKey.length;
  const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false) as boolean[]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Check value overlap
      let sharedValues = 0;
      for (const v of valueSets[i]!) {
        if (valueSets[j]!.has(v)) { sharedValues++; break; }
      }
      if (sharedValues === 0) continue; // no shared candidates

      // Check column overlap
      const aSet = colSets[i]!;
      const bSet = colSets[j]!;
      let intersection = 0;
      for (const c of aSet) { if (bSet.has(c)) intersection++; }
      const union = aSet.size + bSet.size - intersection;
      const overlap = union > 0 ? intersection / union : 1;
      if (overlap < MERGE_OVERLAP_THRESHOLD) {
        adj[i]![j] = true;
        adj[j]![i] = true;
      }
    }
  }

  // Find connected components (merge groups)
  const visited = new Array(n).fill(false);
  const groups: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const group: number[] = [];
    const queue = [i];
    visited[i] = true;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      group.push(cur);
      for (let j = 0; j < n; j++) {
        if (!visited[j] && adj[cur]![j]) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }
    groups.push(group);
  }

  const results: BatchResult[] = [];

  for (const group of groups) {
    if (group.length === 1) {
      // Single file — no merge needed
      const p = withKey[group[0]!]!;
      results.push({
        fileName: p.fileName,
        fileSize: p.fileSize,
        status: "parsed",
        data: p.data,
      });
    } else {
      // Merge group — combine rows by MERGE_KEY
      const groupFiles = group.map((i) => withKey[i]!);
      const allHeaders = new Set<string>();
      for (const gf of groupFiles) {
        for (const h of gf.data.headers) allHeaders.add(h);
      }
      const mergedHeaders = Array.from(allHeaders);

      // Build merged row map: contactNo → combined row
      const rowMap = new Map<string, Record<string, unknown>>();
      for (const gf of groupFiles) {
        for (const row of gf.data.rows) {
          const key = String(row[MERGE_KEY] ?? "").trim();
          if (!key) continue;
          const existing = rowMap.get(key) ?? {};
          // Later files' values overwrite earlier ones for the same column,
          // but only if the new value is non-empty (preserve existing data).
          for (const [col, val] of Object.entries(row)) {
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              existing[col] = val;
            } else if (!(col in existing)) {
              existing[col] = val;
            }
          }
          rowMap.set(key, existing);
        }
      }

      const mergedRows = Array.from(rowMap.values());
      const mergedFileNames = groupFiles.map((gf) => gf.fileName);
      const totalSize = groupFiles.reduce((s, gf) => s + gf.fileSize, 0);

      // Build resolved result for the merged data
      // Since headers are already resolved (came through buildResolvedResult),
      // we just need to rebuild the mapping report for the merged columns.
      const knownKeySet = new Set(FIELD_DEFINITIONS.map((f) => f.key));
      const mappedKeys = new Set(mergedHeaders.filter((h) => knownKeySet.has(h)));
      const unmappedH = mergedHeaders.filter((h) => !knownKeySet.has(h));
      const missingF = FIELD_DEFINITIONS
        .filter((f) => f.required && !mappedKeys.has(f.key))
        .map((f) => f.label);

      results.push({
        fileName: `Merged: ${mergedFileNames.join(" + ")}`,
        fileSize: totalSize,
        status: "parsed",
        mergedFrom: mergedFileNames,
        data: {
          headers: mergedHeaders,
          rows: mergedRows,
          totalRows: mergedRows.length,
          columnMapping: mergedHeaders.map((h) => ({
            uploaded: h,
            mappedTo: knownKeySet.has(h) ? h : null,
          })),
          unmappedHeaders: unmappedH,
          missingRequiredFields: missingF,
        },
      });
    }
  }

  // Add files without the merge key unchanged
  for (const p of withoutKey) {
    results.push({
      fileName: p.fileName,
      fileSize: p.fileSize,
      status: "parsed",
      data: p.data,
    });
  }

  return results;
}

/**
 * POST /api/v1/import/batch-parse
 *
 * Accepts multiple files (CSV/XLSX mix). Parses each one with the same
 * alias-based header resolution, then auto-detects complementary files
 * (different column sets sharing contactNo values) and merges them.
 *
 * Result: a mix of independent file entries and merged entries, each
 * with full column mapping data for the frontend wizard.
 */
export async function handleBatchParse(req: Request, res: Response): Promise<void> {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  const parsed: Array<{
    fileName: string;
    fileSize: number;
    data: ReturnType<typeof buildResolvedResult>;
  }> = [];
  const errors: BatchResult[] = [];

  for (const file of files) {
    try {
      const { rawHeaders, rawRows } = await parseFileBuffer(file);
      if (rawHeaders.length === 0 || rawRows.length === 0) {
        errors.push({
          fileName: file.originalname,
          fileSize: file.size,
          status: "error",
          error: "No data found in the file",
        });
        continue;
      }
      if (rawRows.length > MAX_IMPORT_ROWS) {
        errors.push({
          fileName: file.originalname,
          fileSize: file.size,
          status: "error",
          error: `File exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit (got ${rawRows.length}).`,
        });
        continue;
      }
      const resolved = buildResolvedResult(rawHeaders, rawRows);
      parsed.push({
        fileName: file.originalname,
        fileSize: file.size,
        data: resolved,
      });
    } catch (err) {
      errors.push({
        fileName: file.originalname,
        fileSize: file.size,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown parse error",
      });
    }
  }

  // Detect complementary files and merge them
  const mergedResults = parsed.length > 0 ? detectAndMerge(parsed) : [];

  res.status(200).json({ data: { files: [...mergedResults, ...errors] } });
}
