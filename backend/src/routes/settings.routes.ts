import { Router } from "express";
import { z } from "zod";
import {
  handleGetSettings,
  handleGetSetting,
  handleUpdateSetting,
} from "../controllers/settings.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  enableMaintenance,
  disableMaintenance,
  getMaintenanceStatus,
} from "../middleware/maintenance.js";
import type { Request, Response } from "express";

const router = Router();
router.use(requireAuth, requireAdmin);

// ──────────────────────────────────────────────
//  Maintenance mode toggle (§24.18)
//  Supports custom message + estimated return time
// ──────────────────────────────────────────────

router.get("/maintenance", async (_req: Request, res: Response) => {
  const status = await getMaintenanceStatus();
  res.json(status);
});

router.post("/maintenance/enable", async (req: Request, res: Response) => {
  const body = z
    .object({
      message: z.string().optional(),
      estimatedReturnTime: z.string().optional(),
    })
    .parse(req.body);

  await enableMaintenance({
    message: body.message,
    estimatedReturnTime: body.estimatedReturnTime,
  });

  // §11.4 — Notify all non-admin employees of maintenance mode
  try {
    const { onMaintenanceMode } = await import("../services/notification-triggers.js");
    void onMaintenanceMode(body.estimatedReturnTime ?? "shortly");
  } catch {
    /* non-critical */
  }

  res.json({
    message: "Maintenance mode enabled",
    maintenance: true,
    customMessage: body.message ?? null,
    estimatedReturnTime: body.estimatedReturnTime ?? null,
  });
});

router.post("/maintenance/disable", async (_req: Request, res: Response) => {
  await disableMaintenance();
  res.json({ message: "Maintenance mode disabled", maintenance: false });
});

// ──────────────────────────────────────────────
//  Platform settings CRUD
// ──────────────────────────────────────────────

router.get("/", handleGetSettings);
router.get("/:key", handleGetSetting);
router.put("/:key", handleUpdateSetting);

export { router as settingsRouter };
