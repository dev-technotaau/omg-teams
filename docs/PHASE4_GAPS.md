# Phase 4 — RM Module + Dropdowns (§7, §9): Gap Checklist

**Spec sections audited**: §7 (Reporting Manager Module), §9 (Relational Dropdowns)
**§19 cross-reference**: Spec Phase 2 items 14–15, Phase 3 items 35, 38

## What EXISTS and is spec-compliant

- [x] Data access scoping — RM sees only assigned recruiters' data (getTeamRecruiterIds)
- [x] RM Dashboard — team performance stats (candidates today/month, active recruiters, completion rate)
- [x] RM Dashboard — team daily trend chart (14-day line chart)
- [x] RM Dashboard — team status breakdown (pie/donut)
- [x] RM Dashboard — own attendance (today's status, punch-in time, live working hours)
- [x] RM Dashboard — own leave balance overview
- [x] My Recruiters page — exists with card grid (photo, name, email, status, live status dot, candidates today/month, completion rate)
- [x] My Attendance page — personal log, monthly summary, color-coded calendar, read-only
- [x] My Leaves page — apply for leave, view requests/statuses, cancel pending, balance per type, calendar
- [x] Team Attendance view — assigned recruiters attendance, date filter, summary cards, read-only
- [x] Team Leaves view — assigned recruiters leave requests, status filter tabs, read-only (no approve/reject)
- [x] Own Document Upload — My Documents page with Aadhaar/PAN/Resume/Bank/Offer Letter, KYC progress
- [x] Profile Photo Upload — crop modal, Cloudinary upload, remove functionality
- [x] My Profile page — editable mobile/address, read-only employee ID/email/role/assigned managers
- [x] Company CRUD — create, list (with search), get, update, soft delete, restore
- [x] Service Provider CRUD — create (under company), list by company, update, soft delete
- [x] HR Manager CRUD — create (under company, with email/phone), list by company, update, soft delete
- [x] Admin Companies management page — hierarchical tree, expandable companies, nested SP/HR
- [x] Cascading filtering — SP and HR dropdowns filter by selected Company
- [x] Soft delete with restore — all 3 entities have deletedAt/deletedBy, trash service + admin trash page
- [x] "Create New" inline — modal forms within company expansion for SP and HR

## GAPS — Must Implement

### Gap 1: RM Dashboard — team attendance snapshot (§7)
**Spec says**: Team present/absent/late/on leave counts for today, team avg working hours, team login list with per-recruiter punch-in times.
**Current state**: Team attendance data exists on `/team/attendance` page but NOT embedded on the RM dashboard.
**Fix**: Add team attendance summary cards and team login mini-list to the RM dashboard view.

### Gap 2: RM Dashboard — top performer stat (§7)
**Spec says**: Team dashboard shows "top performer" — the recruiter with most candidates sourced in the current period.
**Current state**: Not shown.
**Fix**: Calculate top performer from existing candidate stats per recruiter. Display as a highlight card.

### Gap 3: RM Dashboard — late indicator in own attendance (§7)
**Spec says**: Own attendance section shows late indicator.
**Current state**: Shows today's status and punch-in time but no explicit late badge/indicator.
**Fix**: Add late indicator (badge/text) when user's attendance isLate is true.

### Gap 4: RM Dashboard — monthly attendance rate (§7)
**Spec says**: Own attendance section shows monthly attendance rate.
**Current state**: Not shown on dashboard (exists on My Attendance page).
**Fix**: Add monthly attendance rate to the own-attendance section of the RM dashboard.

### Gap 5: My Recruiters page — missing columns (§7)
**Spec says**: Table should show: Last Active, Attendance Today, Target Progress, KYC Status. Should be a data table (not just cards). Searchable, sortable, paginated.
**Current state**: Card-based grid. Missing: Last Active display, Attendance Today, Target Progress, KYC Status. No search, no sort, no pagination.
**Fix**: Convert from card grid to DataTable. Add missing columns. Add search, column sorting, pagination.

### Gap 6: My Recruiters — recruiter detail view (§7)
**Spec says**: Click on any recruiter row opens a read-only detail view showing performance summary, recent submissions, attendance overview, and leave status.
**Current state**: Cards are display-only, no click-through to detail view.
**Fix**: Add click handler to navigate to `/my-recruiters/[id]` detail page. Create read-only recruiter detail page with performance, submissions, attendance, leave tabs.

### Gap 7: Quick export from data tables — XLSX/CSV (§7, §23.14)
**Spec says**: RM can export current data table view as XLSX/CSV directly from any data table showing assigned recruiters' data.
**Current state**: Export button exists on reports page but is non-functional (no onClick handler, no export logic).
**Fix**: Implement XLSX/CSV export utility. Wire up export buttons on data tables (reports list, team attendance, team leaves).

## Summary

| Category | Count |
|----------|-------|
| Compliant | 21 |
| Gaps | 7 |
