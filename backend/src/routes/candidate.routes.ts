import { Router } from "express";
import {
  handleCreateCandidate,
  handleListCandidates,
  handleGetCandidate,
  handleUpdateCandidate,
  handleDeleteCandidate,
  handleNextInvoice,
  handleExportCandidates,
  handleStatsByRecruiter,
} from "../controllers/candidate.controller.js";
import { handleUpdateStage, handleGetStageHistory } from "../controllers/pipeline.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Candidate Report Routes — /api/v1/candidates
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

router.post("/", handleCreateCandidate);
router.get("/", handleListCandidates);
router.get("/next-invoice", requireAdmin, handleNextInvoice);
router.get("/export", requireAdmin, handleExportCandidates);
router.get("/stats/by-recruiter", handleStatsByRecruiter);
router.get("/:id", handleGetCandidate);
router.patch("/:id", requireAdmin, handleUpdateCandidate);
router.delete("/:id", requireAdmin, handleDeleteCandidate);

// Pipeline stage
router.patch("/:id/stage", requireAdmin, handleUpdateStage);
router.get("/:id/stage-history", handleGetStageHistory);

export { router as candidateRouter };
