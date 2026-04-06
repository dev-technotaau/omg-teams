import { getPrisma } from "../config/database.js";
import * as sessionSvc from "../services/session.service.js";
import type { Request, Response } from "express";

/** GET /api/v1/admin/sessions — List all active sessions from DB */
export async function handleListSessions(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : 1;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 25;
  const userId = req.query["userId"] as string | undefined;
  const sortBy = req.query["sortBy"] as string | undefined;
  const sortDir = (req.query["sortDir"] as "asc" | "desc" | undefined) ?? "desc";

  const where: Record<string, unknown> = { revokedAt: null };
  if (userId) where["userId"] = userId;

  const SESSION_SORT_KEY_MAP: Record<string, Record<string, unknown>> = {
    user: { user: { firstName: sortDir } },
    role: { user: { role: sortDir } },
    ipAddress: { ipAddress: sortDir },
    createdAt: { createdAt: sortDir },
    lastActiveAt: { lastActiveAt: sortDir },
  };
  const orderBy = (sortBy && SESSION_SORT_KEY_MAP[sortBy]) || { lastActiveAt: "desc" };

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where: where as never,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: orderBy as never,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, employeeId: true, role: true },
        },
      },
    }),
    prisma.session.count({ where: where as never }),
  ]);

  res.status(200).json({
    data: sessions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** DELETE /api/v1/admin/sessions/:id — Revoke a specific session */
export async function handleRevokeSession(req: Request, res: Response): Promise<void> {
  const sessionId = req.params["id"] as string;
  const prisma = getPrisma();

  // Find session in DB
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Destroy from Redis
  await sessionSvc.destroySession(session.token);

  // Mark revoked in DB
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });

  // §11.4 — Notify employee of session revocation
  try {
    const { onSessionRevoked } = await import("../services/notification-triggers.js");
    void onSessionRevoked(session.userId);
  } catch {
    /* non-critical */
  }

  res.status(200).json({ message: "Session revoked" });
}

/** DELETE /api/v1/admin/sessions/user/:userId — Revoke all sessions for a user */
export async function handleRevokeUserSessions(req: Request, res: Response): Promise<void> {
  const userId = req.params["userId"] as string;
  const prisma = getPrisma();

  // Destroy from Redis
  await sessionSvc.destroyUserSessions(userId);

  // Mark all revoked in DB
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // §11.4 — Notify employee of session revocation
  try {
    const { onSessionRevoked } = await import("../services/notification-triggers.js");
    void onSessionRevoked(userId);
  } catch {
    /* non-critical */
  }

  res.status(200).json({ message: "All sessions revoked for user" });
}
