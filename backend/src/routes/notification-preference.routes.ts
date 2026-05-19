import { Router } from "express";
import {
  getMyPreferences,
  updateMyPreference,
  updateMyPreferences,
  getQuietHours,
  updateQuietHours,
} from "../controllers/notification-preference.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/preferences", getMyPreferences);
router.patch("/preferences/:category", updateMyPreference);
router.put("/preferences", updateMyPreferences);

// §11.5 — Quiet hours window (HH:mm). Both null = disabled.
router.get("/quiet-hours", getQuietHours);
router.patch("/quiet-hours", updateQuietHours);

export { router as notificationPreferenceRouter };
