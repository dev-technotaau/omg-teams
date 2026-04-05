import { Router } from "express";
import {
  handleListArchive,
  handleArchiveStats,
  handleRestoreArchive,
  handleDeleteArchive,
  handleRunArchiving,
} from "../controllers/archive.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", handleListArchive);
router.get("/stats", handleArchiveStats);
router.post("/run", handleRunArchiving);
router.post("/:id/restore", handleRestoreArchive);
router.delete("/:id", handleDeleteArchive);

export { router as archiveRouter };
