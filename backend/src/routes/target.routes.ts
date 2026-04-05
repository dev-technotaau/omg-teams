import { Router } from "express";
import {
  handleListTargets,
  handleCreateTarget,
  handleUpdateTarget,
  handleDeleteTarget,
  handleGetRecruiterTargets,
} from "../controllers/target.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", requireAdmin, handleListTargets);
router.post("/", requireAdmin, handleCreateTarget);
router.patch("/:id", requireAdmin, handleUpdateTarget);
router.delete("/:id", requireAdmin, handleDeleteTarget);
router.get("/recruiter/:recruiterId", handleGetRecruiterTargets);

export { router as targetRouter };
