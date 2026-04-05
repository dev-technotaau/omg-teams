import { Router } from "express";
import {
  handleSubmitLeave,
  handleMyLeaves,
  handleMyBalances,
  handleTeamLeaves,
  handleListLeaves,
  handleApproveLeave,
  handleRejectLeave,
  handleCancelLeave,
  handleRevokeLeave,
  handleListLeaveTypes,
  handleListAllBalances,
  handleAdjustBalance,
  handleSetAnnualBalance,
} from "../controllers/leave.controller.js";
import { requireAuth, requireAdmin, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/types", handleListLeaveTypes);
router.post("/", handleSubmitLeave);
router.get("/my", handleMyLeaves);
router.get("/balances", handleMyBalances);
router.get("/balances/all", requireAdmin, handleListAllBalances);
router.post("/balances/adjust", requireAdmin, handleAdjustBalance);
router.post("/balances/set-annual", requireAdmin, handleSetAnnualBalance);
router.get("/team", requireRole("REPORTING_MANAGER", "ADMIN"), handleTeamLeaves);
router.get("/", requireAdmin, handleListLeaves);
router.patch("/:id/approve", requireAdmin, handleApproveLeave);
router.patch("/:id/reject", requireAdmin, handleRejectLeave);
router.patch("/:id/revoke", requireAdmin, handleRevokeLeave);
router.patch("/:id/cancel", handleCancelLeave);

export { router as leaveRouter };
