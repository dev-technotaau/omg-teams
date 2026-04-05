import { Router } from "express";
import {
  handleSaveDraft,
  handleGetDraft,
  handleDeleteDraft,
} from "../controllers/draft.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.put("/", handleSaveDraft);
router.get("/", handleGetDraft);
router.delete("/", handleDeleteDraft);

export { router as draftRouter };
