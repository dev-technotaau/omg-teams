import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Leave Service
// ──────────────────────────────────────────────

/** Admin: Set annual leave balance for a user */
export async function setAnnualBalance(data: {
  userId: string;
  leaveTypeId: string;
  year: number;
  totalAllotted: number;
}) {
  await api.post("/leaves/balances/set-annual", data);
}
