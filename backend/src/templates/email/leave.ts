import {
  type EmailTemplate,
  BRAND,
  emailLayout,
  heading,
  paragraph,
  greeting,
  button,
  successBox,
  dangerBox,
  warningBox,
  detailsTable,
  keyValue,
  signature,
} from "./_layout.js";

// ──────────────────────────────────────────────
//  Leave Management Emails
// ──────────────────────────────────────────────

export const leaveRequestSubmitted = (
  employeeName: string,
  leaveType: string,
  dates: string,
  days: number,
  reason: string,
): EmailTemplate => ({
  subject: `${BRAND.name} — New Leave Request: ${employeeName}`,
  html: emailLayout(
    `${heading("New Leave Request")}
    ${paragraph(`<strong>${employeeName}</strong> has submitted a leave request for your approval.`)}
    ${detailsTable(
      keyValue("Employee", employeeName) +
        keyValue("Leave Type", leaveType) +
        keyValue("Dates", dates) +
        keyValue("Days", String(days)) +
        keyValue("Reason", reason.length > 100 ? reason.slice(0, 100) + "..." : reason),
    )}
    ${button("Review Request", BRAND.url + "/admin/leaves")}
    ${signature()}`,
    `New leave request from ${employeeName}.`,
  ),
  text: `New Leave Request: ${employeeName} requests ${days} day(s) of ${leaveType} for ${dates}. Reason: ${reason}`,
});

export const leaveApproved = (
  userName: string,
  leaveType: string,
  dates: string,
  daysDeducted: number,
  remainingBalance: number,
): EmailTemplate => ({
  subject: `${BRAND.name} — Leave Approved`,
  html: emailLayout(
    `${heading("Leave Approved")}
    ${greeting(userName)}
    ${successBox(`Your <strong>${leaveType}</strong> request for <strong>${dates}</strong> has been approved.`)}
    ${detailsTable(
      keyValue("Leave Type", leaveType) +
        keyValue("Dates", dates) +
        keyValue("Days Deducted", String(daysDeducted)) +
        keyValue("Remaining Balance", String(remainingBalance)),
    )}
    ${signature()}`,
    `Your ${leaveType} for ${dates} has been approved.`,
  ),
  text: `Hi ${userName}, your ${leaveType} for ${dates} has been approved. ${daysDeducted} day(s) deducted. Remaining: ${remainingBalance}.`,
});

export const leaveRejected = (
  userName: string,
  leaveType: string,
  dates: string,
  reason: string,
): EmailTemplate => ({
  subject: `${BRAND.name} — Leave Rejected`,
  html: emailLayout(
    `${heading("Leave Rejected")}
    ${greeting(userName)}
    ${dangerBox(`Your <strong>${leaveType}</strong> request for <strong>${dates}</strong> has been rejected.`)}
    ${detailsTable(
      keyValue("Leave Type", leaveType) +
        keyValue("Dates", dates) +
        keyValue("Rejection Reason", reason),
    )}
    ${paragraph("Your leave balance remains unchanged. Contact your administrator if you have questions.")}
    ${signature()}`,
    `Your ${leaveType} for ${dates} has been rejected.`,
  ),
  text: `Hi ${userName}, your ${leaveType} for ${dates} has been rejected. Reason: ${reason}. Balance unchanged.`,
});

export const leaveRevoked = (
  userName: string,
  leaveType: string,
  dates: string,
  reason: string,
  daysRestored: number,
): EmailTemplate => ({
  subject: `${BRAND.name} — Leave Revoked`,
  html: emailLayout(
    `${heading("Leave Revoked")}
    ${greeting(userName)}
    ${warningBox(`Your previously approved <strong>${leaveType}</strong> for <strong>${dates}</strong> has been revoked by Admin.`)}
    ${detailsTable(
      keyValue("Leave Type", leaveType) +
        keyValue("Dates", dates) +
        keyValue("Reason", reason) +
        keyValue("Days Restored", String(daysRestored)),
    )}
    ${paragraph("The deducted days have been restored to your leave balance.")}
    ${signature()}`,
    `Your approved ${leaveType} for ${dates} has been revoked.`,
  ),
  text: `Hi ${userName}, your ${leaveType} for ${dates} has been revoked. Reason: ${reason}. ${daysRestored} day(s) restored.`,
});

export const leaveBalanceLow = (
  userName: string,
  leaveType: string,
  remaining: number,
): EmailTemplate => ({
  subject: `${BRAND.name} — Low Leave Balance`,
  html: emailLayout(
    `${heading("Low Leave Balance")}
    ${greeting(userName)}
    ${warningBox(`Your <strong>${leaveType}</strong> balance is low: only <strong>${remaining}</strong> day(s) remaining.`)}
    ${paragraph("Plan your upcoming leaves accordingly. Contact your administrator if you have questions about your balance.")}
    ${signature()}`,
    `Your ${leaveType} balance is low: ${remaining} day(s) remaining.`,
  ),
  text: `Hi ${userName}, your ${leaveType} balance is low: ${remaining} day(s) remaining.`,
});
