export const Roles = {
  ADMIN: "ADMIN",
  RECRUITER: "RECRUITER",
  REPORTING_MANAGER: "REPORTING_MANAGER",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Roles.ADMIN]: 100,
  [Roles.REPORTING_MANAGER]: 75,
  [Roles.RECRUITER]: 50,
};

/**
 * Check if roleA has equal or higher privilege than roleB.
 */
export function hasPermission(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}
