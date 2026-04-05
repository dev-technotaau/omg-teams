import * as dashboardSvc from "../services/dashboard.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Dashboard Controller — Spec Section 23.4
// ──────────────────────────────────────────────

/** GET /api/v1/dashboard/stats */
export async function handleDashboardStats(req: Request, res: Response): Promise<void> {
  const stats = await dashboardSvc.getDashboardStats(req.user!.id, req.user!.role);
  res.status(200).json({ stats });
}

/** GET /api/v1/dashboard/rm-team-snapshot — §7 RM team attendance + top performer */
export async function handleRMTeamSnapshot(req: Request, res: Response): Promise<void> {
  const data = await dashboardSvc.getRMTeamSnapshot(req.user!.id);
  res.status(200).json(data);
}

/** GET /api/v1/dashboard/admin-stats — §6.2 Admin dashboard overview */
export async function handleAdminDashboardStats(req: Request, res: Response): Promise<void> {
  const range = (req.query["range"] as string) ?? "today";
  const stats = await dashboardSvc.getAdminDashboardStats(range);
  res.status(200).json({ stats });
}

/** GET /api/v1/dashboard/monthly-attendance — §6.2 Monthly attendance rate */
export async function handleMonthlyAttendance(_req: Request, res: Response): Promise<void> {
  const data = await dashboardSvc.getMonthlyAttendanceRate();
  res.status(200).json(data);
}

/** GET /api/v1/dashboard/daily-trend */
export async function handleDailyTrend(req: Request, res: Response): Promise<void> {
  const trend = await dashboardSvc.getDailyTrend(req.user!.id, req.user!.role);
  res.status(200).json({ trend });
}

/** GET /api/v1/dashboard/status-breakdown */
export async function handleStatusBreakdown(req: Request, res: Response): Promise<void> {
  const breakdown = await dashboardSvc.getStatusBreakdown(req.user!.id, req.user!.role);
  res.status(200).json({ breakdown });
}

/** GET /api/v1/dashboard/extended — §23.4 Extended dashboard (hours, streak, leave, submissions) */
export async function handleExtendedDashboard(req: Request, res: Response): Promise<void> {
  const data = await dashboardSvc.getExtendedDashboard(req.user!.id, req.user!.role);
  res.status(200).json({ data });
}
