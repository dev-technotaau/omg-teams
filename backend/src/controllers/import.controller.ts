import ExcelJS from "exceljs";
import { z } from "zod";
import * as importSvc from "../services/import.service.js";
import type { Request, Response } from "express";

const previewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
});

const executeSchema = z.object({
  rows: z
    .array(
      z.object({
        rowNumber: z.number(),
        data: z.record(z.string(), z.unknown()),
        errors: z.array(z.string()),
        isDuplicate: z.boolean(),
      }),
    )
    .min(1),
  recruiterId: z.string().min(1),
  skipDuplicates: z.boolean().optional(),
});

export async function handlePreviewImport(req: Request, res: Response): Promise<void> {
  const { rows } = previewSchema.parse(req.body);
  const preview = await importSvc.previewImport(rows);
  res.status(200).json({ data: preview });
}

export async function handleExecuteImport(req: Request, res: Response): Promise<void> {
  const { rows, recruiterId, skipDuplicates } = executeSchema.parse(req.body);
  const result = await importSvc.executeImport(rows, recruiterId, req.user!.id, {
    ...(skipDuplicates !== undefined ? { skipDuplicates } : {}),
  });
  res.status(200).json({ data: result });
}

export function handleGetImportTemplate(_req: Request, res: Response): void {
  const columns = importSvc.getTemplateColumns();
  res.status(200).json({ data: { columns } });
}

/**
 * §23.6 — Download XLSX template with headers, descriptions, and example data.
 */
export async function handleDownloadImportTemplate(_req: Request, res: Response): Promise<void> {
  const columns = importSvc.getTemplateColumns();
  const descriptions: Record<string, string> = {
    candidateName: "Full name of the candidate (required)",
    contactNo: "10-digit mobile number (required)",
    emailId: "Email address",
    state: "State name",
    location: "City or area",
    profile: "Job role / profile",
    yearsOfExperience: "Years of experience (number)",
    currentCTC: "Current CTC in LPA (number)",
    currentDesignation: "Current job title",
    currentOrganization: "Current employer",
    higherQualification: "Highest qualification",
    expectedCTC: "Expected CTC in LPA (number)",
    diplomaPartFull: "Diploma part/full",
    graduationPercent: "Graduation percentage",
    graduationYear: "Graduation year (YYYY)",
    twelfthPassingYear: "12th passing year (YYYY)",
    twelfthPercent: "12th percentage",
    tenthPassingYear: "10th passing year (YYYY)",
    tenthPercent: "10th percentage",
    dateOfBirth: "Date of birth (YYYY-MM-DD)",
    noticePeriod: "Notice period (e.g., 30 days, Immediate)",
    remarks: "Additional notes",
    zone: "Zone: NORTH, SOUTH, EAST, WEST, or CENTRAL",
  };
  const examples: Record<string, string> = {
    candidateName: "Rahul Sharma",
    contactNo: "9876543210",
    emailId: "rahul@example.com",
    state: "Maharashtra",
    location: "Mumbai",
    profile: "Software Developer",
    yearsOfExperience: "3",
    currentCTC: "6.5",
    currentDesignation: "SDE-1",
    currentOrganization: "TCS",
    higherQualification: "B.Tech",
    expectedCTC: "10",
    zone: "WEST",
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMG Teams";
  const sheet = workbook.addWorksheet("Import Template");

  // Header row
  sheet.columns = columns.map((col) => ({ header: col, key: col, width: 22 }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "001845" } };

  // Description row
  const descRow = sheet.addRow(columns.map((c) => descriptions[c] ?? ""));
  descRow.font = { italic: true, color: { argb: "666666" } };

  // Example row
  sheet.addRow(columns.map((c) => examples[c] ?? ""));

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", 'attachment; filename="import_template.xlsx"');
  res.send(buffer);
}

/**
 * §23.6 — Parse uploaded XLSX file and return rows as JSON for preview.
 */
export async function handleParseXLSX(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(req.file.buffer as never);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      res.status(400).json({ error: "No worksheet found in the uploaded file" });
      return;
    }

    // Extract headers from first row
    const headers: string[] = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    // Extract data rows (skip row 1 header)
    const rows: Record<string, unknown>[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const record: Record<string, unknown> = {};
      let hasData = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          const val = cell.value;
          record[header] = val instanceof Date ? val.toISOString().slice(0, 10) : val;
          if (val !== null && val !== undefined && String(val).trim() !== "") hasData = true;
        }
      });
      if (hasData) rows.push(record);
    }

    res.status(200).json({ data: { headers, rows, totalRows: rows.length } });
  } catch (err) {
    res.status(400).json({
      error: `Failed to parse XLSX: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
