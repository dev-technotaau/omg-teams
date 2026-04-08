import { Router } from "express";
import {
  handleListTargets,
  handleCreateTarget,
  handleUpdateTarget,
  handleDeleteTarget,
  handleGetRecruiterTargets,
  handleGetMyTargets,
  handleGetTeamTargets,
} from "../controllers/target.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Admin CRUD
router.get("/", requireAdmin, handleListTargets);
router.post("/", requireAdmin, handleCreateTarget);
router.patch("/:id", requireAdmin, handleUpdateTarget);
router.delete("/:id", requireAdmin, handleDeleteTarget);

// Recruiter / RM views — order matters: literal segments before :param
router.get("/me", handleGetMyTargets);
router.get("/team", handleGetTeamTargets);
router.get("/recruiter/:recruiterId", handleGetRecruiterTargets);

export { router as targetRouter };
