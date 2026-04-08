import crypto from "node:crypto";
import { type Role, type AccountStatus } from "@prisma/client";
import { hashPassword, verifyPassword } from "./password.service.js";
import { destroyUserSessions, unlockAccount } from "./session.service.js";
import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import { ConflictError } from "../exceptions/conflict-error.js";
import { ForbiddenError } from "../exceptions/forbidden-error.js";
import { NotFoundError } from "../exceptions/not-found-error.js";
import { logger } from "../instrument.js";
import { encryptPassword, decryptPassword } from "../utils/password-encryption.js";

/** Invalidate auth middleware cache when user profile changes (device, status) */
export async function invalidateUserAuthCache(userId: string): Promise<void> {
  await cache.del(`user_auth:${userId}`);
}

// ──────────────────────────────────────────────
//  User Management Service
//  Spec Section 6.3
// ──────────────────────────────────────────────

/** Convert undefined to null for Prisma optional fields */
function toNull<T>(value: T | undefined): T | null {
  return value ?? null;
}

/**
 * Generate a new Employee ID — OMG-<6 random base32 chars>.
 *
 * §16 enumeration mitigation — sequential Employee IDs (OMG-0001, OMG-0002…)
 * are trivially guessable, allowing an attacker to enumerate the entire
 * employee population by walking the integer space. Switching to 6 random
 * base32 chars (RFC 4648 alphabet, A-Z + 2-7) yields 32^6 ≈ 1.07 billion
 * possible IDs, making walk-the-space enumeration infeasible while keeping
 * the ID short and human-typable.
 *
 * Existing legacy `OMG-<digits>` IDs are NOT migrated — they continue to work
 * indefinitely. Only newly generated IDs use the random suffix.
 *
 * Generation collides on duplicate (1-in-a-billion) — we retry up to 5 times
 * to be safe, then fall through (the unique constraint on `employeeId` will
 * surface a clean conflict if we somehow exhaust retries).
 *
 * Spec Section 6.3.1
 */
const EMPLOYEE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648 base32
export async function generateEmployeeId(): Promise<string> {
  const prisma = getPrisma();
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.randomBytes(6);
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      // bytes[i]! is non-null because we just allocated 6 bytes
      suffix += EMPLOYEE_ID_ALPHABET[bytes[i]! % 32];
    }
    const candidate = `OMG-${suffix}`;
    const exists = await prisma.user.findFirst({
      where: { employeeId: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Astronomically unlikely (5 collisions in 1 billion space) — surface a
  // clear error rather than silently looping.
  throw new Error("Failed to generate a unique Employee ID after 5 attempts");
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "RECRUITER" | "REPORTING_MANAGER";
  mobileNumber?: string | undefined;
  address?: string | undefined;
  managerIds?: string[] | undefined; // for Recruiter accounts — assigned RMs
  recruiterIds?: string[] | undefined; // for RM accounts — recruiters reporting to this RM
}

export interface CreateUserResult {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  plainPassword: string; // only returned once at creation
  assignedManagers: string[];
  assignedRecruiters: string[];
}

/**
 * Create a new Recruiter or Reporting Manager account.
 * Only Admin can call this. Spec Section 6.3
 */
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const prisma = getPrisma();

  // Hard guard: only one admin allowed (the seeded one). No code path may create another.
  if ((input.role as string) === "ADMIN") {
    throw new ForbiddenError("Admin accounts cannot be created");
  }

  // Check for duplicate email
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingEmail) {
    throw new ConflictError("An account with this email already exists");
  }

  const employeeId = await generateEmployeeId();
  const passwordHash = await hashPassword(input.password);
  const encryptedPw = encryptPassword(input.password);

  const user = await prisma.user.create({
    data: {
      employeeId,
      email: input.email,
      passwordHash,
      encryptedPassword: encryptedPw,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      mobileNumber: toNull(input.mobileNumber),
      address: toNull(input.address),
    },
  });

  // Assign Reporting Managers if provided (only when creating a Recruiter)
  const assignedManagers: string[] = [];
  if (input.managerIds && input.managerIds.length > 0 && input.role === "RECRUITER") {
    for (const managerId of input.managerIds) {
      const manager = await prisma.user.findFirst({
        where: { id: managerId, role: "REPORTING_MANAGER", status: "ACTIVE" },
      });
      if (manager) {
        await prisma.recruiterManagerAssignment.create({
          data: { recruiterId: user.id, managerId },
        });
        assignedManagers.push(`${manager.firstName} ${manager.lastName}`);
      }
    }
  }

  // Assign Recruiters if provided (only when creating a Reporting Manager)
  const assignedRecruiters: string[] = [];
  if (input.recruiterIds && input.recruiterIds.length > 0 && input.role === "REPORTING_MANAGER") {
    for (const recruiterId of input.recruiterIds) {
      const recruiter = await prisma.user.findFirst({
        where: { id: recruiterId, role: "RECRUITER", status: "ACTIVE" },
      });
      if (recruiter) {
        // Skip if already assigned (unique constraint on active assignments)
        const existing = await prisma.recruiterManagerAssignment.findFirst({
          where: { recruiterId, managerId: user.id, removedAt: null },
        });
        if (!existing) {
          await prisma.recruiterManagerAssignment.create({
            data: { recruiterId, managerId: user.id },
          });
        }
        assignedRecruiters.push(`${recruiter.firstName} ${recruiter.lastName}`);
      }
    }
  }

  logger.info("User account created", {
    userId: user.id,
    employeeId,
    role: input.role,
  });

  // Notify admins
  const { onAccountCreated } = await import("./notification-triggers.js");
  void onAccountCreated(user.id, `${input.firstName} ${input.lastName}`, input.role);

  // GA4 server-side: track sign_up event
  void import("../utils/analytics.js").then(({ trackEvent: gaTrack }) =>
    gaTrack(user.id, { name: "sign_up", params: { role: input.role } }),
  );

  return {
    id: user.id,
    employeeId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    plainPassword: input.password,
    assignedManagers,
    assignedRecruiters,
  };
}

/**
 * Get user by ID with basic info.
 */
export async function getUserById(userId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      managedRecruiters: {
        where: { removedAt: null },
        include: {
          recruiter: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        },
      },
      assignedManagers: {
        where: { removedAt: null },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        },
      },
    },
  });

  if (!user) throw new NotFoundError("User", userId);
  return user;
}

/**
 * List all users with filtering.
 */
const USER_SORT_KEY_MAP: Record<string, string> = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  role: "role",
  status: "status",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  employeeId: "employeeId",
  employee: "firstName",
  name: "firstName",
  lastActive: "lastActiveAt",
  lastActiveAt: "lastActiveAt",
};

function resolveUserSort(
  sortBy?: string,
  sortDir?: "asc" | "desc",
): Record<string, "asc" | "desc"> {
  const mapped = sortBy ? USER_SORT_KEY_MAP[sortBy] : undefined;
  if (mapped) {
    return { [mapped]: sortDir ?? "desc" };
  }
  return { createdAt: "desc" };
}

export async function listUsers(filters: {
  role?: Role | undefined;
  status?: AccountStatus | undefined;
  search?: string | undefined;
  managerId?: string | undefined;
  kycStatus?: string | undefined;
  deviceStatus?: string | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filters.role) {
    where["role"] = filters.role;
  } else {
    // By default, hide admin accounts from employee / user-management lists.
    // Callers can still explicitly request ADMIN by passing `role: "ADMIN"`.
    where["role"] = { not: "ADMIN" };
  }
  if (filters.status) where["status"] = filters.status;
  else where["status"] = { not: "DELETED" };

  if (filters.search) {
    where["OR"] = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { employeeId: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // §6.4 — Filter by assigned Reporting Manager
  if (filters.managerId) {
    const assignments = await prisma.recruiterManagerAssignment.findMany({
      where: { managerId: filters.managerId, removedAt: null },
      select: { recruiterId: true },
    });
    const recruiterIds = assignments.map((a) => a.recruiterId);
    where["id"] = { in: recruiterIds };
  }

  // §22.12 — Filter by device binding status
  if (filters.deviceStatus === "bound") {
    where["deviceId"] = { not: null };
  } else if (filters.deviceStatus === "unbound") {
    where["deviceId"] = null;
  }

  // §6.4 — Filter by KYC status
  // kycStatus values: "complete", "incomplete", "pending", "not_started"
  // This requires a subquery on employeeDocuments — we filter post-query for now
  // and adjust pagination accordingly if kycStatus is set
  const applyKycFilter = !!filters.kycStatus;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        profilePhotoUrl: true,
        deviceId: true,
        deviceLockedAt: true,
        createdAt: true,
        ...(applyKycFilter && {
          employeeDocuments: {
            select: { status: true },
          },
        }),
      },
      orderBy: resolveUserSort(filters.sortBy, filters.sortDir),
      ...(!applyKycFilter && { skip, take: limit }),
      ...(applyKycFilter && { take: 5000 }), // fetch all for post-filter
    }),
    prisma.user.count({ where }),
  ]);

  if (applyKycFilter) {
    const kycFilter = filters.kycStatus!.toLowerCase();
    const filtered = users.filter((u) => {
      const docs = (u as Record<string, unknown>)["employeeDocuments"] as
        | { status: string }[]
        | undefined;
      if (!docs || docs.length === 0) return kycFilter === "not_started";
      const allVerified = docs.every((d) => d.status === "VERIFIED");
      const hasPending = docs.some((d) => d.status === "PENDING");
      if (kycFilter === "complete") return allVerified;
      if (kycFilter === "pending") return hasPending;
      if (kycFilter === "incomplete") return !allVerified && !hasPending;
      return kycFilter === "not_started" && docs.length === 0;
    });
    const paginated = filtered.slice(skip, skip + limit);
    return {
      data: paginated,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
    };
  }

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Suspend a user account.
 */
export async function suspendUser(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  await destroyUserSessions(userId);
  await invalidateUserAuthCache(userId);
  logger.info("User suspended", { userId });

  // §24.10 — Force client logout via Socket.io
  try {
    const { emitUserSuspended } = await import("../socket.js");
    emitUserSuspended(userId);
  } catch {
    /* non-critical */
  }

  const { onAccountSuspended } = await import("./notification-triggers.js");
  void onAccountSuspended(userId);
}

/**
 * Reactivate a suspended user.
 */
export async function reactivateUser(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE" },
  });
  await unlockAccount(userId);
  await invalidateUserAuthCache(userId);
  logger.info("User reactivated", { userId });

  const { onAccountReactivated } = await import("./notification-triggers.js");
  void onAccountReactivated(userId);
}

/**
 * Soft-delete a user.
 */
export async function deleteUser(userId: string, deletedBy: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "DELETED", deletedAt: new Date(), deletedBy },
  });
  await destroyUserSessions(userId);
  await invalidateUserAuthCache(userId);
  logger.info("User deleted", { userId, deletedBy });
}

/**
 * Reset password for a user (admin-only).
 */
export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(newPassword);
  const encryptedPw = encryptPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, encryptedPassword: encryptedPw },
  });
  await destroyUserSessions(userId);
  logger.info("User password reset", { userId });

  const { onPasswordReset } = await import("./notification-triggers.js");
  void onPasswordReset(userId);
}

/**
 * Admin update employee profile fields.
 * Handles email uniqueness, role change validations, and notifications.
 */
export async function updateUser(
  userId: string,
  data: {
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    mobileNumber?: string | null | undefined;
    address?: string | null | undefined;
    role?: Role | undefined;
  },
) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });
  if (!user) throw new NotFoundError("User", userId);

  // Prevent editing admin accounts
  if (user.role === "ADMIN") {
    throw new ForbiddenError("Cannot edit admin accounts through this endpoint");
  }

  const updateData: Record<string, unknown> = {};
  const changes: string[] = [];

  // Email change — check uniqueness
  if (data.email !== undefined && data.email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) throw new ConflictError("Email already in use");
    updateData["email"] = data.email.toLowerCase();
    changes.push("email");
  }

  if (data.firstName !== undefined && data.firstName !== user.firstName) {
    updateData["firstName"] = data.firstName;
    changes.push("name");
  }
  if (data.lastName !== undefined && data.lastName !== user.lastName) {
    updateData["lastName"] = data.lastName;
    if (!changes.includes("name")) changes.push("name");
  }
  if (data.mobileNumber !== undefined) {
    updateData["mobileNumber"] = data.mobileNumber;
    changes.push("mobile");
  }
  if (data.address !== undefined) {
    updateData["address"] = data.address;
    changes.push("address");
  }

  // Role change — validate allowed transitions
  if (data.role !== undefined && data.role !== user.role) {
    if (data.role === "ADMIN") {
      throw new ForbiddenError("Cannot promote to admin role");
    }
    updateData["role"] = data.role;
    changes.push("role");

    // If changing FROM RM, unassign all managed recruiters
    if (user.role === "REPORTING_MANAGER" && data.role === "RECRUITER") {
      await prisma.recruiterManagerAssignment.updateMany({
        where: { managerId: userId, removedAt: null },
        data: { removedAt: new Date() },
      });
    }
    // If changing FROM Recruiter, unassign from all managers
    if (user.role === "RECRUITER" && data.role === "REPORTING_MANAGER") {
      await prisma.recruiterManagerAssignment.updateMany({
        where: { recruiterId: userId, removedAt: null },
        data: { removedAt: new Date() },
      });
    }
  }

  if (Object.keys(updateData).length === 0) {
    return user;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      mobileNumber: true,
      address: true,
      status: true,
    },
  });

  logger.info("Admin updated employee profile", { userId, changes });

  // Send notification email to employee about profile changes
  if (changes.length > 0) {
    try {
      const { env: appEnv } = await import("../config/env.js");
      if (appEnv.hasSmtp) {
        const { enqueueEmail } = await import("../jobs/email.queue.js");
        const changedFields = changes.join(", ");
        void enqueueEmail({
          to: updated.email,
          subject: "profile_updated_by_admin",
          template: "profile_updated_by_admin",
          context: {
            userName: `${updated.firstName} ${updated.lastName}`,
            changedFields,
          },
        });
      }
    } catch {
      /* non-critical */
    }
  }

  return updated;
}

/**
 * §6.3.3 — Retrieve employee password after admin verification.
 */
export async function getEmployeePassword(
  adminId: string,
  adminPassword: string,
  targetUserId: string,
): Promise<string> {
  const prisma = getPrisma();

  // Verify admin's own password
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { passwordHash: true, role: true },
  });
  if (admin?.role !== "ADMIN") {
    throw new ForbiddenError("Admin access required");
  }
  const isValid = await verifyPassword(adminPassword, admin.passwordHash);
  if (!isValid) {
    throw new ForbiddenError("Invalid admin password");
  }

  // Fetch encrypted password
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { encryptedPassword: true },
  });
  if (!target?.encryptedPassword) {
    throw new NotFoundError("Password not available for this user");
  }

  return decryptPassword(target.encryptedPassword);
}

/**
 * Assign a Reporting Manager to a Recruiter.
 */
export async function assignManager(recruiterId: string, managerId: string): Promise<void> {
  const prisma = getPrisma();

  // Check if assignment already exists
  const existing = await prisma.recruiterManagerAssignment.findFirst({
    where: { recruiterId, managerId, removedAt: null },
  });
  if (existing) return; // already assigned

  await prisma.recruiterManagerAssignment.create({
    data: { recruiterId, managerId },
  });
  logger.info("Manager assigned to recruiter", { recruiterId, managerId });
}

/**
 * Remove a Reporting Manager from a Recruiter.
 */
export async function removeManager(recruiterId: string, managerId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.recruiterManagerAssignment.updateMany({
    where: { recruiterId, managerId, removedAt: null },
    data: { removedAt: new Date() },
  });
  logger.info("Manager removed from recruiter", { recruiterId, managerId });
}

/**
 * Reset device binding for a user (admin-only).
 */
export async function updateProfile(
  userId: string,
  data: { mobileNumber?: string; address?: string },
) {
  const prisma = getPrisma();
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.mobileNumber !== undefined && { mobileNumber: data.mobileNumber }),
      ...(data.address !== undefined && { address: data.address }),
    },
    select: { id: true, mobileNumber: true, address: true },
  });
}

export async function resetDevice(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { deviceId: null, deviceLockedAt: null },
  });
  await prisma.userDevice.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });
  await destroyUserSessions(userId);

  // §24.10 — Force client logout via Socket.io
  try {
    const { emitDeviceReset } = await import("../socket.js");
    emitDeviceReset(userId);
  } catch {
    /* non-critical */
  }

  // §11.4 — Notify employee of device reset
  try {
    const { onDeviceReset: notifyDeviceReset } = await import("./notification-triggers.js");
    void notifyDeviceReset(userId);
  } catch {
    /* non-critical */
  }

  await invalidateUserAuthCache(userId);
  logger.info("User device reset", { userId });
}

/**
 * §22.9 — Get device info + device history for a user (Admin view).
 */
export async function getUserDeviceInfo(userId: string) {
  const prisma = getPrisma();
  const [user, devices, recentLogins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { deviceId: true, deviceLockedAt: true, firstName: true, lastName: true },
    }),
    prisma.userDevice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return {
    currentDeviceId: user?.deviceId ?? null,
    deviceLockedAt: user?.deviceLockedAt?.toISOString() ?? null,
    userName: user ? `${user.firstName} ${user.lastName}` : null,
    devices: devices.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      userAgent: d.userAgent,
      platform: d.platform,
      screenSize: d.screenSize,
      lastSeen: d.lastSeen.toISOString(),
      isActive: d.isActive,
      createdAt: d.createdAt.toISOString(),
    })),
    recentLogins: recentLogins.map((l) => ({
      id: l.id,
      attemptedDeviceId: l.attemptedDeviceId,
      ip: l.ip,
      userAgent: l.userAgent,
      success: l.success,
      failureReason: l.failureReason,
      loginMethod: l.loginMethod,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

/**
 * §22.9 — Reactivate suspended user + optionally reset device binding.
 */
export async function reactivateWithDeviceReset(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", deviceId: null, deviceLockedAt: null },
  });
  await prisma.userDevice.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });
  await destroyUserSessions(userId);
  logger.info("User reactivated with device reset", { userId });
}
