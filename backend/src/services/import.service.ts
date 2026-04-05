import * as auditSvc from "./audit.service.js";
import * as duplicateSvc from "./duplicate.service.js";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Data Import Service — Spec Section 23.6
// ──────────────────────────────────────────────

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
  errors: { row: number; error: string }[];
}

const REQUIRED_FIELDS = ["candidateName", "contactNo"];
const VALID_ZONES = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"];

export function validateRow(data: Record<string, unknown>, rowNumber: number): ImportRow {
  const errors: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || String(data[field]).trim() === "") {
      errors.push(`${field} is required`);
    }
  }

  if (data["contactNo"] && !/^\d{10}$/.test(String(data["contactNo"]))) {
    errors.push("contactNo must be 10 digits");
  }

  if (data["emailId"] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data["emailId"]))) {
    errors.push("Invalid email format");
  }

  if (data["zone"] && !VALID_ZONES.includes(String(data["zone"]).toUpperCase())) {
    errors.push(`zone must be one of: ${VALID_ZONES.join(", ")}`);
  }

  if (
    data["yearsOfExperience"] &&
    (isNaN(Number(data["yearsOfExperience"])) || Number(data["yearsOfExperience"]) < 0)
  ) {
    errors.push("yearsOfExperience must be a non-negative number");
  }

  return { rowNumber, data, errors, isDuplicate: false };
}

export async function previewImport(rows: Record<string, unknown>[]): Promise<ImportPreview> {
  const validated = rows.map((row, i) => validateRow(row, i + 1));

  // Check duplicates
  for (const row of validated) {
    if (row.errors.length > 0) continue;
    const contactNo = String(row.data["contactNo"] ?? "");
    const emailId = String(row.data["emailId"] ?? "");
    if (contactNo || emailId) {
      const dupes = await duplicateSvc.checkDuplicates(
        contactNo || undefined,
        emailId || undefined,
      );
      if (dupes.length > 0) {
        row.isDuplicate = true;
      }
    }
  }

  const validRows = validated.filter((r) => r.errors.length === 0 && !r.isDuplicate);
  const invalidRows = validated.filter((r) => r.errors.length > 0);
  const duplicateRows = validated.filter((r) => r.isDuplicate && r.errors.length === 0);

  return {
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: invalidRows.length,
    duplicateRows: duplicateRows.length,
    rows: validated,
  };
}

export async function executeImport(
  rows: ImportRow[],
  recruiterId: string,
  userId: string,
  options: { skipDuplicates?: boolean } = {},
): Promise<ImportResult> {
  const prisma = getPrisma();
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];

  // Get max global serial number ONCE before the loop
  const lastReport = await prisma.candidateReport.findFirst({
    orderBy: { globalSerialNumber: "desc" },
    select: { globalSerialNumber: true },
  });
  let nextSerial = (lastReport?.globalSerialNumber ?? 0) + 1;

  for (const row of rows) {
    if (row.errors.length > 0) {
      skipped++;
      errors.push({ row: row.rowNumber, error: row.errors.join("; ") });
      continue;
    }

    if (row.isDuplicate && options.skipDuplicates) {
      skipped++;
      continue;
    }

    try {
      const zone = String(row.data["zone"] ?? "WEST").toUpperCase();

      await prisma.candidateReport.create({
        data: {
          globalSerialNumber: nextSerial,
          recruiterId,
          zone: zone as never,
          candidateName: row.data["candidateName"] ? String(row.data["candidateName"]) : null,
          contactNo: row.data["contactNo"] ? String(row.data["contactNo"]) : null,
          emailId: row.data["emailId"] ? String(row.data["emailId"]) : null,
          state: row.data["state"] ? String(row.data["state"]) : null,
          location: row.data["location"] ? String(row.data["location"]) : null,
          profile: row.data["profile"] ? String(row.data["profile"]) : null,
          yearsOfExperience: row.data["yearsOfExperience"]
            ? Number(row.data["yearsOfExperience"])
            : null,
          currentCTC: row.data["currentCTC"] ? Number(row.data["currentCTC"]) : null,
          currentDesignation: row.data["currentDesignation"]
            ? String(row.data["currentDesignation"])
            : null,
          currentOrganization: row.data["currentOrganization"]
            ? String(row.data["currentOrganization"])
            : null,
          higherQualification: row.data["higherQualification"]
            ? String(row.data["higherQualification"])
            : null,
          expectedCTC: row.data["expectedCTC"] ? Number(row.data["expectedCTC"]) : null,
          remarks: row.data["remarks"] ? String(row.data["remarks"]) : null,
          status: "Complete",
        },
      });
      nextSerial++;
      imported++;
    } catch (err) {
      skipped++;
      errors.push({
        row: row.rowNumber,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Log the import action
  auditSvc.logAudit({
    userId,
    userRole: "ADMIN",
    action: "IMPORT",
    entityType: "CANDIDATE_REPORT",
    changes: {
      totalRows: { old: 0, new: rows.length },
      imported: { old: 0, new: imported },
      skipped: { old: 0, new: skipped },
      errorCount: { old: 0, new: errors.length },
    },
  });

  return { totalProcessed: rows.length, imported, skipped, errors };
}

export function getTemplateColumns(): string[] {
  return [
    "candidateName",
    "contactNo",
    "emailId",
    "state",
    "location",
    "profile",
    "yearsOfExperience",
    "currentCTC",
    "currentDesignation",
    "currentOrganization",
    "higherQualification",
    "expectedCTC",
    "diplomaPartFull",
    "graduationPercent",
    "graduationYear",
    "twelfthPassingYear",
    "twelfthPercent",
    "tenthPassingYear",
    "tenthPercent",
    "dateOfBirth",
    "noticePeriod",
    "remarks",
    "zone",
  ];
}
