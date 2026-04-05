// ──────────────────────────────────────────────
//  Application Routes
// ──────────────────────────────────────────────

export const ROUTES = {
  // Auth & Public
  LOGIN: "/login",
  MAINTENANCE: "/maintenance",

  // Main
  DASHBOARD: "/dashboard",
  NOTIFICATIONS: "/notifications",
  PROFILE: "/profile",
  SETTINGS: "/settings",
  NOTIFICATION_SETTINGS: "/settings/notifications",
  SEARCH: "/search",
  HELP: "/help",

  // Reports / Candidates
  REPORTS: "/reports",
  REPORTS_NEW: "/reports/new",
  REPORTS_DETAIL: (id: string) => `/reports/${id}`,
  REPORTS_EDIT: (id: string) => `/reports/${id}/edit`,

  // Attendance
  ATTENDANCE: "/attendance",
  ATTENDANCE_REGULARIZATION: "/attendance/regularization",

  // Leave
  LEAVES: "/leaves",

  // Documents
  DOCUMENTS: "/documents",

  // RM views
  MY_RECRUITERS: "/my-recruiters",
  MY_RECRUITER_DETAIL: (id: string) => `/my-recruiters/${id}`,
  TEAM: "/team",
  TEAM_ATTENDANCE: "/team/attendance",
  TEAM_LEAVES: "/team/leaves",
  TEAM_TARGETS: "/team/targets",
  TEAM_MEMBER: (id: string) => `/team/${id}`,

  // Admin
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_REPORTS: "/admin/reports",
  ADMIN_REPORT_DETAIL: (id: string) => `/admin/reports/${id}`,
  ADMIN_USERS: "/admin/users",
  ADMIN_EMPLOYEES: "/admin/employees",
  ADMIN_EMPLOYEE_DETAIL: (id: string) => `/admin/employees/${id}`,
  ADMIN_ATTENDANCE: "/admin/attendance",
  ADMIN_LEAVES: "/admin/leaves",
  ADMIN_TARGETS: "/admin/targets",
  ADMIN_COMPANIES: "/admin/companies",
  ADMIN_DOCUMENTS: "/admin/documents",
  ADMIN_DOCUMENT_TYPES: "/admin/document-types",
  ADMIN_DUPLICATES: "/admin/duplicates",
  ADMIN_OFFER_LETTERS: "/admin/offer-letters",
  ADMIN_REPORTS_MANAGEMENT: "/admin/reports-management",
  ADMIN_TRASH: "/admin/trash",
  ADMIN_ARCHIVE: "/admin/archive",
  ADMIN_MASTER_DATA: "/admin/master-data",
  ADMIN_SETTINGS: "/admin/settings",
  ADMIN_SESSIONS: "/admin/sessions",
  ADMIN_ANALYTICS: "/admin/analytics",
  ADMIN_HOLIDAYS: "/admin/holidays",
  ADMIN_EMAIL_TEMPLATES: "/admin/email-templates",
  ADMIN_IMPORT: "/admin/import",
  ADMIN_AUDIT_LOGS: "/admin/audit-logs",
  ADMIN_WEBHOOKS: "/admin/webhooks",
  ADMIN_QUEUES: "/admin/queues",
  PASSKEYS: "/profile/passkeys",
} as const;

/**
 * Routes that are accessible without authentication.
 * Used by Next.js middleware to skip auth checks.
 */
export const PUBLIC_ROUTES = ["/login", "/maintenance"] as const;

/**
 * Routes that require ADMIN role.
 * Middleware redirects non-admin users away from these.
 */
export const ADMIN_ROUTE_PREFIX = "/admin";

/**
 * Routes that require REPORTING_MANAGER role.
 */
export const TEAM_ROUTE_PREFIX = "/team";

/**
 * Default redirect after login, per role.
 */
export const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  RECRUITER: "/dashboard",
  REPORTING_MANAGER: "/dashboard",
};
