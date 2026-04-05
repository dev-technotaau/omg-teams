import { Router } from "express";
import {
  handleCheckDuplicates,
  handleListDuplicateGroups,
  handleMergeDuplicates,
  handleResolveDuplicateGroup,
} from "../controllers/duplicate.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/check", handleCheckDuplicates);
router.get("/", requireAdmin, handleListDuplicateGroups);
router.post("/:id/merge", requireAdmin, handleMergeDuplicates);
router.patch("/:id/resolve", requireAdmin, handleResolveDuplicateGroup);

export { router as duplicateRouter };
