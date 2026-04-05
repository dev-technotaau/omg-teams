import { Router } from "express";
import {
  handleListTrash,
  handleRestore,
  handlePermanentDelete,
} from "../controllers/trash.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", handleListTrash);
router.post("/restore", handleRestore);
router.post("/permanent-delete", handlePermanentDelete);

export { router as trashRouter };
