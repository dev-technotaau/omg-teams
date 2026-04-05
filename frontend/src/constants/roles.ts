// ──────────────────────────────────────────────
//  Role Constants
// ──────────────────────────────────────────────

export const ROLES = {
  ADMIN: "ADMIN",
  RECRUITER: "RECRUITER",
  REPORTING_MANAGER: "REPORTING_MANAGER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  RECRUITER: "Recruiter",
  REPORTING_MANAGER: "Reporting Manager",
};

/** Filter dropdowns — includes "All" option */
export const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: ROLES.RECRUITER, label: ROLE_LABELS.RECRUITER },
  { value: ROLES.REPORTING_MANAGER, label: ROLE_LABELS.REPORTING_MANAGER },
];

/** Create/edit forms — no blank option */
export const ROLE_CREATE_OPTIONS = [
  { value: ROLES.RECRUITER, label: ROLE_LABELS.RECRUITER },
  { value: ROLES.REPORTING_MANAGER, label: ROLE_LABELS.REPORTING_MANAGER },
];

/** All roles including admin — for admin-level forms */
export const ALL_ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: ROLE_LABELS.ADMIN },
  { value: ROLES.RECRUITER, label: ROLE_LABELS.RECRUITER },
  { value: ROLES.REPORTING_MANAGER, label: ROLE_LABELS.REPORTING_MANAGER },
];
