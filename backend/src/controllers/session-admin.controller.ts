import { getPrisma } from "../config/database.js";
import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import { logger } from "../instrument.js";
import * as sessionSvc from "../services/session.service.js";
import type { Request, Response } from "express";

const SESSION_PREFIX = "session:";

/**
 * Window in milliseconds for what counts as "currently active" on the
 * admin sessions page. We use the non-admin idle timeout (default 30
 * min) so the page shows the same definition of "online right now"
 * for everyone, regardless of role-specific TTLs in Redis. Without
 * this filter, admins (3-day Redis TTL) would linger as "active" for
 * days after closing the browser, while employees (30-min TTL) would
 * disappear quickly — the asymmetry the user observed.
 */
function getInactivityCutoff(): Date {
  return new Date(Date.now() - env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000);
}

/**
 * Sweep stale Session DB rows that have already expired in Redis.
 *
 * The Session table records every Redis session at create-time, but
 * Redis sessions expire on their own TTL (idle timeout, capped at
 * midnight for non-admins). When that happens the DB row's
 * `revokedAt` is never touched, so the admin page would otherwise
 * show "ghost" sessions that aren't actually live anywhere.
 *
 * This sweep is idempotent and self-healing: for every non-revoked
 * row we ask Redis if the matching `session:<token>` key still
 * exists. If not, we stamp `revokedAt = now`. The next list query
 * will then exclude it. The check is one Redis pipeline, so it's
 * cheap even with hundreds of live sessions.
 */
async function sweepStaleSessions(): Promise<void> {
  const prisma = getPrisma();
  const redis = getRedisClient();

  const live = await prisma.session.findMany({
    where: { revokedAt: null },
    select: { id: true, token: true },
  });
  if (live.length === 0) return;

  const pipeline = redis.pipeline();
  for (const s of live) pipeline.exists(`${SESSION_PREFIX}${s.token}`);
  const results = await pipeline.exec();

  const staleIds: string[] = [];
  live.forEach((s, i) => {
    const exists = results?.[i]?.[1] === 1;
    if (!exists) staleIds.push(s.id);
  });

  if (staleIds.length > 0) {
    await prisma.session.updateMany({
      where: { id: { in: staleIds } },
      data: { revokedAt: new Date() },
    });
    logger.debug("Swept stale sessions", { count: staleIds.length });
  }
}

/** GET /api/v1/admin/sessions — List active or historical sessions from DB */
export async function handleListSessions(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : 1;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 25;
  const userId = req.query["userId"] as string | undefined;
  const roleFilter = req.query["role"] as string | undefined;
  // "active" (default) → currently online
  // "history" → revoked OR went idle without explicit logout
  const view = req.query["view"] === "history" ? "history" : "active";
  const sortBy = req.query["sortBy"] as string | undefined;
  const sortDir = (req.query["sortDir"] as "asc" | "desc" | undefined) ?? "desc";

  // Self-heal: kill ghost rows whose Redis entry has already expired.
  // Done before counts/listing so the response only ever shows truly
  // active sessions and the summary numbers stay accurate.
  await sweepStaleSessions();

  // "Currently active" cutoff. Sessions whose lastActiveAt is older
  // than this window aren't shown in the active view — even if Redis
  // still has their key (admin 3-day TTL) and even if revokedAt is
  // null. The DB column is kept fresh by refreshSession's throttled
  // writer. The history view inverts this filter.
  const cutoff = getInactivityCutoff();

  const where: Record<string, unknown> =
    view === "history"
      ? {
          // Anything that is NOT currently active counts as history:
          // either explicitly revoked, or non-revoked but idle past
          // the cutoff (browser closed without logout).
          OR: [{ revokedAt: { not: null } }, { revokedAt: null, lastActiveAt: { lte: cutoff } }],
        }
      : {
          revokedAt: null,
          lastActiveAt: { gt: cutoff },
        };
  if (userId) where["userId"] = userId;
  if (roleFilter === "ADMIN") {
    where["user"] = { role: "ADMIN" };
  } else if (roleFilter === "EMPLOYEE") {
    where["user"] = { role: { in: ["RECRUITER", "REPORTING_MANAGER"] } };
  }

  const SESSION_SORT_KEY_MAP: Record<string, Record<string, unknown>> = {
    user: { user: { firstName: sortDir } },
    role: { user: { role: sortDir } },
    ipAddress: { ipAddress: sortDir },
    createdAt: { createdAt: sortDir },
    lastActiveAt: { lastActiveAt: sortDir },
    revokedAt: { revokedAt: { sort: sortDir, nulls: "last" } },
  };
  // For history we sort by revokedAt desc with nulls last by default
  // — explicitly revoked sessions come first (most recent first),
  // then idle/timed-out sessions (which have NULL revokedAt) sorted
  // by their position. Active view sorts by lastActiveAt desc.
  const defaultOrder: Record<string, unknown> =
    view === "history" ? { revokedAt: { sort: "desc", nulls: "last" } } : { lastActiveAt: "desc" };
  const orderBy = (sortBy ? SESSION_SORT_KEY_MAP[sortBy] : undefined) ?? defaultOrder;

  // Run the paginated list, the filtered count, and the global
  // role-by-role summary in parallel. Summary always reflects the
  // unfiltered totals so the admin can see the breakdown across tabs.
  const [sessions, total, summaryGroups] = await Promise.all([
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
    prisma.session.groupBy({
      by: ["userId"],
      where: { revokedAt: null, lastActiveAt: { gt: cutoff } },
      _count: { _all: true },
    }),
  ]);

  // Translate the per-user groupBy into per-role counts. We avoid an
  // extra join by re-using the user info that's already on each
  // active session row — but for the summary we need ALL active
  // sessions, not just the page slice. One small follow-up findMany
  // keeps the SQL surface area minimal.
  const summaryUserIds = summaryGroups.map((g) => g.userId);
  const summaryUsers =
    summaryUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: summaryUserIds } },
          select: { id: true, role: true },
        })
      : [];
  const roleByUser = new Map(summaryUsers.map((u) => [u.id, u.role]));
  const summary = { total: 0, admins: 0, recruiters: 0, managers: 0 };
  for (const g of summaryGroups) {
    const role = roleByUser.get(g.userId);
    summary.total += g._count._all;
    if (role === "ADMIN") summary.admins += g._count._all;
    else if (role === "RECRUITER") summary.recruiters += g._count._all;
    else if (role === "REPORTING_MANAGER") summary.managers += g._count._all;
  }

  res.status(200).json({
    data: sessions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    // The token of the request-making admin's own session, so the
    // frontend can flag "this is you" on the matching row.
    currentSessionId: req.user?.sessionId ?? null,
    summary,
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

/**
 * DELETE /api/v1/admin/sessions — Revoke ALL active sessions except the
 * caller's own. The clicking admin keeps their session so they don't
 * get logged out mid-workflow (matches the "Sign out of all other
 * sessions" pattern from Google/Microsoft/Apple).
 *
 * Steps:
 *   1. Find every non-revoked DB Session row except the caller's
 *   2. Pipeline-delete the matching Redis keys (session:<token> and
 *      user_session:<userId>)
 *   3. Mark all those rows revoked in one updateMany
 *   4. Emit socket force-logout for each affected user
 */
export async function handleRevokeAllSessions(req: Request, res: Response): Promise<void> {
  const prisma = getPrisma();
  const callerSessionId = req.user?.sessionId ?? null;

  const targets = await prisma.session.findMany({
    where: {
      revokedAt: null,
      ...(callerSessionId ? { token: { not: callerSessionId } } : {}),
    },
    select: { id: true, token: true, userId: true },
  });

  if (targets.length === 0) {
    res.status(200).json({ message: "No other sessions to revoke", revoked: 0 });
    return;
  }

  // Bulk Redis cleanup — single pipeline round-trip for both the
  // session:<token> and user_session:<userId> keys.
  const redis = getRedisClient();
  const pipeline = redis.pipeline();
  const uniqueUserIds = new Set<string>();
  for (const t of targets) {
    pipeline.del(`${SESSION_PREFIX}${t.token}`);
    pipeline.del(`user_session:${t.userId}`);
    uniqueUserIds.add(t.userId);
  }
  await pipeline.exec();

  // Mark every affected DB row revoked in one statement
  await prisma.session.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { revokedAt: new Date() },
  });

  // Best-effort socket force-logout — each affected user's open tabs
  // will get the SESSION_REVOKED event and bounce to the login page
  // immediately rather than waiting for their next request to fail.
  try {
    const { emitSessionRevoked } = await import("../socket.js");
    for (const uid of uniqueUserIds) emitSessionRevoked(uid);
  } catch {
    /* socket not initialized — non-critical */
  }

  // §11.4 — Notify each affected user
  try {
    const { onSessionRevoked } = await import("../services/notification-triggers.js");
    for (const uid of uniqueUserIds) {
      void onSessionRevoked(uid);
    }
  } catch {
    /* non-critical */
  }

  logger.info("Revoke-all-sessions executed", {
    revoked: targets.length,
    affectedUsers: uniqueUserIds.size,
    callerKept: callerSessionId !== null,
  });

  res.status(200).json({
    message: "All other sessions revoked",
    revoked: targets.length,
    affectedUsers: uniqueUserIds.size,
  });
}
