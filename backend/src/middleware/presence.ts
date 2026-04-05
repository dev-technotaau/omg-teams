import { touchPresence, broadcastPresence } from "../services/presence.service.js";
import type { Request, Response, NextFunction } from "express";

// ──────────────────────────────────────────────
//  Presence Middleware — Spec Section 23.15
//
//  Records last activity time for the authenticated
//  user on every API request.
// ──────────────────────────────────────────────

export function presenceMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.id) {
    // Fire-and-forget — don't block the request
    void touchPresence(req.user.id).then(() => {
      broadcastPresence(req.user!.id, "online");
    });
  }
  next();
}
