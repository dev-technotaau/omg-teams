import { Router } from "express";
import {
  handleDashboardStats,
  handleRMTeamSnapshot,
  handleAdminDashboardStats,
  handleMonthlyAttendance,
  handleDailyTrend,
  handleStatusBreakdown,
  handleExtendedDashboard,
} from "../controllers/dashboard.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Dashboard Routes — /api/v1/dashboard
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

router.get("/stats", handleDashboardStats);
router.get("/rm-team-snapshot", requireRole("REPORTING_MANAGER"), handleRMTeamSnapshot);
router.get("/admin-stats", requireRole("ADMIN"), handleAdminDashboardStats);
router.get("/monthly-attendance", requireRole("ADMIN"), handleMonthlyAttendance);
router.get("/daily-trend", handleDailyTrend);
router.get("/status-breakdown", handleStatusBreakdown);
router.get("/extended", handleExtendedDashboard);

export { router as dashboardRouter };
