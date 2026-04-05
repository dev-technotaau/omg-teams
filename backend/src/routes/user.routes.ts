import { Router } from "express";
import {
  handleCreateUser,
  handleListUsers,
  handleGetUser,
  handleUpdateUser,
  handleSuspendUser,
  handleReactivateUser,
  handleDeleteUser,
  handleResetPassword,
  handleAssignManager,
  handleRemoveManager,
  handleResetDevice,
  handleGetDeviceInfo,
  handleReactivateWithDeviceReset,
  handleUnlockAccount,
  handleGenerateBackupCodes,
  handleGetBackupCodeStatus,
  handleGetEmployeePassword,
  handleGetTeamMember,
} from "../controllers/user.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  User Management Routes — /api/v1/users
// ──────────────────────────────────────────────

const router = Router();

router.use(requireAuth);

// §7 — RM can view assigned recruiter detail (before requireAdmin)
router.get("/:id/team-view", handleGetTeamMember);

// All remaining endpoints require Admin role
router.use(requireAdmin);

router.post("/", handleCreateUser);
router.get("/", handleListUsers);
router.get("/:id", handleGetUser);
router.patch("/:id", handleUpdateUser);
router.patch("/:id/suspend", handleSuspendUser);
router.patch("/:id/reactivate", handleReactivateUser);
router.delete("/:id", handleDeleteUser);
router.patch("/:id/reset-password", handleResetPassword);
router.post("/:id/assign-manager", handleAssignManager);
router.delete("/:id/remove-manager/:managerId", handleRemoveManager);
router.post("/:id/reset-device", handleResetDevice);
router.get("/:id/device-info", handleGetDeviceInfo);
router.post("/:id/reactivate-with-device-reset", handleReactivateWithDeviceReset);
router.post("/:id/unlock", handleUnlockAccount);
router.post("/:id/backup-codes", handleGenerateBackupCodes);
router.get("/:id/backup-codes/status", handleGetBackupCodeStatus);
router.post("/:id/password", handleGetEmployeePassword);

export { router as userRouter };
