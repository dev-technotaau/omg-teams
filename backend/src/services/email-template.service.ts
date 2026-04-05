import { getPrisma } from "../config/database.js";
import * as templates from "../templates/email/index.js";

// ──────────────────────────────────────────────
//  Email Template Service — Spec Section 23.13
//
//  Templates live in src/templates/email/ as
//  TypeScript functions (enterprise pattern).
//
//  DB-stored customizations override file defaults.
//  Admin can customize subject + bodyHtml per key,
//  using {{variable}} placeholders (Handlebars-style).
// ──────────────────────────────────────────────

/**
 * Default templates generated from the file-based template system.
 * These use sample data to produce the Handlebars-compatible defaults
 * that the admin customization system expects.
 */
const DEFAULT_TEMPLATES: Record<
  string,
  { subject: string; bodyHtml: string; variables: string[] }
> = {
  daily_report: {
    ...toSubjectBody(templates.dailyReport("{{reportDate}}", "{{reportType}}", "{{downloadLink}}")),
    variables: ["reportDate", "reportType", "downloadLink"],
  },
  monthly_report: {
    ...toSubjectBody(
      templates.monthlyReport("{{reportMonth}}", "{{reportType}}", "{{downloadLink}}"),
    ),
    variables: ["reportMonth", "reportType", "downloadLink"],
  },
  account_created: {
    ...toSubjectBody(
      templates.accountCreated("{{userName}}", "{{employeeId}}", "{{role}}", "{{loginUrl}}"),
    ),
    variables: ["userName", "employeeId", "role", "loginUrl"],
  },
  password_reset: {
    ...toSubjectBody(templates.passwordReset("{{userName}}")),
    variables: ["userName"],
  },
  account_suspended: {
    ...toSubjectBody(templates.accountSuspended("{{userName}}", "{{reason}}")),
    variables: ["userName", "reason"],
  },
  account_reactivated: {
    ...toSubjectBody(templates.accountReactivated("{{userName}}")),
    variables: ["userName", "loginUrl"],
  },
  account_lockout: {
    ...toSubjectBody(
      templates.accountLockout("{{userName}}", "{{lockTimestamp}}", "{{unlockTime}}"),
    ),
    variables: ["userName", "lockTimestamp", "unlockTime"],
  },
  device_lock_blocked: {
    ...toSubjectBody(templates.deviceLockBlocked("{{userName}}", "{{deviceInfo}}")),
    variables: ["userName", "deviceInfo"],
  },
  "scheduled-report-delivery": {
    ...toSubjectBody(
      templates.scheduledReportDelivery(
        "{{reportName}}",
        "{{reportType}}",
        "{{generatedAt}}",
        "{{downloadLink}}",
        "{{recipientEmail}}",
      ),
    ),
    variables: ["reportName", "reportType", "generatedAt", "downloadLink", "recipientEmail"],
  },
  late_login_alert: {
    ...toSubjectBody(templates.lateLoginAlert("{{employeeName}}", "{{time}}", "{{expectedTime}}")),
    variables: ["employeeName", "time", "expectedTime"],
  },
  absent_alert: {
    ...toSubjectBody(templates.absentAlert("{{employeeName}}", "{{date}}")),
    variables: ["employeeName", "date"],
  },
  excessive_late_alert: {
    ...toSubjectBody(templates.excessiveLateAlert("{{employeeName}}", 0, 0, "{{month}}")),
    variables: ["employeeName", "lateCount", "threshold", "month"],
  },
  leave_request_submitted: {
    ...toSubjectBody(
      templates.leaveRequestSubmitted(
        "{{employeeName}}",
        "{{leaveType}}",
        "{{dates}}",
        0,
        "{{reason}}",
      ),
    ),
    variables: ["employeeName", "leaveType", "dates", "days", "reason"],
  },
  leave_approved: {
    ...toSubjectBody(templates.leaveApproved("{{userName}}", "{{leaveType}}", "{{dates}}", 0, 0)),
    variables: ["userName", "leaveType", "dates", "daysDeducted", "remainingBalance"],
  },
  leave_rejected: {
    ...toSubjectBody(
      templates.leaveRejected("{{userName}}", "{{leaveType}}", "{{dates}}", "{{reason}}"),
    ),
    variables: ["userName", "leaveType", "dates", "reason"],
  },
  leave_revoked: {
    ...toSubjectBody(
      templates.leaveRevoked("{{userName}}", "{{leaveType}}", "{{dates}}", "{{reason}}", 0),
    ),
    variables: ["userName", "leaveType", "dates", "reason", "daysRestored"],
  },
  leave_balance_low: {
    ...toSubjectBody(templates.leaveBalanceLow("{{userName}}", "{{leaveType}}", 0)),
    variables: ["userName", "leaveType", "remaining"],
  },
  document_uploaded: {
    ...toSubjectBody(templates.documentUploaded("{{employeeName}}", "{{documentType}}")),
    variables: ["employeeName", "documentType"],
  },
  document_verified: {
    ...toSubjectBody(templates.documentVerified("{{userName}}", "{{documentType}}")),
    variables: ["userName", "documentType"],
  },
  document_rejected: {
    ...toSubjectBody(templates.documentRejected("{{userName}}", "{{documentType}}", "{{reason}}")),
    variables: ["userName", "documentType", "reason"],
  },
  kyc_complete: {
    ...toSubjectBody(templates.kycComplete("{{userName}}")),
    variables: ["userName"],
  },
  kyc_reminder: {
    ...toSubjectBody(templates.kycReminder("{{userName}}", 0)),
    variables: ["userName", "pendingCount"],
  },
  email_change_otp: {
    ...toSubjectBody(templates.emailChangeOtp("{{userName}}", "{{otp}}", "{{newEmail}}")),
    variables: ["userName", "otp", "newEmail"],
  },
  email_change_confirmation: {
    ...toSubjectBody(
      templates.emailChangeConfirmation("{{userName}}", "{{oldEmail}}", "{{newEmail}}"),
    ),
    variables: ["userName", "oldEmail", "newEmail"],
  },
  password_change_confirmation: {
    ...toSubjectBody(templates.passwordChangeConfirmation("{{userName}}")),
    variables: ["userName"],
  },
  mobile_change_confirmation: {
    ...toSubjectBody(templates.mobileChangeConfirmation("{{userName}}", "{{newMobile}}")),
    variables: ["userName", "newMobile"],
  },
  profile_updated_by_admin: {
    ...toSubjectBody(templates.profileUpdatedByAdmin("{{userName}}", "{{changedFields}}")),
    variables: ["userName", "changedFields"],
  },
};

/** Convert an EmailTemplate to the { subject, bodyHtml } format used by the service */
function toSubjectBody(t: templates.EmailTemplate): { subject: string; bodyHtml: string } {
  return { subject: t.subject, bodyHtml: t.html };
}

export async function listTemplates() {
  const prisma = getPrisma();
  const stored = await prisma.emailTemplate.findMany({ orderBy: { templateKey: "asc" } });

  const templateMap = new Map(stored.map((t) => [t.templateKey, t]));
  const result = Object.entries(DEFAULT_TEMPLATES).map(([key, defaults]) => {
    const dbTemplate = templateMap.get(key);
    return {
      templateKey: key,
      subject: dbTemplate?.subject ?? defaults.subject,
      bodyHtml: dbTemplate?.bodyHtml ?? defaults.bodyHtml,
      updatedAt: dbTemplate?.updatedAt ?? null,
      updatedBy: dbTemplate?.updatedBy ?? null,
      isCustomized: !!dbTemplate,
      id: dbTemplate?.id ?? null,
    };
  });

  return result;
}

/** §23.13 — Get email template with Redis caching */
export async function getTemplate(templateKey: string) {
  // Try Redis cache first
  try {
    const { getRedisClient } = await import("../config/redis.js");
    const redis = getRedisClient();
    const cached = await redis.get(`email_template:${templateKey}`);
    if (cached)
      return JSON.parse(cached) as {
        templateKey: string;
        subject: string;
        bodyHtml: string;
        isCustomized: boolean;
      };
  } catch {
    // Redis unavailable — fall through
  }

  const prisma = getPrisma();
  const stored = await prisma.emailTemplate.findUnique({ where: { templateKey } });
  const defaults = DEFAULT_TEMPLATES[templateKey];
  if (!stored && !defaults) return null;
  const result = {
    templateKey,
    subject: stored?.subject ?? defaults?.subject ?? "",
    bodyHtml: stored?.bodyHtml ?? defaults?.bodyHtml ?? "",
    isCustomized: !!stored,
  };

  // Cache for 10 minutes
  try {
    const { getRedisClient } = await import("../config/redis.js");
    const redis = getRedisClient();
    await redis.set(`email_template:${templateKey}`, JSON.stringify(result), "EX", 600);
  } catch {
    // non-critical
  }

  return result;
}

export async function updateTemplate(
  templateKey: string,
  data: { subject: string; bodyHtml: string },
  updatedBy: string,
) {
  const prisma = getPrisma();
  const result = await prisma.emailTemplate.upsert({
    where: { templateKey },
    update: { subject: data.subject, bodyHtml: data.bodyHtml, updatedBy },
    create: { templateKey, subject: data.subject, bodyHtml: data.bodyHtml, updatedBy },
  });
  // Invalidate Redis cache
  try {
    const { getRedisClient } = await import("../config/redis.js");
    await getRedisClient().del(`email_template:${templateKey}`);
  } catch {
    /* non-critical */
  }
  return result;
}

export async function resetTemplate(templateKey: string) {
  const prisma = getPrisma();
  try {
    await prisma.emailTemplate.delete({ where: { templateKey } });
  } catch {
    // Template not in DB — already using defaults
  }
  const defaults = DEFAULT_TEMPLATES[templateKey];
  return defaults ? { subject: defaults.subject, bodyHtml: defaults.bodyHtml } : null;
}

export function getAvailableVariables(templateKey: string): string[] {
  return DEFAULT_TEMPLATES[templateKey]?.variables ?? [];
}

export function renderTemplate(
  template: { subject: string; bodyHtml: string },
  variables: Record<string, string>,
) {
  let subject = template.subject;
  let bodyHtml = template.bodyHtml;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value);
    bodyHtml = bodyHtml.replaceAll(placeholder, value);
  }
  return { subject, bodyHtml };
}

// ──────────────────────────────────────────────
//  Direct template rendering (bypass DB overrides)
//
//  Use these when you want the enterprise template
//  directly, without Handlebars variable substitution.
//  The templates are fully rendered with actual data.
// ──────────────────────────────────────────────

export { templates };
