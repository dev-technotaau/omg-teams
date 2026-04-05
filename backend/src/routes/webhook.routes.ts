import { Router } from "express";
import {
  handleListWebhooks,
  handleListEvents,
  handleCreateWebhook,
  handleUpdateWebhook,
  handleDeleteWebhook,
  handleTestWebhook,
  handleRotateSecret,
} from "../controllers/webhook.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Webhook Routes — /api/v1/webhooks
//  Admin-only CRUD for webhook endpoints
// ──────────────────────────────────────────────

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", handleListWebhooks);
router.get("/events", handleListEvents);
router.post("/", handleCreateWebhook);
router.patch("/:id", handleUpdateWebhook);
router.delete("/:id", handleDeleteWebhook);
router.post("/:id/test", handleTestWebhook);
router.post("/:id/rotate-secret", handleRotateSecret);

export { router as webhookRouter };
