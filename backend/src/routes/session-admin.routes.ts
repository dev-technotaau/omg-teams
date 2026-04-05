import { Router } from "express";
import {
  handleListSessions,
  handleRevokeSession,
  handleRevokeUserSessions,
} from "../controllers/session-admin.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get("/", handleListSessions);
router.delete("/:id", handleRevokeSession);
router.delete("/user/:userId", handleRevokeUserSessions);

export { router as sessionAdminRouter };
