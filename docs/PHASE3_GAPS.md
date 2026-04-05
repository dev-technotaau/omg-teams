# Phase 3 — Core Recruitment: Admin Module: Gap Checklist

**Spec sections audited**: §6 (Admin Module)
**§19 cross-reference**: Spec Phase 2 items 8–14

## What EXISTS and is spec-compliant

- [x] Admin candidate detail/edit page with 4-tab interface (All, Candidate, Recruitment, MIS)
- [x] All 48 fields present across tabs (fields 1–33 recruiter + 34–48 admin)
- [x] Zone-conditional field visibility (Set A only fields hidden for Set B zones)
- [x] Data-aware save button with deep comparison (deepEqual on formData vs originalData)
- [x] Save button visual states: deactivated, active, saving spinner, success toast
- [x] Tab structure with correct field groupings per spec
- [x] Relational dropdowns for Company, Service Provider, HR Manager with API fetching
- [x] Candidate pipeline stage management with stage history display
- [x] MIS tab with invoice fields and computed outstanding amount
- [x] Employee ID auto-generation (OMG-XXXX format, zero-padded, auto-increment)
- [x] Employee ID immutable, unique, not reused
- [x] Account creation modal with firstName, lastName, email, password, role fields
- [x] Success modal showing Employee ID + password with copy-to-clipboard buttons
- [x] Employee list table with 10 columns (Name, Employee ID, Role, Status, Candidates, Completion %, Mobile, Device, Joined, Actions)
- [x] Employee list filtering (role, status, search)
- [x] Employee list pagination
- [x] Employee detail page with 6 tabs (Profile, Performance, Attendance, Leave, Documents, Reports)
- [x] Admin dashboard with attendance cards (Present, Absent, Late, On Leave, Half Day)
- [x] Admin dashboard with KPI cards (Candidates Today, This Month, Pending, Outstanding)
- [x] Today's Logins panel (placeholder)
- [x] Pending Actions panel (Leave Requests, KYC Verifications, Locked Accounts)

## GAPS — Must Implement

### Gap 1: Ctrl+S / Cmd+S keyboard shortcut for admin candidate edit (§6.1.1)
**Spec says**: `Ctrl+S` / `Cmd+S` triggers save — but only if the Save button is active (data has changed). If deactivated, does nothing.
**Current state**: No keyboard event listener in the candidate detail page.
**Fix**: Add useEffect with keydown listener for Ctrl+S/Cmd+S that calls save when `hasChanges` is true.

### Gap 2: Tab URL state persistence (§6.1.1)
**Spec says**: Active tab is reflected in URL query parameter (e.g., `?tab=mis`) so Admin can share links and browser back/forward works.
**Current state**: Tab state is local useState only — not synced to URL.
**Fix**: Use `useSearchParams` to read/write `?tab=` query parameter. Initialize activeTab from URL, update URL on tab change.

### Gap 3: Unsaved changes warning on navigation/tab switch (§6.1.1)
**Spec says**: If Admin has unsaved changes and tries to navigate away or switch tabs, show "You have unsaved changes" warning.
**Current state**: No beforeunload handler and no tab-switch interception.
**Fix**: Add beforeunload event listener when `hasChanges` is true. Add confirmation dialog when switching tabs with unsaved changes.

### Gap 4: Admin dashboard — dynamic data fetching (§6.2)
**Spec says**: All dashboard metrics are real-time from API. Attendance cards, KPI cards, login times — all fetched dynamically.
**Current state**: All values hardcoded to 0 / "No logins recorded yet." No API calls.
**Fix**: Create dashboard stats API endpoint. Fetch attendance counts, KPI metrics, today's logins on mount. Wire up to actual data.

### Gap 5: Admin dashboard — monthly attendance percentage tracker (§6.2)
**Spec says**: Monthly attendance rate card with circular progress gauge, comparison vs. last month (arrow up/down with % change), clickable for per-employee breakdown.
**Current state**: Not present at all.
**Fix**: Add monthly attendance section with donut chart, month-over-month comparison, and drill-down link.

### Gap 6: Admin dashboard — date-wise data tabs / time range selector (§6.2)
**Spec says**: Side panel with Today, Yesterday, predefined periods (weekly, 15-day, monthly), custom date range picker, "All" option. Data viewing modes: Daily, Weekly, 15-day, Monthly, 3-month, 6-month, Yearly, All-time, Custom.
**Current state**: No date/time range filtering at all — dashboard shows only "today" with static data.
**Fix**: Add date range selector component. Wire dashboard metrics to accept and use date range parameters.

### Gap 7: Account creation modal — assigned RMs display (§6.3.2)
**Spec says**: Success modal shows "Assigned Reporting Manager(s)" — names of RM(s) assigned during creation (if any).
**Current state**: Success modal shows name, role, Employee ID, password — but NOT assigned RMs.
**Fix**: If RM assignment happens during creation, include RM names in the success modal. If assignment is separate, add RM multi-select to creation form.

### Gap 8: Account creation success modal — download credentials button (§6.3.2)
**Spec says**: Optional "Download Credentials" button — downloads text file or PDF with Employee ID + password.
**Current state**: Only copy-to-clipboard buttons exist.
**Fix**: Add "Download Credentials" button that generates and downloads a text file with employee ID and password.

### Gap 9: Employee detail — password view with admin verification (§6.3.3)
**Spec says**: Password field masked by default. Eye icon to reveal — requires admin's own password verification first. Copy icon also requires verification. 5-minute verification cache. Auto-hide after 30 seconds.
**Current state**: No password field at all in employee detail page.
**Fix**: Add password display section with masked field, eye/copy icons, admin password verification dialog, 5-minute cache timer, 30-second auto-hide.

### Gap 10: Employee detail — Employee ID copy icon (§6.3.3)
**Spec says**: Copy icon beside Employee ID field in detail page. Click copies to clipboard with toast.
**Current state**: Employee ID shown as read-only text in profile tab but no copy icon.
**Fix**: Add copy-to-clipboard icon button beside Employee ID display.

### Gap 11: Employees list — missing columns (§6.4)
**Spec says**: Table should have these additional columns: Assigned RM(s), Attendance Rate, Late Count, Leave Balance, Target Achievement, Live Status, Last Active, KYC Status.
**Current state**: Only 10 columns present. Missing 8 columns from spec.
**Fix**: Add the 8 missing columns. Some require new backend endpoints/aggregations (attendance rate, late count, leave balance, target achievement, live status, last active, KYC status).

### Gap 12: Admin dashboard — Today's Logins live list (§6.2)
**Spec says**: Scrollable list of employees who logged in today with name, role, login time, status (On Time / Late). Sorted by most recent. Employees not yet logged in listed separately with "Not Yet Logged In" label.
**Current state**: Placeholder text "No logins recorded yet." — no API integration.
**Fix**: Create API endpoint for today's login times from LoginHistory/attendance. Fetch and display scrollable list with on-time/late indicators.

### Gap 13: Admin dashboard — Conversion Rate KPI (§6.2)
**Spec says**: KPI card showing "Conversion Rate" — % of candidates who reached Date of Joining out of total sourced.
**Current state**: KPI cards show Candidates Today, This Month, Pending, Outstanding — no Conversion Rate.
**Fix**: Add Conversion Rate card to KPI section. Calculate from candidate pipeline data.

### Gap 14: Success modal — Email display (§6.3.2)
**Spec says**: Success modal should show "Email" — the email address added to the account.
**Current state**: Success modal shows Name, Role, Employee ID, Password — but NOT Email.
**Fix**: Add email field to createdUser state and display in success modal.

## Summary

| Category | Count |
|----------|-------|
| Compliant | 20 |
| Gaps | 14 |
