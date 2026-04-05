# Phase 6 — Analytics & Statistics (§21) Gap Checklist

## Compliant Items (already working)
1. ✅ 10 KPI Summary Cards with period comparison (8 of 10 fully computed)
2. ✅ Recruitment Pipeline Funnel (5 stages, % of prev/top)
3. ✅ Recruitment Trend Line Chart (daily/weekly/monthly)
4. ✅ Recruiter Performance Stacked Bar Chart
5. ✅ Zone Distribution Pie/Donut Chart
6. ✅ Company Volume Horizontal Bar Chart
7. ✅ HR Feedback Breakdown Pie Chart
8. ✅ Revenue Over Time Area Chart
9. ✅ Employee Overview Summary Cards (4 cards)
10. ✅ Global Date Range Selector (6 periods + custom)
11. ✅ All 9 analytics API endpoints
12. ✅ AnalyticsSnapshot and PlatformHealthLog DB models
13. ✅ Redis caching infrastructure (cache.ts)
14. ✅ Socket.io infrastructure
15. ✅ Recharts charting library

## Gaps to Implement

| # | Gap | Severity | File(s) |
|---|-----|----------|---------|
| 1 | `avgTimeToJoin` returns hardcoded 0 — needs date arithmetic | HIGH | analytics.service.ts |
| 2 | `hrFeedbackRate` returns hardcoded 0 — needs feedback count calc | HIGH | analytics.service.ts |
| 3 | Recruiter Leaderboard missing (§21.4.3) — ranked table | HIGH | analytics.service.ts, page.tsx |
| 4 | Payment Status Distribution donut missing (§21.4.8) | MEDIUM | analytics.service.ts, page.tsx |
| 5 | Company Revenue Table missing (§21.4.8) | MEDIUM | analytics.service.ts, page.tsx |
| 6 | Profile Distribution chart missing (§21.4.6) | MEDIUM | analytics.service.ts, page.tsx |
| 7 | Notice Period Distribution missing (§21.4.9) | LOW | analytics.service.ts, page.tsx |
| 8 | Employee Overview incomplete — missing present/absent/leave today, attendance heatmap, performance comparison | MEDIUM | analytics.service.ts, page.tsx |
| 9 | Platform Health dashboard missing (§21.6) — uses existing models but no UI/endpoint | MEDIUM | analytics.service.ts, controller, page.tsx |
| 10 | Real-time live metrics not implemented (§21.5) — no Socket.io analytics events | LOW | socket.ts, page.tsx |
