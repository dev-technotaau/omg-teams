import { z } from "zod";
import * as attendanceSvc from "../services/attendance.service.js";
import type { Request, Response } from "express";

/** GET /api/v1/attendance/my — Own attendance */
export async function handleMyAttendance(req: Request, res: Response): Promise<void> {
  const dateFrom = req.query["dateFrom"] as string | undefined;
  const dateTo = req.query["dateTo"] as string | undefined;
  const records = await attendanceSvc.getUserAttendance(req.user!.id, dateFrom, dateTo);
  res.status(200).json({ records });
}

/** GET /api/v1/attendance — Admin: all attendance */
export async function handleListAttendance(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const result = await attendanceSvc.listAllAttendance({
    userId: q["userId"] as string | undefined,
    date: q["date"] as string | undefined,
    status: q["status"] as Parameters<typeof attendanceSvc.listAllAttendance>[0]["status"],
    managerId: q["managerId"] as string | undefined,
    page: q["page"] ? parseInt(q["page"] as string, 10) : undefined,
    limit: q["limit"] ? parseInt(q["limit"] as string, 10) : undefined,
  });
  res.status(200).json(result);
}

/** GET /api/v1/attendance/team — RM: team attendance */
export async function handleTeamAttendance(req: Request, res: Response): Promise<void> {
  const { getPrisma } = await import("../lib/prisma.js");
  const prisma = getPrisma();
  // Get recruiter IDs assigned to this RM
  const assignments = await prisma.recruiterManagerAssignment.findMany({
    where: { managerId: req.user!.id, removedAt: null },
    select: { recruiterId: true },
  });
  const recruiterIds = assignments.map((a) => a.recruiterId);
  // Include self
  recruiterIds.push(req.user!.id);

  const q = req.query;
  const result = await attendanceSvc.listAllAttendance({
    userIds: recruiterIds,
    date: (q["date"] as string) || new Date().toISOString().split("T")[0],
    page: q["page"] ? parseInt(q["page"] as string, 10) : undefined,
    limit: q["limit"] ? parseInt(q["limit"] as string, 10) : undefined,
  });
  res.status(200).json(result);
}

/** GET /api/v1/attendance/config — Admin: get all attendance config */
export async function handleGetConfig(_req: Request, res: Response): Promise<void> {
  const config = await attendanceSvc.getAllAttendanceConfig();
  res.status(200).json({ config });
}

/** PUT /api/v1/attendance/config/:key — Admin: update attendance config */
export async function handleUpdateConfig(req: Request, res: Response): Promise<void> {
  const key = req.params["key"] as string;
  const body = z.object({ value: z.string() }).parse(req.body);
  await attendanceSvc.updateAttendanceConfig(key, body.value);
  res.status(200).json({ message: "Config updated" });
}

/** PATCH /api/v1/attendance/:id — Admin: edit attendance */
export async function handleEditAttendance(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      punchInTime: z.string().optional(),
      punchOutTime: z.string().optional(),
      status: z
        .enum([
          "PRESENT_FULL",
          "PRESENT_HALF",
          "LATE",
          "ABSENT",
          "INCOMPLETE",
          "ON_LEAVE",
          "HOLIDAY",
          "WEEKEND",
          "OVERTIME",
        ])
        .optional(),
      remarks: z.string().optional(),
    })
    .parse(req.body);

  const record = await attendanceSvc.editAttendance(req.params["id"] as string, req.user!.id, body);
  res.status(200).json({ record });
}
