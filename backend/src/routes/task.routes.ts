import { Router } from "express";
import {
  handleCreateTask,
  handleListTasksAdmin,
  handleAdminTaskStats,
  handleGetTask,
  handleUpdateTask,
  handleReassignTask,
  handleCancelTask,
  handleDeleteTask,
  handleTaskHistory,
  handleDecideAssignment,
  handleListMyTasks,
  handleMyOpenTaskCount,
  handleSubmitTask,
  handleGetUserTaskMetrics,
} from "../controllers/task.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Task Routes — /api/v1/tasks (§Task)
//
//  Order matters — literal segments before :param.
//  /me, /me/open-count, /stats, /user-metrics/:userId, /assignments/...
//  must register BEFORE /:id so they aren't shadowed.
// ──────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

// ── Employee (any authenticated role can call /me) ────────────
router.get("/me", handleListMyTasks);
router.get("/me/open-count", handleMyOpenTaskCount);
router.post("/:id/submit", handleSubmitTask);

// ── Admin: review decisions ───────────────────────────────────
router.post("/assignments/:assignmentId/decision", requireAdmin, handleDecideAssignment);

// ── Admin: aggregate stats + per-user metrics ─────────────────
router.get("/stats", requireAdmin, handleAdminTaskStats);
router.get("/user-metrics/:userId", requireAdmin, handleGetUserTaskMetrics);

// ── Admin: CRUD + actions ─────────────────────────────────────
router.post("/", requireAdmin, handleCreateTask);
router.get("/", requireAdmin, handleListTasksAdmin);
router.patch("/:id", requireAdmin, handleUpdateTask);
router.patch("/:id/reassign", requireAdmin, handleReassignTask);
router.patch("/:id/cancel", requireAdmin, handleCancelTask);
router.delete("/:id", requireAdmin, handleDeleteTask);
router.get("/:id/history", requireAdmin, handleTaskHistory);

// ── Read-only detail (admin or any assignee) ──────────────────
router.get("/:id", handleGetTask);

export { router as taskRouter };
