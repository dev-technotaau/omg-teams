import { Router } from "express";
import {
  getMyPreferences,
  updateMyPreference,
  updateMyPreferences,
} from "../controllers/notification-preference.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/preferences", getMyPreferences);
router.patch("/preferences/:category", updateMyPreference);
router.put("/preferences", updateMyPreferences);

export { router as notificationPreferenceRouter };
