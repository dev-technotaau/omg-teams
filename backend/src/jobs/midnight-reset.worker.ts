import { Worker, type Job } from "bullmq";
import { getPrisma } from "../config/database.js";
import { jobsProcessed } from "../config/metrics.js";
import { getRedisClient, getRedisSubscriber } from "../config/redis.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Midnight Reset Worker
//
//  1. Revoke all active sessions
//  2. Auto punch-out attendance records still open
// ──────────────────────────────────────────────

export function startMidnightResetWorker(): Worker {
  const worker = new Worker(
    "midnight-reset",
    async (job: Job) => {
      await processMidnightReset(job);
    },
    {
      connection: getRedisClient(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    jobsProcessed.inc({ queue: "midnight-reset", status: "completed" });
    logger.debug(`Midnight reset job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    jobsProcessed.inc({ queue: "midnight-reset", status: "failed" });
    logger.error(`Midnight reset job ${job?.id} failed`, { error: err.message });
    void import("../services/notification-triggers.js").then(({ onJobFailed }) =>
      onJobFailed("midnight-reset", err.message),
    );
  });

  getRedisSubscriber();

  logger.info("Midnight reset worker started");
  return worker;
}

async function processMidnightReset(job: Job): Promise<void> {
  const prisma = getPrisma();
  const redis = getRedisClient();
  const now = new Date();

  // ── 1. Revoke all active NON-ADMIN sessions ──
  // §4: "Admin sessions are NOT affected."
  // Find non-admin users with active sessions, destroy their Redis + DB sessions.
  const activeSessions = await prisma.session.findMany({
    where: { revokedAt: null },
    select: { id: true, token: true, userId: true, user: { select: { role: true } } },
  });

  let revokedCount = 0;
  for (const session of activeSessions) {
    if (session.user.role === "ADMIN") continue; // Skip admin sessions

    // Revoke DB session
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });

    // Destroy Redis session
    await redis.del(`session:${session.token}`);
    await redis.del(`user_session:${session.userId}`);

    revokedCount++;
  }

  logger.info("Midnight reset: non-admin sessions revoked", { count: revokedCount });

  // ── 2. Auto punch-out open attendance records ──
  //    Find records for today (or any day) where punch-out is missing
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const openRecords = await prisma.attendanceRecord.findMany({
    where: {
      date: today,
      punchOutTime: null,
      midnightResetApplied: false,
      punchInTime: { not: null },
    },
    select: {
      id: true,
      userId: true,
      punchInTime: true,
    },
  });

  if (openRecords.length > 0) {
    // Set punch-out to 23:59:59 of today
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 0);

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

    let updatedCount = 0;
    for (const record of openRecords) {
      if (!record.punchInTime) continue;

      const grossMinutes = Math.max(
        0,
        Math.floor((endOfDay.getTime() - record.punchInTime.getTime()) / 60_000),
      );
      const netMinutes = Math.max(0, grossMinutes - breakMins);
      const overtimeMinutes = Math.max(0, netMinutes - standardDayMins);
      const isHalfDay = netMinutes < halfDayMins && netMinutes > 0;

      const updateData: Record<string, unknown> = {
        punchOutTime: endOfDay,
        grossWorkingMinutes: grossMinutes,
        netWorkingMinutes: netMinutes,
        overtimeMinutes,
        midnightResetApplied: true,
        // §27.1 — Flag as INCOMPLETE (punch-out was auto-set at midnight, not explicit)
        status: isHalfDay ? "PRESENT_HALF" : "INCOMPLETE",
      };

      await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: updateData,
      });
      updatedCount++;

      // §27.1 — Notify admin of incomplete attendance (punch-out missing)
      try {
        const { onIncompleteAttendance } = await import("../services/notification-triggers.js");
        void onIncompleteAttendance(record.userId, today.toISOString().slice(0, 10));
      } catch {
        /* non-critical */
      }
    }

    logger.info("Midnight reset: attendance records auto-punched-out", {
      count: updatedCount,
    });
  } else {
    logger.info("Midnight reset: no open attendance records to reset");
  }

  await job.updateProgress(100);
}
