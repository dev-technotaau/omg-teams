import { z } from "zod";
import * as draftSvc from "../services/draft.service.js";
import type { Request, Response } from "express";

/** PUT /api/v1/drafts — Save or update draft */
export async function handleSaveDraft(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      zone: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]).nullable(),
      formData: z.record(z.string(), z.unknown()),
    })
    .parse(req.body);

  const draft = await draftSvc.saveDraft(req.user!.id, body.zone, body.formData);
  res.status(200).json({ draft });
}

/** GET /api/v1/drafts — Get current user's draft */
export async function handleGetDraft(req: Request, res: Response): Promise<void> {
  const draft = await draftSvc.getDraft(req.user!.id);
  res.status(200).json({ draft });
}

/** DELETE /api/v1/drafts — Delete current user's draft */
export async function handleDeleteDraft(req: Request, res: Response): Promise<void> {
  await draftSvc.deleteDraft(req.user!.id);
  res.status(200).json({ message: "Draft deleted" });
}
