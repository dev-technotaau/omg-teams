import {
  type EmailTemplate,
  BRAND,
  emailLayout,
  heading,
  paragraph,
  warningBox,
  dangerBox,
  infoBox,
  detailsTable,
  keyValue,
  signature,
} from "./_layout.js";

// ──────────────────────────────────────────────
//  Attendance Emails
// ──────────────────────────────────────────────

export const lateLoginAlert = (
  employeeName: string,
  time: string,
  expectedTime: string,
): EmailTemplate => ({
  subject: `${BRAND.name} — Late Login: ${employeeName}`,
  html: emailLayout(
    `${heading("Late Login Alert")}
    ${paragraph(`<strong>${employeeName}</strong> logged in late today.`)}
    ${detailsTable(
      keyValue("Employee", employeeName) +
        keyValue("Login Time", time) +
        keyValue("Expected By", expectedTime),
    )}
    ${warningBox("This employee has been flagged as late for today's attendance.")}
    ${signature()}`,
    `${employeeName} logged in late at ${time}.`,
  ),
  text: `Late Login Alert: ${employeeName} logged in at ${time} (expected by ${expectedTime}).`,
});

export const absentAlert = (employeeName: string, date: string): EmailTemplate => ({
  subject: `${BRAND.name} — Absent: ${employeeName}`,
  html: emailLayout(
    `${heading("Absent Employee Alert")}
    ${paragraph(`<strong>${employeeName}</strong> has not logged in today.`)}
    ${detailsTable(keyValue("Employee", employeeName) + keyValue("Date", date))}
    ${dangerBox("This employee has been marked absent. No login was recorded by the absent threshold time.")}
    ${signature()}`,
    `${employeeName} has not logged in today.`,
  ),
  text: `Absent Alert: ${employeeName} has not logged in on ${date}.`,
});

export const excessiveLateAlert = (
  employeeName: string,
  lateCount: number,
  threshold: number,
  month: string,
): EmailTemplate => ({
  subject: `${BRAND.name} — Excessive Late Logins: ${employeeName}`,
  html: emailLayout(
    `${heading("Excessive Late Login Alert")}
    ${paragraph(`<strong>${employeeName}</strong> has exceeded the late login threshold for ${month}.`)}
    ${detailsTable(
      keyValue("Employee", employeeName) +
        keyValue("Late Count", String(lateCount)) +
        keyValue("Threshold", String(threshold)) +
        keyValue("Month", month),
    )}
    ${dangerBox(`This employee has been late ${lateCount} times this month, exceeding the configured threshold of ${threshold}.`)}
    ${signature()}`,
    `${employeeName} has been late ${lateCount} times this month.`,
  ),
  text: `Excessive Late Alert: ${employeeName} has been late ${lateCount} times in ${month} (threshold: ${threshold}).`,
});

export const monthlyAttendanceSummary = (month: string): EmailTemplate => ({
  subject: `${BRAND.name} — Monthly Attendance Summary for ${month}`,
  html: emailLayout(
    `${heading("Monthly Attendance Summary")}
    ${paragraph(`The attendance summary for <strong>${month}</strong> is ready for review.`)}
    ${infoBox("Login to the admin dashboard to view the full report with per-employee breakdowns.")}
    ${signature()}`,
    `Monthly attendance summary for ${month} is ready.`,
  ),
  text: `Monthly Attendance Summary for ${month} is ready for review. Login to the admin dashboard to view details.`,
});
