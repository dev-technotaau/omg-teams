// ──────────────────────────────────────────────
//  API Endpoint Constants
//  Base paths used by services — avoids magic strings
// ──────────────────────────────────────────────

export const API = {
  // Auth
  AUTH_LOGIN: "/auth/login",
  AUTH_LOGOUT: "/auth/logout",
  AUTH_REFRESH: "/auth/refresh",
  AUTH_ME: "/auth/me",
  AUTH_PROFILE: "/auth/me/profile",
  AUTH_VERIFY_PASSWORD: "/auth/verify-password",

  // Candidates
  CANDIDATES: "/candidates",
  CANDIDATE_DETAIL: (id: string) => `/candidates/${id}`,
  CANDIDATE_NEXT_INVOICE: "/candidates/next-invoice",
  CANDIDATE_STATS_BY_RECRUITER: "/candidates/stats/by-recruiter",
  DUPLICATES_CHECK: "/duplicates/check",

  // Attendance
  ATTENDANCE_MY: "/attendance/my",
  ATTENDANCE_PUNCH_IN: "/attendance/punch-in",
  ATTENDANCE_PUNCH_OUT: "/attendance/punch-out",
  ATTENDANCE_ADMIN: "/attendance/admin",
  ATTENDANCE_REGULARIZATION: "/attendance/regularization",
  ATTENDANCE_TEAM: "/attendance/team",

  // Leave
  LEAVES: "/leaves",
  LEAVE_DETAIL: (id: string) => `/leaves/${id}`,
  LEAVE_TYPES: "/leaves/types",
  LEAVE_BALANCE: "/leaves/balance",
  LEAVE_APPROVE: (id: string) => `/leaves/${id}/approve`,
  LEAVE_REJECT: (id: string) => `/leaves/${id}/reject`,
  LEAVE_TEAM: "/leaves/team",
  LEAVE_ADMIN: "/leaves/admin",

  // Notifications
  NOTIFICATIONS: "/notifications",
  NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: "/notifications/read-all",
  NOTIFICATIONS_CLEAR_ALL: "/notifications/clear-all",
  NOTIFICATION_PREFERENCES: "/notifications/preferences",

  // Documents
  DOCUMENTS: "/documents",
  DOCUMENT_DETAIL: (id: string) => `/documents/${id}`,
  DOCUMENT_VERIFY: (id: string) => `/documents/${id}/verify`,

  // Users
  USERS: "/users",
  USER_DETAIL: (id: string) => `/users/${id}`,
  USER_SUSPEND: (id: string) => `/users/${id}/suspend`,
  USER_REACTIVATE: (id: string) => `/users/${id}/reactivate`,
  USER_RESET_PASSWORD: (id: string) => `/users/${id}/reset-password`,
  USER_RESET_DEVICE: (id: string) => `/users/${id}/reset-device`,

  // Dashboard
  DASHBOARD_STATS: "/dashboard/stats",
  DASHBOARD_DAILY_TREND: "/dashboard/daily-trend",
  DASHBOARD_STATUS_BREAKDOWN: "/dashboard/status-breakdown",

  // Company
  COMPANIES: "/companies",
  COMPANY_DETAIL: (id: string) => `/companies/${id}`,

  // Targets
  TARGETS: "/targets",
  TARGET_DETAIL: (id: string) => `/targets/${id}`,

  // Reports
  REPORT_SCHEDULES: "/reports/schedules",
  REPORT_SCHEDULE_DETAIL: (id: string) => `/reports/schedules/${id}`,

  // Analytics
  ANALYTICS_KPI: "/analytics/kpi",
  ANALYTICS_FUNNEL: "/analytics/funnel",
  ANALYTICS_TREND: "/analytics/trend",
  ANALYTICS_RECRUITER_PERFORMANCE: "/analytics/recruiter-performance",
  ANALYTICS_ZONE: "/analytics/zone",
  ANALYTICS_COMPANY: "/analytics/company",
  ANALYTICS_FEEDBACK: "/analytics/feedback",
  ANALYTICS_REVENUE: "/analytics/revenue",
  ANALYTICS_EMPLOYEE_OVERVIEW: "/analytics/employee-overview",

  // Admin
  SETTINGS: "/settings",
  SESSIONS: "/sessions",
  HOLIDAYS: "/holidays",
  EMAIL_TEMPLATES: "/email-templates",
  AUDIT_LOGS: "/audit-logs",
  AUDIT_LOGS_EXPORT: "/audit-logs/export",
  IMPORT: "/import",

  // Upload
  UPLOAD_AVATAR: "/upload/avatar",
  UPLOAD_DOCUMENT: "/upload/document",
  UPLOAD_DELETE_PROFILE_PHOTO: "/upload/profile-photo",

  // Drafts
  DRAFTS: "/drafts",

  // Dropdowns
  DROPDOWN_OPTIONS: "/dropdowns",
} as const;
