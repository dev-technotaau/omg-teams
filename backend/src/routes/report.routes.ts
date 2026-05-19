import { Router } from "express";
import {
  handleGenerateReport,
  handleReportHistory,
  handleListSchedules,
  handleCreateSchedule,
  handleUpdateSchedule,
  handleDeleteSchedule,
  handleGetColumnsRegistry,
  handleGetDefaultColumns,
  handleListTemplates,
  handleGetTemplate,
  handleCreateTemplate,
  handleUpdateTemplate,
  handleDeleteTemplate,
} from "../controllers/report.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.post("/generate", handleGenerateReport);
router.get("/history", handleReportHistory);

// Column registry — feeds the Generate/Schedule column picker UI
router.get("/columns", handleGetColumnsRegistry);
router.get("/columns/defaults", handleGetDefaultColumns);

// Templates (column selection + filter presets)
router.get("/templates", handleListTemplates);
router.post("/templates", handleCreateTemplate);
router.get("/templates/:id", handleGetTemplate);
router.patch("/templates/:id", handleUpdateTemplate);
router.delete("/templates/:id", handleDeleteTemplate);

router.get("/schedules", handleListSchedules);
router.post("/schedules", handleCreateSchedule);
router.patch("/schedules/:id", handleUpdateSchedule);
router.delete("/schedules/:id", handleDeleteSchedule);

export { router as reportRouter };
