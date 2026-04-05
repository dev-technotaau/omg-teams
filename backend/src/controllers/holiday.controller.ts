import { z } from "zod";
import * as holidaySvc from "../services/holiday.service.js";
import type { Request, Response } from "express";

const holidaySchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(["NATIONAL", "REGIONAL", "CUSTOM"]).optional(),
  isRecurring: z.boolean().optional(),
});

export async function handleListHolidays(req: Request, res: Response): Promise<void> {
  const year = req.query["year"] ? parseInt(req.query["year"] as string, 10) : undefined;
  const holidays = await holidaySvc.listHolidays(year);
  res.status(200).json({ data: holidays });
}

export async function handleCreateHoliday(req: Request, res: Response): Promise<void> {
  const body = holidaySchema.parse(req.body);
  const holiday = await holidaySvc.createHoliday(
    {
      date: body.date,
      name: body.name,
      ...(body.type ? { type: body.type } : {}),
      ...(body.isRecurring !== undefined ? { isRecurring: body.isRecurring } : {}),
    },
    req.user!.id,
  );
  res.status(201).json({ data: holiday });
}

export async function handleUpdateHoliday(req: Request, res: Response): Promise<void> {
  const body = holidaySchema.partial().parse(req.body);
  const clean: Record<string, unknown> = {};
  if (body.date !== undefined) clean["date"] = body.date;
  if (body.name !== undefined) clean["name"] = body.name;
  if (body.type !== undefined) clean["type"] = body.type;
  if (body.isRecurring !== undefined) clean["isRecurring"] = body.isRecurring;
  const holiday = await holidaySvc.updateHoliday(req.params["id"] as string, clean);
  res.status(200).json({ data: holiday });
}

export async function handleDeleteHoliday(req: Request, res: Response): Promise<void> {
  await holidaySvc.deleteHoliday(req.params["id"] as string);
  res.status(200).json({ message: "Holiday deleted" });
}
