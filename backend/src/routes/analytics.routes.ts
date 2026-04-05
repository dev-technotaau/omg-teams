import { Router } from "express";
import {
  handleGetKPISummary,
  handleGetPipelineFunnel,
  handleGetRecruitmentTrend,
  handleGetRecruiterPerformance,
  handleGetZoneDistribution,
  handleGetCompanyVolume,
  handleGetHRFeedbackBreakdown,
  handleGetRevenueOverTime,
  handleGetEmployeeOverview,
  handleGetRecruiterLeaderboard,
  handleGetPaymentStatusDistribution,
  handleGetCompanyRevenueTable,
  handleGetProfileDistribution,
  handleGetNoticePeriodDistribution,
  handleGetPlatformHealth,
  handleGetAgeDistribution,
  handleGetExperienceDistribution,
  handleGetCTCAnalysis,
  handleGetActivityHeatmap,
  handleGetLiveMetrics,
  handleGetEmployeeAttendanceHeatmap,
  handleGetEmployeeLeaveUtilization,
  handleGetWorkforceDistribution,
  handleGetGSTTDSSummary,
} from "../controllers/analytics.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// §21.2 KPI
router.get("/kpi", handleGetKPISummary);

// §21.3 Funnel
router.get("/funnel", handleGetPipelineFunnel);

// §21.4.1 Recruitment Trend
router.get("/recruitment-trend", handleGetRecruitmentTrend);

// §21.4.2 Recruiter Performance
router.get("/recruiter-performance", handleGetRecruiterPerformance);

// §21.4.3 Recruiter Leaderboard
router.get("/recruiter-leaderboard", handleGetRecruiterLeaderboard);

// §21.4.4 Zone Distribution
router.get("/zone-distribution", handleGetZoneDistribution);

// §21.4.5 Company Volume
router.get("/company-volume", handleGetCompanyVolume);

// §21.4.6 Profile Distribution
router.get("/profile-distribution", handleGetProfileDistribution);

// §21.4.7 HR Feedback
router.get("/hr-feedback", handleGetHRFeedbackBreakdown);

// §21.4.8 Revenue & Financial
router.get("/revenue", handleGetRevenueOverTime);
router.get("/payment-status", handleGetPaymentStatusDistribution);
router.get("/company-revenue", handleGetCompanyRevenueTable);
router.get("/gst-tds-summary", handleGetGSTTDSSummary);

// §21.4.9 Notice Period
router.get("/notice-period", handleGetNoticePeriodDistribution);

// §21.4.10 Age & Experience
router.get("/age-distribution", handleGetAgeDistribution);
router.get("/experience-distribution", handleGetExperienceDistribution);

// §21.4.11 CTC Analysis
router.get("/ctc-analysis", handleGetCTCAnalysis);

// §21.4.12 Activity Heatmap
router.get("/activity-heatmap", handleGetActivityHeatmap);

// §21.4.13 Employee Overview & Analytics
router.get("/employee-overview", handleGetEmployeeOverview);
router.get("/employee-attendance-heatmap", handleGetEmployeeAttendanceHeatmap);
router.get("/employee-leave-utilization", handleGetEmployeeLeaveUtilization);
router.get("/workforce-distribution", handleGetWorkforceDistribution);

// §21.5 Live Metrics
router.get("/live-metrics", handleGetLiveMetrics);

// §21.6 Platform Health
router.get("/platform-health", handleGetPlatformHealth);

export { router as analyticsRouter };
