import { Worker, type Job } from "bullmq";
import { getPrisma } from "../config/database.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Absent Detection Worker — Spec §27.3, §27.5
//
//  At absent threshold time (default 12 PM), find
//  all non-admin users with no attendance record
//  for today and mark them ABSENT.
// ──────────────────────────────────────────────

export function startAbsentDetectionWorker(): Worker {
  const worker = new Worker(
    "absent-detection",
    async (job: Job) => {
      await processAbsentDetection(job);
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "absent-detection", status: "completed" });
    logger.debug(`Absent detection job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "absent-detection", status: "failed" });
    logger.error(`Absent detection job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("absent-detection", err.message),
    );
  });

  getRedisSubscriber();

  logger.info("Absent detection worker started");
  return worker;
}

async function processAbsentDetection(job: Job): Promise<void> {
  const prisma = getPrisma();
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get all active non-admin users
  const activeUsers = await prisma.user.findMany({
    where: {
      role: { in: ["RECRUITER", "REPORTING_MANAGER"] },
      status: "ACTIVE",
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (activeUsers.length === 0) {
    logger.info("Absent detection: no active employees");
    await job.updateProgress(100);
    return;
  }

  const userIds = activeUsers.map((u) => u.id);

  // Find users who already have an attendance record for today
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { userId: { in: userIds }, date: todayDate },
    select: { userId: true },
  });
  const recordedUserIds = new Set(existingRecords.map((r) => r.userId));

  // Check approved leaves for today
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: "APPROVED",
      startDate: { lte: todayDate },
      endDate: { gte: todayDate },
    },
    select: { userId: true },
  });
  const onLeaveUserIds = new Set(approvedLeaves.map((l) => l.userId));

  // Check if today is a holiday
  const holiday = await prisma.holiday.findUnique({
    where: { date: todayDate },
  });

  // Filter users with no record, no leave, and not a holiday
  const absentUsers = activeUsers.filter(
    (u) => !recordedUserIds.has(u.id) && !onLeaveUserIds.has(u.id) && !holiday,
  );

  if (absentUsers.length === 0) {
    logger.info("Absent detection: no absent employees found");
    await job.updateProgress(100);
    return;
  }

  // Create ABSENT records and notify
  let createdCount = 0;
  for (const user of absentUsers) {
    await prisma.attendanceRecord.create({
      data: {
        userId: user.id,
        date: todayDate,
        status: "ABSENT",
      },
    });
    createdCount++;
  }

  // Fire notifications for absent users (admin + RM)
  try {
    const { onAbsentDetected, onRecruiterAbsentForRM } =
      await import("../services/notification-triggers.js");
    for (const user of absentUsers) {
      void onAbsentDetected(user.id, `${user.firstName} ${user.lastName}`);
      void onRecruiterAbsentForRM(user.id);
    }
  } catch {
    logger.error("Failed to send absent notifications");
  }

  // Create ON_LEAVE records for users on approved leave who don't have a record yet
  for (const leaveUserId of onLeaveUserIds) {
    if (!recordedUserIds.has(leaveUserId)) {
      await prisma.attendanceRecord.create({
        data: {
          userId: leaveUserId,
          date: todayDate,
          status: "ON_LEAVE",
        },
      });
    }
  }

  // Create HOLIDAY records for all if today is a holiday
  if (holiday) {
    for (const user of activeUsers) {
      if (!recordedUserIds.has(user.id)) {
        await prisma.attendanceRecord.create({
          data: {
            userId: user.id,
            date: todayDate,
            status: "HOLIDAY",
          },
        });
      }
    }
  }

  logger.info("Absent detection completed", { absentCount: createdCount });
  await job.updateProgress(100);
}
