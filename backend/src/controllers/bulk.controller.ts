import { z } from "zod";
import * as bulkSvc from "../services/bulk.service.js";
import type { Request, Response } from "express";

const idsSchema = z.object({ ids: z.array(z.string()).min(1) });

/** POST /api/v1/bulk/status — Bulk update status */
export async function handleBulkStatus(req: Request, res: Response): Promise<void> {
  const { ids, status } = z
    .object({
      ids: z.array(z.string()).min(1),
      status: z.string(),
    })
    .parse(req.body);

  const result = await bulkSvc.bulkUpdateStatus(ids, status);
  res.status(200).json({ updated: result.count });
}

/** POST /api/v1/bulk/stage — Bulk update pipeline stage */
export async function handleBulkStage(req: Request, res: Response): Promise<void> {
  const { ids, stage } = z
    .object({
      ids: z.array(z.string()).min(1),
      stage: z.enum([
        "SOURCED",
        "SCREENED",
        "CV_SHARED",
        "INTERVIEW_SCHEDULED",
        "SELECTED",
        "JOINED",
        "INVOICED",
        "CLOSED",
      ]),
    })
    .parse(req.body);

  const result = await bulkSvc.bulkUpdateStage(ids, stage);
  res.status(200).json({ updated: result.count });
}

/** POST /api/v1/bulk/payment-status — Bulk update payment status */
export async function handleBulkPaymentStatus(req: Request, res: Response): Promise<void> {
  const { ids, paymentStatus } = z
    .object({
      ids: z.array(z.string()).min(1),
      paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID", "OVERDUE"]),
    })
    .parse(req.body);

  const result = await bulkSvc.bulkUpdatePaymentStatus(ids, paymentStatus);
  res.status(200).json({ updated: result.count });
}

/** POST /api/v1/bulk/delete — Bulk soft delete */
export async function handleBulkDelete(req: Request, res: Response): Promise<void> {
  const { ids } = idsSchema.parse(req.body);
  const result = await bulkSvc.bulkDelete(ids, req.user!.id);
  res.status(200).json({ deleted: result.count });
}

/** POST /api/v1/bulk/assign-company — Bulk assign company */
export async function handleBulkAssignCompany(req: Request, res: Response): Promise<void> {
  const { ids, companyId } = z
    .object({
      ids: z.array(z.string()).min(1),
      companyId: z.string(),
    })
    .parse(req.body);

  const result = await bulkSvc.bulkAssignCompany(ids, companyId);
  res.status(200).json({ updated: result.count });
}

/** POST /api/v1/bulk/restore — Bulk restore from trash */
const bulkRestoreSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        entityType: z.enum(["candidate", "company", "serviceProvider", "hrManager", "user"]),
      }),
    )
    .min(1),
});

export async function handleBulkRestore(req: Request, res: Response): Promise<void> {
  const { items } = bulkRestoreSchema.parse(req.body);
  const result = await bulkSvc.bulkRestore(items);
  res.status(200).json({ restored: result.count });
}
