import { Worker, type Job } from "bullmq";
import { getPrisma } from "../config/database.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Session Expiry Worker
//
//  §4: "If a session expires due to idle timeout
//  without explicit logout, the session expiry
//  timestamp is recorded as the Punch Out time."
//
//  Detects open attendance records where the user
//  has no active Redis session (expired) and records
//  the current time as punch-out.
// ──────────────────────────────────────────────

export function startSessionExpiryWorker(): Worker {
  const worker = new Worker(
    "session-expiry",
    async (job: Job) => {
      await processSessionExpiryCheck(job);
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "session-expiry", status: "completed" });
    logger.debug(`Session expiry check job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "session-expiry", status: "failed" });
    logger.error(`Session expiry check job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("session-expiry", err.message),
    );
  });

  getRedisSubscriber();

  logger.info("Session expiry worker started");
  return worker;
}

async function processSessionExpiryCheck(_job: Job): Promise<void> {
  const prisma = getPrisma();
  const redis = getRedisClient();
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find open attendance records (punched in, not punched out) for today
  const openRecords = await prisma.attendanceRecord.findMany({
    where: {
      date: todayDate,
      punchInTime: { not: null },
      punchOutTime: null,
      midnightResetApplied: false,
      status: { notIn: ["ON_LEAVE", "HOLIDAY", "WEEKEND"] },
    },
    select: {
      id: true,
      userId: true,
      punchInTime: true,
      user: { select: { role: true } },
    },
  });

  if (openRecords.length === 0) return;

  // Read attendance config for calculations
  const breakConfig = await prisma.attendanceConfig.findUnique({
    where: { key: "breakDeductionMinutes" },
  });
  const standardConfig = await prisma.attendanceConfig.findUnique({
    where: { key: "standardDayMinutes" },
  });
  const halfDayConfig = await prisma.attendanceConfig.findUnique({
    where: { key: "halfDayThresholdMinutes" },
  });
  const breakMins = breakConfig ? Number(breakConfig.value) : 60;
  const standardDayMins = standardConfig ? Number(standardConfig.value) : 480;
  const halfDayMins = halfDayConfig ? Number(halfDayConfig.value) : 240;

  let punchedOutCount = 0;

  for (const record of openRecords) {
    // Skip admin — admin sessions aren't idle-timed
    if (record.user.role === "ADMIN") continue;

    // Check if user has an active Redis session
    const sessionId = await redis.get(`user_session:${record.userId}`);
    if (sessionId) {
      // User still has active session — skip
      const sessionData = await redis.get(`session:${sessionId}`);
      if (sessionData) continue;
    }

    // No active session → session expired, punch out
    if (!record.punchInTime) continue;

    const grossMinutes = Math.max(
      0,
      Math.floor((now.getTime() - record.punchInTime.getTime()) / 60_000),
    );
    const netMinutes = Math.max(0, grossMinutes - breakMins);
    const overtimeMinutes = Math.max(0, netMinutes - standardDayMins);
    const isHalfDay = netMinutes < halfDayMins && netMinutes > 0;

    const updateData: Record<string, unknown> = {
      punchOutTime: now,
      grossWorkingMinutes: grossMinutes,
      netWorkingMinutes: netMinutes,
      overtimeMinutes,
    };
    if (isHalfDay) updateData["status"] = "PRESENT_HALF";

    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: updateData,
    });

    punchedOutCount++;
    logger.info("Session-expiry punch-out", { userId: record.userId });
  }

  if (punchedOutCount > 0) {
    logger.info("Session expiry check: punched out expired sessions", { count: punchedOutCount });
  }
}
