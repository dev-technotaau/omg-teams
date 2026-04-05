# Phase 9 — Additional Features Part 1 (§23.1–23.10) Gap Checklist

## Compliant Items (already working)
1. ✅ §23.1 Audit/Activity Log — AuditLog model, service, routes, admin page, export
2. ✅ §23.2 Bulk Operations — bulk service (status/stage/payment/delete/assign), routes, DataTable selectable prop
3. ✅ §23.3 Candidate Duplicate Detection — DuplicateGroup model, service, routes, admin duplicates page
4. ✅ §23.4 Recruiter & RM Dashboards — role-based dashboard with KPIs, charts, attendance, leave overview
5. ✅ §23.6 Data Import (CSV/XLSX) — import service with validation/preview/process, admin import page
6. ✅ §23.7 Soft Delete with Restore — deletedAt/deletedBy on all entities, trash service, admin trash page
7. ✅ §23.8 Form Auto-Save/Draft — CandidateReportDraft model, draft service/routes
8. ✅ §23.9 Recruiter Targets/Goals — RecruiterTarget model, CRUD service/routes, admin targets page
9. ✅ §23.10 Global Search — search service with role-based scoping, search routes, search results page
10. ✅ My Recruiters page — DataTable with all spec columns (attendance, target %, KYC, search, sort)

## Gaps to Implement

| # | Gap | Severity | File(s) |
|---|-----|----------|---------|
| 1 | Admin reports page uses raw `<table>` instead of DataTable — no bulk actions, no sorting, no page-size selector | HIGH | admin/reports/page.tsx |
| 2 | Search bar in header only visible to ADMIN — RM and Recruiter cannot access global search | MEDIUM | header.tsx |
| 3 | §23.5 Data Archiving — entirely missing (archive tables, archive service, archive cron job, admin archive page) | HIGH | backend + frontend |
| 4 | Admin reports page missing bulk actions wiring (bulk status update, bulk delete, bulk assign) | MEDIUM | admin/reports/page.tsx |
