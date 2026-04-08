import { Router } from "express";
import {
  handleListSessions,
  handleRevokeAllSessions,
  handleRevokeSession,
  handleRevokeUserSessions,
} from "../controllers/session-admin.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get("/", handleListSessions);
// Order matters: more specific routes (/user/:userId) and the bare
// "delete all" must come BEFORE the catch-all "/:id" so they don't
// get swallowed.
router.delete("/", handleRevokeAllSessions);
router.delete("/user/:userId", handleRevokeUserSessions);
router.delete("/:id", handleRevokeSession);

export { router as sessionAdminRouter };
