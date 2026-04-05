// ──────────────────────────────────────────────
//  Leave Types
// ──────────────────────────────────────────────

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  isHalfDay?: boolean;
  reason: string;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  leaveType: { name: string; code: string };
  user: { firstName: string; lastName: string; employeeId: string | null };
}

export interface LeaveBalance {
  id: string;
  userId: string;
  year: number;
  totalAllotted: number;
  used: number;
  remaining: number;
  leaveType: { id: string; name: string; code: string };
  user: { firstName: string; lastName: string; employeeId: string | null; role: string };
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
}

export interface LeaveBalanceInfo {
  code: string;
  name: string;
  used: number;
  total: number;
}
