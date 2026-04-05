import { type AttendanceStatus, type Prisma } from "@prisma/client";
import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Attendance Service — Spec Section 27
// ──────────────────────────────────────────────

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Record punch-in (first login of the day only).
 * Called during login flow (Step 10).
 */
export async function punchIn(userId: string): Promise<void> {
  const prisma = getPrisma();
  const dateKey = today();

  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId, date: dateKey } },
  });

  if (existing?.punchInTime) return; // Already punched in today

  const now = new Date();

  // Check if user has approved leave today
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: "APPROVED",
      startDate: { lte: dateKey },
      endDate: { gte: dateKey },
    },
  });

  if (approvedLeave) {
    // On leave — record login for audit only, no working timer
    await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date: dateKey } },
      update: { leaveLoginAt: now },
      create: {
        userId,
        date: dateKey,
        status: "ON_LEAVE",
        leaveLoginAt: now,
      },
    });
    return;
  }

  // Check late status (cached for 1 hour)
  const lateConfig = await cache.getOrSet(
    "attendance:config:expectedLoginTime",
    () => getAttendanceConfig("expectedLoginTime"),
    3600,
  );
  const graceConfig = await cache.getOrSet(
    "attendance:config:gracePeriodMinutes",
    () => getAttendanceConfig("gracePeriodMinutes"),
    3600,
  );
  const expectedTime = String(lateConfig ?? "10:00");
  const graceMinutes = graceConfig ? Number(graceConfig) : 15;

  const [expH, expM] = expectedTime.split(":").map(Number) as [number, number];
  const lateThreshold = new Date(dateKey);
  lateThreshold.setHours(expH, expM + graceMinutes, 0, 0);

  const isLate = now > lateThreshold;
  const lateByMinutes = isLate ? Math.floor((now.getTime() - lateThreshold.getTime()) / 60000) : 0;

  await prisma.attendanceRecord.upsert({
    where: { userId_date: { userId, date: dateKey } },
    update: {
      punchInTime: now,
      status: "PRESENT_FULL",
      isLate,
      lateByMinutes: isLate ? lateByMinutes : null,
    },
    create: {
      userId,
      date: dateKey,
      punchInTime: now,
      status: isLate ? "LATE" : "PRESENT_FULL",
      isLate,
      lateByMinutes: isLate ? lateByMinutes : null,
    },
  });

  logger.info("Punch in recorded", { userId, isLate, lateByMinutes });

  // Notify on late login
  if (isLate) {
    const { onLateLogin, onExcessiveLateCount, onRecruiterLateForRM } =
      await import("./notification-triggers.js");
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    void onLateLogin(userId, timeStr);
    void onRecruiterLateForRM(userId, timeStr);

    // Check excessive late threshold
    const excessiveConfig = await cache.getOrSet(
      "attendance:config:excessiveLateThreshold",
      () => getAttendanceConfig("excessiveLateThreshold"),
      3600,
    );
    const threshold = excessiveConfig ? Number(excessiveConfig) : 5;
    const monthStart = new Date(dateKey.getFullYear(), dateKey.getMonth(), 1);
    const lateCountThisMonth = await prisma.attendanceRecord.count({
      where: { userId, isLate: true, date: { gte: monthStart } },
    });
    if (lateCountThisMonth >= threshold) {
      void onExcessiveLateCount(userId, lateCountThisMonth, threshold);
    }
  }
}

/**
 * Record punch-out (last logout of the day).
 */
export async function punchOut(userId: string): Promise<void> {
  const prisma = getPrisma();
  const dateKey = today();
  const now = new Date();

  const record = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId, date: dateKey } },
  });

  if (!record?.punchInTime) return; // Never punched in
  if (record.status === "ON_LEAVE") return; // On leave

  const grossMinutes = Math.floor((now.getTime() - record.punchInTime.getTime()) / 60000);
  const breakDeduction = await cache.getOrSet(
    "attendance:config:breakDeductionMinutes",
    () => getAttendanceConfig("breakDeductionMinutes"),
    3600,
  );
  const breakMins = breakDeduction ? Number(breakDeduction) : 60;
  const netMinutes = Math.max(0, grossMinutes - breakMins);

  // Half-day check (cached for 1 hour)
  const halfDayThreshold = await cache.getOrSet(
    "attendance:config:halfDayThresholdMinutes",
    () => getAttendanceConfig("halfDayThresholdMinutes"),
    3600,
  );
  const halfDayMins = halfDayThreshold ? Number(halfDayThreshold) : 240;
  const isHalfDay = netMinutes < halfDayMins && netMinutes > 0;

  // Overtime calculation
  const standardDayConfig = await cache.getOrSet(
    "attendance:config:standardDayMinutes",
    () => getAttendanceConfig("standardDayMinutes"),
    3600,
  );
  const standardDayMins = standardDayConfig ? Number(standardDayConfig) : 480;
  const overtimeMinutes = Math.max(0, netMinutes - standardDayMins);

  let status: AttendanceStatus = record.status;
  if (isHalfDay) status = "PRESENT_HALF";

  await prisma.attendanceRecord.update({
    where: { userId_date: { userId, date: dateKey } },
    data: {
      punchOutTime: now,
      grossWorkingMinutes: grossMinutes,
      netWorkingMinutes: netMinutes,
      overtimeMinutes,
      status,
    },
  });

  // Notify on half-day detection
  if (isHalfDay) {
    try {
      const { onHalfDayDetected } = await import("./notification-triggers.js");
      void onHalfDayDetected(
        userId,
        dateKey.toISOString().split("T")[0]!,
        Math.round((netMinutes / 60) * 10) / 10,
      );
    } catch {
      /* non-critical */
    }
  }
}

/**
 * Get attendance records for a user within a date range.
 */
export async function getUserAttendance(userId: string, dateFrom?: string, dateTo?: string) {
  const prisma = getPrisma();
  const where: Prisma.AttendanceRecordWhereInput = { userId };

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  return prisma.attendanceRecord.findMany({
    where,
    orderBy: { date: "desc" },
  });
}

/**
 * Get all attendance records (admin view) with filtering.
 */
export async function listAllAttendance(filters: {
  userId?: string | undefined;
  userIds?: string[] | undefined;
  date?: string | undefined;
  status?: AttendanceStatus | undefined;
  managerId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const skip = (page - 1) * limit;

  const where: Prisma.AttendanceRecordWhereInput = {};

  // §27.6 — Filter by Reporting Manager (show only assigned recruiters)
  if (filters.managerId) {
    const assignments = await prisma.recruiterManagerAssignment.findMany({
      where: { managerId: filters.managerId, removedAt: null },
      select: { recruiterId: true },
    });
    where.userId = { in: assignments.map((a) => a.recruiterId) };
  } else if (filters.userIds && filters.userIds.length > 0) {
    where.userId = { in: filters.userIds };
  } else if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.date) where.date = new Date(filters.date);
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, employeeId: true, role: true } },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Admin: edit punch times for an employee.
 */
export async function editAttendance(
  id: string,
  editorUserId: string,
  data: {
    punchInTime?: string | undefined;
    punchOutTime?: string | undefined;
    status?: AttendanceStatus | undefined;
    remarks?: string | undefined;
  },
) {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};

  if (data.punchInTime) {
    updateData["punchInTime"] = new Date(data.punchInTime);
    updateData["punchInEditedBy"] = editorUserId;
  }
  if (data.punchOutTime) {
    updateData["punchOutTime"] = new Date(data.punchOutTime);
    updateData["punchOutEditedBy"] = editorUserId;
  }

  // Recalculate working minutes if punch times changed
  if (data.punchInTime || data.punchOutTime) {
    const record = await prisma.attendanceRecord.findUnique({ where: { id } });
    if (record) {
      const pin = data.punchInTime ? new Date(data.punchInTime) : record.punchInTime;
      const pout = data.punchOutTime ? new Date(data.punchOutTime) : record.punchOutTime;
      if (pin && pout) {
        const grossMinutes = Math.floor((pout.getTime() - pin.getTime()) / 60000);
        const breakMins = Number((await getAttendanceConfig("breakDeductionMinutes")) ?? 60);
        const netMinutes = Math.max(0, grossMinutes - breakMins);
        const standardDayMins = Number((await getAttendanceConfig("standardDayMinutes")) ?? 480);
        const halfDayMins = Number((await getAttendanceConfig("halfDayThresholdMinutes")) ?? 240);

        updateData["grossWorkingMinutes"] = grossMinutes;
        updateData["netWorkingMinutes"] = netMinutes;
        updateData["overtimeMinutes"] = Math.max(0, netMinutes - standardDayMins);

        // Auto-update status based on hours if not explicitly set
        if (!data.status) {
          if (netMinutes < halfDayMins && netMinutes > 0) {
            updateData["status"] = "PRESENT_HALF";
          } else if (record.status === "PRESENT_HALF" && netMinutes >= halfDayMins) {
            updateData["status"] = "PRESENT_FULL";
          }
        }
      }
    }
  }

  if (data.status) updateData["status"] = data.status;
  if (data.remarks !== undefined) updateData["remarks"] = data.remarks;

  return prisma.attendanceRecord.update({ where: { id }, data: updateData });
}

// Helper: read attendance config
async function getAttendanceConfig(key: string): Promise<unknown> {
  return cache.getOrSet(
    `attendance_config:${key}`,
    async () => {
      const prisma = getPrisma();
      const config = await prisma.attendanceConfig.findUnique({ where: { key } });
      return config?.value ?? null;
    },
    3600, // 1 hour
  );
}

/**
 * Get all attendance configuration settings.
 */
export async function getAllAttendanceConfig(): Promise<Record<string, string>> {
  const prisma = getPrisma();
  const configs = await prisma.attendanceConfig.findMany();
  const result: Record<string, string> = {};
  for (const c of configs) {
    result[c.key] = String(c.value);
  }
  return result;
}

/**
 * Update an attendance configuration setting.
 */
export async function updateAttendanceConfig(key: string, value: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.attendanceConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  // Invalidate cache
  void cache.del(`attendance_config:${key}`);
}
