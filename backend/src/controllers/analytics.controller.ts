import * as analyticsSvc from "../services/analytics.service.js";
import type { Request, Response } from "express";

export async function handleGetKPISummary(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "today";
  const customFrom = req.query["from"] as string | undefined;
  const customTo = req.query["to"] as string | undefined;
  const data = await analyticsSvc.getKPISummary(period, customFrom, customTo);
  res.status(200).json({ data });
}

export async function handleGetPipelineFunnel(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getPipelineFunnel(period);
  res.status(200).json({ data });
}

export async function handleGetRecruitmentTrend(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const granularity = (req.query["granularity"] as "daily" | "weekly" | "monthly") ?? "daily";
  const data = await analyticsSvc.getRecruitmentTrend(period, granularity);
  res.status(200).json({ data });
}

export async function handleGetRecruiterPerformance(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getRecruiterPerformance(period);
  res.status(200).json({ data });
}

export async function handleGetZoneDistribution(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getZoneDistribution(period);
  res.status(200).json({ data });
}

export async function handleGetCompanyVolume(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getCompanyVolume(period);
  res.status(200).json({ data });
}

export async function handleGetHRFeedbackBreakdown(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getHRFeedbackBreakdown(period);
  res.status(200).json({ data });
}

export async function handleGetRevenueOverTime(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisYear";
  const data = await analyticsSvc.getRevenueOverTime(period);
  res.status(200).json({ data });
}

export async function handleGetEmployeeOverview(_req: Request, res: Response): Promise<void> {
  const data = await analyticsSvc.getEmployeeOverview();
  res.status(200).json({ data });
}

export async function handleGetRecruiterLeaderboard(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getRecruiterLeaderboard(period);
  res.status(200).json({ data });
}

export async function handleGetPaymentStatusDistribution(
  req: Request,
  res: Response,
): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getPaymentStatusDistribution(period);
  res.status(200).json({ data });
}

export async function handleGetCompanyRevenueTable(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getCompanyRevenueTable(period);
  res.status(200).json({ data });
}

export async function handleGetProfileDistribution(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getProfileDistribution(period);
  res.status(200).json({ data });
}

export async function handleGetNoticePeriodDistribution(
  req: Request,
  res: Response,
): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getNoticePeriodDistribution(period);
  res.status(200).json({ data });
}

export async function handleGetPlatformHealth(_req: Request, res: Response): Promise<void> {
  const data = await analyticsSvc.getExpandedPlatformHealth();
  res.status(200).json({ data });
}

/** Age Distribution — §21.4.10 */
export async function handleGetAgeDistribution(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getAgeDistribution(period);
  res.status(200).json({ data });
}

/** Experience Distribution — §21.4.10 */
export async function handleGetExperienceDistribution(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getExperienceDistribution(period);
  res.status(200).json({ data });
}

/** CTC Analysis — §21.4.11 */
export async function handleGetCTCAnalysis(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getCTCAnalysis(period);
  res.status(200).json({ data });
}

/** Activity Heatmap — §21.4.12 */
export async function handleGetActivityHeatmap(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const recruiterId = req.query["recruiterId"] as string | undefined;
  const data = await analyticsSvc.getActivityHeatmap(period, recruiterId);
  res.status(200).json({ data });
}

/** Live Metrics — §21.5 */
export async function handleGetLiveMetrics(_req: Request, res: Response): Promise<void> {
  const data = await analyticsSvc.getLiveMetrics();
  res.status(200).json({ data });
}

/** Employee Attendance Heatmap — §21.4.13 */
export async function handleGetEmployeeAttendanceHeatmap(
  req: Request,
  res: Response,
): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getEmployeeAttendanceHeatmap(period);
  res.status(200).json({ data });
}

/** Employee Leave Utilization — §21.4.13 */
export async function handleGetEmployeeLeaveUtilization(
  _req: Request,
  res: Response,
): Promise<void> {
  const data = await analyticsSvc.getEmployeeLeaveUtilization();
  res.status(200).json({ data });
}

/** Workforce Distribution — §21.4.13 */
export async function handleGetWorkforceDistribution(_req: Request, res: Response): Promise<void> {
  const data = await analyticsSvc.getWorkforceDistribution();
  res.status(200).json({ data });
}

/** GST & TDS Summary — §21.4.8 */
export async function handleGetGSTTDSSummary(req: Request, res: Response): Promise<void> {
  const period = (req.query["period"] as string) ?? "thisMonth";
  const data = await analyticsSvc.getGSTTDSSummary(period);
  res.status(200).json({ data });
}
