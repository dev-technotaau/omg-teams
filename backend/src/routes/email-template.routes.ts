import { Router } from "express";
import {
  handleListTemplates,
  handleGetTemplate,
  handleUpdateTemplate,
  handleResetTemplate,
  handlePreviewTemplate,
} from "../controllers/email-template.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get("/", handleListTemplates);
router.get("/:key", handleGetTemplate);
router.put("/:key", handleUpdateTemplate);
router.delete("/:key/reset", handleResetTemplate);
router.post("/:key/preview", handlePreviewTemplate);

export { router as emailTemplateRouter };
