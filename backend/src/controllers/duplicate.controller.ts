import { z } from "zod";
import * as dupSvc from "../services/duplicate.service.js";
import type { Request, Response } from "express";

/** POST /api/v1/duplicates/check — Pre-submission duplicate check */
export async function handleCheckDuplicates(req: Request, res: Response): Promise<void> {
  const { contactNo, emailId } = z
    .object({
      contactNo: z.string().optional(),
      emailId: z.string().optional(),
    })
    .parse(req.body);

  const matches = await dupSvc.checkDuplicates(contactNo, emailId);
  res.status(200).json({ duplicates: matches, hasDuplicates: matches.length > 0 });
}

/** GET /api/v1/duplicates — List duplicate groups (admin) */
export async function handleListDuplicateGroups(req: Request, res: Response): Promise<void> {
  const status = req.query["status"] as "PENDING" | "RESOLVED" | "DISMISSED" | undefined;
  const groups = await dupSvc.listDuplicateGroups(status);
  res.status(200).json({ groups });
}

/** POST /api/v1/duplicates/:id/merge — Merge duplicates keeping primary */
export async function handleMergeDuplicates(req: Request, res: Response): Promise<void> {
  const { primaryCandidateId } = z
    .object({
      primaryCandidateId: z.string().cuid(),
    })
    .parse(req.body);

  const merged = await dupSvc.mergeDuplicates(
    req.params["id"] as string,
    primaryCandidateId,
    req.user!.id,
  );
  res.status(200).json({ data: merged });
}

/** PATCH /api/v1/duplicates/:id/resolve — Resolve a duplicate group */
export async function handleResolveDuplicateGroup(req: Request, res: Response): Promise<void> {
  const { action } = z
    .object({
      action: z.enum(["RESOLVED", "DISMISSED"]),
    })
    .parse(req.body);

  const group = await dupSvc.resolveDuplicateGroup(
    req.params["id"] as string,
    req.user!.id,
    action,
  );
  res.status(200).json({ group });
}
