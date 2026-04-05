import { Router } from "express";
import { handleListAuditLogs, handleExportAuditLogs } from "../controllers/audit.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/export", handleExportAuditLogs);
router.get("/", handleListAuditLogs);

export { router as auditRouter };
