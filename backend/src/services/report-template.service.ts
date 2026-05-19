import { Prisma, type ReportType } from "@prisma/client";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";
import { validateColumnKeys, sanitizeColumnKeys } from "./report-columns.js";

// ─────────────────────────────────────────────────────────────
//  Report Template Service — §20 column management
//
//  Templates hold a saved column selection (and optional default
//  filters) for a given report type. Used by both Generate
//  (instant download) and Schedule (recurring delivery). CUSTOM
//  templates let admins build arbitrary candidate column sets;
//  templates against pre-existing report types just save a
//  preferred ordering / filter preset on top of that type.
// ─────────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  name: string;
  reportType: ReportType;
  columnKeys: string[];
  filters?: Record<string, unknown> | null;
  description?: string | null;
  isShared?: boolean;
  createdById: string;
}

export interface UpdateTemplateInput {
  name?: string;
  reportType?: ReportType;
  columnKeys?: string[];
  filters?: Record<string, unknown> | null;
  description?: string | null;
  isShared?: boolean;
}

export interface TemplateDTO {
  id: string;
  name: string;
  reportType: ReportType;
  columnConfig: string[];
  filters: Record<string, unknown> | null;
  description: string | null;
  isShared: boolean;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

function toDTO(t: {
  id: string;
  name: string;
  reportType: ReportType;
  columnConfig: Prisma.JsonValue;
  filters: Prisma.JsonValue | null;
  description: string | null;
  isShared: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { firstName: string; lastName: string } | null;
  _count?: { scheduledConfigs: number };
}): TemplateDTO {
  return {
    id: t.id,
    name: t.name,
    reportType: t.reportType,
    columnConfig: sanitizeColumnKeys(t.reportType, t.columnConfig),
    filters: (t.filters as Record<string, unknown> | null) ?? null,
    description: t.description,
    isShared: t.isShared,
    createdById: t.createdById,
    createdByName: t.createdBy
      ? `${t.createdBy.firstName} ${t.createdBy.lastName}`.trim()
      : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    usageCount: t._count?.scheduledConfigs ?? 0,
  };
}

const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  _count: { select: { scheduledConfigs: true } },
} as const;

/**
 * List templates visible to a user — own + shared.
 * Optionally filter by report type.
 */
export async function listTemplates(opts: {
  userId: string;
  reportType?: ReportType | undefined;
}): Promise<TemplateDTO[]> {
  const prisma = getPrisma();
  const where: Prisma.ReportTemplateWhereInput = {
    OR: [{ createdById: opts.userId }, { isShared: true }],
  };
  if (opts.reportType) where.reportType = opts.reportType;

  const rows = await prisma.reportTemplate.findMany({
    where,
    include,
    orderBy: [{ isShared: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(toDTO);
}

export async function getTemplate(opts: {
  id: string;
  userId: string;
}): Promise<TemplateDTO | null> {
  const prisma = getPrisma();
  const row = await prisma.reportTemplate.findUnique({
    where: { id: opts.id },
    include,
  });
  if (!row) return null;
  if (row.createdById !== opts.userId && !row.isShared) return null;
  return toDTO(row);
}

export async function createTemplate(input: CreateTemplateInput): Promise<TemplateDTO> {
  const prisma = getPrisma();
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required");

  const cleanedKeys = validateColumnKeys(input.reportType, input.columnKeys);

  const createData: Prisma.ReportTemplateUncheckedCreateInput = {
    name,
    reportType: input.reportType,
    columnConfig: cleanedKeys as unknown as Prisma.InputJsonValue,
    description: input.description ?? null,
    isShared: input.isShared ?? false,
    createdById: input.createdById,
  };
  if (input.filters !== undefined && input.filters !== null) {
    createData.filters = input.filters as Prisma.InputJsonValue;
  }

  const row = await prisma.reportTemplate.create({
    data: createData,
    include,
  });

  logger.info("Report template created", {
    id: row.id,
    name: row.name,
    reportType: row.reportType,
    columns: cleanedKeys.length,
    createdBy: input.createdById,
  });

  return toDTO(row);
}

export async function updateTemplate(opts: {
  id: string;
  userId: string;
  input: UpdateTemplateInput;
}): Promise<TemplateDTO> {
  const prisma = getPrisma();
  const existing = await prisma.reportTemplate.findUnique({ where: { id: opts.id } });
  if (!existing) throw new Error("Template not found");
  if (existing.createdById !== opts.userId) {
    throw new Error("Only the template owner can update it");
  }

  const data: Prisma.ReportTemplateUpdateInput = {};
  if (opts.input.name !== undefined) {
    const name = opts.input.name.trim();
    if (!name) throw new Error("Template name cannot be empty");
    data.name = name;
  }
  if (opts.input.reportType !== undefined) {
    data.reportType = opts.input.reportType;
  }
  if (opts.input.columnKeys !== undefined) {
    const targetType = opts.input.reportType ?? existing.reportType;
    const cleaned = validateColumnKeys(targetType, opts.input.columnKeys);
    data.columnConfig = cleaned as unknown as Prisma.InputJsonValue;
  }
  if (opts.input.filters !== undefined) {
    data.filters =
      opts.input.filters === null
        ? Prisma.DbNull
        : (opts.input.filters as Prisma.InputJsonValue);
  }
  if (opts.input.description !== undefined) data.description = opts.input.description;
  if (opts.input.isShared !== undefined) data.isShared = opts.input.isShared;

  const row = await prisma.reportTemplate.update({
    where: { id: opts.id },
    data,
    include,
  });

  logger.info("Report template updated", { id: row.id, fields: Object.keys(data) });
  return toDTO(row);
}

export async function deleteTemplate(opts: { id: string; userId: string }): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.reportTemplate.findUnique({ where: { id: opts.id } });
  if (!existing) return;
  if (existing.createdById !== opts.userId) {
    throw new Error("Only the template owner can delete it");
  }

  // SetNull on scheduled configs so schedules survive template deletion
  // (they fall back to their own columnConfig or the default).
  await prisma.scheduledReportConfig.updateMany({
    where: { templateId: opts.id },
    data: { templateId: null },
  });
  await prisma.reportTemplate.delete({ where: { id: opts.id } });

  logger.info("Report template deleted", { id: opts.id });
}

/**
 * Resolve the column keys + filters a schedule should use at run-time.
 * Precedence:
 *   1. Schedule's own columnConfig (if set)
 *   2. Linked template's columnConfig (if templateId set + template alive)
 *   3. Default columns for the report type
 *
 * Filters merge similarly — template filters are the base, schedule
 * filters override per-key.
 */
export async function resolveScheduleConfig(scheduleId: string): Promise<{
  reportType: ReportType;
  columnKeys: string[];
  filters: Record<string, unknown>;
}> {
  const prisma = getPrisma();
  const schedule = await prisma.scheduledReportConfig.findUnique({
    where: { id: scheduleId },
    include: { template: true },
  });
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  const scheduleKeys =
    (schedule.columnConfig as string[] | null) && (schedule.columnConfig as string[]).length > 0
      ? (schedule.columnConfig as string[])
      : null;
  const templateKeys = schedule.template
    ? (schedule.template.columnConfig as string[])
    : null;

  const rawKeys = scheduleKeys ?? templateKeys ?? [];
  const columnKeys = sanitizeColumnKeys(schedule.reportType, rawKeys);

  const templateFilters =
    (schedule.template?.filters as Record<string, unknown> | undefined) ?? {};
  const scheduleFilters =
    (schedule.filters as Record<string, unknown> | undefined) ?? {};
  const filters = { ...templateFilters, ...scheduleFilters };

  return { reportType: schedule.reportType, columnKeys, filters };
}
