import { Router } from "express";
import {
  handleListLoginHistory,
  handleListUserNotifications,
  handleGetAuthMethods,
  handleListLeaveBalanceHistory,
  handleListDocumentHistory,
  handleGetUserPresence,
  handleListPasswordHistory,
  handleListWebhookSubscriptions,
  handleCreateWebhookSubscription,
  handleUpdateWebhookSubscription,
  handleDeleteWebhookSubscription,
  handleListTablePreferences,
  handleListFilterPresets,
  handleListImpersonationSessions,
  handleStartImpersonation,
  handleEndImpersonation,
  handleListUserArchivedRecords,
  handleForceLogoutUser,
  handleResetMfa,
  handleGetGodviewSummary,
} from "../controllers/godview.controller.js";
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

// ── §Godview — per-user administrative data ─────────────────────
router.get("/:id/godview-summary", handleGetGodviewSummary);
router.get("/:id/presence", handleGetUserPresence);
router.get("/:id/login-history", handleListLoginHistory);
router.get("/:id/notifications", handleListUserNotifications);
router.get("/:id/auth-methods", handleGetAuthMethods);
router.get("/:id/leave-balance-history", handleListLeaveBalanceHistory);
router.get("/:id/document-history", handleListDocumentHistory);
router.get("/:id/password-history", handleListPasswordHistory);
router.get("/:id/table-preferences", handleListTablePreferences);
router.get("/:id/filter-presets", handleListFilterPresets);
router.get("/:id/archive-entries", handleListUserArchivedRecords);
router.post("/:id/force-logout", handleForceLogoutUser);
router.post("/:id/reset-mfa", handleResetMfa);

// Webhook subscriptions (per-user)
router.get("/:id/webhook-subscriptions", handleListWebhookSubscriptions);
router.post("/:id/webhook-subscriptions", handleCreateWebhookSubscription);
router.patch("/:id/webhook-subscriptions/:subscriptionId", handleUpdateWebhookSubscription);
router.delete("/:id/webhook-subscriptions/:subscriptionId", handleDeleteWebhookSubscription);

// Impersonation
router.get("/:id/impersonation-sessions", handleListImpersonationSessions);
router.post("/:id/impersonate", handleStartImpersonation);
router.post("/:id/impersonate/:impersonationId/end", handleEndImpersonation);

export { router as userRouter };
