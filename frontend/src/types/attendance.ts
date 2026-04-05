// ──────────────────────────────────────────────
//  Attendance Types
// ──────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  date: string;
  punchInTime: string | null;
  punchOutTime: string | null;
  grossWorkingMinutes: number | null;
  netWorkingMinutes: number | null;
  overtimeMinutes: number | null;
  status: string;
  isLate: boolean;
  lateByMinutes: number | null;
  midnightResetApplied?: boolean;
  remarks?: string | null;
  user: { firstName: string; lastName: string; employeeId: string | null; role: string };
}

export interface AttendanceInfo {
  punchInTime: string | null;
  status: string | null;
}
