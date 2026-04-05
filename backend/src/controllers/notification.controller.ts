import * as notifSvc from "../services/notification.service.js";
import type { Request, Response } from "express";

/** GET /api/v1/notifications */
export async function handleGetNotifications(req: Request, res: Response): Promise<void> {
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : 1;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 20;
  const category = req.query["category"] as string | undefined;
  const readFilter = req.query["readFilter"] as string | undefined; // "read" | "unread"
  const search = req.query["search"] as string | undefined;
  const unreadOnly = req.query["unreadOnly"] === "true";

  const opts: Parameters<typeof notifSvc.getUserNotifications>[1] = { page, limit };
  if (category) opts.category = category;
  if (unreadOnly) opts.readFilter = "unread";
  else if (readFilter) opts.readFilter = readFilter;
  if (search) opts.search = search;

  const result = await notifSvc.getUserNotifications(req.user!.id, opts);
  res.status(200).json(result);
}

/** GET /api/v1/notifications/unread-count */
export async function handleGetUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await notifSvc.getUnreadCount(req.user!.id);
  res.status(200).json({ unreadCount: count });
}

/** PATCH /api/v1/notifications/:id/read */
export async function handleMarkAsRead(req: Request, res: Response): Promise<void> {
  await notifSvc.markAsRead(req.params["id"] as string, req.user!.id);
  // §11.7 — Push updated count for real-time badge decrement
  await notifSvc.pushUnreadCount(req.user!.id);
  res.status(200).json({ message: "Marked as read" });
}

/** PATCH /api/v1/notifications/:id/unread */
export async function handleMarkAsUnread(req: Request, res: Response): Promise<void> {
  await notifSvc.markAsUnread(req.params["id"] as string, req.user!.id);
  await notifSvc.pushUnreadCount(req.user!.id);
  res.status(200).json({ message: "Marked as unread" });
}

/** PATCH /api/v1/notifications/read-all */
export async function handleMarkAllAsRead(req: Request, res: Response): Promise<void> {
  await notifSvc.markAllAsRead(req.user!.id);
  await notifSvc.pushUnreadCount(req.user!.id);
  res.status(200).json({ message: "All marked as read" });
}

/** DELETE /api/v1/notifications/:id */
export async function handleClearNotification(req: Request, res: Response): Promise<void> {
  await notifSvc.clearNotification(req.params["id"] as string, req.user!.id);
  res.status(200).json({ message: "Cleared" });
}

/** DELETE /api/v1/notifications/clear-all */
export async function handleClearAll(req: Request, res: Response): Promise<void> {
  await notifSvc.clearAllNotifications(req.user!.id);
  res.status(200).json({ message: "All cleared" });
}
