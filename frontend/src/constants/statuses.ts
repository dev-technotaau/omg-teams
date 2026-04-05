// ──────────────────────────────────────────────
//  Status Constants & Badge Variant Maps
// ──────────────────────────────────────────────

import type { BadgeVariant } from "./badge-variants";

// ── User / Account Status ───────────────────
export const USER_STATUSES = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};

export const USER_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: USER_STATUSES.ACTIVE, label: "Active" },
  { value: USER_STATUSES.SUSPENDED, label: "Suspended" },
];

export const USER_STATUS_BADGE: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
};

// ── Leave Request Status ────────────────────
export const LEAVE_STATUSES = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[keyof typeof LEAVE_STATUSES];

export const LEAVE_STATUS_BADGE: Record<string, BadgeVariant> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
};

// ── Attendance Status ───────────────────────
export const ATTENDANCE_STATUSES = {
  PRESENT_FULL: "PRESENT_FULL",
  PRESENT_HALF: "PRESENT_HALF",
  LATE: "LATE",
  ABSENT: "ABSENT",
  ON_LEAVE: "ON_LEAVE",
  HOLIDAY: "HOLIDAY",
  WEEKEND: "WEEKEND",
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[keyof typeof ATTENDANCE_STATUSES];

export const ATTENDANCE_STATUS_BADGE: Record<string, BadgeVariant> = {
  PRESENT_FULL: "success",
  PRESENT_HALF: "warning",
  LATE: "warning",
  ABSENT: "danger",
  ON_LEAVE: "info",
  HOLIDAY: "default",
  WEEKEND: "default",
};

// §18 — Attendance Calendar Color Coding (dual-tone: light bg + dark text)
export const ATTENDANCE_CALENDAR_COLORS: Record<string, { bg: string; text: string }> = {
  PRESENT_FULL: { bg: "bg-success-100", text: "text-success-500" },
  PRESENT_HALF: { bg: "bg-warning-100", text: "text-warning-500" },
  LATE: { bg: "bg-[#FFEDD5]", text: "text-[#EA580C]" },
  ABSENT: { bg: "bg-error-100", text: "text-error-500" },
  INCOMPLETE: { bg: "bg-warning-100", text: "text-warning-700" },
  ON_LEAVE: { bg: "bg-info-100", text: "text-info-500" },
  HOLIDAY: { bg: "bg-[#F3E8FF]", text: "text-[#9333EA]" },
  WEEKEND: { bg: "bg-bg-muted", text: "text-text-muted" },
};

// ── Candidate Stage / Status ────────────────
export const CANDIDATE_STAGES = {
  COMPLETE: "COMPLETE",
  PENDING: "PENDING",
  JOINED: "JOINED",
  CV_SHARED: "CV_SHARED",
  REJECTED: "REJECTED",
  IN_PROGRESS: "IN_PROGRESS",
} as const;

export const CANDIDATE_STATUS_COLORS: Record<string, string> = {
  COMPLETE: "bg-success-500",
  PENDING: "bg-warning-500",
  JOINED: "bg-primary-500",
  CV_SHARED: "bg-info-500",
  REJECTED: "bg-error-500",
  IN_PROGRESS: "bg-accent-blue",
};

// ── Document Verification Status ────────────
export const DOCUMENT_STATUSES = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[keyof typeof DOCUMENT_STATUSES];

export const DOCUMENT_STATUS_BADGE: Record<string, BadgeVariant> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

// ── Role Badge Variants ────────────────────
export const ROLE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  RECRUITER: "success",
  REPORTING_MANAGER: "warning",
  ADMIN: "info",
};

// ── Target Type Badge Variants ─────────────
export const TARGET_TYPE_BADGE: Record<string, BadgeVariant> = {
  DAILY: "success",
  WEEKLY: "warning",
  MONTHLY: "danger",
};

// ── Holiday Type Badge / Colors ────────────
export const HOLIDAY_TYPE_BADGE: Record<string, BadgeVariant> = {
  NATIONAL: "danger",
  REGIONAL: "warning",
  CUSTOM: "success",
};

export const HOLIDAY_DOT_COLORS: Record<string, string> = {
  NATIONAL: "bg-error-500",
  REGIONAL: "bg-warning-700",
  CUSTOM: "bg-success-500",
};

// ── Notification Type ───────────────────────
export const NOTIFICATION_TYPES = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;

export const NOTIFICATION_TYPE_BADGE: Record<string, BadgeVariant> = {
  info: "default",
  success: "success",
  warning: "warning",
  error: "danger",
};
