import { Router } from "express";
import {
  handleGenerateReport,
  handleReportHistory,
  handleListSchedules,
  handleCreateSchedule,
  handleUpdateSchedule,
  handleDeleteSchedule,
} from "../controllers/report.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.post("/generate", handleGenerateReport);
router.get("/history", handleReportHistory);
router.get("/schedules", handleListSchedules);
router.post("/schedules", handleCreateSchedule);
router.patch("/schedules/:id", handleUpdateSchedule);
router.delete("/schedules/:id", handleDeleteSchedule);

export { router as reportRouter };
