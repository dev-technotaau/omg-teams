import * as auditSvc from "../services/audit.service.js";
import type { Request, Response } from "express";

/** GET /api/v1/audit-logs — List audit logs with filtering */
export async function handleListAuditLogs(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const result = await auditSvc.listAuditLogs({
    userId: q["userId"] as string | undefined,
    action: q["action"] as string | undefined,
    entityType: q["entityType"] as string | undefined,
    entityId: q["entityId"] as string | undefined,
    dateFrom: q["dateFrom"] as string | undefined,
    dateTo: q["dateTo"] as string | undefined,
    page: q["page"] ? parseInt(q["page"] as string, 10) : undefined,
    limit: q["limit"] ? parseInt(q["limit"] as string, 10) : undefined,
  });
  res.status(200).json(result);
}

/** GET /api/v1/audit-logs/export — Export audit logs as XLSX */
export async function handleExportAuditLogs(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const buffer = await auditSvc.exportAuditLogs({
    action: q["action"] as string | undefined,
    entityType: q["entityType"] as string | undefined,
    dateFrom: q["dateFrom"] as string | undefined,
    dateTo: q["dateTo"] as string | undefined,
  });
  const fileName = `audit_logs_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
}
