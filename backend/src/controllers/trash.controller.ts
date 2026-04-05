import { z } from "zod";
import * as trashSvc from "../services/trash.service.js";
import type { Request, Response } from "express";

const entityTypeEnum = z.enum([
  "candidateReport",
  "company",
  "serviceProvider",
  "hRManager",
  "user",
]);

/** GET /api/v1/trash — List trashed items */
export async function handleListTrash(req: Request, res: Response): Promise<void> {
  const entityType = req.query["entityType"] as string | undefined;
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : 1;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 20;

  const parsed = entityType ? entityTypeEnum.parse(entityType) : undefined;
  const items = await trashSvc.listTrash(parsed, page, limit);
  res.status(200).json({ items });
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
