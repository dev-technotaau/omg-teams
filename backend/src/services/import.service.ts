import { type Prisma } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";
import * as auditSvc from "./audit.service.js";

// ──────────────────────────────────────────────
//  Data Import Service — Spec Section 23.6
//
//  Bulk CSV / XLSX import for candidate reports.
//  Covers all 46 importable fields out of the 48
//  spec fields. Excludes #1 Sr.No (auto), #23 Age
//  (derived), #32 Reporting Manager (derived from
//  RM assignment). #31 Recruiter is supported via
//  the optional `recruiterEmail` column with the
//  Import-page picker as a fallback.
// ──────────────────────────────────────────────

// ╔══════════════════════════════════════════════╗
// ║  FIELD DEFINITIONS — single source of truth  ║
// ╚══════════════════════════════════════════════╝

type FieldType =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "email"
  | "phone10"
  | "enum"
  | "fk-name"
  | "recruiter-email";

export interface FieldDefinition {
  /** Storage key — must match the Prisma field name OR a special "fk-name" alias */
  key: string;
  /** Human label for the template / UI */
  label: string;
  /** Spec field number (1–48) — for reference; null for `zone` */
  specNumber: number | null;
  /** Logical category — drives template grouping */
  category: "recruiter" | "screening" | "admin" | "system";
  type: FieldType;
  required?: boolean;
  /** Allowed values for enum fields (case-insensitive on input) */
  enumValues?: string[];
  /** Numeric bounds */
  min?: number;
  max?: number;
  /** Description shown in template + UI tooltip */
  description: string;
  /** Example cell value for the template */
  example: string;
  /**
   * Only required when an FK lookup column is supported.
   * `fkResolveTo` names the actual Prisma column (e.g. companyId).
   */
  fkResolveTo?: "companyId" | "serviceProviderId" | "hrManagerId";
  /** Zone-conditional — only applies for Set A (West, Central) */
  zoneConditional?: boolean;
}

/**
 * The 46 importable fields, in spec order. The 2 NOT importable
 * fields are explicitly skipped here:
 *   #1  Sr. No        — auto-generated `globalSerialNumber`
 *   #23 Age           — derived from `dateOfBirth` at read time
 *   #32 Reporting Manager — derived from RM assignment
 *
 * #31 Recruiter is supported via the optional `recruiterEmail`
 * column. Rows without that column fall back to the recruiter
 * picked on the Import page. Inactive recruiters are accepted
 * in the column (for historical attribution) but rejected on
 * the picker.
 *
 * `companyId`, `serviceProviderId`, `hrManagerId` are exposed as
 * NAME columns (companyName, etc) — admins type the human name and
 * the writer resolves to the cuid via the lookup tables.
 */
export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // ── Required system field ──
  {
    key: "zone",
    label: "Zone",
    specNumber: null,
    category: "system",
    type: "enum",
    required: true,
    enumValues: ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"],
    description: "Zone — must be one of: NORTH, SOUTH, EAST, WEST, CENTRAL (required)",
    example: "WEST",
  },

  // ── Recruiter form fields (2-25, 33) ──
  {
    key: "dateSourced",
    label: "Date Sourced",
    specNumber: 2,
    category: "recruiter",
    type: "date",
    description: "Date the profile was sourced (YYYY-MM-DD or DD/MM/YYYY)",
    example: "2026-04-01",
  },
  {
    key: "candidateName",
    label: "Candidate Name",
    specNumber: 3,
    category: "recruiter",
    type: "text",
    required: true,
    description: "Full name of the candidate (required)",
    example: "Rahul Sharma",
  },
  {
    key: "contactNo",
    label: "Contact No",
    specNumber: 4,
    category: "recruiter",
    type: "phone10",
    required: true,
    description: "10-digit Indian mobile number, no +91 prefix (required)",
    example: "9876543210",
  },
  {
    key: "state",
    label: "State",
    specNumber: 5,
    category: "recruiter",
    type: "text",
    description: "Candidate's state",
    example: "Maharashtra",
  },
  {
    key: "location",
    label: "Location",
    specNumber: 6,
    category: "recruiter",
    type: "text",
    description: "Candidate's city / area",
    example: "Mumbai",
  },
  {
    key: "profile",
    label: "Profile",
    specNumber: 7,
    category: "recruiter",
    type: "text",
    description: "Job role / profile",
    example: "Software Developer",
  },
  {
    key: "yearsOfExperience",
    label: "Years of Experience",
    specNumber: 8,
    category: "recruiter",
    type: "number",
    min: 0,
    max: 60,
    description: "Total experience in years (0-60)",
    example: "3.5",
  },
  {
    key: "currentCtc",
    label: "Current CTC",
    specNumber: 9,
    category: "recruiter",
    type: "number",
    min: 0,
    description: "Current CTC in LPA (lakhs per annum)",
    example: "6.5",
  },
  {
    key: "currentDesignation",
    label: "Current Designation",
    specNumber: 10,
    category: "recruiter",
    type: "text",
    description: "Current job title",
    example: "Software Engineer",
  },
  {
    key: "currentOrganization",
    label: "Current Organization",
    specNumber: 11,
    category: "recruiter",
    type: "text",
    description: "Current employer",
    example: "Tata Consultancy Services",
  },
  {
    key: "emailId",
    label: "Email ID",
    specNumber: 12,
    category: "recruiter",
    type: "email",
    description: "Email address",
    example: "rahul.sharma@example.com",
  },
  {
    key: "higherQualification",
    label: "Higher Qualification",
    specNumber: 13,
    category: "recruiter",
    type: "text",
    description: "Highest degree (B.Tech, M.Sc, etc.)",
    example: "B.Tech",
  },
  {
    key: "expectedCtc",
    label: "Expected CTC",
    specNumber: 14,
    category: "recruiter",
    type: "number",
    min: 0,
    description: "Expected CTC in LPA (lakhs per annum)",
    example: "10",
  },
  {
    key: "diplomaPartFull",
    label: "Diploma Part / Full",
    specNumber: 15,
    category: "recruiter",
    type: "enum",
    enumValues: ["Part", "Full"],
    description: "Diploma type — Part or Full",
    example: "Full",
  },
  {
    key: "graduationPercent",
    label: "Graduation %",
    specNumber: 16,
    category: "recruiter",
    type: "number",
    min: 0,
    max: 100,
    description: "Graduation percentage (0-100)",
    example: "72.5",
  },
  {
    key: "graduationYear",
    label: "Graduation Year",
    specNumber: 17,
    category: "recruiter",
    type: "integer",
    min: 1950,
    max: 2100,
    description: "Year of graduation (YYYY)",
    example: "2020",
  },
  {
    key: "twelfthPassingYear",
    label: "12th Passing Year",
    specNumber: 18,
    category: "recruiter",
    type: "integer",
    min: 1950,
    max: 2100,
    description: "Year of 12th completion (YYYY)",
    example: "2016",
  },
  {
    key: "twelfthPercent",
    label: "12th %",
    specNumber: 19,
    category: "recruiter",
    type: "number",
    min: 0,
    max: 100,
    description: "12th standard percentage (0-100)",
    example: "78",
  },
  {
    key: "tenthPassingYear",
    label: "10th Passing Year",
    specNumber: 20,
    category: "recruiter",
    type: "integer",
    min: 1950,
    max: 2100,
    description: "Year of 10th completion (YYYY)",
    example: "2014",
  },
  {
    key: "tenthPercent",
    label: "10th %",
    specNumber: 21,
    category: "recruiter",
    type: "number",
    min: 0,
    max: 100,
    description: "10th standard percentage (0-100)",
    example: "82",
  },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    specNumber: 22,
    category: "recruiter",
    type: "date",
    description: "Date of birth (YYYY-MM-DD or DD/MM/YYYY)",
    example: "1995-06-15",
  },
  {
    key: "noticePeriod",
    label: "Notice Period",
    specNumber: 24,
    category: "recruiter",
    type: "text",
    description: "Notice period (Immediate, 15 days, 30 days, 60 days, 90 days)",
    example: "30 days",
  },
  {
    key: "remarks",
    label: "Remarks",
    specNumber: 25,
    category: "recruiter",
    type: "text",
    description: "Additional notes",
    example: "Strong communicator, immediate joiner",
  },

  // ── Zone-conditional screening fields (26-30) ──
  // These only apply to Set A zones (West, Central). For Set B
  // (East, North, South) the importer ignores them silently.
  {
    key: "isCtcInformed",
    label: "Is CTC informed?",
    specNumber: 26,
    category: "screening",
    type: "boolean",
    zoneConditional: true,
    description: "Set A (West/Central) only — Yes / No / 1 / 0 / true / false",
    example: "Yes",
  },
  {
    key: "isOffRollOkay",
    label: "Is off-roll okay?",
    specNumber: 27,
    category: "screening",
    type: "boolean",
    zoneConditional: true,
    description: "Set A only — candidate okay with off-roll job nature?",
    example: "Yes",
  },
  {
    key: "isOnRollExplained",
    label: "On-roll 18-month explained?",
    specNumber: 28,
    category: "screening",
    type: "boolean",
    zoneConditional: true,
    description: "Set A only — was the on-roll 18-month clause explained?",
    example: "Yes",
  },
  {
    key: "hasTwoWheeler",
    label: "Has two-wheeler + licence?",
    specNumber: 29,
    category: "screening",
    type: "boolean",
    zoneConditional: true,
    description: "Set A only — owns a two-wheeler and has licence?",
    example: "Yes",
  },
  {
    key: "communicationSkill",
    label: "Communication skill (1-10)",
    specNumber: 30,
    category: "screening",
    type: "integer",
    min: 1,
    max: 10,
    zoneConditional: true,
    description: "Set A only — communication skill rating (1-10)",
    example: "8",
  },

  // ── Status (33) ──
  {
    key: "status",
    label: "Status",
    specNumber: 33,
    category: "recruiter",
    type: "enum",
    enumValues: ["Complete", "Pending"],
    description: "Status — Complete or Pending (default: Pending)",
    example: "Complete",
  },

  // ── Recruiter attribution (#31) — optional per-row override ──
  // Used for historical / multi-recruiter imports where rows belong
  // to different recruiters. If blank, the row falls back to the
  // recruiter selected on the Import page. Inactive recruiters are
  // accepted in this column for historical accuracy.
  {
    key: "recruiterEmail",
    label: "Recruiter Email",
    specNumber: 31,
    category: "recruiter",
    type: "recruiter-email",
    description:
      "Optional — email of the recruiter who sourced this candidate. " +
      "Use for historical / multi-recruiter imports. " +
      "If blank, the row is attributed to the recruiter selected on the " +
      "Import page. Inactive / former recruiters are accepted in this column.",
    example: "priya.recruiter@example.com",
  },

  // ── Admin-only fields (34-48) ──
  // Company / Service Provider / HR Manager are imported by NAME.
  // The writer resolves them to ids via the lookup maps below.
  {
    key: "companyName",
    label: "Company",
    specNumber: 34,
    category: "admin",
    type: "fk-name",
    fkResolveTo: "companyId",
    description: "Company name — must match an existing company exactly (case-insensitive)",
    example: "Acme Corporation",
  },
  {
    key: "serviceProviderName",
    label: "Service Provider",
    specNumber: 35,
    category: "admin",
    type: "fk-name",
    fkResolveTo: "serviceProviderId",
    description: "Service Provider name — must belong to the named Company",
    example: "Acme Staffing Pvt Ltd",
  },
  {
    key: "hrManagerName",
    label: "HR Manager",
    specNumber: 36,
    category: "admin",
    type: "fk-name",
    fkResolveTo: "hrManagerId",
    description: "HR Manager name — must belong to the named Company",
    example: "Priya Verma",
  },
  {
    key: "adminLocation",
    label: "Location (Admin)",
    specNumber: 37,
    category: "admin",
    type: "text",
    description: "Admin-level location (may differ from recruiter Location)",
    example: "Mumbai",
  },
  {
    key: "adminState",
    label: "State (Admin)",
    specNumber: 38,
    category: "admin",
    type: "text",
    description: "Admin-level state",
    example: "Maharashtra",
  },
  {
    key: "dateOfJoining",
    label: "Date of Joining",
    specNumber: 39,
    category: "admin",
    type: "date",
    description: "Joining date (YYYY-MM-DD or DD/MM/YYYY)",
    example: "2026-05-01",
  },
  {
    key: "invoiceDate",
    label: "Invoice Date",
    specNumber: 40,
    category: "admin",
    type: "date",
    description: "Invoice issue date",
    example: "2026-05-15",
  },
  {
    key: "invoiceNumber",
    label: "Invoice Number",
    specNumber: 41,
    category: "admin",
    type: "text",
    description: "Invoice number — must be globally unique",
    example: "INV-2026-0042",
  },
  {
    key: "invoiceAmountTotal",
    label: "Invoice Amount Total (₹)",
    specNumber: 42,
    category: "admin",
    type: "number",
    min: 0,
    description: "Total invoice amount in rupees",
    example: "150000",
  },
  {
    key: "gstAmount",
    label: "GST Amount (₹)",
    specNumber: 43,
    category: "admin",
    type: "number",
    min: 0,
    description: "GST component in rupees",
    example: "27000",
  },
  {
    key: "amountReceived",
    label: "Amount Received (₹)",
    specNumber: 44,
    category: "admin",
    type: "number",
    min: 0,
    description: "Amount received from the client in rupees",
    example: "150000",
  },
  {
    key: "tdsAmount",
    label: "TDS Amount (₹)",
    specNumber: 45,
    category: "admin",
    type: "number",
    min: 0,
    description: "TDS deducted in rupees",
    example: "1500",
  },
  {
    key: "paymentStatus",
    label: "Payment Status",
    specNumber: 46,
    category: "admin",
    type: "enum",
    enumValues: ["UNPAID", "PARTIAL", "PAID", "OVERDUE"],
    description: "Payment status — UNPAID / PARTIAL / PAID / OVERDUE",
    example: "PAID",
  },
  {
    key: "paymentDate",
    label: "Payment Date",
    specNumber: 46,
    category: "admin",
    type: "date",
    description: "Date of payment received",
    example: "2026-06-01",
  },
  {
    key: "cvSharedOnDate",
    label: "CV Shared On Date",
    specNumber: 47,
    category: "admin",
    type: "date",
    description: "Date the CV was shared with the company",
    example: "2026-04-10",
  },
  {
    key: "hrFeedback",
    label: "Feedback from HR",
    specNumber: 48,
    category: "admin",
    type: "enum",
    enumValues: ["REJECTED", "HOLD", "PROFILE_CLOSED"],
    description: "HR feedback — REJECTED / HOLD / PROFILE_CLOSED",
    example: "PROFILE_CLOSED",
  },
];

/** Hard limits — see spec §23.6 */
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
/** Above this row count, the import is queued through BullMQ instead of run inline. */
export const ASYNC_IMPORT_THRESHOLD = 500;
/** Transactional batch size — keeps each Postgres tx small enough to commit fast */
export const IMPORT_BATCH_SIZE = 100;

// ╔══════════════════════════════════════════════╗
// ║  PARSERS — type-specific cell coercion       ║
// ╚══════════════════════════════════════════════╝

/**
 * Excel epoch is 1899-12-30 (intentional Lotus 1-2-3 quirk). A serial
 * of 45000 ≈ April 2023. We accept Date objects (XLSX parser may emit
 * native Date), strings (CSV always; XLSX text-formatted cells), and
 * numbers (Excel serial dates).
 */
function parseDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Excel serial → JS Date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + raw * 86_400_000);
  }

  const str = String(raw).trim();
  if (!str) return null;

  // ISO 8601 — yyyy-mm-dd or yyyy-mm-ddThh:mm:ss
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(str);
  if (iso) {
    const [, y, m, d] = iso;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // dd/mm/yyyy or dd-mm-yyyy (India default)
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str);
  if (dmy) {
    const [, d, m, y] = dmy;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Last resort — let JS try
  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

const TRUTHY = new Set(["yes", "y", "true", "1", "on"]);
const FALSY = new Set(["no", "n", "false", "0", "off"]);

function parseBoolean(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  const str = String(raw).trim().toLowerCase();
  if (TRUTHY.has(str)) return true;
  if (FALSY.has(str)) return false;
  return null; // signal "unparseable" — caller will record an error
}

function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  // Strip ₹, commas, whitespace
  const str = String(raw).replace(/[₹,\s]/g, "");
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate and coerce one cell against its FieldDefinition. Returns
 * the coerced value, or pushes an error message describing the issue.
 */
function coerceCell(
  field: FieldDefinition,
  raw: unknown,
  errors: string[],
  lookups: ResolvedLookups,
  fkResolutions: Record<string, string | null>,
): unknown {
  const isEmpty = raw === null || raw === undefined || String(raw).trim() === "";

  if (isEmpty) {
    if (field.required) errors.push(`${field.label} is required`);
    return null;
  }

  switch (field.type) {
    case "text":
      return String(raw).trim();

    case "email": {
      const str = String(raw).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
        errors.push(`${field.label} is not a valid email`);
        return null;
      }
      return str;
    }

    case "phone10": {
      const str = String(raw).replace(/\D/g, "");
      if (!/^\d{10}$/.test(str)) {
        errors.push(`${field.label} must be a 10-digit number`);
        return null;
      }
      return str;
    }

    case "number": {
      const n = parseNumber(raw);
      if (n === null) {
        errors.push(`${field.label} is not a valid number`);
        return null;
      }
      if (field.min !== undefined && n < field.min) {
        errors.push(`${field.label} must be ≥ ${field.min}`);
        return null;
      }
      if (field.max !== undefined && n > field.max) {
        errors.push(`${field.label} must be ≤ ${field.max}`);
        return null;
      }
      return n;
    }

    case "integer": {
      const n = parseNumber(raw);
      if (n === null || !Number.isInteger(n)) {
        errors.push(`${field.label} must be a whole number`);
        return null;
      }
      if (field.min !== undefined && n < field.min) {
        errors.push(`${field.label} must be ≥ ${field.min}`);
        return null;
      }
      if (field.max !== undefined && n > field.max) {
        errors.push(`${field.label} must be ≤ ${field.max}`);
        return null;
      }
      return n;
    }

    case "boolean": {
      const b = parseBoolean(raw);
      if (b === null) {
        errors.push(`${field.label} must be Yes/No (got "${String(raw)}")`);
        return null;
      }
      return b;
    }

    case "date": {
      const dt = parseDate(raw);
      if (!dt) {
        errors.push(`${field.label} is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`);
        return null;
      }
      return dt;
    }

    case "enum": {
      const str = String(raw).trim();
      const match = field.enumValues!.find((v) => v.toLowerCase() === str.toLowerCase());
      if (!match) {
        errors.push(
          `${field.label} must be one of: ${field.enumValues!.join(", ")} (got "${str}")`,
        );
        return null;
      }
      return match;
    }

    case "fk-name": {
      const str = String(raw).trim();
      const key = str.toLowerCase();
      let resolvedId: string | undefined;
      if (field.fkResolveTo === "companyId") {
        resolvedId = lookups.companyByName.get(key);
      } else if (field.fkResolveTo === "serviceProviderId") {
        resolvedId = lookups.serviceProviderByName.get(key);
      } else if (field.fkResolveTo === "hrManagerId") {
        resolvedId = lookups.hrManagerByName.get(key);
      }
      if (!resolvedId) {
        errors.push(`${field.label} "${str}" not found — create it under Master Data first`);
        return null;
      }
      // Stash the resolved id under the actual Prisma column name
      fkResolutions[field.fkResolveTo!] = resolvedId;
      return null; // returned value isn't used by the writer
    }

    case "recruiter-email": {
      const str = String(raw).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
        errors.push(`${field.label} is not a valid email`);
        return null;
      }
      const id = lookups.recruiterByEmail.get(str.toLowerCase());
      if (!id) {
        errors.push(
          `${field.label} "${str}" is not a known recruiter — check spelling or create the user first`,
        );
        return null;
      }
      // Stash under the Prisma column name. Inactive recruiters are
      // intentionally allowed here for historical attribution.
      fkResolutions["recruiterId"] = id;
      return null;
    }
  }
}

// ╔══════════════════════════════════════════════╗
// ║  LOOKUP TABLES — name → id resolution        ║
// ╚══════════════════════════════════════════════╝

interface ResolvedLookups {
  companyByName: Map<string, string>;
  serviceProviderByName: Map<string, string>;
  hrManagerByName: Map<string, string>;
  recruiterByEmail: Map<string, string>;
}

/**
 * Build the case-insensitive name → id maps for Company / SP / HR
 * and the email → id map for Recruiters.
 *
 * Soft-deleted Company / SP / HR entries are excluded — you can't
 * import to a deleted master-data record.
 *
 * Recruiters: soft-deleted excluded, but INACTIVE recruiters ARE
 * included so historical imports can attribute rows to recruiters
 * who have since been disabled or left the company. The picker on
 * the Import page enforces ACTIVE separately for the fallback path.
 */
async function loadLookups(): Promise<ResolvedLookups> {
  const prisma = getPrisma();
  const [companies, serviceProviders, hrManagers, recruiters] = await Promise.all([
    prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.serviceProvider.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.hRManager.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: "RECRUITER", deletedAt: null },
      select: { id: true, email: true },
    }),
  ]);

  return {
    companyByName: new Map(companies.map((c) => [c.name.toLowerCase(), c.id])),
    serviceProviderByName: new Map(serviceProviders.map((s) => [s.name.toLowerCase(), s.id])),
    hrManagerByName: new Map(hrManagers.map((h) => [h.name.toLowerCase(), h.id])),
    recruiterByEmail: new Map(recruiters.map((r) => [r.email.toLowerCase(), r.id])),
  };
}

// ╔══════════════════════════════════════════════╗
// ║  PUBLIC TYPES                                ║
// ╚══════════════════════════════════════════════╝

export interface ImportRow {
  rowNumber: number;
  /** Raw input as it came from the file (string-coerced for the UI) */
  values: Record<string, string>;
  /** Parsed/validated values keyed by Prisma column (only set when valid) */
  parsed: Record<string, unknown>;
  errors: string[];
  isDuplicate: boolean;
  /** ID of the existing record this duplicates (for `overwrite` mode) */
  duplicateOfId?: string | null;
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ImportRow[];
}

export type DuplicateMode = "skip" | "flag" | "overwrite";

export interface ImportOptions {
  duplicateMode: DuplicateMode;
  /**
   * Fallback recruiter — every row that does NOT specify a `recruiterEmail`
   * column value gets attributed to this recruiter. Optional, but every
   * row must end up with a recruiter (column OR fallback). If provided,
   * must reference an ACTIVE user with role RECRUITER. The per-row column
   * is more permissive (inactive recruiters are allowed there).
   */
  recruiterId: string | null;
  /** File name — recorded in the audit log per spec §23.6 */
  fileName: string;
}

export interface ImportResult {
  totalProcessed: number;
  imported: number;
  skipped: number;
  errors: number;
  failedRows: {
    rowNumber: number;
    values: Record<string, string>;
    error: string;
  }[];
}

/** Returned by `getImportLookups` for the frontend column mapping screen */
export interface ImportLookups {
  companies: { id: string; name: string }[];
  serviceProviders: { id: string; name: string; companyId: string }[];
  hrManagers: { id: string; name: string; companyId: string }[];
  zones: string[];
  paymentStatuses: string[];
  hrFeedbackOptions: string[];
}

// ╔══════════════════════════════════════════════╗
// ║  PUBLIC API                                  ║
// ╚══════════════════════════════════════════════╝

export function getFieldDefinitions(): FieldDefinition[] {
  return FIELD_DEFINITIONS;
}

export function getTemplateColumns(): string[] {
  return FIELD_DEFINITIONS.map((f) => f.key);
}

/**
 * Returns the recruiter list for the downloadable XLSX template's
 * Reference sheet. Includes inactive recruiters since they're valid
 * targets for the per-row `recruiterEmail` column. Sorted by name.
 */
export async function getRecruitersForTemplate(): Promise<
  { email: string; firstName: string; lastName: string; status: string }[]
> {
  const prisma = getPrisma();
  return prisma.user.findMany({
    where: { role: "RECRUITER", deletedAt: null },
    select: { email: true, firstName: true, lastName: true, status: true },
    orderBy: [{ status: "asc" }, { firstName: "asc" }],
  });
}

/**
 * Returns dropdown content for the frontend mapping/preview screens
 * (zones, payment statuses, feedback options, and lookup-table
 * contents). Used by GET /api/import/lookups.
 */
export async function getImportLookups(): Promise<ImportLookups> {
  const prisma = getPrisma();
  const [companies, serviceProviders, hrManagers] = await Promise.all([
    prisma.company.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceProvider.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: "asc" },
    }),
    prisma.hRManager.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    companies,
    serviceProviders,
    hrManagers,
    zones: ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"],
    paymentStatuses: ["UNPAID", "PARTIAL", "PAID", "OVERDUE"],
    hrFeedbackOptions: ["REJECTED", "HOLD", "PROFILE_CLOSED"],
  };
}

/**
 * Validate and dedupe a batch of raw rows. The frontend calls this
 * after column mapping; the result drives the preview UI.
 *
 * - Validates every cell against its FieldDefinition
 * - Resolves company/SP/HR names → ids
 * - Resolves per-row recruiter email → id (if column present)
 * - Validates per-row recruiter attribution: each row must end up
 *   with a recruiterId from EITHER the column OR the fallback picker
 * - Performs a SINGLE batched duplicate check across all valid rows
 *   (replaces the previous per-row roundtrip)
 *
 * `fallbackRecruiterId` is the recruiter selected on the Import-page
 * picker. It's only used to satisfy rows that don't carry their own
 * recruiterEmail column. We re-verify it's an ACTIVE recruiter so the
 * preview already shows the picker error rather than waiting for
 * execute.
 */
export async function previewImport(
  rawRows: Record<string, unknown>[],
  fallbackRecruiterId: string | null = null,
): Promise<ImportPreview> {
  if (rawRows.length === 0) {
    return { totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0, rows: [] };
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import too large: ${rawRows.length} rows (max ${MAX_IMPORT_ROWS}). ` +
        `Split the file or contact support to enable async processing.`,
    );
  }

  const lookups = await loadLookups();

  // Verify the fallback recruiter up front so we surface a wrong
  // picker selection inside the preview rather than mid-import.
  let fallbackOk = false;
  let fallbackError: string | null = null;
  if (fallbackRecruiterId) {
    const prisma = getPrisma();
    const r = await prisma.user.findUnique({
      where: { id: fallbackRecruiterId },
      select: { role: true, status: true, deletedAt: true },
    });
    if (!r || r.deletedAt) {
      fallbackError = "Selected fallback recruiter not found";
    } else if (r.role !== "RECRUITER") {
      fallbackError = "Selected fallback user is not a recruiter";
    } else if (r.status !== "ACTIVE") {
      fallbackError = "Selected fallback recruiter is not active";
    } else {
      fallbackOk = true;
    }
  }

  const validated: ImportRow[] = rawRows.map((rawRow, idx) => {
    const errors: string[] = [];
    const parsed: Record<string, unknown> = {};
    const fkResolutions: Record<string, string | null> = {};
    const stringValues: Record<string, string> = {};

    for (const field of FIELD_DEFINITIONS) {
      const raw = rawRow[field.key];
      stringValues[field.key] = raw === null || raw === undefined ? "" : String(raw);

      const coerced = coerceCell(field, raw, errors, lookups, fkResolutions);
      if (coerced !== null && field.type !== "fk-name") {
        parsed[field.key] = coerced;
      }
    }

    // Apply FK resolutions on top of `parsed`
    for (const [col, id] of Object.entries(fkResolutions)) {
      if (id) parsed[col] = id;
    }

    return {
      rowNumber: idx + 1,
      values: stringValues,
      parsed,
      errors,
      isDuplicate: false,
      duplicateOfId: null,
    };
  });

  // ── Per-row recruiter attribution ──
  // Each row must end up with a recruiterId. Priority:
  //   1. recruiterEmail column (already resolved into parsed.recruiterId)
  //   2. fallback recruiter from the Import-page picker
  // If neither is available, the row is invalid.
  for (const row of validated) {
    if (row.errors.length > 0) continue;
    const colRecruiter = row.parsed["recruiterId"];
    const hasColumnRecruiter = typeof colRecruiter === "string" && colRecruiter.length > 0;
    if (hasColumnRecruiter) continue;
    if (fallbackOk && fallbackRecruiterId) {
      row.parsed["recruiterId"] = fallbackRecruiterId;
      continue;
    }
    row.errors.push(
      fallbackError
        ? `No Recruiter Email column on this row, and the fallback recruiter is invalid (${fallbackError})`
        : "No Recruiter Email column on this row, and no fallback recruiter selected on the Import page",
    );
  }

  // ── Batched duplicate check ──
  // Build a single OR clause across all valid rows' contactNo / emailId,
  // then map results back. One DB roundtrip instead of N.
  const valid = validated.filter((r) => r.errors.length === 0);
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const row of valid) {
    const phone = row.parsed["contactNo"];
    const email = row.parsed["emailId"];
    if (typeof phone === "string" && phone) phones.add(phone);
    if (typeof email === "string" && email) emails.add(email);
  }

  if (phones.size > 0 || emails.size > 0) {
    const prisma = getPrisma();
    const dupOr: Prisma.CandidateReportWhereInput[] = [];
    if (phones.size > 0) dupOr.push({ contactNo: { in: Array.from(phones) } });
    if (emails.size > 0) dupOr.push({ emailId: { in: Array.from(emails) } });

    const existing = await prisma.candidateReport.findMany({
      where: { deletedAt: null, OR: dupOr },
      select: { id: true, contactNo: true, emailId: true },
    });

    const idByPhone = new Map<string, string>();
    const idByEmail = new Map<string, string>();
    for (const e of existing) {
      if (e.contactNo) idByPhone.set(e.contactNo, e.id);
      if (e.emailId) idByEmail.set(e.emailId.toLowerCase(), e.id);
    }

    for (const row of valid) {
      const phone = row.parsed["contactNo"];
      const email = row.parsed["emailId"];
      let dupId: string | undefined;
      if (typeof phone === "string" && phone) dupId = idByPhone.get(phone);
      if (!dupId && typeof email === "string" && email) {
        dupId = idByEmail.get(email.toLowerCase());
      }
      if (dupId) {
        row.isDuplicate = true;
        row.duplicateOfId = dupId;
      }
    }
  }

  // ── Within-file duplicate detection ──
  // Two rows in the same file with the same phone/email — flag the
  // second occurrence so admins notice.
  const seenPhones = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  for (const row of validated) {
    if (row.errors.length > 0) continue;
    const phone = row.parsed["contactNo"];
    const email = row.parsed["emailId"];
    if (typeof phone === "string" && phone) {
      if (seenPhones.has(phone)) {
        row.errors.push(`Duplicate phone within this file (also row ${seenPhones.get(phone)})`);
      } else {
        seenPhones.set(phone, row.rowNumber);
      }
    }
    if (typeof email === "string" && email) {
      const key = email.toLowerCase();
      if (seenEmails.has(key)) {
        row.errors.push(`Duplicate email within this file (also row ${seenEmails.get(key)})`);
      } else {
        seenEmails.set(key, row.rowNumber);
      }
    }
  }

  return {
    totalRows: rawRows.length,
    validRows: validated.filter((r) => r.errors.length === 0 && !r.isDuplicate).length,
    invalidRows: validated.filter((r) => r.errors.length > 0).length,
    duplicateRows: validated.filter((r) => r.isDuplicate && r.errors.length === 0).length,
    rows: validated,
  };
}

/**
 * Execute the import in transactional batches.
 *
 * - Honours the duplicate mode (skip / flag / overwrite)
 * - Wraps each batch (default 100 rows) in a Prisma transaction
 * - Returns per-row error details so the frontend can show & retry
 * - Logs the file name and per-recruiter attribution to the audit trail
 */
export async function executeImport(
  rows: ImportRow[],
  options: ImportOptions,
  importingUserId: string,
): Promise<ImportResult> {
  const prisma = getPrisma();
  let imported = 0;
  let skipped = 0;
  const failedRows: ImportResult["failedRows"] = [];

  // If a fallback recruiter was provided, verify it. The per-row column
  // is allowed to attribute rows to inactive recruiters (historical), but
  // the picker fallback must reference a currently ACTIVE recruiter.
  if (options.recruiterId) {
    const recruiter = await prisma.user.findUnique({
      where: { id: options.recruiterId },
      select: { id: true, role: true, status: true, deletedAt: true },
    });
    if (!recruiter || recruiter.deletedAt) {
      throw new Error("Selected fallback recruiter not found");
    }
    if (recruiter.role !== "RECRUITER") {
      throw new Error("Selected fallback user is not a recruiter");
    }
    if (recruiter.status !== "ACTIVE") {
      throw new Error("Selected fallback recruiter is not active");
    }
  }

  // Determine the rows we'll actually attempt to write. For each row,
  // resolve the per-row recruiterId: column wins, fallback is the safety
  // net. If neither is set, the row is failed (mirrors previewImport).
  const toProcess: ImportRow[] = [];
  let attributedFromColumn = 0;
  let attributedFromFallback = 0;
  const distinctRecruiterIds = new Set<string>();
  for (const row of rows) {
    if (row.errors.length > 0) {
      skipped++;
      failedRows.push({
        rowNumber: row.rowNumber,
        values: row.values,
        error: row.errors.join("; "),
      });
      continue;
    }
    const colRecruiter = row.parsed["recruiterId"];
    const hasColumnRecruiter = typeof colRecruiter === "string" && colRecruiter.length > 0;
    if (hasColumnRecruiter) {
      attributedFromColumn++;
    } else if (options.recruiterId) {
      row.parsed["recruiterId"] = options.recruiterId;
      attributedFromFallback++;
    } else {
      skipped++;
      failedRows.push({
        rowNumber: row.rowNumber,
        values: row.values,
        error:
          "No recruiter for this row — set a Recruiter Email column or pick a fallback recruiter on the Import page",
      });
      continue;
    }
    distinctRecruiterIds.add(row.parsed["recruiterId"] as string);
    if (row.isDuplicate && options.duplicateMode === "skip") {
      skipped++;
      continue;
    }
    toProcess.push(row);
  }

  // Reserve the next serial range up-front so we don't have to fight
  // for it inside each transaction. The DB column is also defaulted
  // to autoincrement, so a collision would still be safe — this is
  // just an optimization.
  const lastReport = await prisma.candidateReport.findFirst({
    orderBy: { globalSerialNumber: "desc" },
    select: { globalSerialNumber: true },
  });
  let nextSerial = (lastReport?.globalSerialNumber ?? 0) + 1;

  // Process in transactional batches
  for (let i = 0; i < toProcess.length; i += IMPORT_BATCH_SIZE) {
    const batch = toProcess.slice(i, i + IMPORT_BATCH_SIZE);
    try {
      await prisma.$transaction(
        async (tx) => {
          for (const row of batch) {
            const data = buildCreateData(row, nextSerial++);

            if (row.isDuplicate && options.duplicateMode === "overwrite" && row.duplicateOfId) {
              // Overwrite: update the existing record in place. Note we
              // intentionally KEEP the original record's recruiterId
              // (not the import row's) so an admin re-importing a CSV
              // doesn't silently re-attribute existing candidates.
              await tx.candidateReport.update({
                where: { id: row.duplicateOfId },
                data: stripCreateOnlyFields(data),
              });
              imported++;
            } else {
              // Insert. For "flag" mode set isDuplicate=true so the
              // admin Duplicates page picks it up.
              await tx.candidateReport.create({
                data: {
                  ...data,
                  isDuplicate: row.isDuplicate && options.duplicateMode === "flag",
                },
              });
              imported++;
            }
          }
        },
        { timeout: 30_000 },
      );
    } catch (err) {
      // Whole batch rolled back — record each row in the batch as
      // failed so the admin can retry.
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Import batch failed", {
        batchStart: i,
        batchSize: batch.length,
        error: message,
      });
      for (const row of batch) {
        failedRows.push({
          rowNumber: row.rowNumber,
          values: row.values,
          error: `Batch transaction failed: ${message}`,
        });
      }
      // Roll back the optimistic serial counter for this batch
      nextSerial -= batch.length;
    }
  }

  // ── Audit log ──
  // §23.6 requires file name, total rows, imported, skipped, errors,
  // and importing user. We also log the fallback recruiter, the
  // attribution split (column vs fallback) and the distinct recruiter
  // count so admins can later answer "which recruiter received those
  // records" even for multi-recruiter historical imports.
  auditSvc.logAudit({
    userId: importingUserId,
    userRole: "ADMIN",
    action: "IMPORT",
    entityType: "CANDIDATE_REPORT",
    changes: {
      fileName: { old: null, new: options.fileName },
      fallbackRecruiterId: { old: null, new: options.recruiterId ?? null },
      attributedFromColumn: { old: 0, new: attributedFromColumn },
      attributedFromFallback: { old: 0, new: attributedFromFallback },
      distinctRecruiterCount: { old: 0, new: distinctRecruiterIds.size },
      duplicateMode: { old: null, new: options.duplicateMode },
      totalRows: { old: 0, new: rows.length },
      imported: { old: 0, new: imported },
      skipped: { old: 0, new: skipped },
      errorCount: { old: 0, new: failedRows.length },
    },
  });

  return {
    totalProcessed: rows.length,
    imported,
    skipped,
    errors: failedRows.length,
    failedRows,
  };
}

/**
 * Build the Prisma `CandidateReportCreateInput` for a single row from
 * its parsed values. Field assignment is driven entirely by the
 * FIELD_DEFINITIONS registry — you add a field there and it
 * automatically flows through here.
 *
 * The recruiterId is read from `row.parsed.recruiterId`, which the
 * caller (executeImport) has already populated from either the
 * recruiterEmail column or the fallback picker.
 */
function buildCreateData(
  row: ImportRow,
  serialNumber: number,
): Prisma.CandidateReportUncheckedCreateInput {
  const data: Record<string, unknown> = {
    globalSerialNumber: serialNumber,
    recruiterId: row.parsed["recruiterId"],
  };

  for (const field of FIELD_DEFINITIONS) {
    // recruiter-email is FK-only — the resolved id lives under
    // parsed.recruiterId and is already on `data` above.
    if (field.type === "recruiter-email") continue;

    const value = row.parsed[field.key];
    if (value === undefined || value === null) continue;

    if (field.type === "fk-name") {
      // FK columns are stashed under their resolved id name in `parsed`
      const idCol = field.fkResolveTo!;
      const id = row.parsed[idCol];
      if (typeof id === "string") data[idCol] = id;
      continue;
    }

    // Status enum on the schema is a free String column with the
    // values "Complete" / "Pending" — leave the casing as parsed.
    data[field.key] = value;
  }

  return data as unknown as Prisma.CandidateReportUncheckedCreateInput;
}

/**
 * Strip create-only fields when overwriting an existing record. The
 * global serial number must not change on update, and we deliberately
 * leave the original recruiterId in place so re-importing a file
 * doesn't silently re-attribute existing candidates.
 */
function stripCreateOnlyFields(
  data: Prisma.CandidateReportUncheckedCreateInput,
): Prisma.CandidateReportUpdateInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { globalSerialNumber, recruiterId, ...rest } = data as Record<string, unknown>;
  return rest as Prisma.CandidateReportUpdateInput;
}
