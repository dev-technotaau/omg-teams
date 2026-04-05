import { type Role, Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Audit Log System
//  Spec Section 23.1
//
//  Logs all CRUD actions across the platform:
//  who, what, when, from where, old→new values
// ──────────────────────────────────────────────

export interface AuditInput {
  userId: string | null;
  userRole: Role | null;
  action: string; // CREATE, UPDATE, DELETE, RESTORE, LOGIN, LOGOUT, etc.
  entityType: string; // User, CandidateReport, Company, etc.
  entityId?: string | null;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log an audit trail entry.
 * Fire-and-forget — errors are logged but don't block the caller.
 */
export function logAudit(input: AuditInput): void {
  const prisma = getPrisma();

  prisma.auditLog
    .create({
      data: {
        userId: input.userId,
        userRole: input.userRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        changes: input.changes ? (input.changes as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
    .catch((err: unknown) => {
      logger.error("Failed to write audit log", { error: (err as Error).message });
    });
}

/**
 * Query audit logs with filtering.
 */
export async function listAuditLogs(filters: {
  userId?: string | undefined;
  action?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filters.userId) where["userId"] = filters.userId;
  if (filters.action) where["action"] = filters.action;
  if (filters.entityType) where["entityType"] = filters.entityType;
  if (filters.entityId) where["entityId"] = filters.entityId;

  if (filters.dateFrom || filters.dateTo) {
    where["timestamp"] = {};
    if (filters.dateFrom)
      (where["timestamp"] as Record<string, unknown>)["gte"] = new Date(filters.dateFrom);
    if (filters.dateTo)
      (where["timestamp"] as Record<string, unknown>)["lte"] = new Date(filters.dateTo);
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, employeeId: true } },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Export audit logs as XLSX buffer.
 */
export async function exportAuditLogs(filters: {
  action?: string | undefined;
  entityType?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}): Promise<Buffer> {
  const prisma = getPrisma();

  const where: Record<string, unknown> = {};
  if (filters.action) where["action"] = filters.action;
  if (filters.entityType) where["entityType"] = filters.entityType;
  if (filters.dateFrom || filters.dateTo) {
    where["timestamp"] = {};
    if (filters.dateFrom)
      (where["timestamp"] as Record<string, unknown>)["gte"] = new Date(filters.dateFrom);
    if (filters.dateTo)
      (where["timestamp"] as Record<string, unknown>)["lte"] = new Date(filters.dateTo);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { firstName: true, lastName: true, employeeId: true } } },
    orderBy: { timestamp: "desc" },
    take: 10000,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMG Teams";
  const sheet = workbook.addWorksheet("Audit Logs");

  sheet.columns = [
    { header: "Timestamp", key: "timestamp", width: 20 },
    { header: "User", key: "user", width: 20 },
    { header: "Employee ID", key: "employeeId", width: 15 },
    { header: "Role", key: "role", width: 18 },
    { header: "Action", key: "action", width: 12 },
    { header: "Entity Type", key: "entityType", width: 18 },
    { header: "Entity ID", key: "entityId", width: 28 },
    { header: "Changes", key: "changes", width: 50 },
    { header: "IP Address", key: "ip", width: 15 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "001845" } };

  for (const log of logs) {
    sheet.addRow({
      timestamp: log.timestamp,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : "System",
      employeeId: log.user?.employeeId ?? "",
      role: log.userRole ?? "",
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? "",
      changes: log.changes ? JSON.stringify(log.changes) : "",
      ip: log.ipAddress ?? "",
    });
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  logger.info("Audit log exported", { rows: logs.length });
  return buffer;
}
