// ──────────────────────────────────────────────
//  User / Auth Types
// ──────────────────────────────────────────────

import type { Role } from "@/constants/roles";

/** Authenticated user from /auth/me */
export interface AuthUser {
  id: string;
  employeeId: string | null;
  email: string;
  name: string | null;
  profilePhotoUrl: string | null;
  role: Role | string;
  status?: string;
  mobileNumber?: string | null;
  address?: string | null;
  deviceId?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
  assignedManagers?: Array<{ manager: { id: string; firstName: string; lastName: string } }>;
}

/** User list item from /users (admin) */
export interface UserListItem {
  id: string;
  employeeId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  profilePhotoUrl: string | null;
  deviceId: string | null;
  mobileNumber: string | null;
  createdAt: string;
}

/** Employee view with computed fields */
export interface Employee extends UserListItem {
  _count?: {
    candidateReports?: number;
  };
  candidateCount?: number;
  attendanceRate?: number;
  lateCount?: number;
  completionRate?: number;
  leaveBalance?: number;
  targetAchievement?: number;
  kycStatus?: string;
  lastActive?: string | null;
  assignedManagers?: string[];
}

/** Recruiter summary (used in dropdowns / targets) */
export interface RecruiterSummary {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
}
