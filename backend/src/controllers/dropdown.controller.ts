import { z } from "zod";
import * as dropdownSvc from "../services/dropdown.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Dropdown Options Controller (Admin Master Data)
// ──────────────────────────────────────────────

const categoryEnum = z.enum([
  "STATE",
  "LOCATION",
  "PROFILE",
  "QUALIFICATION",
  "NOTICE_PERIOD",
  "DIPLOMA",
  "CUSTOM",
]);
const zoneSetEnum = z.enum(["SET_A", "SET_B", "ALL"]).nullable().optional();

export async function handleListDropdownOptions(req: Request, res: Response): Promise<void> {
  const category = categoryEnum.parse(req.params["category"]);
  const zoneSet = req.query["zoneSet"] as string | undefined;
  const options = await dropdownSvc.listDropdownOptions(
    category,
    zoneSet as "SET_A" | "SET_B" | "ALL" | undefined,
  );
  res.status(200).json({ options });
}

export async function handleCreateDropdownOption(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      category: categoryEnum,
      value: z.string().trim().min(1),
      label: z.string().trim().min(1),
      zoneSet: zoneSetEnum,
      sortOrder: z.number().int().optional(),
    })
    .parse(req.body);
  const option = await dropdownSvc.createDropdownOption(body);
  res.status(201).json({ option });
}

export async function handleUpdateDropdownOption(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      value: z.string().trim().min(1).optional(),
      label: z.string().trim().min(1).optional(),
      zoneSet: zoneSetEnum,
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .parse(req.body);
  const option = await dropdownSvc.updateDropdownOption(req.params["id"] as string, body);
  res.status(200).json({ option });
}

export async function handleDeleteDropdownOption(req: Request, res: Response): Promise<void> {
  await dropdownSvc.deleteDropdownOption(req.params["id"] as string);
  res.status(200).json({ message: "Dropdown option deactivated" });
}

export async function handleReorderDropdownOptions(req: Request, res: Response): Promise<void> {
  const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body);
  await dropdownSvc.reorderDropdownOptions(ids);
  res.status(200).json({ message: "Options reordered" });
}
