import { createNotification } from "./notification.service.js";
import { getPrisma } from "../config/database.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Notification Triggers — Spec Section 11.4
//  Centralized notification creation for events
// ──────────────────────────────────────────────

/** Helper to get admin user IDs for admin-targeted notifications */
async function getAdminUserIds(): Promise<string[]> {
  const prisma = getPrisma();
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** Helper to get user's name */
async function getUserName(userId: string): Promise<string> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  return user ? `${user.firstName} ${user.lastName}` : "Unknown";
}

/** Helper to notify all admins.
 *  Honors PlatformSetting `notification_admin_emails` (CSV of extra emails
 *  that get the alert via email even if they're not admin users).
 *  `category` is used to gate event-specific toggles like
 *  `notification_device_mismatch` / `notification_suspicious_activity`.
 */
async function notifyAdmins(data: {
  type: Parameters<typeof createNotification>[0]["type"];
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  category?: "device_mismatch" | "suspicious_activity";
}) {
  const { getSettingBool, getSettingCSV } = await import("./settings.service.js");

  // Per-event kill switches
  if (data.category === "device_mismatch") {
    if (!(await getSettingBool("notification_device_mismatch", true))) return;
  }
  if (data.category === "suspicious_activity") {
    if (!(await getSettingBool("notification_suspicious_activity", true))) return;
  }

  const adminIds = await getAdminUserIds();
  for (const adminId of adminIds) {
    try {
      await createNotification({
        userId: adminId,
        type: data.type,
        title: data.title,
        message: data.message,
        ...(data.actionUrl !== undefined ? { actionUrl: data.actionUrl } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      });
    } catch (err) {
      logger.error("Failed to send admin notification", { adminId, error: err });
    }
  }

  // Extra recipients from PlatformSetting (system alerts to ops mailbox etc.)
  const extraEmails = await getSettingCSV("notification_admin_emails", []);
  if (extraEmails.length > 0) {
    try {
      const { enqueueEmail } = await import("../jobs/email.queue.js");
      for (const to of extraEmails) {
        void enqueueEmail({
          to,
          subject: `[OMG Teams] ${data.title}`,
          template: "system_alert",
          context: {
            title: data.title,
            message: data.message,
            actionUrl: data.actionUrl ?? null,
          },
        });
      }
    } catch {
      /* non-critical — primary notification path already fired */
    }
  }
}

// ──────────────────────────────────────────────
//  LEAVE NOTIFICATIONS (§11.4)
// ──────────────────────────────────────────────

/** Leave request submitted → notify admin */
export async function onLeaveRequestSubmitted(
  requestId: string,
  userId: string,
  leaveType: string,
  dates: string,
  days: number,
  reason: string,
) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "LEAVE",
    title: "New Leave Request",
    message: `${name} submitted a ${leaveType} request for ${dates} (${days} days). Reason: ${reason.slice(0, 80)}`,
    actionUrl: "/admin/leave-management",
    metadata: { requestId, userId },
  });
}

/** Leave approved → notify employee */
export async function onLeaveApproved(
  userId: string,
  leaveType: string,
  dates: string,
  daysDeducted: number,
) {
  await createNotification({
    userId,
    type: "LEAVE",
    title: "Leave Approved",
    message: `Your ${leaveType} for ${dates} has been approved. ${daysDeducted} day(s) deducted.`,
    actionUrl: "/leave",
  });
}

/** Leave rejected → notify employee */
export async function onLeaveRejected(
  userId: string,
  leaveType: string,
  dates: string,
  reason: string,
) {
  await createNotification({
    userId,
    type: "LEAVE",
    title: "Leave Rejected",
    message: `Your ${leaveType} for ${dates} has been rejected. Reason: ${reason}`,
    actionUrl: "/leave",
  });
}

/** Leave cancelled by employee → notify admin */
export async function onLeaveCancelled(userId: string, leaveType: string, dates: string) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "LEAVE",
    title: "Leave Request Cancelled",
    message: `${name} has cancelled their ${leaveType} request for ${dates}.`,
    actionUrl: "/admin/leaves",
    metadata: { userId },
  });
}

/** Leave revoked by admin → notify employee */
export async function onLeaveRevoked(
  userId: string,
  leaveType: string,
  dates: string,
  reason: string,
  daysRestored: number,
) {
  await createNotification({
    userId,
    type: "LEAVE",
    title: "Leave Revoked",
    message: `Your approved ${leaveType} for ${dates} has been revoked. Reason: ${reason}. ${daysRestored} day(s) restored to your balance.`,
    actionUrl: "/leaves",
  });
}

/** Leave balance low warning → notify employee */
export async function onLeaveBalanceLow(userId: string, leaveType: string, remaining: number) {
  await createNotification({
    userId,
    type: "LEAVE",
    title: "Leave Balance Low",
    message: `Your ${leaveType} balance is low: only ${remaining} day(s) remaining.`,
    actionUrl: "/leaves",
  });
}

/** Leave balance exhausted → notify admin */
export async function onLeaveBalanceExhausted(userId: string, leaveType: string) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "LEAVE",
    title: "Leave Balance Exhausted",
    message: `${name}'s ${leaveType} balance has been exhausted (0 days remaining).`,
    actionUrl: "/admin/leaves",
    metadata: { userId },
  });
}

// ──────────────────────────────────────────────
//  DOCUMENT / KYC NOTIFICATIONS (§11.4)
// ──────────────────────────────────────────────

/** Document uploaded → notify admin */
export async function onDocumentUploaded(userId: string, documentType: string) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "DOCUMENT",
    title: "Document Uploaded",
    message: `${name} uploaded ${documentType}. Review and verify.`,
    actionUrl: "/admin/documents",
    metadata: { userId },
  });
}

/** Document verified → notify employee */
export async function onDocumentVerified(userId: string, documentType: string) {
  await createNotification({
    userId,
    type: "DOCUMENT",
    title: "Document Verified",
    message: `Your ${documentType} has been verified.`,
    actionUrl: "/documents",
  });
}

/** Document rejected → notify employee */
export async function onDocumentRejected(userId: string, documentType: string, reason: string) {
  await createNotification({
    userId,
    type: "DOCUMENT",
    title: "Document Rejected",
    message: `Your ${documentType} has been rejected. Reason: ${reason}. Please re-upload.`,
    actionUrl: "/documents",
  });
}

// ──────────────────────────────────────────────
//  ATTENDANCE NOTIFICATIONS (§11.4)
// ──────────────────────────────────────────────

/** Late login → notify admin + employee */
export async function onLateLogin(userId: string, time: string) {
  const name = await getUserName(userId);
  await createNotification({
    userId,
    type: "ATTENDANCE",
    title: "Late Login",
    message: `You logged in late today at ${time}.`,
    actionUrl: "/attendance",
  });
  await notifyAdmins({
    type: "ATTENDANCE",
    title: "Late Login",
    message: `${name} logged in late at ${time}.`,
    actionUrl: "/admin/attendance",
    metadata: { userId },
  });
}

/** Absent detected → notify admin + RM */
export async function onAbsentDetected(userId: string, name: string) {
  await notifyAdmins({
    type: "ATTENDANCE",
    title: "Employee Absent",
    message: `${name} has not logged in today.`,
    actionUrl: "/admin/attendance",
    metadata: { userId },
  });
}

/** Incomplete attendance (missing punch out) → notify admin */
export async function onIncompleteAttendance(userId: string, date: string) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "ATTENDANCE",
    title: "Incomplete Attendance",
    message: `${name}'s attendance record for ${date} is incomplete — no punch out recorded.`,
    actionUrl: "/admin/attendance",
    metadata: { userId },
  });
}

/** Excessive late count exceeded → notify admin */
export async function onExcessiveLateCount(userId: string, lateCount: number, threshold: number) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "ATTENDANCE",
    title: "Excessive Late Logins",
    message: `${name} has been late ${lateCount} times this month — exceeds the threshold of ${threshold}.`,
    actionUrl: "/admin/attendance",
    metadata: { userId, lateCount, threshold },
  });
}

// ──────────────────────────────────────────────
//  REPORT NOTIFICATIONS (§11.4)
// ──────────────────────────────────────────────

/** Report generated → notify requester */
export async function onReportGenerated(userId: string, reportType: string) {
  await createNotification({
    userId,
    type: "REPORT",
    title: "Report Ready",
    message: `Your ${reportType} report is ready for download.`,
    actionUrl: "/admin/reports-management",
  });
}

/** Scheduled report sent → notify admin */
export async function onScheduledReportSent(reportName: string, recipientCount: number) {
  await notifyAdmins({
    type: "REPORT",
    title: "Scheduled Report Sent",
    message: `${reportName} scheduled report sent to ${recipientCount} recipient(s).`,
    actionUrl: "/admin/reports-management",
  });
}

/** Scheduled report failed → notify admin */
export async function onScheduledReportFailed(reportName: string, error: string) {
  await notifyAdmins({
    type: "REPORT",
    title: "Scheduled Report Failed",
    message: `Scheduled report "${reportName}" failed to generate. Error: ${error.slice(0, 100)}`,
    actionUrl: "/admin/reports-management",
  });
}

// ──────────────────────────────────────────────
//  ACCOUNT NOTIFICATIONS (§11.4)
// ──────────────────────────────────────────────

/** Account created → notify admin */
export async function onAccountCreated(userId: string, name: string, role: string) {
  await notifyAdmins({
    type: "ACCOUNT",
    title: "New Account Created",
    message: `New account created: ${name} (${role}).`,
    actionUrl: "/admin/users",
    metadata: { userId },
  });
}

/** Password reset → notify employee */
export async function onPasswordReset(userId: string) {
  await createNotification({
    userId,
    type: "ACCOUNT",
    title: "Password Reset",
    message: "Your password was reset by Admin.",
  });
}

/** Account suspended → notify employee */
export async function onAccountSuspended(userId: string) {
  await createNotification({
    userId,
    type: "ACCOUNT",
    title: "Account Suspended",
    message: "Your account has been suspended. Contact Admin.",
  });
}

/** Account reactivated → notify employee */
export async function onAccountReactivated(userId: string) {
  await createNotification({
    userId,
    type: "ACCOUNT",
    title: "Account Reactivated",
    message: "Your account has been reactivated.",
  });
}

// ──────────────────────────────────────────────
//  TARGET NOTIFICATIONS (§11.4)
//
//  All target triggers respect the user's TARGET notification
//  preference toggle. This is in addition to the broader push/email
//  channel checks that createNotification performs internally.
// ──────────────────────────────────────────────

/** Check if user has TARGET notifications enabled (default: true) */
async function targetNotificationsEnabled(userId: string): Promise<boolean> {
  const { shouldNotify } = await import("./notification-preference.service.js");
  return shouldNotify(userId, "TARGET");
}

/** Target assigned → notify recruiter */
export async function onTargetAssigned(
  recruiterId: string,
  targetType: string,
  targetValue: number,
) {
  if (!(await targetNotificationsEnabled(recruiterId))) return;
  await createNotification({
    userId: recruiterId,
    type: "TARGET",
    title: "New Target Assigned",
    message: `A new ${targetType.toLowerCase()} target of ${targetValue} has been assigned to you.`,
    actionUrl: "/my-targets",
  });
}

/** Target updated → notify recruiter */
export async function onTargetUpdated(
  recruiterId: string,
  targetType: string,
  targetValue: number,
) {
  if (!(await targetNotificationsEnabled(recruiterId))) return;
  await createNotification({
    userId: recruiterId,
    type: "TARGET",
    title: "Target Updated",
    message: `Your ${targetType.toLowerCase()} target has been updated to ${targetValue}.`,
    actionUrl: "/my-targets",
  });
}

/**
 * Target achieved → notify recruiter and assigned RMs.
 *
 * §11.4 — Idempotent per (recruiter, period) so the notification
 * fires once per period (day/week/month). De-duplication is enforced
 * by the caller (target.service.checkAndFireAchievement) using a
 * Redis lock.
 */
export async function onTargetAchieved(
  recruiterId: string,
  count: number,
  targetType: "DAILY" | "WEEKLY" | "MONTHLY" = "DAILY",
) {
  const enabled = await targetNotificationsEnabled(recruiterId);
  const periodLabel =
    targetType === "DAILY" ? "daily" : targetType === "WEEKLY" ? "weekly" : "monthly";

  if (enabled) {
    await createNotification({
      userId: recruiterId,
      type: "TARGET",
      title: `${targetType[0]}${targetType.slice(1).toLowerCase()} Target Achieved!`,
      message: `You reached your ${periodLabel} target: ${count} candidates sourced!`,
      actionUrl: "/my-targets",
    });
  }
  // RMs are notified independently of the recruiter's preference —
  // it's the manager's preference that gates their delivery.
  await notifyAssignedManagers(recruiterId, {
    type: "TARGET",
    title: "Recruiter Target Achieved",
    message: `${await getUserName(recruiterId)} reached their ${periodLabel} target (${count}).`,
    actionUrl: "/my-recruiters",
    metadata: { recruiterId, targetType, count },
  });
}

// ──────────────────────────────────────────────
//  MISSING TRIGGERS — §11.4 (added Phase 9)
// ──────────────────────────────────────────────

/** Helper to notify assigned Reporting Managers for a recruiter */
async function notifyAssignedManagers(
  recruiterId: string,
  data: {
    type: Parameters<typeof createNotification>[0]["type"];
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const assignments = await prisma.recruiterManagerAssignment.findMany({
    where: { recruiterId, removedAt: null },
    select: { managerId: true },
  });
  for (const a of assignments) {
    try {
      await createNotification({ userId: a.managerId, ...data });
    } catch (err) {
      logger.error("Failed to send RM notification", { managerId: a.managerId, error: err });
    }
  }
}

/** Half-day detected → notify admin + employee + assigned RM */
export async function onHalfDayDetected(userId: string, date: string, hoursWorked: number) {
  const name = await getUserName(userId);
  await createNotification({
    userId,
    type: "ATTENDANCE",
    title: "Half Day Recorded",
    message: `Today recorded as half day (${hoursWorked}h worked).`,
    actionUrl: "/attendance",
  });
  await notifyAdmins({
    type: "ATTENDANCE",
    title: "Half Day Detected",
    message: `${name} recorded a half day on ${date} (${hoursWorked} hours worked).`,
    actionUrl: "/admin/attendance",
    metadata: { userId },
  });
  await notifyAssignedManagers(userId, {
    type: "ATTENDANCE",
    title: "Team Member Half Day",
    message: `${name} recorded a half day today.`,
    actionUrl: "/my-recruiters",
    metadata: { userId },
  });
}

/** Device reset by admin → notify employee */
export async function onDeviceReset(userId: string) {
  await createNotification({
    userId,
    type: "ACCOUNT",
    title: "Device Binding Reset",
    message: "Your device binding was reset by Admin. Please login again.",
  });
}

/** Session revoked by admin → notify employee */
export async function onSessionRevoked(userId: string) {
  await createNotification({
    userId,
    type: "ACCOUNT",
    title: "Session Revoked",
    message: "Your session was revoked by Admin.",
  });
}

/** KYC complete → notify employee + admin */
export async function onKycComplete(userId: string) {
  const name = await getUserName(userId);
  await createNotification({
    userId,
    type: "DOCUMENT",
    title: "KYC Complete",
    message: "Your KYC is complete — all documents verified.",
    actionUrl: "/documents",
  });
  await notifyAdmins({
    type: "DOCUMENT",
    title: "Employee KYC Complete",
    message: `${name} has completed KYC — all documents verified.`,
    actionUrl: "/admin/documents",
    metadata: { userId },
  });
}

/** Recruiter submits candidate reports → notify admin + assigned RM */
export async function onReportSubmitted(recruiterId: string, count: number) {
  const name = await getUserName(recruiterId);
  await notifyAdmins({
    type: "REPORT",
    title: "Reports Submitted",
    message: `${name} submitted ${count} candidate report(s) today.`,
    actionUrl: "/admin/reports",
    metadata: { recruiterId },
  });
  await notifyAssignedManagers(recruiterId, {
    type: "REPORT",
    title: "Recruiter Report Submitted",
    message: `${name} submitted ${count} candidate report(s) today.`,
    actionUrl: "/my-recruiters",
    metadata: { recruiterId },
  });
}

/** RM notification — assigned recruiter logged in late */
export async function onRecruiterLateForRM(recruiterId: string, time: string) {
  const name = await getUserName(recruiterId);
  await notifyAssignedManagers(recruiterId, {
    type: "ATTENDANCE",
    title: "Recruiter Late Login",
    message: `${name} logged in late at ${time}.`,
    actionUrl: "/my-recruiters",
    metadata: { recruiterId },
  });
}

/** RM notification — assigned recruiter absent */
export async function onRecruiterAbsentForRM(recruiterId: string) {
  const name = await getUserName(recruiterId);
  await notifyAssignedManagers(recruiterId, {
    type: "ATTENDANCE",
    title: "Recruiter Absent",
    message: `${name} has not logged in today.`,
    actionUrl: "/my-recruiters",
    metadata: { recruiterId },
  });
}

/** RM notification — assigned recruiter's leave approved */
export async function onRecruiterLeaveApprovedForRM(
  recruiterId: string,
  leaveType: string,
  dates: string,
) {
  const name = await getUserName(recruiterId);
  await notifyAssignedManagers(recruiterId, {
    type: "LEAVE",
    title: "Recruiter Leave Approved",
    message: `${name}'s ${leaveType} for ${dates} has been approved. They will be on leave.`,
    actionUrl: "/my-recruiters",
    metadata: { recruiterId },
  });
}

/** Login blocked (device mismatch) → notify admin */
export async function onLoginBlocked(userId: string, deviceInfo: string) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "ACCOUNT",
    title: "Login Blocked (Device Mismatch)",
    message: `Login attempt blocked for ${name} — device mismatch. Device: ${deviceInfo.slice(0, 50)}`,
    actionUrl: "/admin/users",
    metadata: { userId },
    category: "device_mismatch",
  });
}

/**
 * §16 — Login anomaly blocked (new country / impossible travel).
 * Notifies BOTH the affected user (so they know their account was targeted)
 * AND admins (for security visibility).
 */
export async function onLoginAnomalyBlocked(
  userId: string,
  reason: string,
  country: string | undefined,
) {
  const name = await getUserName(userId);
  const where = country ? ` from ${country}` : "";

  // Notify the user themselves — most important signal: "your account is
  // being targeted." Ignored if user has no notification channel — that's
  // fine, the admin notification is the backstop.
  try {
    await createNotification({
      userId,
      type: "ACCOUNT",
      title: "Login Attempt Blocked",
      message: `A login to your account was blocked${where}. If this was you, contact your admin for a backup code. If not, your password may be compromised — change it immediately.`,
      actionUrl: "/profile",
      metadata: { reason },
    });
  } catch (err) {
    logger.error("Failed to send anomaly notification to user", { userId, error: err });
  }

  await notifyAdmins({
    type: "ACCOUNT",
    title: "Login Blocked (Anomaly)",
    message: `${name}: ${reason.slice(0, 120)}`,
    actionUrl: "/admin/users",
    metadata: { userId, reason, country },
    category: "suspicious_activity",
  });
}

/** Account lockout → notify admin */
export async function onAccountLockout(userId: string, attempts: number) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "ACCOUNT",
    title: "Account Locked",
    message: `${name}'s account locked after ${attempts} failed login attempts.`,
    actionUrl: "/admin/users",
    metadata: { userId },
  });
}

/** Backup code used → notify admin (§11.4.1) */
export async function onBackupCodeUsed(userId: string) {
  const name = await getUserName(userId);
  await notifyAdmins({
    type: "ACCOUNT",
    title: "Backup Code Used",
    message: `${name} used a backup code to login from a new device.`,
    actionUrl: "/admin/users",
    metadata: { userId },
  });
}

/** BullMQ job failed → notify admin (§11.4.1) */
export async function onJobFailed(jobName: string, error: string) {
  await notifyAdmins({
    type: "SYSTEM",
    title: "Background Job Failed",
    message: `Background job "${jobName}" failed. Reason: ${error.slice(0, 100)}`,
  });
}

/** Cloud storage cleanup complete → notify admin (§11.4.1) */
export async function onStorageCleanupComplete(filesRemoved: number) {
  await notifyAdmins({
    type: "SYSTEM",
    title: "Storage Cleanup Complete",
    message: `Auto-cleanup removed ${filesRemoved} expired report files.`,
  });
}

/** Database backup complete → notify admin (§11.4.1) */
export async function onDatabaseBackupComplete() {
  await notifyAdmins({
    type: "SYSTEM",
    title: "Database Backup Complete",
    message: "Daily database backup completed successfully.",
  });
}

/** Maintenance mode → notify all employees (§11.4.2) */
export async function onMaintenanceMode(startTime: string) {
  const prisma = getPrisma();
  const employees = await prisma.user.findMany({
    where: { role: { in: ["RECRUITER", "REPORTING_MANAGER"] }, status: "ACTIVE" },
    select: { id: true },
  });
  for (const emp of employees) {
    try {
      await createNotification({
        userId: emp.id,
        type: "SYSTEM",
        title: "Maintenance Scheduled",
        message: `Platform will be under maintenance from ${startTime}. Save your work.`,
      });
    } catch {
      // Continue sending to others
    }
  }
}

// ──────────────────────────────────────────────
//  TASK NOTIFICATIONS (§Task)
// ──────────────────────────────────────────────

interface TaskNotifyContext {
  taskId: string;
  subject: string;
  priority: string;
  endDate: Date;
}

/** New task assigned → notify each assignee */
export async function onTaskAssigned(assigneeIds: string[], ctx: TaskNotifyContext) {
  for (const userId of assigneeIds) {
    try {
      await createNotification({
        userId,
        type: "TASK",
        title: "New task assigned",
        message: `${ctx.subject} (${ctx.priority}) — due ${ctx.endDate.toLocaleDateString("en-IN")}`,
        actionUrl: `/my-tasks?taskId=${ctx.taskId}`,
        metadata: { taskId: ctx.taskId, priority: ctx.priority },
      });
    } catch (err) {
      logger.error("Failed to fire onTaskAssigned", { userId, taskId: ctx.taskId, error: err });
    }
  }
}

/** Employee submitted a task → notify admins for review */
export async function onTaskSubmitted(
  assignmentId: string,
  taskId: string,
  taskSubject: string,
  employeeId: string,
) {
  const employeeName = await getUserName(employeeId);
  await notifyAdmins({
    type: "TASK",
    title: "Task submitted for review",
    message: `${employeeName} submitted "${taskSubject}". Review and accept or reject.`,
    actionUrl: `/admin/tasks?reviewId=${assignmentId}`,
    metadata: { taskId, assignmentId, employeeId },
  });
}

/** Admin accepted a submission → notify the employee */
export async function onTaskAccepted(userId: string, taskSubject: string, taskId: string) {
  try {
    await createNotification({
      userId,
      type: "TASK",
      title: "Task accepted",
      message: `Your submission for "${taskSubject}" was accepted. ✅`,
      actionUrl: `/my-tasks?taskId=${taskId}`,
      metadata: { taskId },
    });
  } catch (err) {
    logger.error("Failed to fire onTaskAccepted", { userId, taskId, error: err });
  }
}

/** Admin rejected a submission → notify the employee */
export async function onTaskRejected(
  userId: string,
  taskSubject: string,
  taskId: string,
  reason: string,
) {
  try {
    await createNotification({
      userId,
      type: "TASK",
      title: "Task needs revision",
      message: `Your submission for "${taskSubject}" was rejected. Reason: ${reason}`,
      actionUrl: `/my-tasks?taskId=${taskId}`,
      metadata: { taskId, reason },
    });
  } catch (err) {
    logger.error("Failed to fire onTaskRejected", { userId, taskId, error: err });
  }
}

/** Admin cancelled a task → notify all assignees who haven't been accepted */
export async function onTaskCancelled(
  assigneeIds: string[],
  taskSubject: string,
  taskId: string,
  reason: string | null,
) {
  for (const userId of assigneeIds) {
    try {
      await createNotification({
        userId,
        type: "TASK",
        title: "Task cancelled",
        message: reason
          ? `"${taskSubject}" was cancelled. Reason: ${reason}`
          : `"${taskSubject}" was cancelled.`,
        actionUrl: `/my-tasks?taskId=${taskId}`,
        metadata: { taskId },
      });
    } catch (err) {
      logger.error("Failed to fire onTaskCancelled", { userId, taskId, error: err });
    }
  }
}

/** Task is overdue → daily scheduler can call this */
export async function onTaskOverdue(userId: string, taskSubject: string, taskId: string) {
  try {
    await createNotification({
      userId,
      type: "TASK",
      title: "Task overdue",
      message: `"${taskSubject}" is past its deadline. Please complete it as soon as possible.`,
      actionUrl: `/my-tasks?taskId=${taskId}`,
      metadata: { taskId },
    });
  } catch (err) {
    logger.error("Failed to fire onTaskOverdue", { userId, taskId, error: err });
  }
}

/** Reassignment → notify added and removed assignees */
export async function onTaskReassigned(
  addedIds: string[],
  removedIds: string[],
  taskSubject: string,
  taskId: string,
) {
  for (const userId of addedIds) {
    try {
      await createNotification({
        userId,
        type: "TASK",
        title: "New task assigned",
        message: `You were added to "${taskSubject}".`,
        actionUrl: `/my-tasks?taskId=${taskId}`,
        metadata: { taskId },
      });
    } catch (err) {
      logger.error("Failed to fire onTaskReassigned (added)", { userId, taskId, error: err });
    }
  }
  for (const userId of removedIds) {
    try {
      await createNotification({
        userId,
        type: "TASK",
        title: "Removed from task",
        message: `You were removed from "${taskSubject}".`,
        metadata: { taskId },
      });
    } catch (err) {
      logger.error("Failed to fire onTaskReassigned (removed)", { userId, taskId, error: err });
    }
  }
}

/** Dates were extended → notify all assignees */
export async function onTaskExtended(
  assigneeIds: string[],
  taskSubject: string,
  taskId: string,
  newEndDate: Date,
) {
  for (const userId of assigneeIds) {
    try {
      await createNotification({
        userId,
        type: "TASK",
        title: "Task deadline extended",
        message: `"${taskSubject}" — new deadline ${newEndDate.toLocaleDateString("en-IN")}`,
        actionUrl: `/my-tasks?taskId=${taskId}`,
        metadata: { taskId },
      });
    } catch (err) {
      logger.error("Failed to fire onTaskExtended", { userId, taskId, error: err });
    }
  }
}
