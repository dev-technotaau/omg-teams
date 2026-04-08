// ──────────────────────────────────────────────
//  §Godview — Aggregated per-user administrative data
//
//  Service functions backing the Employee Detail "godview" page.
//  Every function is user-scoped and assumes the caller is admin.
// ──────────────────────────────────────────────

import { getPresence } from "./presence.service.js";
import { getPrisma } from "../config/database.js";
import type { Prisma } from "@prisma/client";

interface Pagination {
  page?: number;
  limit?: number;
}

function paginate(p: Pagination) {
  const page = p.page && p.page > 0 ? p.page : 1;
  const limit = p.limit && p.limit > 0 ? p.limit : 25;
  return { page, limit, skip: (page - 1) * limit };
}

function wrap<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

// ── 1. Login history ──────────────────────────────────────────────
export async function listLoginHistory(userId: string, p: Pagination) {
  const prisma = getPrisma();
  const { page, limit, skip } = paginate(p);
  const [rows, total] = await Promise.all([
    prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.loginHistory.count({ where: { userId } }),
  ]);
  return wrap(rows, total, page, limit);
}

// ── 2. Notifications received by user (admin view) ────────────────
export async function listUserNotifications(userId: string, p: Pagination) {
  const prisma = getPrisma();
  const { page, limit, skip } = paginate(p);
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return wrap(rows, total, page, limit);
}

// ── 3. Auth methods: WebAuthn + backup codes + mfa enrollment ─────
export async function getAuthMethods(userId: string) {
  const prisma = getPrisma();
  const [credentials, backupCodes] = await Promise.all([
    prisma.webAuthnCredential.findMany({
      where: { userId },
      select: {
        id: true,
        credentialId: true,
        deviceName: true,
        transports: true,
        counter: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.backupCode.findMany({
      where: { userId },
      select: { id: true, isUsed: true, usedAt: true, createdAt: true },
    }),
  ]);
  const total = backupCodes.length;
  const used = backupCodes.filter((c) => c.isUsed).length;
  return {
    webauthnCredentials: credentials,
    backupCodes: { total, used, remaining: total - used, items: backupCodes },
    mfaEnrolled: credentials.length > 0 || total > 0,
  };
}

// ── 4. Leave balance history ─────────────────────────────────────
export async function listLeaveBalanceHistory(userId: string, p: Pagination) {
  const prisma = getPrisma();
  const { page, limit, skip } = paginate(p);
  const where = { leaveBalance: { userId } } as const;
  const [rows, total] = await Promise.all([
    prisma.leaveBalanceHistory.findMany({
      where,
      include: {
        leaveBalance: { include: { leaveType: { select: { name: true, code: true } } } },
        changer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.leaveBalanceHistory.count({ where }),
  ]);
  return wrap(rows, total, page, limit);
}

// ── 5. Employee document history ─────────────────────────────────
export async function listDocumentHistory(userId: string, p: Pagination) {
  const prisma = getPrisma();
  const { page, limit, skip } = paginate(p);
  const where = { document: { userId } } as const;
  const [rows, total] = await Promise.all([
    prisma.employeeDocumentHistory.findMany({
      where,
      include: {
        document: {
          include: { documentType: { select: { name: true } } },
        },
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.employeeDocumentHistory.count({ where }),
  ]);
  return wrap(rows, total, page, limit);
}

// ── 6. Presence lookup ───────────────────────────────────────────
export async function getUserPresence(userId: string) {
  return getPresence(userId);
}

// ── 7. Password history ──────────────────────────────────────────
export async function listPasswordHistory(userId: string, p: Pagination) {
  const prisma = getPrisma();
  const { page, limit, skip } = paginate(p);
  const [rows, total] = await Promise.all([
    prisma.passwordHistory.findMany({
      where: { userId },
      select: {
        id: true,
        reason: true,
        changedBy: true,
        createdAt: true,
        // Never expose the hash itself
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.passwordHistory.count({ where: { userId } }),
  ]);
  return wrap(rows, total, page, limit);
}

// ── 8. Webhook subscriptions (per-user CRUD) ─────────────────────
export async function listWebhookSubscriptions(userId: string) {
  const prisma = getPrisma();
  return prisma.webhookSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWebhookSubscription(
  userId: string,
  input: { url: string; secret: string; events: string[]; description?: string | null },
) {
  const prisma = getPrisma();
  return prisma.webhookSubscription.create({
    data: {
      userId,
      url: input.url,
      secret: input.secret,
      events: input.events,
      description: input.description ?? null,
    },
  });
}

export async function updateWebhookSubscription(
  id: string,
  input: {
    url?: string;
    secret?: string;
    events?: string[];
    description?: string | null;
    isActive?: boolean;
  },
) {
  const prisma = getPrisma();
  return prisma.webhookSubscription.update({ where: { id }, data: input });
}

export async function deleteWebhookSubscription(id: string) {
  const prisma = getPrisma();
  await prisma.webhookSubscription.delete({ where: { id } });
}

// ── 9. Table preferences ─────────────────────────────────────────
export async function listTablePreferences(userId: string) {
  const prisma = getPrisma();
  return prisma.tablePreference.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

// ── 10. Filter presets ───────────────────────────────────────────
export async function listFilterPresets(userId: string) {
  const prisma = getPrisma();
  return prisma.filterPreset.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

// ── 11. Impersonation sessions ───────────────────────────────────
export async function listImpersonationSessions(userId: string, p: Pagination) {
  const prisma = getPrisma();
  const { page, limit, skip } = paginate(p);
  // Return sessions where this user was either the admin OR the target
  const where = { OR: [{ adminId: userId }, { targetUserId: userId }] };
  const [rows, total] = await Promise.all([
    prisma.impersonationSession.findMany({
      where,
      include: {
        admin: { select: { id: true, firstName: true, lastName: true, email: true } },
        target: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.impersonationSession.count({ where }),
  ]);
  return wrap(rows, total, page, limit);
}

export async function startImpersonation(
  adminId: string,
  targetUserId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const prisma = getPrisma();
  return prisma.impersonationSession.create({
    data: {
      adminId,
      targetUserId,
      reason,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

export async function endImpersonation(id: string) {
  const prisma = getPrisma();
  return prisma.impersonationSession.update({
    where: { id },
    data: { endedAt: new Date() },
  });
}

// ── 12. Archive entries (by actor or related user) ──────────────
export async function listUserArchivedRecords(userId: string, p: Pagination) {
  const prisma = getPrisma();
  const { page, limit, skip } = paginate(p);
  const where: Prisma.ArchivedRecordWhereInput = {
    OR: [{ actorId: userId }, { relatedUserId: userId }],
  };
  const [rows, total] = await Promise.all([
    prisma.archivedRecord.findMany({
      where,
      orderBy: { archivedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.archivedRecord.count({ where }),
  ]);
  return wrap(rows, total, page, limit);
}

// ── 13a. Reset MFA: delete all WebAuthn credentials + backup codes ──
export async function resetMfa(userId: string): Promise<{ webauthn: number; backup: number }> {
  const prisma = getPrisma();
  const [w, b] = await Promise.all([
    prisma.webAuthnCredential.deleteMany({ where: { userId } }),
    prisma.backupCode.deleteMany({ where: { userId } }),
  ]);
  return { webauthn: w.count, backup: b.count };
}

// ── 13. Force logout: revoke all sessions + record ──────────────
export async function forceLogoutUser(userId: string): Promise<{ revoked: number }> {
  const prisma = getPrisma();
  const sessionSvc = await import("./session.service.js");
  await sessionSvc.destroyUserSessions(userId);
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  try {
    const { onSessionRevoked } = await import("./notification-triggers.js");
    void onSessionRevoked(userId);
  } catch {
    /* non-critical */
  }
  return { revoked: result.count };
}

// ── Unified godview summary for header badge ────────────────────
export async function getGodviewSummary(userId: string) {
  const prisma = getPrisma();
  const [presence, activeSessions, unreadNotifs, lastLogin] = await Promise.all([
    getPresence(userId),
    prisma.session.count({ where: { userId, revokedAt: null } }),
    prisma.notification.count({ where: { userId, isRead: false, isCleared: false } }),
    prisma.loginHistory.findFirst({
      where: { userId, success: true },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, ip: true },
    }),
  ]);
  return { presence, activeSessions, unreadNotifications: unreadNotifs, lastLogin };
}
