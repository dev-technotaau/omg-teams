import { Router } from "express";
import {
  handleMyAttendance,
  handleTeamAttendance,
  handleListAttendance,
  handleEditAttendance,
  handleGetConfig,
  handleUpdateConfig,
} from "../controllers/attendance.controller.js";
import { requireAuth, requireAdmin, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/my", handleMyAttendance);
router.get("/team", requireRole("REPORTING_MANAGER", "ADMIN"), handleTeamAttendance);
router.get("/config", requireAdmin, handleGetConfig);
router.put("/config/:key", requireAdmin, handleUpdateConfig);
router.get("/", requireAdmin, handleListAttendance);
router.patch("/:id", requireAdmin, handleEditAttendance);

export { router as attendanceRouter };
