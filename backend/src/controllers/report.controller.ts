import { z } from "zod";
import * as reportSvc from "../services/report.service.js";
import * as templateSvc from "../services/report-template.service.js";
import {
  getAllColumnInfo,
  getColumnInfo,
  getDefaultColumnKeys,
} from "../services/report-columns.js";
import type { Request, Response } from "express";
import type { ReportType } from "@prisma/client";

const reportTypeEnum = z.enum([
  "DAILY_RECRUITMENT_BATCH",
  "DAILY_RECRUITMENT_INDIVIDUAL",
  "WORK_PROFILE",
  "CANDIDATE",
  "RECRUITMENT",
  "CANDIDATE_MIS",
  "HR_FEEDBACK",
  "COMPANY_SPECIFIC",
  "SERVICE_PROVIDER_SPECIFIC",
  "HR_SPECIFIC",
  "ZONE_WISE",
  "STATUS_BASED",
  "PAYMENT_INVOICE",
  "ATTENDANCE",
  "LEAVE",
  "EMPLOYEE_PERFORMANCE_ALL",
  "EMPLOYEE_PERFORMANCE_RECRUITERS",
  "EMPLOYEE_PERFORMANCE_RMS",
  "EMPLOYEE_PERFORMANCE_INDIVIDUAL",
  "CUSTOM",
]);

/** POST /api/v1/reports/generate — Generate + download + save to cloud §20.2 */
export async function handleGenerateReport(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      reportType: reportTypeEnum,
      filters: z
        .object({
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          recruiterId: z.string().optional(),
          companyId: z.string().optional(),
          serviceProviderId: z.string().optional(),
          hrManagerId: z.string().optional(),
          zone: z.string().optional(),
          status: z.string().optional(),
          paymentStatus: z.string().optional(),
          employeeId: z.string().optional(),
          employeeScope: z.string().optional(),
        })
        .optional(),
      columnKeys: z.array(z.string()).optional(),
      templateId: z.string().optional(),
      reportName: z.string().optional(),
    })
    .parse(req.body);

  // If a template is referenced, resolve its column keys + filters as the
  // base; the request body can override either.
  let columnKeys = body.columnKeys;
  let filters = body.filters ?? {};
  if (body.templateId) {
    const tpl = await templateSvc.getTemplate({ id: body.templateId, userId: req.user!.id });
    if (tpl) {
      if (!columnKeys || columnKeys.length === 0) columnKeys = tpl.columnConfig;
      if (tpl.filters) {
        filters = { ...(tpl.filters as Record<string, string>), ...filters };
      }
    }
  }

  const { buffer, fileName, columnKeys: resolvedKeys } = await reportSvc.generateReport(
    body.reportType,
    filters,
    columnKeys ?? null,
  );

  const recordName = body.reportName?.trim() || fileName;

  // §20.2 — Save to cloud + DB record
  const cloudResult = await reportSvc.uploadReportToCloud(buffer, fileName);

  await reportSvc.saveReportRecord({
    reportType: body.reportType,
    reportName: recordName,
    source: "ON_PAGE",
    filters: filters as Record<string, unknown>,
    columnKeys: resolvedKeys,
    fileSize: buffer.length,
    cloudUrl: cloudResult.cloudUrl,
    cloudStorageKey: cloudResult.cloudStorageKey,
    storageBackend: cloudResult.storageBackend,
    createdByUserId: req.user!.id,
  });

  // Notify report generated
  const { onReportGenerated } = await import("../services/notification-triggers.js");
  void onReportGenerated(req.user!.id, body.reportType);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
}

/** GET /api/v1/reports/columns — Full column registry for the frontend picker. */
export async function handleGetColumnsRegistry(req: Request, res: Response): Promise<void> {
  const reportType = req.query["reportType"] as string | undefined;
  if (reportType) {
    const parsed = reportTypeEnum.parse(reportType);
    res.status(200).json({ data: getColumnInfo(parsed) });
    return;
  }
  res.status(200).json({ data: getAllColumnInfo() });
}

/** GET /api/v1/reports/columns/defaults?reportType=X — Just the default key list. */
export async function handleGetDefaultColumns(req: Request, res: Response): Promise<void> {
  const reportType = reportTypeEnum.parse(req.query["reportType"]);
  res.status(200).json({ data: getDefaultColumnKeys(reportType) });
}

/** GET /api/v1/reports/history — §20.4 Report history with filters, sorting, search */
export async function handleReportHistory(req: Request, res: Response): Promise<void> {
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : 1;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 25;

  const opts: reportSvc.HistoryQueryOpts = { page, limit };
  if (req.query["reportType"]) opts.reportType = req.query["reportType"] as string;
  if (req.query["source"]) opts.source = req.query["source"] as string;
  if (req.query["search"]) opts.search = req.query["search"] as string;
  if (req.query["dateFrom"]) opts.dateFrom = req.query["dateFrom"] as string;
  if (req.query["dateTo"]) opts.dateTo = req.query["dateTo"] as string;
  if (req.query["sortBy"]) opts.sortBy = req.query["sortBy"] as string;
  if (req.query["sortDir"]) opts.sortDir = req.query["sortDir"] as "asc" | "desc";

  const result = await reportSvc.listGeneratedReports(opts);
  res.status(200).json(result);
}

/** GET /api/v1/reports/schedules — List scheduled reports */
export async function handleListSchedules(req: Request, res: Response): Promise<void> {
  const status = req.query["status"] as string | undefined;
  const result = await reportSvc.listSchedules(status);
  res.status(200).json(result);
}

/** POST /api/v1/reports/schedules — Create a scheduled report §20.3 */
export async function handleCreateSchedule(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      reportType: z.string(),
      reportName: z.string().min(1),
      frequency: z.string(),
      time: z.string(),
      recipients: z.array(z.string().email()),
      filters: z.record(z.string(), z.string()).optional(),
      columnKeys: z.array(z.string()).optional(),
      templateId: z.string().optional(),
    })
    .parse(req.body);
  const createData: Parameters<typeof reportSvc.createSchedule>[0] = {
    reportType: body.reportType,
    reportName: body.reportName,
    frequency: body.frequency,
    time: body.time,
    recipients: body.recipients,
  };
  if (body.filters) createData.filters = body.filters;
  if (body.columnKeys) createData.columnKeys = body.columnKeys;
  if (body.templateId) createData.templateId = body.templateId;
  const schedule = await reportSvc.createSchedule(createData);
  res.status(201).json(schedule);
}

/** PATCH /api/v1/reports/schedules/:id — Update schedule §20.3 */
export async function handleUpdateSchedule(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const body = z
    .object({
      status: z.string().optional(),
      reportType: z.string().optional(),
      reportName: z.string().optional(),
      frequency: z.string().optional(),
      time: z.string().optional(),
      recipients: z.array(z.string().email()).optional(),
      filters: z.record(z.string(), z.string()).optional(),
      columnKeys: z.array(z.string()).nullable().optional(),
      templateId: z.string().nullable().optional(),
    })
    .parse(req.body);
  const updateData: Parameters<typeof reportSvc.updateSchedule>[1] = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.reportType !== undefined) updateData.reportType = body.reportType;
  if (body.reportName !== undefined) updateData.reportName = body.reportName;
  if (body.frequency !== undefined) updateData.frequency = body.frequency;
  if (body.time !== undefined) updateData.time = body.time;
  if (body.recipients !== undefined) updateData.recipients = body.recipients;
  if (body.filters !== undefined) updateData.filters = body.filters;
  if (body.columnKeys !== undefined) updateData.columnKeys = body.columnKeys;
  if (body.templateId !== undefined) updateData.templateId = body.templateId;
  const schedule = await reportSvc.updateSchedule(id, updateData);
  res.status(200).json(schedule);
}

/** DELETE /api/v1/reports/schedules/:id — Delete schedule */
export async function handleDeleteSchedule(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  await reportSvc.deleteSchedule(id);
  res.status(200).json({ message: "Schedule deleted" });
}

// ─────────────────────────────────────────────────────────────
//  Report Templates — column-selection + filter presets
// ─────────────────────────────────────────────────────────────

const templateBodySchema = z.object({
  name: z.string().min(1).max(120),
  reportType: reportTypeEnum,
  columnKeys: z.array(z.string()).min(1),
  filters: z.record(z.string(), z.unknown()).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isShared: z.boolean().optional(),
});

/** GET /api/v1/reports/templates */
export async function handleListTemplates(req: Request, res: Response): Promise<void> {
  const reportType = req.query["reportType"] as string | undefined;
  const opts: Parameters<typeof templateSvc.listTemplates>[0] = {
    userId: req.user!.id,
  };
  if (reportType) {
    opts.reportType = reportTypeEnum.parse(reportType) as ReportType;
  }
  const data = await templateSvc.listTemplates(opts);
  res.status(200).json({ data });
}

/** GET /api/v1/reports/templates/:id */
export async function handleGetTemplate(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const data = await templateSvc.getTemplate({ id, userId: req.user!.id });
  if (!data) {
    res.status(404).json({ message: "Template not found" });
    return;
  }
  res.status(200).json({ data });
}

/** POST /api/v1/reports/templates */
export async function handleCreateTemplate(req: Request, res: Response): Promise<void> {
  const body = templateBodySchema.parse(req.body);
  const created = await templateSvc.createTemplate({
    name: body.name,
    reportType: body.reportType as ReportType,
    columnKeys: body.columnKeys,
    filters: (body.filters ?? null) as Record<string, unknown> | null,
    description: body.description ?? null,
    isShared: body.isShared ?? false,
    createdById: req.user!.id,
  });
  res.status(201).json({ data: created });
}

/** PATCH /api/v1/reports/templates/:id */
export async function handleUpdateTemplate(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const body = templateBodySchema.partial().parse(req.body);
  const input: Parameters<typeof templateSvc.updateTemplate>[0]["input"] = {};
  if (body.name !== undefined) input.name = body.name;
  if (body.reportType !== undefined) input.reportType = body.reportType as ReportType;
  if (body.columnKeys !== undefined) input.columnKeys = body.columnKeys;
  if (body.filters !== undefined) input.filters = body.filters as Record<string, unknown> | null;
  if (body.description !== undefined) input.description = body.description;
  if (body.isShared !== undefined) input.isShared = body.isShared;
  const updated = await templateSvc.updateTemplate({
    id,
    userId: req.user!.id,
    input,
  });
  res.status(200).json({ data: updated });
}

/** DELETE /api/v1/reports/templates/:id */
export async function handleDeleteTemplate(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  await templateSvc.deleteTemplate({ id, userId: req.user!.id });
  res.status(200).json({ message: "Template deleted" });
}
