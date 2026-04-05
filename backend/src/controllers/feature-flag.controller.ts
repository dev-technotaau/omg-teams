import { getAllFlags, invalidateCache } from "../config/feature-flags.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Feature Flags Controller
//
//  Client-visible flags for maintenance mode detection
// ──────────────────────────────────────────────

const CLIENT_VISIBLE_FLAGS = ["maintenanceMode", "maintenanceMessage", "maintenanceReturnTime"];

/** GET /api/v1/feature-flags/client — public, returns only client-visible flags */
export async function handleClientFlags(req: Request, res: Response): Promise<void> {
  const force = req.query["fresh"] === "true";
  if (force) invalidateCache();

  const allFlags = await getAllFlags(force);

  const clientFlags: Record<string, unknown> = {};
  for (const key of CLIENT_VISIBLE_FLAGS) {
    if (key in allFlags) clientFlags[key] = allFlags[key];
  }

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).json({ data: clientFlags });
}

/** GET /api/v1/feature-flags — admin only, all flags */
export async function handleAllFlags(req: Request, res: Response): Promise<void> {
  const force = req.query["fresh"] === "true";
  if (force) invalidateCache();

  const flags = await getAllFlags(force);
  res.status(200).json({ data: flags });
}
