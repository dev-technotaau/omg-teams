import { z } from "zod";
import * as leaveSvc from "../services/leave.service.js";
import type { Request, Response } from "express";

/** POST /api/v1/leaves — Submit leave request */
export async function handleSubmitLeave(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      leaveTypeId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      isHalfDay: z.boolean().optional(),
      halfDayPeriod: z.enum(["FIRST_HALF", "SECOND_HALF"]).nullable().optional(),
      reason: z.string().min(1),
      supportingDocumentUrl: z.string().nullable().optional(),
      emergencyContact: z.string().nullable().optional(),
    })
    .parse(req.body);

  const request = await leaveSvc.submitLeaveRequest({ ...body, userId: req.user!.id });
  res.status(201).json({ request });
}

/** GET /api/v1/leaves/my — Own leave requests */
export async function handleMyLeaves(req: Request, res: Response): Promise<void> {
  const requests = await leaveSvc.getUserLeaveRequests(req.user!.id);
  res.status(200).json({ requests });
}

/** GET /api/v1/leaves/balances — Own leave balances */
export async function handleMyBalances(req: Request, res: Response): Promise<void> {
  const year = req.query["year"] ? parseInt(req.query["year"] as string, 10) : undefined;
  const balances = await leaveSvc.getUserLeaveBalances(req.user!.id, year);
  res.status(200).json({ balances });
}

/** GET /api/v1/leaves/team — RM: team leave requests */
export async function handleTeamLeaves(req: Request, res: Response): Promise<void> {
  const { getPrisma } = await import("../lib/prisma.js");
  const prisma = getPrisma();
  const assignments = await prisma.recruiterManagerAssignment.findMany({
    where: { managerId: req.user!.id, removedAt: null },
    select: { recruiterId: true },
  });
  const recruiterIds = assignments.map((a) => a.recruiterId);
  recruiterIds.push(req.user!.id);

  const q = req.query;
  const result = await leaveSvc.listAllLeaveRequests({
    userIds: recruiterIds,
    status: q["status"] as Parameters<typeof leaveSvc.listAllLeaveRequests>[0]["status"],
    page: q["page"] ? parseInt(q["page"] as string, 10) : undefined,
    limit: q["limit"] ? parseInt(q["limit"] as string, 10) : undefined,
  });
  res.status(200).json(result);
}

/** GET /api/v1/leaves — Admin: all leave requests */
export async function handleListLeaves(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const result = await leaveSvc.listAllLeaveRequests({
    status: q["status"] as Parameters<typeof leaveSvc.listAllLeaveRequests>[0]["status"],
    userId: q["userId"] as string | undefined,
    page: q["page"] ? parseInt(q["page"] as string, 10) : undefined,
    limit: q["limit"] ? parseInt(q["limit"] as string, 10) : undefined,
  });
  res.status(200).json(result);
}

/** PATCH /api/v1/leaves/:id/approve — Admin approve */
export async function handleApproveLeave(req: Request, res: Response): Promise<void> {
  const request = await leaveSvc.approveLeave(req.params["id"] as string, req.user!.id);
  res.status(200).json({ request });
}

/** PATCH /api/v1/leaves/:id/reject — Admin reject */
export async function handleRejectLeave(req: Request, res: Response): Promise<void> {
  const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
  const request = await leaveSvc.rejectLeave(req.params["id"] as string, req.user!.id, reason);
  res.status(200).json({ request });
}

/** PATCH /api/v1/leaves/:id/cancel — Employee cancel own */
export async function handleCancelLeave(req: Request, res: Response): Promise<void> {
  const request = await leaveSvc.cancelLeave(req.params["id"] as string, req.user!.id);
  res.status(200).json({ request });
}

/** PATCH /api/v1/leaves/:id/revoke — Admin revoke approved leave */
export async function handleRevokeLeave(req: Request, res: Response): Promise<void> {
  const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
  const request = await leaveSvc.revokeLeave(req.params["id"] as string, req.user!.id, reason);
  res.status(200).json({ request });
}

/** GET /api/v1/leaves/balances/all — Admin: all employee balances */
export async function handleListAllBalances(req: Request, res: Response): Promise<void> {
  const year = req.query["year"] ? parseInt(req.query["year"] as string, 10) : undefined;
  const balances = await leaveSvc.listAllBalances(year);
  res.status(200).json({ balances });
}

/** POST /api/v1/leaves/balances/adjust — Admin: adjust employee balance */
export async function handleAdjustBalance(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      userId: z.string(),
      leaveTypeId: z.string(),
      year: z.number().int(),
      adjustment: z.number().int(),
      reason: z.string().min(1),
    })
    .parse(req.body);

  const balance = await leaveSvc.adjustBalance({ ...body, adjustedBy: req.user!.id });
  res.status(200).json({ balance });
}

/** POST /api/v1/leaves/balances/set-annual — Admin: set annual allotment */
export async function handleSetAnnualBalance(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      userId: z.string(),
      leaveTypeId: z.string(),
      year: z.number().int(),
      totalAllotted: z.number().int().min(0),
    })
    .parse(req.body);

  const balance = await leaveSvc.setAnnualBalance({ ...body, setBy: req.user!.id });
  res.status(200).json({ balance });
}

/** GET /api/v1/leaves/types — List leave types */
export async function handleListLeaveTypes(_req: Request, res: Response): Promise<void> {
  const types = await leaveSvc.listLeaveTypes();
  res.status(200).json({ types });
}
