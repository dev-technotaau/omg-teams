import { z } from "zod";
import * as targetSvc from "../services/target.service.js";
import type { Request, Response } from "express";

const createTargetSchema = z.object({
  recruiterId: z.string().min(1),
  targetType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  targetValue: z.number().int().positive(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
});

const updateTargetSchema = z.object({
  targetValue: z.number().int().positive().optional(),
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function handleListTargets(req: Request, res: Response): Promise<void> {
  const recruiterId = req.query["recruiterId"] as string | undefined;
  const isActiveParam = req.query["isActive"] as string | undefined;
  const filters = {
    ...(recruiterId !== undefined && { recruiterId }),
    ...(isActiveParam !== undefined && { isActive: isActiveParam === "true" }),
  };
  const targets = await targetSvc.listTargets(filters);
  res.status(200).json({ data: targets });
}

export async function handleCreateTarget(req: Request, res: Response): Promise<void> {
  const body = createTargetSchema.parse(req.body);
  const target = await targetSvc.createTarget(
    {
      recruiterId: body.recruiterId,
      targetType: body.targetType,
      targetValue: body.targetValue,
      effectiveFrom: body.effectiveFrom,
      ...(body.effectiveTo ? { effectiveTo: body.effectiveTo } : {}),
    },
    req.user!.id,
  );
  res.status(201).json({ data: target });
}

export async function handleUpdateTarget(req: Request, res: Response): Promise<void> {
  const body = updateTargetSchema.parse(req.body);
  const clean: Record<string, unknown> = {};
  if (body.targetValue !== undefined) clean["targetValue"] = body.targetValue;
  if (body.effectiveTo !== undefined) clean["effectiveTo"] = body.effectiveTo;
  if (body.isActive !== undefined) clean["isActive"] = body.isActive;
  const target = await targetSvc.updateTarget(req.params["id"] as string, clean);
  res.status(200).json({ data: target });
}

export async function handleDeleteTarget(req: Request, res: Response): Promise<void> {
  await targetSvc.deleteTarget(req.params["id"] as string);
  res.status(200).json({ message: "Target deactivated" });
}

export async function handleGetRecruiterTargets(req: Request, res: Response): Promise<void> {
  const targets = await targetSvc.getRecruiterActiveTargets(req.params["recruiterId"] as string);
  const achievements = await Promise.all(
    targets.map(async (t) => ({
      ...t,
      achieved: await targetSvc.getTargetAchievement(
        t.recruiterId ?? (req.params["recruiterId"] as string),
        t.targetType,
      ),
    })),
  );
  res.status(200).json({ data: achievements });
}
