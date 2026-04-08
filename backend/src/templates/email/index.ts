// ──────────────────────────────────────────────
//  Email Templates — Barrel Export
//
//  All templates organized by category.
//  Each export is a function returning { subject, html, text }.
// ──────────────────────────────────────────────

export type { EmailTemplate } from "./_layout.js";
export { BRAND } from "./_layout.js";

// Layout components (for custom templates)
export {
  emailLayout,
  heading,
  subheading,
  paragraph,
  greeting,
  smallText,
  divider,
  button,
  infoBox,
  successBox,
  warningBox,
  dangerBox,
  keyValue,
  detailsTable,
  signature,
} from "./_layout.js";

// Auth & Account
export {
  accountCreated,
  passwordReset,
  accountSuspended,
  accountReactivated,
  accountLockout,
  deviceLockBlocked,
  systemAlert,
} from "./auth.js";

// Account Management (self-service + admin-initiated)
export {
  emailChangeOtp,
  emailChangeConfirmation,
  passwordChangeConfirmation,
  mobileChangeConfirmation,
  profileUpdatedByAdmin,
} from "./account.js";

// Reports
export { dailyReport, monthlyReport, scheduledReportDelivery } from "./reports.js";

// Attendance
export {
  lateLoginAlert,
  absentAlert,
  excessiveLateAlert,
  monthlyAttendanceSummary,
} from "./attendance.js";

// Leave Management
export {
  leaveRequestSubmitted,
  leaveApproved,
  leaveRejected,
  leaveRevoked,
  leaveBalanceLow,
} from "./leave.js";

// Documents / KYC
export {
  documentUploaded,
  documentVerified,
  documentRejected,
  kycComplete,
  kycReminder,
} from "./documents.js";
