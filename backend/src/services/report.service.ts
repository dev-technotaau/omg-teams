import { type ReportType, type ReportSource, Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../instrument.js";
import {
  sanitizeColumnKeys,
  resolveColumnDefs,
  getDefaultColumnKeys,
} from "./report-columns.js";

// ──────────────────────────────────────────────
//  Report Generation Service — Spec Section 10, 20
// ──────────────────────────────────────────────

export interface ReportFilters {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  recruiterId?: string | undefined;
  companyId?: string | undefined;
  serviceProviderId?: string | undefined;
  hrManagerId?: string | undefined;
  zone?: string | undefined;
  status?: string | undefined;
  paymentStatus?: string | undefined;
  employeeId?: string | undefined;
  employeeScope?: string | undefined;
}

/**
 * Generate an XLSX report and return the buffer.
 *
 * `columnKeys` (optional) — caller-supplied ordered subset of the
 * report type's column pool. Unknown/dupe keys are dropped; an
 * empty result falls back to the type's default set. Used by
 * Generate, Schedule, and the worker so a single code path
 * produces every report on the platform.
 */
export async function generateReport(
  reportType: ReportType,
  filters: ReportFilters,
  columnKeys?: string[] | null,
): Promise<{ buffer: Buffer; fileName: string; columnKeys: string[] }> {
  const data = await fetchTypedReportData(reportType, filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMG Teams";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Report");

  const resolvedKeys = columnKeys && columnKeys.length > 0
    ? sanitizeColumnKeys(reportType, columnKeys)
    : getDefaultColumnKeys(reportType);
  const columns = resolveColumnDefs(reportType, resolvedKeys);
  sheet.columns = columns.map((col) => ({ header: col.header, key: col.key, width: col.width }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "001845" } };

  // Add data rows
  for (const row of data.rows) {
    sheet.addRow(row);
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `${reportType}_${datePart}.xlsx`;

  logger.info("Report generated", {
    reportType,
    rows: data.rows.length,
    columns: resolvedKeys.length,
    fileName,
  });

  return { buffer, fileName, columnKeys: resolvedKeys };
}

/**
 * §20.2 — Upload report file to cloud storage (R2/Cloudinary).
 * Returns cloudUrl + cloudStorageKey. Falls back gracefully if
 * cloud storage is not configured.
 */
export async function uploadReportToCloud(
  buffer: Buffer,
  fileName: string,
): Promise<{
  cloudUrl: string | null;
  cloudStorageKey: string | null;
  storageBackend: "R2" | null;
}> {
  if (env.hasR2) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getR2 } = await import("../config/storage.js");
    const key = `reports/${Date.now()}_${fileName}`;
    await getR2().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    // Generate signed URL instead of raw public URL
    const { getSignedR2Url } = await import("../utils/signed-url.js");
    const cloudUrl = await getSignedR2Url(key, undefined, `attachment; filename="${fileName}"`);
    logger.info("Report uploaded to R2", { key, size: buffer.length });
    return { cloudUrl, cloudStorageKey: key, storageBackend: "R2" };
  }

  logger.warn("No cloud storage configured for reports — stored in DB only", { fileName });
  return { cloudUrl: null, cloudStorageKey: null, storageBackend: null };
}

/**
 * Save generated report metadata to DB.
 */
export async function saveReportRecord(data: {
  reportType: ReportType;
  reportName: string;
  source: ReportSource;
  filters?: Record<string, unknown>;
  columnKeys?: string[];
  fileSize?: number;
  cloudUrl?: string | null;
  cloudStorageKey?: string | null;
  storageBackend?: "CLOUDINARY" | "R2" | null;
  createdByUserId?: string;
}) {
  const prisma = getPrisma();

  // §20.2 — Set 30-day expiration for cloud-stored reports
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const createData: Prisma.GeneratedReportUncheckedCreateInput = {
    reportType: data.reportType,
    reportName: data.reportName,
    source: data.source,
    fileSize: data.fileSize ?? null,
    cloudUrl: data.cloudUrl ?? null,
    cloudStorageKey: data.cloudStorageKey ?? null,
    storageBackend: data.storageBackend ?? null,
    expiresAt,
    createdByUserId: data.createdByUserId ?? null,
  };
  if (data.filters !== undefined) {
    createData.filters = data.filters as Prisma.InputJsonValue;
  }
  if (data.columnKeys !== undefined) {
    createData.columnConfig = data.columnKeys as unknown as Prisma.InputJsonValue;
  }
  return prisma.generatedReport.create({ data: createData });
}

/**
 * §20.4 — List generated reports (history) with filtering, sorting, search.
 */
export interface HistoryQueryOpts {
  page: number;
  limit: number;
  reportType?: string;
  source?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function listGeneratedReports(opts: HistoryQueryOpts) {
  const prisma = getPrisma();
  const { page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: Prisma.GeneratedReportWhereInput = {};

  // Filter by report type
  if (opts.reportType) {
    where.reportType = opts.reportType as ReportType;
  }

  // Filter by source
  if (opts.source) {
    where.source = opts.source as ReportSource;
  }

  // Filter by date range
  if (opts.dateFrom || opts.dateTo) {
    where.generatedAt = {};
    if (opts.dateFrom) where.generatedAt.gte = new Date(opts.dateFrom);
    if (opts.dateTo) where.generatedAt.lte = new Date(opts.dateTo);
  }

  // Search by report name
  if (opts.search) {
    where.OR = [{ reportName: { contains: opts.search, mode: "insensitive" } }];
  }

  // Sorting
  const validSortKeys = ["generatedAt", "reportName", "reportType", "fileSize", "source"];
  const sortBy = validSortKeys.includes(opts.sortBy ?? "") ? opts.sortBy! : "generatedAt";
  const sortDir = opts.sortDir === "asc" ? "asc" : "desc";
  const orderBy = { [sortBy]: sortDir } as Prisma.GeneratedReportOrderByWithRelationInput;

  const [data, total] = await Promise.all([
    prisma.generatedReport.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        deliveryLogs: {
          select: {
            recipientEmail: true,
            sentAt: true,
            deliveryStatus: true,
          },
          orderBy: { sentAt: "desc" },
        },
      },
    }),
    prisma.generatedReport.count({ where }),
  ]);

  // §20.4 — Enrich with recipient emails, sentAt, expiration indicator
  // Generate fresh signed URLs for non-expired reports
  const now = new Date();
  const { getSignedDownloadUrl } = await import("../utils/signed-url.js");

  const enriched = await Promise.all(
    data.map(async (r) => {
      const recipientEmails =
        r.deliveryLogs.length > 0
          ? [...new Set(r.deliveryLogs.map((d) => d.recipientEmail))]
          : null;
      const sentAt = r.deliveryLogs[0]?.sentAt?.toISOString() ?? null;
      const deliveryStatus = r.deliveryLogs[0]?.deliveryStatus ?? null;
      const isExpired =
        r.isExpired || (r.expiresAt !== null && r.expiresAt !== undefined && r.expiresAt < now);

      // Regenerate signed URL using the recorded backend (falls back to the
      // configured-default heuristic for rows written before the column existed).
      let cloudUrl: string | null = null;
      if (!isExpired && r.cloudStorageKey) {
        try {
          cloudUrl = await getSignedDownloadUrl(r.cloudStorageKey, {
            backend: r.storageBackend,
            contentDisposition: `attachment; filename="${r.reportName}"`,
            resourceType: "raw",
          });
        } catch {
          cloudUrl = null;
        }
      }

      return {
        id: r.id,
        reportName: r.reportName,
        reportType: r.reportType,
        source: r.source,
        generatedAt: r.generatedAt.toISOString(),
        fileSize: r.fileSize,
        filters: r.filters ? JSON.stringify(r.filters) : "",
        recipientEmails,
        sentAt,
        deliveryStatus,
        cloudUrl,
        isExpired,
      };
    }),
  );

  return {
    data: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * List scheduled report configs.
 */
export async function listSchedules(status?: string) {
  const prisma = getPrisma();
  const where: Prisma.ScheduledReportConfigWhereInput = {};
  if (status) where.isActive = status === "active";
  const data = await prisma.scheduledReportConfig.findMany({
    where,
    include: {
      recipients: { where: { removedAt: null } },
      deliveryLogs: { orderBy: { sentAt: "desc" }, take: 1 },
      template: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    data: data.map((s) => {
      const lastSent = s.deliveryLogs[0]?.sentAt ?? null;
      const timing = s.timing as { hour?: number; minute?: number } | null;
      const nextScheduled = computeNextScheduled(s.frequency, timing);
      return {
        id: s.id,
        reportType: s.reportType,
        reportName: s.reportName,
        filters: s.filters as Record<string, string> | null,
        columnConfig: (s.columnConfig as string[] | null) ?? null,
        templateId: s.templateId,
        templateName: s.template?.name ?? null,
        frequency: s.frequency,
        time: timing
          ? `${String(timing.hour ?? 0).padStart(2, "0")}:${String(timing.minute ?? 0).padStart(2, "0")}`
          : "",
        recipients: s.recipients.map((r) => r.email),
        lastSent: lastSent?.toISOString() ?? null,
        nextScheduled: nextScheduled.toISOString(),
        status: s.isActive ? "active" : "paused",
      };
    }),
  };
}

function computeNextScheduled(
  frequency: string,
  timing: { hour?: number; minute?: number } | null,
): Date {
  const now = new Date();
  const hour = timing?.hour ?? 0;
  const minute = timing?.minute ?? 0;

  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (frequency === "DAILY") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === "MONTHLY") {
    if (next <= now) next.setMonth(next.getMonth() + 1, 1);
    else next.setDate(1);
  } else if (frequency === "YEARLY") {
    if (next <= now) next.setFullYear(next.getFullYear() + 1, 0, 1);
    else {
      next.setMonth(0);
      next.setDate(1);
    }
  } else {
    if (next <= now) next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * §20.3 — Create a scheduled report config with filters.
 */
export async function createSchedule(data: {
  reportType: string;
  reportName: string;
  frequency: string;
  time: string;
  recipients: string[];
  filters?: Record<string, string>;
  columnKeys?: string[] | null;
  templateId?: string | null;
}) {
  const prisma = getPrisma();

  // Parse time string (e.g. "09:30") into structured JSON for the timing column.
  // If empty/missing, fall back to the platform default (`report_default_schedule_time`).
  let timeStr = data.time;
  if (!timeStr) {
    const { getSettingString } = await import("./settings.service.js");
    timeStr = await getSettingString("report_default_schedule_time", "09:00");
  }
  const [hour, minute] = timeStr.split(":").map(Number);

  const reportType = data.reportType as ReportType;
  const cleanedKeys = data.columnKeys
    ? sanitizeColumnKeys(reportType, data.columnKeys)
    : null;

  const createData: Prisma.ScheduledReportConfigCreateInput = {
    reportType,
    reportName: data.reportName,
    filters: (data.filters as Prisma.InputJsonValue) ?? {},
    frequency: data.frequency as "DAILY" | "MONTHLY" | "YEARLY",
    timing: { hour: hour ?? 0, minute: minute ?? 0 },
    isActive: true,
    recipients: {
      create: data.recipients.map((email) => ({ email })),
    },
  };
  if (cleanedKeys) {
    createData.columnConfig = cleanedKeys as unknown as Prisma.InputJsonValue;
  }
  if (data.templateId) {
    createData.template = { connect: { id: data.templateId } };
  }

  return prisma.scheduledReportConfig.create({
    data: createData,
    include: { recipients: true },
  });
}

/**
 * §20.3 — Update a scheduled report config (toggle status, edit fields, update filters).
 */
export async function updateSchedule(
  id: string,
  data: {
    status?: string | undefined;
    reportType?: string | undefined;
    reportName?: string | undefined;
    frequency?: string | undefined;
    time?: string | undefined;
    recipients?: string[] | undefined;
    filters?: Record<string, string> | undefined;
    columnKeys?: string[] | null | undefined;
    templateId?: string | null | undefined;
  },
) {
  const prisma = getPrisma();
  const updateData: Prisma.ScheduledReportConfigUpdateInput = {};
  if (data.status !== undefined) updateData.isActive = data.status === "active";
  if (data.reportType) updateData.reportType = data.reportType as ReportType;
  if (data.reportName) updateData.reportName = data.reportName;
  if (data.frequency) updateData.frequency = data.frequency as "DAILY" | "MONTHLY" | "YEARLY";
  if (data.time) {
    const [hour, minute] = data.time.split(":").map(Number);
    updateData.timing = { hour: hour ?? 0, minute: minute ?? 0 };
  }
  if (data.filters !== undefined) {
    updateData.filters = data.filters as Prisma.InputJsonValue;
  }
  if (data.columnKeys !== undefined) {
    // Need the report type to validate against — fall back to existing row's type if not in payload
    const targetType = (data.reportType as ReportType | undefined) ?? (
      await prisma.scheduledReportConfig.findUnique({
        where: { id },
        select: { reportType: true },
      })
    )?.reportType;
    if (data.columnKeys === null) {
      updateData.columnConfig = Prisma.DbNull;
    } else if (targetType) {
      const cleaned = sanitizeColumnKeys(targetType, data.columnKeys);
      updateData.columnConfig = cleaned as unknown as Prisma.InputJsonValue;
    }
  }
  if (data.templateId !== undefined) {
    updateData.template = data.templateId
      ? { connect: { id: data.templateId } }
      : { disconnect: true };
  }

  const result = await prisma.scheduledReportConfig.update({ where: { id }, data: updateData });

  // Update recipients if provided — soft-delete old, create new
  if (data.recipients) {
    await prisma.scheduledReportRecipient.updateMany({
      where: { scheduledReportConfigId: id, removedAt: null },
      data: { removedAt: new Date() },
    });
    await prisma.scheduledReportRecipient.createMany({
      data: data.recipients.map((email) => ({ scheduledReportConfigId: id, email })),
    });
  }

  return result;
}

/**
 * Delete a scheduled report config.
 */
export async function deleteSchedule(id: string) {
  const prisma = getPrisma();
  // Delete recipients first, then config
  await prisma.scheduledReportRecipient.deleteMany({ where: { scheduledReportConfigId: id } });
  return prisma.scheduledReportConfig.delete({ where: { id } });
}

/**
 * §20.2/20.4 — Mark expired reports and clean up cloud files.
 * Called by BullMQ scheduled job.
 */
export async function cleanupExpiredReports(): Promise<number> {
  const prisma = getPrisma();
  const now = new Date();

  // Find expired reports that haven't been marked yet
  const expired = await prisma.generatedReport.findMany({
    where: {
      isExpired: false,
      expiresAt: { lte: now },
    },
    select: { id: true, cloudStorageKey: true },
  });

  if (expired.length === 0) return 0;

  // Delete expired report files from R2
  const keysToDelete = expired.map((r) => r.cloudStorageKey).filter((k): k is string => !!k);
  if (keysToDelete.length > 0) {
    const { deleteR2Objects } = await import("../config/storage.js");
    const deleted = await deleteR2Objects(keysToDelete);
    logger.info("Expired report files deleted from R2", {
      requested: keysToDelete.length,
      deleted,
    });
  }

  // Mark as expired in DB (history entry stays for audit trail per §20.4)
  await prisma.generatedReport.updateMany({
    where: { id: { in: expired.map((e) => e.id) } },
    data: { isExpired: true, cloudUrl: null },
  });

  logger.info("Expired reports cleaned up", { count: expired.length });
  return expired.length;
}

// ──────────────────────────────────────────────
//  Typed report data fetcher (used by generateReport)
//  Column layout comes from report-columns.ts; this
//  fetcher only needs to populate the superset of fields
//  the registry exposes for the report type's source.
// ──────────────────────────────────────────────

interface TypedReportData {
  rows: Record<string, unknown>[];
}

async function fetchTypedReportData(
  reportType: ReportType,
  filters: ReportFilters,
): Promise<TypedReportData> {
  const prisma = getPrisma();

  // ── Attendance-based reports ──
  if (reportType === "ATTENDANCE") {
    const where: Prisma.AttendanceRecordWhereInput = {};
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
    }
    if (filters.employeeId) where.userId = filters.employeeId;

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, employeeId: true } },
      },
      orderBy: { date: "desc" },
      take: 10000,
    });

    return {
      rows: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        employee: `${r.user.firstName} ${r.user.lastName}`,
        employeeId: r.user.employeeId ?? "",
        email: r.user.email,
        punchIn: r.punchInTime?.toISOString().slice(11, 16) ?? "",
        punchOut: r.punchOutTime?.toISOString().slice(11, 16) ?? "",
        workingHours: r.netWorkingMinutes
          ? `${Math.floor(r.netWorkingMinutes / 60)}h ${r.netWorkingMinutes % 60}m`
          : "",
        status: r.status,
        isLate: r.isLate ? "Yes" : "No",
        lateByMinutes: r.lateByMinutes ?? "",
      })),
    };
  }

  // ── Leave-based reports ──
  if (reportType === "LEAVE") {
    const where: Prisma.LeaveRequestWhereInput = {};
    if (filters.dateFrom || filters.dateTo) {
      where.startDate = {};
      if (filters.dateFrom) where.startDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.startDate.lte = new Date(filters.dateTo);
    }
    if (filters.employeeId) where.userId = filters.employeeId;
    if (filters.status)
      where.status = filters.status as unknown as Prisma.EnumLeaveRequestStatusFilter;

    const records = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, employeeId: true } },
        leaveType: { select: { name: true } },
        actioner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: "desc" },
      take: 10000,
    });

    return {
      rows: records.map((r) => ({
        employee: `${r.user.firstName} ${r.user.lastName}`,
        employeeId: r.user.employeeId ?? "",
        leaveType: r.leaveType.name,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        numberOfDays: r.numberOfDays,
        isHalfDay: r.isHalfDay ? "Yes" : "No",
        reason: r.reason,
        status: r.status,
        actionedBy: r.actioner ? `${r.actioner.firstName} ${r.actioner.lastName}` : "",
      })),
    };
  }

  // ── Payment / Invoice reports ──
  if (reportType === "PAYMENT_INVOICE") {
    const where: Prisma.CandidateReportWhereInput = { deletedAt: null };
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.paymentStatus)
      where.paymentStatus =
        filters.paymentStatus as unknown as Prisma.EnumPaymentStatusNullableFilter;
    if (filters.dateFrom || filters.dateTo) {
      where.invoiceDate = {};
      if (filters.dateFrom) where.invoiceDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.invoiceDate.lte = new Date(filters.dateTo);
    }
    // Only include records with invoice data
    where.invoiceNumber = { not: null };

    const records = await prisma.candidateReport.findMany({
      where,
      include: { company: { select: { name: true } } },
      orderBy: { invoiceDate: "desc" },
      take: 10000,
    });

    return {
      rows: records.map((c) => ({
        serialNo: c.globalSerialNumber,
        candidateName: c.candidateName,
        company: c.company?.name ?? "",
        invoiceNumber: c.invoiceNumber,
        invoiceDate: c.invoiceDate?.toISOString().slice(0, 10) ?? "",
        invoiceAmount: c.invoiceAmountTotal,
        gstAmount: c.gstAmount,
        tdsAmount: c.tdsAmount,
        amountReceived: c.amountReceived,
        paymentStatus: c.paymentStatus,
        paymentDate: c.paymentDate?.toISOString().slice(0, 10) ?? "",
      })),
    };
  }

  // ── Employee performance reports ──
  if (reportType.startsWith("EMPLOYEE_PERFORMANCE")) {
    const userWhere: Prisma.UserWhereInput = { deletedAt: null, status: "ACTIVE" };
    if (reportType === "EMPLOYEE_PERFORMANCE_RECRUITERS") userWhere.role = "RECRUITER";
    else if (reportType === "EMPLOYEE_PERFORMANCE_RMS") userWhere.role = "REPORTING_MANAGER";
    else if (reportType === "EMPLOYEE_PERFORMANCE_INDIVIDUAL" && filters.employeeId)
      userWhere.id = filters.employeeId;
    // §20.2 — Employee scope filter from UI
    else if (filters.employeeScope === "RECRUITERS") userWhere.role = "RECRUITER";
    else if (filters.employeeScope === "RMS") userWhere.role = "REPORTING_MANAGER";

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
        status: true,
      },
      take: 5000,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const userIds = users.map((u) => u.id);

    const [candidateCounts, attendanceCounts] = await Promise.all([
      prisma.candidateReport.groupBy({
        by: ["recruiterId"],
        where: { recruiterId: { in: userIds }, deletedAt: null },
        _count: { id: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, date: { gte: monthStart }, status: "PRESENT_FULL" },
        _count: { id: true },
      }),
    ]);

    const candidateMap = new Map(candidateCounts.map((c) => [c.recruiterId, c._count.id]));
    const attendanceMap = new Map(attendanceCounts.map((a) => [a.userId, a._count.id]));
    const workingDays = Math.max(
      1,
      Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      rows: users.map((u) => ({
        employee: `${u.firstName} ${u.lastName}`,
        employeeId: u.employeeId ?? "",
        role: u.role,
        candidatesToday: 0, // Would need separate query; kept simple
        candidatesMonth: candidateMap.get(u.id) ?? 0,
        totalCandidates: candidateMap.get(u.id) ?? 0,
        completionRate: 0,
        attendanceRate: Math.round(((attendanceMap.get(u.id) ?? 0) / workingDays) * 100),
        status: u.status,
      })),
    };
  }

  // ── Candidate-based reports (default for most types) ──
  const where: Prisma.CandidateReportWhereInput = { deletedAt: null };
  if (filters.recruiterId) where.recruiterId = filters.recruiterId;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.serviceProviderId) where.serviceProviderId = filters.serviceProviderId;
  if (filters.hrManagerId) where.hrManagerId = filters.hrManagerId;
  if (filters.zone) {
    // §20.2 — Zone filter supports Set A/B batch filtering
    if (filters.zone === "SET_A") {
      where.zone = { in: ["WEST", "CENTRAL"] };
    } else if (filters.zone === "SET_B") {
      where.zone = { in: ["EAST", "NORTH", "SOUTH"] };
    } else {
      where.zone = filters.zone as Prisma.EnumZoneFilter;
    }
  }
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  // Apply type-specific filters
  if (reportType === "HR_FEEDBACK") where.hrFeedback = { not: null };
  if (reportType === "COMPANY_SPECIFIC" && filters.companyId) where.companyId = filters.companyId;
  if (reportType === "SERVICE_PROVIDER_SPECIFIC" && filters.serviceProviderId)
    where.serviceProviderId = filters.serviceProviderId;
  if (reportType === "HR_SPECIFIC" && filters.hrManagerId) where.hrManagerId = filters.hrManagerId;

  const candidates = await prisma.candidateReport.findMany({
    where,
    include: {
      recruiter: { select: { firstName: true, lastName: true, employeeId: true } },
      company: { select: { name: true } },
      serviceProvider: { select: { name: true } },
      hrManager: { select: { name: true } },
    },
    orderBy: { globalSerialNumber: "asc" },
    take: 10000,
  });

  const fmtDate = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 10) : "";
  const fmtBool = (b: boolean | null | undefined) =>
    b === null || b === undefined ? "" : b ? "Yes" : "No";

  return {
    rows: candidates.map((c) => ({
      // Identity & meta
      serialNo: c.globalSerialNumber,
      candidateName: c.candidateName,
      contactNo: c.contactNo,
      emailId: c.emailId,
      dateOfBirth: fmtDate(c.dateOfBirth),
      // Location
      zone: c.zone,
      state: c.state,
      location: c.location,
      adminState: c.adminState,
      adminLocation: c.adminLocation,
      // Profile
      profile: c.profile,
      experience: c.yearsOfExperience,
      currentDesignation: c.currentDesignation,
      currentOrganization: c.currentOrganization,
      higherQualification: c.higherQualification,
      noticePeriod: c.noticePeriod,
      // Education
      diplomaPartFull: c.diplomaPartFull,
      graduationPercent: c.graduationPercent,
      graduationYear: c.graduationYear,
      twelfthPercent: c.twelfthPercent,
      twelfthPassingYear: c.twelfthPassingYear,
      tenthPercent: c.tenthPercent,
      tenthPassingYear: c.tenthPassingYear,
      // Compensation
      currentCtc: c.currentCtc,
      expectedCtc: c.expectedCtc,
      // Pipeline
      status: c.status,
      stage: c.candidateStage,
      isDuplicate: fmtBool(c.isDuplicate),
      dateSourced: fmtDate(c.dateSourced),
      cvSharedOnDate: fmtDate(c.cvSharedOnDate),
      dateOfJoining: fmtDate(c.dateOfJoining),
      remarks: c.remarks,
      // Set-A checkpoints
      isCtcInformed: fmtBool(c.isCtcInformed),
      isOffRollOkay: fmtBool(c.isOffRollOkay),
      isOnRollExplained: fmtBool(c.isOnRollExplained),
      hasTwoWheeler: fmtBool(c.hasTwoWheeler),
      communicationSkill: c.communicationSkill,
      // Stakeholders
      recruiterName: `${c.recruiter.firstName} ${c.recruiter.lastName}`,
      company: c.company?.name ?? "",
      serviceProvider: c.serviceProvider?.name ?? "",
      hrManager: c.hrManager?.name ?? "",
      hrFeedback: c.hrFeedback,
      // Billing
      invoiceNumber: c.invoiceNumber,
      invoiceDate: fmtDate(c.invoiceDate),
      invoiceAmount: c.invoiceAmountTotal,
      gstAmount: c.gstAmount,
      tdsAmount: c.tdsAmount,
      amountReceived: c.amountReceived,
      paymentStatus: c.paymentStatus,
      paymentDate: fmtDate(c.paymentDate),
      // Audit
      createdAt: fmtDate(c.createdAt),
    })),
  };
}
