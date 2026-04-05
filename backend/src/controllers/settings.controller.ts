import { z } from "zod";
import * as settingsSvc from "../services/settings.service.js";
import type { Request, Response } from "express";

/** GET /api/v1/settings */
export async function handleGetSettings(_req: Request, res: Response): Promise<void> {
  const settings = await settingsSvc.getAllSettings();
  res.status(200).json({ settings });
}

/** GET /api/v1/settings/:key */
export async function handleGetSetting(req: Request, res: Response): Promise<void> {
  const setting = await settingsSvc.getSetting(req.params["key"] as string);
  res.status(200).json({ setting });
}

/** PUT /api/v1/settings/:key */
export async function handleUpdateSetting(req: Request, res: Response): Promise<void> {
  const { value } = z.object({ value: z.unknown() }).parse(req.body);
  const setting = await settingsSvc.updateSetting(req.params["key"] as string, value, req.user!.id);
  res.status(200).json({ setting });
}
