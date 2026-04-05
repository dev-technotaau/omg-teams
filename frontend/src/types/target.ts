// ──────────────────────────────────────────────
//  Target Types
// ──────────────────────────────────────────────

export type TargetType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface Target {
  id: string;
  recruiterId: string;
  targetType: TargetType;
  targetValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  recruiter: { id: string; firstName: string; lastName: string; employeeId: string | null };
  creator: { id: string; firstName: string; lastName: string };
  achieved?: number;
}
