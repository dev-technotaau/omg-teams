import { z } from "zod";
import * as targetSvc from "../services/target.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Targets Controller — Spec Section 23.9
// ──────────────────────────────────────────────

const createTargetSchema = z
  .object({
    /**
     * null / omitted = global default applied to recruiters with no
     * individual override (see target.service.getRecruiterActiveTargets).
     */
    recruiterId: z.string().min(1).nullable().optional(),
    targetType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    targetValue: z.number().int().positive(),
    effectiveFrom: z.string().min(1),
    effectiveTo: z.string().optional(),
  })
  .refine(
    (d) => {
      if (!d.effectiveTo) return true;
      const from = new Date(d.effectiveFrom);
      const to = new Date(d.effectiveTo);
      return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from;
    },
    { message: "effectiveTo must be on or after effectiveFrom", path: ["effectiveTo"] },
  );

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
      recruiterId: body.recruiterId ?? null,
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
  const clean: { targetValue?: number; effectiveTo?: string | null; isActive?: boolean } = {};
  if (body.targetValue !== undefined) clean.targetValue = body.targetValue;
  if (body.effectiveTo !== undefined) clean.effectiveTo = body.effectiveTo;
  if (body.isActive !== undefined) clean.isActive = body.isActive;
  const target = await targetSvc.updateTarget(req.params["id"] as string, clean);
  res.status(200).json({ data: target });
}

export async function handleDeleteTarget(req: Request, res: Response): Promise<void> {
  await targetSvc.deleteTarget(req.params["id"] as string);
  res.status(200).json({ message: "Target deactivated" });
}

/**
 * GET /targets/recruiter/:recruiterId — used by both admin (any
 * recruiter) and the recruiter's own /my-targets page.
 *
 * Recruiters can only fetch their own; RMs can fetch any of their
 * assigned recruiters; admins can fetch anyone.
 */
export async function handleGetRecruiterTargets(req: Request, res: Response): Promise<void> {
  const recruiterId = req.params["recruiterId"] as string;

  // Authorization: enforce scoping for non-admin callers
  if (req.user!.role === "RECRUITER" && req.user!.id !== recruiterId) {
    res.status(403).json({ error: "You can only view your own targets" });
    return;
  }
  if (req.user!.role === "REPORTING_MANAGER") {
    const { getPrisma } = await import("../config/database.js");
    const prisma = getPrisma();
    const isAssigned = await prisma.recruiterManagerAssignment.findFirst({
      where: { managerId: req.user!.id, recruiterId, removedAt: null },
      select: { id: true },
    });
    if (!isAssigned && req.user!.id !== recruiterId) {
      res.status(403).json({ error: "Recruiter is not assigned to you" });
      return;
    }
  }

  const targets = await targetSvc.getRecruiterTargetsWithAchievement(recruiterId);
  res.status(200).json({ data: targets });
}

/**
 * GET /targets/me — current user (recruiter) shortcut for the
 * /my-targets page so we don't have to expose the user id in the URL.
 */
export async function handleGetMyTargets(req: Request, res: Response): Promise<void> {
  const targets = await targetSvc.getRecruiterTargetsWithAchievement(req.user!.id);
  res.status(200).json({ data: targets });
}

/**
 * GET /targets/team — RM view of every assigned recruiter's targets.
 */
export async function handleGetTeamTargets(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== "REPORTING_MANAGER" && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Reporting Manager or Admin role required" });
    return;
  }
  const data = await targetSvc.getTeamTargetsForManager(req.user!.id);
  res.status(200).json({ data });
}
