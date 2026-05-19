import { z } from "zod";
import { ForbiddenError } from "../exceptions/forbidden-error.js";
import { ValidationError } from "../exceptions/validation-error.js";
import { generateBackupCodes, getBackupCodeStatus } from "../services/backup-code.service.js";
import { validatePasswordComplexity } from "../services/password.service.js";
import { getUserPerformance } from "../services/user-performance.service.js";
import {
  createUser,
  getUserById,
  listUsers,
  suspendUser,
  reactivateUser,
  deleteUser,
  resetPassword,
  updateUser,
  assignManager,
  removeManager,
  getUserDeviceInfo,
  reactivateWithDeviceReset,
  resetDevice,
  getEmployeePassword,
} from "../services/user.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  User Management Controller (Admin-only)
//  Spec Section 6.3
// ──────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(["RECRUITER", "REPORTING_MANAGER"]),
  mobileNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  managerIds: z.array(z.string()).optional(),
  recruiterIds: z.array(z.string()).optional(),
});

/** POST /api/v1/users */
export async function handleCreateUser(req: Request, res: Response): Promise<void> {
  const body = createUserSchema.parse(req.body);

  // Validate password complexity
  const passwordCheck = validatePasswordComplexity(body.password, {
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
  });

  if (!passwordCheck.valid) {
    throw new ValidationError(
      passwordCheck.errors.map((msg) => ({ path: "password", message: msg })),
    );
  }

  const result = await createUser(body);

  res.status(201).json({
    message: "Employee account created successfully",
    user: {
      id: result.id,
      employeeId: result.employeeId,
      email: result.email,
      firstName: result.firstName,
      lastName: result.lastName,
      role: result.role,
      plainPassword: result.plainPassword,
      assignedManagers: result.assignedManagers,
      assignedRecruiters: result.assignedRecruiters,
    },
  });
}

/** GET /api/v1/users */
export async function handleListUsers(req: Request, res: Response): Promise<void> {
  const role = req.query["role"] as string | undefined;
  const status = req.query["status"] as string | undefined;
  const search = req.query["search"] as string | undefined;
  const managerId = req.query["managerId"] as string | undefined;
  const kycStatus = req.query["kycStatus"] as string | undefined;
  const deviceStatus = req.query["deviceStatus"] as string | undefined;
  const page = req.query["page"] ? parseInt(req.query["page"] as string, 10) : undefined;
  const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : undefined;

  const sortBy = req.query["sortBy"] as string | undefined;
  const sortDir = req.query["sortDir"] as "asc" | "desc" | undefined;

  const result = await listUsers({
    role: role as "ADMIN" | "RECRUITER" | "REPORTING_MANAGER" | undefined,
    status: status as "ACTIVE" | "SUSPENDED" | "DELETED" | undefined,
    search,
    managerId,
    kycStatus,
    deviceStatus,
    sortBy,
    sortDir,
    page,
    limit,
  });

  res.status(200).json(result);
}

/** GET /api/v1/users/:id */
export async function handleGetUser(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.params["id"] as string);
  res.status(200).json({ user });
}

/** PATCH /api/v1/users/:id/suspend */
export async function handleSuspendUser(req: Request, res: Response): Promise<void> {
  await suspendUser(req.params["id"] as string);
  res.status(200).json({ message: "User suspended" });
}

/** PATCH /api/v1/users/:id/reactivate */
export async function handleReactivateUser(req: Request, res: Response): Promise<void> {
  await reactivateUser(req.params["id"] as string);
  res.status(200).json({ message: "User reactivated" });
}

/** DELETE /api/v1/users/:id */
export async function handleDeleteUser(req: Request, res: Response): Promise<void> {
  await deleteUser(req.params["id"] as string, req.user!.id);
  res.status(200).json({ message: "User deleted" });
}

/** PATCH /api/v1/users/:id — Admin edit employee profile */
export async function handleUpdateUser(req: Request, res: Response): Promise<void> {
  const updateSchema = z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
    mobileNumber: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    role: z.enum(["RECRUITER", "REPORTING_MANAGER"]).optional(),
  });

  const body = updateSchema.parse(req.body);
  const updated = await updateUser(req.params["id"] as string, body);
  res.status(200).json({ message: "Employee updated", user: updated });
}

/** PATCH /api/v1/users/:id/reset-password */
export async function handleResetPassword(req: Request, res: Response): Promise<void> {
  const { newPassword } = z.object({ newPassword: z.string().min(8).max(128) }).parse(req.body);

  const passwordCheck = validatePasswordComplexity(newPassword);
  if (!passwordCheck.valid) {
    throw new ValidationError(
      passwordCheck.errors.map((msg) => ({ path: "newPassword", message: msg })),
    );
  }

  await resetPassword(req.params["id"] as string, newPassword);
  res.status(200).json({ message: "Password reset" });
}

/** POST /api/v1/users/:id/assign-manager */
export async function handleAssignManager(req: Request, res: Response): Promise<void> {
  const { managerId } = z.object({ managerId: z.string() }).parse(req.body);
  await assignManager(req.params["id"] as string, managerId);
  res.status(200).json({ message: "Manager assigned" });
}

/** DELETE /api/v1/users/:id/remove-manager/:managerId */
export async function handleRemoveManager(req: Request, res: Response): Promise<void> {
  await removeManager(req.params["id"] as string, req.params["managerId"] as string);
  res.status(200).json({ message: "Manager removed" });
}

/** POST /api/v1/users/:id/reset-device */
export async function handleResetDevice(req: Request, res: Response): Promise<void> {
  await resetDevice(req.params["id"] as string);
  res.status(200).json({ message: "Device reset" });
}

/** GET /api/v1/users/:id/device-info — §22.9 Admin device info view */
export async function handleGetDeviceInfo(req: Request, res: Response): Promise<void> {
  const data = await getUserDeviceInfo(req.params["id"] as string);
  res.status(200).json({ data });
}

/** POST /api/v1/users/:id/reactivate-with-device-reset — §22.9 Combined action */
export async function handleReactivateWithDeviceReset(req: Request, res: Response): Promise<void> {
  await reactivateWithDeviceReset(req.params["id"] as string);
  res.status(200).json({ message: "User reactivated with device reset" });
}

/** POST /api/v1/users/:id/unlock — §25.1 Admin manual unlock of locked-out account */
export async function handleUnlockAccount(req: Request, res: Response): Promise<void> {
  const { unlockAccount } = await import("../services/session.service.js");
  await unlockAccount(req.params["id"] as string);
  res.status(200).json({ message: "Account unlocked" });
}

/** POST /api/v1/users/:id/backup-codes — Generate new backup codes (§23.16) */
export async function handleGenerateBackupCodes(req: Request, res: Response): Promise<void> {
  const codes = await generateBackupCodes(req.params["id"] as string);
  res.status(200).json({ codes });
}

/** GET /api/v1/users/:id/backup-codes/status — Get backup code status */
export async function handleGetBackupCodeStatus(req: Request, res: Response): Promise<void> {
  const status = await getBackupCodeStatus(req.params["id"] as string);
  res.status(200).json(status);
}

/** GET /api/v1/users/:id/team-view — §7 RM can view details of assigned recruiters */
export async function handleGetTeamMember(req: Request, res: Response): Promise<void> {
  const { role, id: userId } = req.user!;
  const targetId = req.params["id"] as string;

  // Admin can always view
  if (role === "ADMIN") {
    const user = await getUserById(targetId);
    res.status(200).json({ user });
    return;
  }

  // RM can view only assigned recruiters
  if (role === "REPORTING_MANAGER") {
    const prisma = (await import("../config/database.js")).getPrisma();
    const assignment = await prisma.recruiterManagerAssignment.findFirst({
      where: { managerId: userId, recruiterId: targetId, removedAt: null },
    });
    if (!assignment) {
      throw new ForbiddenError("This recruiter is not assigned to you");
    }
    const user = await getUserById(targetId);
    res.status(200).json({ user });
    return;
  }

  throw new ForbiddenError("You do not have permission to view this user");
}

/** POST /api/v1/users/:id/password — §6.3.3 Retrieve employee password with admin verification */
export async function handleGetEmployeePassword(req: Request, res: Response): Promise<void> {
  const { adminPassword } = z.object({ adminPassword: z.string().min(1) }).parse(req.body);
  const password = await getEmployeePassword(
    req.user!.id,
    adminPassword,
    req.params["id"] as string,
  );
  res.status(200).json({ password });
}

/**
 * GET /api/v1/users/:id/performance?period=thisMonth
 * Performance bundle for the Admin → Employee Detail → Performance tab.
 * §6.4 — KPIs, pipeline, zones, trend, attendance, leave, targets, rank.
 */
export async function handleGetUserPerformance(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await getUserPerformance(req.params["id"] as string, period);
  res.status(200).json({ data });
}
