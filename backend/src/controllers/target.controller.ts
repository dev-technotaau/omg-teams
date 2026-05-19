import { z } from "zod";
import * as targetSvc from "../services/target.service.js";
import { logAudit, listAuditLogs } from "../services/audit.service.js";
import type { Request, Response } from "express";

// §23.1 — entity type used in audit_logs for recruiter target rows.
// Used by both the write side (logAudit calls) and the read side
// (history endpoint filter). Keep in sync.
const TARGET_ENTITY_TYPE = "RecruiterTarget";

/** Compute the diff between two row snapshots for the audit `changes` field. */
function diffRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): Record<string, { old: unknown; new: unknown }> | null {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const f of fields) {
    const a = before[f];
    const b = after[f];
    const aVal = a instanceof Date ? a.toISOString() : a;
    const bVal = b instanceof Date ? b.toISOString() : b;
    if (aVal !== bVal) diff[f] = { old: aVal, new: bVal };
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

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
  /** Only allowed when target is SCHEDULED (see service guard). */
  effectiveFrom: z.string().min(1).optional(),
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function handleListTargets(req: Request, res: Response): Promise<void> {
  const recruiterId = req.query["recruiterId"] as string | undefined;
  const isActiveParam = req.query["isActive"] as string | undefined;
  const effectiveStatus = req.query["effectiveStatus"] as string | undefined;
  const endingWithinDaysParam = req.query["endingWithinDays"] as string | undefined;

  const VALID_EFFECTIVE_STATUSES = ["ACTIVE", "SCHEDULED", "EXPIRED", "INACTIVE"] as const;
  type ValidEffectiveStatus = (typeof VALID_EFFECTIVE_STATUSES)[number];

  const filters: Parameters<typeof targetSvc.listTargets>[0] = {
    ...(recruiterId !== undefined && { recruiterId }),
    ...(isActiveParam !== undefined && { isActive: isActiveParam === "true" }),
    ...(effectiveStatus && (VALID_EFFECTIVE_STATUSES as readonly string[]).includes(effectiveStatus)
      ? { effectiveStatus: effectiveStatus as ValidEffectiveStatus }
      : {}),
    ...(endingWithinDaysParam !== undefined && !Number.isNaN(Number(endingWithinDaysParam))
      ? { endingWithinDays: Number(endingWithinDaysParam) }
      : {}),
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

  // §23.1 — Audit: record creation so the per-target history view can show it.
  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "CREATE",
    entityType: TARGET_ENTITY_TYPE,
    entityId: target.id,
    changes: {
      targetType: { old: null, new: target.targetType },
      targetValue: { old: null, new: target.targetValue },
      recruiterId: { old: null, new: target.recruiterId },
      effectiveFrom: { old: null, new: target.effectiveFrom.toISOString() },
      effectiveTo: { old: null, new: target.effectiveTo?.toISOString() ?? null },
    },
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  res.status(201).json({ data: target });
}

export async function handleUpdateTarget(req: Request, res: Response): Promise<void> {
  const body = updateTargetSchema.parse(req.body);
  const clean: {
    targetValue?: number;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    isActive?: boolean;
  } = {};
  if (body.targetValue !== undefined) clean.targetValue = body.targetValue;
  if (body.effectiveFrom !== undefined) clean.effectiveFrom = body.effectiveFrom;
  if (body.effectiveTo !== undefined) clean.effectiveTo = body.effectiveTo;
  if (body.isActive !== undefined) clean.isActive = body.isActive;
  const { existing, updated } = await targetSvc.updateTarget(req.params["id"] as string, clean);

  // §23.1 — Audit only the actual diff. Service returns both snapshots
  // so we don't have to refetch.
  const changes = diffRows(
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>,
    ["targetValue", "effectiveFrom", "effectiveTo", "isActive"],
  );
  if (changes) {
    logAudit({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: "UPDATE",
      entityType: TARGET_ENTITY_TYPE,
      entityId: updated.id,
      changes,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
  }

  res.status(200).json({ data: updated });
}

export async function handleDeleteTarget(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  await targetSvc.deleteTarget(id);

  // §23.1 — Treated as a "soft delete" (sets isActive=false). Log as DELETE
  // so the history clearly shows the deactivation event distinct from a
  // normal UPDATE that flipped isActive.
  logAudit({
    userId: req.user!.id,
    userRole: req.user!.role,
    action: "DELETE",
    entityType: TARGET_ENTITY_TYPE,
    entityId: id,
    changes: { isActive: { old: true, new: false } },
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  res.status(200).json({ message: "Target deactivated" });
}

/**
 * GET /targets/:id/history — §23.9 + §23.1
 * Returns the audit-log timeline for a single target row.
 */
export async function handleGetTargetHistory(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const result = await listAuditLogs({
    entityType: TARGET_ENTITY_TYPE,
    entityId: id,
    page: 1,
    limit: 100,
  });
  res.status(200).json({ data: result.data });
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
