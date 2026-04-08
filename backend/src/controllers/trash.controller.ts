import { z } from "zod";
import * as trashSvc from "../services/trash.service.js";
import type { Request, Response } from "express";

const entityTypeEnum = z.enum(["candidate", "company", "serviceProvider", "hrManager", "user"]);

const listQuerySchema = z.object({
  entityType: entityTypeEnum.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

/** GET /api/v1/trash — List trashed items (paginated, cross-entity) */
export async function handleListTrash(req: Request, res: Response): Promise<void> {
  const opts = listQuerySchema.parse(req.query);
  const result = await trashSvc.listTrash(opts);
  res.status(200).json(result);
}

/** POST /api/v1/trash/restore — Restore a trashed item */
export async function handleRestore(req: Request, res: Response): Promise<void> {
  const { entityType, id } = z
    .object({
      entityType: entityTypeEnum,
      id: z.string(),
    })
    .parse(req.body);

  await trashSvc.restoreFromTrash(entityType, id);
  res.status(200).json({ message: "Restored" });
}

/** POST /api/v1/trash/permanent-delete — Permanently delete a trashed item */
export async function handlePermanentDelete(req: Request, res: Response): Promise<void> {
  const { entityType, id } = z
    .object({
      entityType: entityTypeEnum,
      id: z.string(),
    })
    .parse(req.body);

  await trashSvc.permanentDelete(entityType, id);
  res.status(200).json({ message: "Permanently deleted" });
}
