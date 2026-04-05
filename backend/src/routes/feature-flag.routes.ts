import { Router } from "express";
import { handleClientFlags, handleAllFlags } from "../controllers/feature-flag.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Public endpoint — no auth required (frontend checks before login)
router.get("/client", handleClientFlags);

// Admin only — see all flags
router.get("/", requireAuth, requireAdmin, handleAllFlags);

export { router as featureFlagRouter };
