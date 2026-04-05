import { Router } from "express";
import {
  handleGetNotifications,
  handleGetUnreadCount,
  handleMarkAsRead,
  handleMarkAsUnread,
  handleMarkAllAsRead,
  handleClearNotification,
  handleClearAll,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", handleGetNotifications);
router.get("/unread-count", handleGetUnreadCount);
router.patch("/:id/read", handleMarkAsRead);
router.patch("/:id/unread", handleMarkAsUnread);
router.patch("/read-all", handleMarkAllAsRead);
router.delete("/:id", handleClearNotification);
router.delete("/clear-all", handleClearAll);

export { router as notificationRouter };
