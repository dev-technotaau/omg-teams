import { type LeaveRequestStatus, type Prisma } from "@prisma/client";
import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { NotFoundError } from "../exceptions/not-found-error.js";

// ──────────────────────────────────────────────
//  Leave Service — Spec Section 28
// ──────────────────────────────────────────────

/**
 * Count working days between two dates, excluding weekends (Sun) and holidays.
 */
async function countWorkingDays(start: Date, end: Date): Promise<number> {
  const { isHoliday } = await import("./holiday.service.js");
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Default: Sunday is non-working (configurable later)
    if (dayOfWeek !== 0) {
      const holiday = await isHoliday(current);
      if (!holiday) count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function submitLeaveRequest(data: {
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean | undefined;
  halfDayPeriod?: "FIRST_HALF" | "SECOND_HALF" | null | undefined;
  reason: string;
  supportingDocumentUrl?: string | null | undefined;
  emergencyContact?: string | null | undefined;
}) {
  const prisma = getPrisma();

  // Admin is excluded from the leave system entirely
  const requester = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { role: true },
  });
  if (requester?.role === "ADMIN") {
    throw new AppError(
      "Admin accounts cannot request leave",
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN,
    );
  }

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  // Calculate working days (excluding weekends/holidays)
  const numberOfDays = data.isHalfDay ? 0.5 : await countWorkingDays(start, end);

  if (numberOfDays <= 0) {
    throw new AppError(
      "Selected dates contain no working days",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Check for overlapping requests (§28.2.2)
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      userId: data.userId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) {
    throw new AppError(
      "You already have a leave request for overlapping dates",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Get leave type for validation rules
  const leaveType = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
  if (!leaveType?.isActive) {
    throw new AppError(
      "Invalid or inactive leave type",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Advance notice check (§28.2.2) — skip for sick leave (advanceNoticeDays = 0)
  if (leaveType.advanceNoticeDays && leaveType.advanceNoticeDays > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / 86400000);
    if (daysUntilStart < leaveType.advanceNoticeDays) {
      throw new AppError(
        `${leaveType.name} requires at least ${leaveType.advanceNoticeDays} day(s) advance notice`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  // Max consecutive days check (§28.2.2)
  if (leaveType.maxConsecutiveDays && numberOfDays > leaveType.maxConsecutiveDays) {
    throw new AppError(
      `${leaveType.name} allows a maximum of ${leaveType.maxConsecutiveDays} consecutive days`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Check leave balance
  const year = start.getFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: { userId: data.userId, leaveTypeId: data.leaveTypeId, year },
    },
  });

  // §28.2 — Negative balance gating. When the platform setting
  // `leave_negative_balance` is enabled, employees may apply beyond their
  // remaining balance (the balance just goes negative on approval).
  const { getSettingBool } = await import("./settings.service.js");
  const allowNegative = await getSettingBool("leave_negative_balance", false);
  if (!allowNegative && balance && balance.remaining < numberOfDays) {
    throw new AppError(
      "Insufficient leave balance",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId: data.userId,
      leaveTypeId: data.leaveTypeId,
      startDate: start,
      endDate: end,
      isHalfDay: data.isHalfDay ?? false,
      halfDayPeriod: data.halfDayPeriod ?? null,
      numberOfDays,
      reason: data.reason,
      supportingDocumentUrl: data.supportingDocumentUrl ?? null,
      emergencyContact: data.emergencyContact ?? null,
    },
    include: { leaveType: { select: { name: true } } },
  });

  // Notify admins of new leave request
  const { onLeaveRequestSubmitted } = await import("./notification-triggers.js");
  const dates = `${start.toISOString().slice(0, 10)} - ${end.toISOString().slice(0, 10)}`;
  void onLeaveRequestSubmitted(
    request.id,
    data.userId,
    request.leaveType.name,
    dates,
    numberOfDays,
    data.reason,
  );

  return request;
}

export async function approveLeave(requestId: string, adminId: string) {
  const prisma = getPrisma();
  const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Leave Request", requestId);
  if (request.status !== "PENDING")
    throw new AppError(
      "Can only approve pending requests",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );

  // Deduct from balance
  const year = request.startDate.getFullYear();
  await prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
    },
    update: {
      used: { increment: request.numberOfDays },
      remaining: { decrement: request.numberOfDays },
    },
    create: {
      userId: request.userId,
      leaveTypeId: request.leaveTypeId,
      year,
      totalAllotted: 0,
      used: request.numberOfDays,
      remaining: -request.numberOfDays,
    },
  });

  const updated = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", actionedBy: adminId, actionedAt: new Date() },
    include: { leaveType: { select: { name: true } } },
  });

  // Create ON_LEAVE attendance records for each leave day (§28.8)
  await createLeaveAttendanceRecords(
    request.userId,
    request.startDate,
    request.endDate,
    request.isHalfDay,
  );

  // Check for low balance warning
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
    },
  });
  const { getSettingNumber } = await import("./settings.service.js");
  const lowThreshold = await getSettingNumber("leave_low_balance_threshold", 2);
  if (balance && balance.remaining <= lowThreshold && balance.remaining >= 0) {
    const { onLeaveBalanceLow } = await import("./notification-triggers.js");
    void onLeaveBalanceLow(request.userId, updated.leaveType.name, balance.remaining);
  }
  if (balance && balance.remaining <= 0) {
    const { onLeaveBalanceExhausted } = await import("./notification-triggers.js");
    void onLeaveBalanceExhausted(request.userId, updated.leaveType.name);
  }

  // Notify employee
  const { onLeaveApproved, onRecruiterLeaveApprovedForRM } =
    await import("./notification-triggers.js");
  const dates = `${request.startDate.toISOString().slice(0, 10)} - ${request.endDate.toISOString().slice(0, 10)}`;
  void onLeaveApproved(request.userId, updated.leaveType.name, dates, request.numberOfDays);

  // §28.6.3 — Notify assigned Reporting Manager(s)
  void onRecruiterLeaveApprovedForRM(request.userId, updated.leaveType.name, dates);

  return updated;
}

/**
 * Revoke a previously approved leave request (§28.3.1).
 * Restores balance, reverts attendance records.
 */
export async function revokeLeave(requestId: string, adminId: string, reason: string) {
  const prisma = getPrisma();
  const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Leave Request", requestId);
  if (request.status !== "APPROVED")
    throw new AppError(
      "Can only revoke approved requests",
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );

  // Restore balance
  const year = request.startDate.getFullYear();
  await prisma.leaveBalance.update({
    where: {
      userId_leaveTypeId_year: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
    },
    data: {
      used: { decrement: request.numberOfDays },
      remaining: { increment: request.numberOfDays },
    },
  });

  const updated = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: "REVOKED",
      revocationReason: reason,
      actionedBy: adminId,
      actionedAt: new Date(),
    },
    include: { leaveType: { select: { name: true } } },
  });

  // Revert ON_LEAVE attendance records to ABSENT (§28.8)
  await revertLeaveAttendanceRecords(request.userId, request.startDate, request.endDate);

  // Notify employee
  const { onLeaveRevoked } = await import("./notification-triggers.js");
  const dates = `${request.startDate.toISOString().slice(0, 10)} - ${request.endDate.toISOString().slice(0, 10)}`;
  void onLeaveRevoked(request.userId, updated.leaveType.name, dates, reason, request.numberOfDays);

  return updated;
}

/**
 * Create ON_LEAVE attendance records for each leave day.
 */
async function createLeaveAttendanceRecords(
  userId: string,
  startDate: Date,
  endDate: Date,
  isHalfDay: boolean,
) {
  const prisma = getPrisma();
  const { isHoliday } = await import("./holiday.service.js");
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Skip Sundays and holidays
    if (dayOfWeek !== 0 && !(await isHoliday(current))) {
      const dateKey = new Date(current.getFullYear(), current.getMonth(), current.getDate());
      await prisma.attendanceRecord.upsert({
        where: { userId_date: { userId, date: dateKey } },
        update: { status: isHalfDay ? "PRESENT_HALF" : "ON_LEAVE" },
        create: {
          userId,
          date: dateKey,
          status: isHalfDay ? "PRESENT_HALF" : "ON_LEAVE",
        },
      });
    }
    current.setDate(current.getDate() + 1);
  }
}

/**
 * Revert ON_LEAVE attendance records to ABSENT when leave is revoked.
 */
async function revertLeaveAttendanceRecords(userId: string, startDate: Date, endDate: Date) {
  const prisma = getPrisma();
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateKey = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    await prisma.attendanceRecord.updateMany({
      where: { userId, date: dateKey, status: "ON_LEAVE" },
      data: { status: "ABSENT" },
    });
    current.setDate(current.getDate() + 1);
  }
}

export async function rejectLeave(requestId: string, adminId: string, reason: string) {
  const prisma = getPrisma();
  const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Leave Request", requestId);

  const updated = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      actionedBy: adminId,
      actionedAt: new Date(),
    },
    include: { leaveType: { select: { name: true } } },
  });

  // Notify employee
  const { onLeaveRejected } = await import("./notification-triggers.js");
  const dates = `${request.startDate.toISOString().slice(0, 10)} - ${request.endDate.toISOString().slice(0, 10)}`;
  void onLeaveRejected(request.userId, updated.leaveType.name, dates, reason);

  return updated;
}

export async function cancelLeave(requestId: string, userId: string) {
  const prisma = getPrisma();
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { leaveType: { select: { name: true, id: true } } },
  });
  if (request?.userId !== userId) throw new NotFoundError("Leave Request", requestId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // §28.11 — Cancel pending request (always allowed)
  if (request.status === "PENDING") {
    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
      include: { leaveType: { select: { name: true } } },
    });
    const { onLeaveCancelled } = await import("./notification-triggers.js");
    const dates = `${request.startDate.toISOString().slice(0, 10)} - ${request.endDate.toISOString().slice(0, 10)}`;
    void onLeaveCancelled(userId, updated.leaveType.name, dates);
    return updated;
  }

  // §28.11 — Cancel approved leave before start date (restore balance)
  if (request.status === "APPROVED" && request.startDate > today) {
    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
      include: { leaveType: { select: { name: true } } },
    });

    // Restore leave balance
    const balance = await prisma.leaveBalance.findFirst({
      where: { userId, leaveTypeId: request.leaveType.id, year: request.startDate.getFullYear() },
    });
    if (balance) {
      const newUsed = Math.max(0, balance.used - request.numberOfDays);
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: newUsed,
          remaining:
            balance.totalAllotted + balance.carriedForward + balance.manualAdjustment - newUsed,
        },
      });
    }

    // Revert ON_LEAVE attendance records
    await revertLeaveAttendanceRecords(userId, request.startDate, request.endDate);

    const { onLeaveCancelled } = await import("./notification-triggers.js");
    const dates = `${request.startDate.toISOString().slice(0, 10)} - ${request.endDate.toISOString().slice(0, 10)}`;
    void onLeaveCancelled(userId, updated.leaveType.name, dates);
    return updated;
  }

  throw new AppError(
    request.status === "APPROVED"
      ? "Cannot cancel approved leave after start date. Contact admin to revoke."
      : "Can only cancel pending or future approved requests",
    HttpStatus.BAD_REQUEST,
    ErrorCode.VALIDATION_ERROR,
  );
}

export async function getUserLeaveRequests(userId: string) {
  const prisma = getPrisma();
  return prisma.leaveRequest.findMany({
    where: { userId },
    include: { leaveType: { select: { name: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserLeaveBalances(userId: string, year?: number) {
  const prisma = getPrisma();
  return prisma.leaveBalance.findMany({
    where: { userId, year: year ?? new Date().getFullYear() },
    include: { leaveType: { select: { name: true, code: true } } },
  });
}

export async function listAllLeaveRequests(filters: {
  status?: LeaveRequestStatus | undefined;
  userId?: string | undefined;
  userIds?: string[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const where: Prisma.LeaveRequestWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.userIds && filters.userIds.length > 0) {
    where.userId = { in: filters.userIds };
  } else if (filters.userId) {
    where.userId = filters.userId;
  }

  // Admin is excluded from the leave system entirely
  where.user = { role: { not: "ADMIN" } };

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, employeeId: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listLeaveTypes() {
  return cache.getOrSet(
    "leave_types:active",
    async () => {
      const prisma = getPrisma();
      return prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    },
    86400,
  ); // 24 hours
}

/**
 * Admin: list all leave balances across employees (§28.3.3).
 */
export async function listAllBalances(year?: number) {
  const prisma = getPrisma();
  return prisma.leaveBalance.findMany({
    where: { year: year ?? new Date().getFullYear() },
    include: {
      user: { select: { firstName: true, lastName: true, employeeId: true, role: true } },
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: [{ user: { firstName: "asc" } }, { leaveType: { name: "asc" } }],
  });
}

/**
 * Admin: adjust an employee's leave balance (credit/debit) with reason (§28.3.3).
 */
export async function adjustBalance(data: {
  userId: string;
  leaveTypeId: string;
  year: number;
  adjustment: number;
  reason: string;
  adjustedBy: string;
}) {
  const prisma = getPrisma();

  const balance = await prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: {
        userId: data.userId,
        leaveTypeId: data.leaveTypeId,
        year: data.year,
      },
    },
    update: {
      manualAdjustment: { increment: data.adjustment },
      remaining: { increment: data.adjustment },
    },
    create: {
      userId: data.userId,
      leaveTypeId: data.leaveTypeId,
      year: data.year,
      totalAllotted: 0,
      manualAdjustment: data.adjustment,
      used: 0,
      remaining: data.adjustment,
    },
  });

  // Record in balance history
  await prisma.leaveBalanceHistory.create({
    data: {
      leaveBalanceId: balance.id,
      changeType: data.adjustment > 0 ? "MANUAL_CREDIT" : "MANUAL_DEBIT",
      changeAmount: data.adjustment,
      balanceBefore: balance.remaining - data.adjustment,
      balanceAfter: balance.remaining,
      reason: data.reason,
      changedBy: data.adjustedBy,
    },
  });

  return balance;
}

/**
 * Admin: set annual allotment for an employee (§28.3.3).
 */
export async function setAnnualBalance(data: {
  userId: string;
  leaveTypeId: string;
  year: number;
  totalAllotted: number;
  setBy: string;
}) {
  const prisma = getPrisma();

  const existing = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId: data.userId,
        leaveTypeId: data.leaveTypeId,
        year: data.year,
      },
    },
  });

  const oldAllotted = existing?.totalAllotted ?? 0;
  const diff = data.totalAllotted - oldAllotted;

  const balance = await prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: {
        userId: data.userId,
        leaveTypeId: data.leaveTypeId,
        year: data.year,
      },
    },
    update: {
      totalAllotted: data.totalAllotted,
      remaining: { increment: diff },
    },
    create: {
      userId: data.userId,
      leaveTypeId: data.leaveTypeId,
      year: data.year,
      totalAllotted: data.totalAllotted,
      used: 0,
      remaining: data.totalAllotted,
    },
  });

  // Record in balance history
  await prisma.leaveBalanceHistory.create({
    data: {
      leaveBalanceId: balance.id,
      changeType: "ALLOTTED",
      changeAmount: diff,
      balanceBefore: balance.remaining - diff,
      balanceAfter: balance.remaining,
      reason: `Annual allotment set to ${data.totalAllotted}`,
      changedBy: data.setBy,
    },
  });

  return balance;
}

// ──────────────────────────────────────────────
//  Leave Policy Config (key-value settings)
// ──────────────────────────────────────────────

/** Get a leave policy config value by key */
export async function getLeavePolicyConfig(key: string) {
  const prisma = getPrisma();
  return prisma.leavePolicyConfig.findUnique({ where: { key } });
}

/** Set a leave policy config value */
export async function setLeavePolicyConfig(key: string, value: unknown) {
  const prisma = getPrisma();
  return prisma.leavePolicyConfig.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}

/** List all leave policy configs */
export async function listLeavePolicyConfigs() {
  const prisma = getPrisma();
  return prisma.leavePolicyConfig.findMany({ orderBy: { key: "asc" } });
}
