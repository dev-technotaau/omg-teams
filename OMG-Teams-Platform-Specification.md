# OMG Teams — Internal Recruitment, Employee & Workforce Management Platform

## Complete Technical Specification & Implementation Prompt

---

## TABLE OF CONTENTS

1. [Project Overview & Business Context](#1-project-overview--business-context)
2. [Entity Hierarchy & Relationships](#2-entity-hierarchy--relationships)
3. [User Roles & Access Control](#3-user-roles--access-control)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [Recruiter Module](#5-recruiter-module)
6. [Admin Module](#6-admin-module)
7. [Reporting Manager Module](#7-reporting-manager-module)
8. [Zone-Based Form Logic](#8-zone-based-form-logic)
9. [Company / Service Provider / HR — Relational Dropdowns](#9-company--service-provider--hr--relational-dropdowns)
10. [Report Generation & Distribution System](#10-report-generation--distribution-system)
11. [Notification System](#11-notification-system)
12. [Data Viewing, Filtering, Pagination & Virtualization](#12-data-viewing-filtering-pagination--virtualization)
13. [Profile Photo System](#13-profile-photo-system)
14. [Invoice Number Auto-Generation Logic](#14-invoice-number-auto-generation-logic)
15. [Tech Stack & Infrastructure](#15-tech-stack--infrastructure)
16. [Security Layer](#16-security-layer)
17. [Database Schema Guidelines](#17-database-schema-guidelines)
18. [UI/UX Requirements](#18-uiux-requirements)
19. [Implementation Order & Phasing](#19-implementation-order--phasing)
20. [Admin Reports Management Page](#20-admin-reports-management-page)
21. [Admin Analytics & Statistics Page](#21-admin-analytics--statistics-page)
22. [Single-Device Lock & Persistent Device Binding](#22-single-device-lock--persistent-device-binding)
23. [Additional Platform Features](#23-additional-platform-features)
24. [Development, Architecture & Tech-Stack Standards](#24-development-architecture--tech-stack-standards)
25. [Security Hardening](#25-security-hardening)
26. [Deployment & Infrastructure](#26-deployment--infrastructure)
27. [Attendance Management System](#27-attendance-management-system)
28. [Leave Application & Management System](#28-leave-application--management-system)
29. [Document Upload & KYC Verification System](#29-document-upload--kyc-verification-system)
30. [User Profile Page & Profile Photo Management](#30-user-profile-page--profile-photo-management)
31. [Appendix — Field Reference Tables](#31-appendix--field-reference-tables)
32. [Complete Page Directory](#32-complete-page-directory)
33. [Complete Database Model Directory](#33-complete-database-model-directory)

---

## 1. PROJECT OVERVIEW & BUSINESS CONTEXT

### Platform Name

**OMG Teams** — Internal Recruitment, Employee & Workforce Management Platform

### Business Model

OMG Teams is a recruitment agency that provides hiring services to external **Companies**. Each Company may have multiple **Service Providers** operating under it, and multiple **HR Managers** within the company. OMG Teams receives recruitment tasks from these Companies (specifying required candidate profiles and locations) and assigns those tasks internally to its own employees — the **Recruiters**. Recruiters find, screen, and select matching candidates, then report their daily activity. Recruiters report to OMG Teams (not to the external companies).

### Platform Purpose

A web application to digitize and manage this entire recruitment workflow — from daily candidate reporting by recruiters, through managerial oversight, all the way to admin-level invoicing, analytics, and report generation. Beyond recruitment operations, the platform also serves as a comprehensive **employee/workforce management system** — managing employee attendance (punch in/out, working hours, late detection, half-day tracking), leave management (leave requests, approvals, balances, policies), employee document/KYC verification (Aadhaar, PAN, Resume, Bank Details, Offer Letter generation and verification), employee performance targets and goals, employee live status tracking (online/offline presence), device-level security binding, and full employee lifecycle administration.

### Platform Scope — Key Functional Domains

| Domain | Description |
|--------|-------------|
| **Recruitment Operations** | Daily candidate sourcing, screening, report submission by recruiters, zone-based forms, candidate pipeline tracking, duplicate detection, company/service provider/HR management, invoicing. |
| **Employee Management** | Employee account lifecycle (create, suspend, reactivate, delete), profile management (photo, mobile, address), role assignments, device binding, KYC/document verification, targets/goals. |
| **Attendance Management** | Automatic punch in/out via login/logout, working hours calculation, late login alerts, half-day detection, holiday calendar, Admin attendance dashboard. |
| **Leave Management** | Employee leave requests with approval workflow, leave types (Casual, Sick, Earned, Comp Off, etc.), leave balances with auto-deduction, leave policies, team leave calendars. |
| **Document & KYC Management** | Employee document uploads (Aadhaar, PAN, Resume, Bank Details, Offer Letter), Admin verification workflow, offer letter generation from template, auto-verification of platform-generated documents. |
| **Reporting & Analytics** | 20+ report types, on-demand and scheduled report generation (XLSX), email distribution, enterprise-grade analytics dashboard with KPI cards, charts, funnels, real-time metrics, platform health monitoring. |
| **Notification System** | Real-time in-app notifications via Socket.io for all roles — document verification, leave approvals, attendance alerts, system events, with notification panel (dropdown + full page). |
| **Live Presence Tracking** | Employee online/offline status via Firebase Realtime Database + Firestore, last active timestamps, Admin and RM visibility. |
| **Security** | Single-device lock with persistent binding, JWT + BFF cookie auth, session management, account lockout, password complexity, data encryption, PII handling, Turnstile captcha. |

### Platform Type

Dashboard-style internal web application (not public-facing).

---

## 2. ENTITY HIERARCHY & RELATIONSHIPS

### Organizational & Recruitment Hierarchy

```
Company (top-level entity)
├── Service Provider 1 (belongs to Company)
├── Service Provider 2 (belongs to Company)
├── HR Manager 1 (belongs to Company)
└── HR Manager 2 (belongs to Company)

OMG Teams (the agency)
├── Admin (single, full control)
├── Reporting Manager 1
│   ├── Recruiter A (assigned by Admin)
│   └── Recruiter B (assigned by Admin)
└── Reporting Manager 2
    ├── Recruiter C
    └── Recruiter D
```

### Employee & Workforce Entities (per User)

```
User (Admin / Reporting Manager / Recruiter)
├── Profile (photo, mobile number, address)
├── Device Binding (deviceId, deviceLockedAt — Section 22)
├── Sessions (active sessions with geo/timestamps — Section 4)
├── Attendance Records (daily punch in/out, working hours — Section 27)
│   └── one AttendanceRecord per user per day
├── Leave Requests (submitted leave applications — Section 28)
│   └── linked to LeaveType + LeaveBalance
├── Leave Balances (per leave type per year — Section 28)
├── Employee Documents (uploaded KYC docs — Section 29)
│   ├── Aadhaar Card
│   ├── PAN Card
│   ├── Resume
│   ├── Bank Details
│   └── Offer Letter & Agreement
├── Offer Letter (generated by Admin — Section 29.4)
├── Recruiter Targets (daily/weekly/monthly goals — Section 23.9)
├── Notifications (in-app notifications — Section 11)
├── Login History (login attempt audit log — Section 22)
├── User Devices (device binding history — Section 22)
└── Backup Codes (emergency device login — Section 23.16)
```

### Recruitment Data Entities (per Candidate Report)

```
Candidate Report (submitted by Recruiter, enriched by Admin)
├── Zone (North / South / East / West / Central)
├── Company (relational dropdown — Section 9)
│   ├── Service Provider (belongs to Company)
│   └── HR Manager (belongs to Company)
├── Invoice (admin-only — Section 14)
├── Candidate Stage (pipeline status — Section 23.11)
├── Duplicate Group (if flagged — Section 23.3)
└── Candidate Report Draft (auto-saved form state — Section 23.8)
```

### Platform-Level Entities

```
Platform Configuration & Operations
├── Holiday (holiday calendar — Section 27.9)
├── Leave Type (Casual, Sick, Earned, Comp Off, etc. — Section 28.1)
├── Document Type (Aadhaar, PAN, Resume, etc. — Section 29.1)
├── Audit Log (all CRUD actions across platform — Section 23.1)
├── Generated Report (report files on cloud — Section 20)
├── Scheduled Report Config (recurring email reports — Section 20.3)
├── Report Delivery Log (email delivery tracking — Section 20)
├── Notification Preference (per-user notification settings — Section 11.5)
├── Analytics Snapshot (pre-computed aggregations — Section 21.9)
├── Platform Health Log (system metrics — Section 21.9)
├── Attendance Config (configurable thresholds — Section 27.13)
├── Leave Policy Config (configurable leave rules — Section 28.7)
├── Admin Settings (platform-wide configurations — Section 23.12)
└── Dropdown Options (admin-configurable master data — Section 23.19)
```

### Key Relationship Rules

- A **Company** has many **Service Providers**.
- A **Company** has many **HR Managers**.
- **Service Providers** are relational with (belong to) **Companies**.
- **HR Managers** are relational with (belong to) **Companies**.
- A **Recruiter** can be assigned to **multiple Reporting Managers** (by Admin).
- Admin can **remove and reassign** Reporting Managers to/from Recruiters at any time.
- There is exactly **one Admin** in the system.
- **Reporting Managers** and **Recruiters** cannot register themselves — their accounts are created exclusively by Admin.
- A **User** has many **Attendance Records** (one per day).
- A **User** has many **Leave Requests**.
- A **User** has many **Leave Balances** (one per leave type per year).
- A **User** has many **Employee Documents** (one per document type, with version history).
- A **User** may have one **Offer Letter** (generated by Admin, with re-generation history).
- A **User** has many **Notifications**.
- A **User** has many **Audit Log** entries (as the actor who performed actions).
- A **Candidate Report** belongs to one **Recruiter** (who submitted it) and may be linked to one **Company**, one **Service Provider**, one **HR Manager**, and one **Invoice**.
- A **Candidate Report** may belong to a **Duplicate Group** (if flagged as duplicate).
- **Holidays** are platform-wide (apply to all users).
- **Leave Types** and **Document Types** are admin-configurable and apply to all employees.

---

## 3. USER ROLES & ACCESS CONTROL

### 3.1 Admin (Single User — Full Control)

**Account management:**
- Creates, deletes, suspends/deactivates, and reactivates Recruiter and Reporting Manager accounts.
- Assigns/removes/reassigns Reporting Managers to Recruiters (many-to-many).
- Changes/resets passwords for self, Recruiters, and Reporting Managers.
- Uploads profile photos for self and all other users.

**Data access:**
- Full read/write access to all data across the platform.
- Views and edits all recruiter-submitted reports.
- Adds additional fields/data to recruiter submissions (admin-only fields — see Section 6).
- Views all candidate data, joining data, invoicing data.

**Session management:**
- Views all active sessions for all Reporting Managers and Recruiters.
- Views session metadata: location data of all sessions, timestamps of locations.
- Can revoke all sessions for a user or revoke individual sessions selectively.

**Report & analytics:**
- Full date-wise data viewing with tabs: Today, Yesterday, custom period selector, and "All" view option.
- Downloads reports directly from admin panel (generated on-the-fly, not saved to cloud) in XLSX format.
- Downloads by multiple time ranges: daily, weekly, 15-day, monthly, 3-month, 6-month, yearly, and custom.
- Downloads batch reports (all recruiters combined) or individual recruiter reports.
- Downloads all report types combined or each report type separately.
- Configures and manages the automated email report distribution system.

**Company/Service Provider/HR management:**
- Creates, edits, and manages Companies, Service Providers (under Companies), and HR Managers (under Companies).

**Attendance management (Section 27):**
- Views full attendance logs for all employees (recruiters and reporting managers), filtered by date, employee, role, or status.
- Attendance dashboard with summary cards (Present Today, Absent Today, Late Today, On Leave Today, Half Day Today).
- "Today's Logins" panel showing login times for all employees with on-time/late indicators.
- Monthly attendance percentage tracker (auto-calculated) with comparison vs. previous month.
- Edits punch-in/out times for any employee (to correct incomplete or erroneous records).
- Marks employees as "On Leave" for specific dates. Overrides half-day and late flags with reason.
- Configures attendance settings: expected login time, grace period, absent threshold, half-day threshold, break deduction, end-of-day cutoff, working days (Section 27.13).
- Manages the holiday calendar: add/edit/delete holidays, set recurring holidays (Section 27.9).

**Leave management (Section 28):**
- Receives leave request notifications from employees. Approves or rejects leave requests with one click (approve) or with mandatory rejection reason (reject).
- Bulk approve/reject multiple pending leave requests at once.
- Views complete leave request history across all employees with filtering by employee, type, status, date range.
- Manages leave balances for all employees: set annual allotments (global default or per-individual override), adjust balances manually (credit/debit with reason), configure carry-forward rules, trigger yearly balance resets.
- Views team-wide leave calendar with conflict detection (alerts when too many employees on leave same day).
- Revokes previously approved leave (with reason — balance restored to employee).
- Configures leave policies: allotments per type, max consecutive days, advance notice requirements, backdate limits, document requirements, carry-forward rules, negative balance toggle (Section 28.7).

**Document / KYC verification (Section 29):**
- Receives notifications when employees upload documents. Reviews uploaded documents (Aadhaar, PAN, Resume, Bank Details, Offer Letter/Agreement).
- Verifies or rejects each document with one click (verify) or with mandatory rejection reason (reject). Can change document status in any direction: Verified ↔ Pending ↔ Rejected.
- Verification toggle: Verified / Pending per document on the Admin panel.
- Views KYC completion status for all employees: "Complete," "Incomplete (X/Y)," "Pending Review," "Not Started."
- Generates offer letters/agreements from a codebase template with static content (header, footer, watermark, owner signature) and dynamic fields pre-filled from employee account data (Section 29.4). Can generate during or after account creation.
- Downloads and re-downloads generated offer letters. Views generation history. Re-generates with new terms (previous version archived).
- Batch document verification (select multiple pending documents, verify all at once).

**Recruiter targets & goals (Section 23.9):**
- Sets daily/weekly/monthly candidate sourcing targets per recruiter (individual or global default).
- Views target achievement across all recruiters. Edits/deactivates targets. Views target change history.

**Employee live status visibility (Section 23.15):**
- Sees online/offline/idle live status indicator (green/yellow/gray dot) for ALL employees (recruiters and reporting managers).
- Sees "last active X hours ago" status for all employees.
- Visible on: Admin Dashboard, Employees page, User Management table, Analytics "Active Users" widget.

**Device management (Section 22):**
- Resets device binding for any recruiter or reporting manager (one-click "Reset Device" button per employee).
- Force-logout all sessions for any user. Force switch device (reset + logout in one action).
- Views bound device info: deviceId, lock timestamp, user agent, platform.
- Views login history and device tracking history for all users.

**Audit & compliance (Section 23.1):**
- Views full audit trail of all CRUD actions across the platform: who created/edited/deleted what record, when, from where, with old → new value details.
- Filters audit log by user, action type, entity type, date range. Searches by entity ID or user name. Exports audit log to XLSX.

**Duplicate management (Section 23.3):**
- Views all flagged candidate duplicates. Resolves duplicates: merge records, dismiss flag, delete duplicate.

**Bulk operations (Section 23.2):**
- Performs bulk edit, bulk delete, bulk status update, bulk assign, bulk payment status update, and bulk export across candidate records and other entities.

**Data import (Section 23.6):**
- Imports historical candidate data via bulk CSV/XLSX upload with column mapping, validation, duplicate detection, and error reporting.

**Trash management (Section 23.7):**
- Views all soft-deleted records across all entity types in a dedicated "Trash" page. Restores or permanently deletes items. Bulk restore/permanent delete.

**Platform settings & configuration (Section 23.12):**
- Manages platform-wide settings: zone-to-form-set mappings, dropdown options (states, locations, profiles, qualifications, notice periods), attendance thresholds, leave policies, document types, invoice prefix format, session timeout duration, auto-archive thresholds, notification preferences.
- Manages configurable dropdown options (master data) for all form fields without code changes (Section 23.19).
- Manages email templates for system-generated emails (Section 23.13).

**Notification center (Section 11):**
- Receives ALL platform notifications: document verification requests, leave approval requests, late/half-day attendance alerts, report submissions, account events, system alerts, scheduled report delivery status, BullMQ job failures, and more.
- Notification panel (dropdown/drawer + full page) with unread count badge, "Mark All as Read" button, "Clear All" button, unread highlight/changed background, filtering by category.

### 3.2 Reporting Manager

**Account:** Created by Admin only. Can login but NOT register.

**Data access:**
- Can view reports and data submitted by Recruiters who are assigned under them by Admin.
- Read-only access — cannot edit recruiter submissions.
- Cannot view data from Recruiters not assigned to them.

**Profile:**
- Can upload own profile photo.

**Profile page (Section 30):**
- Dedicated "My Profile" page to view personal information, update mobile number and address, upload/change/remove profile photo with full image manipulation controls (crop, rotate, scale, reposition, fixed ratio).

**My Recruiters page (Section 7):**
- Dedicated view-only page showing all recruiters assigned under them by Admin.
- Displays: profile photo, name, email, status, live online/offline dot, last active, candidates today/month, attendance today, completion rate, target progress, KYC status.
- **No control** on adding or removing recruiter assignments — only Admin can modify assignments. No "Add" or "Remove" buttons.

**Team dashboard (Section 23.4.2):**
- Team performance dashboard showing aggregate stats of all assigned recruiters: total candidates (team) today, active recruiters today, team completion rate, top performer.
- Per-recruiter bar chart, team trend lines, status breakdown.
- Own attendance & working hours display: today's status, punch-in time, live working hours counter, late indicator, monthly attendance rate, attendance streak.
- Own leave overview: leave balance summary, upcoming approved leaves, pending leave requests.
- Team attendance snapshot: team present/absent/late/on leave today, team avg working hours, team login list.

**Team attendance view (Section 27.8):**
- Views attendance data for assigned recruiters (same columns as Admin view but scoped to assigned recruiters only). Read-only — cannot edit attendance records.
- Team attendance summary cards: present, absent, late count for the team today.

**Team leave view (Section 28.5):**
- Views leave requests from assigned recruiters: all statuses (Pending/Approved/Rejected). Read-only — **cannot** approve or reject leave requests (only Admin can).
- Team leave calendar showing which assigned recruiters are on leave on which dates.
- Receives notification when assigned recruiter's leave is approved or revoked by Admin.

**Employee live status visibility (Section 23.15):**
- Sees online/offline/idle live status indicator for **themselves** (green dot in own navigation header).
- Sees online/offline dot + "last active X hours ago" for **all recruiters assigned under them** (on My Recruiters page and Team Dashboard).
- **Cannot** see other reporting managers' status or unassigned recruiters' status.

**Own attendance self-view (Section 27.7):**
- "My Attendance" page showing own attendance log with all columns (Punch In, Punch Out, Working Hours, Status, Late By).
- Monthly summary: total present days, half days, late count, absent count, total working hours, average daily hours.
- Calendar view with color-coded days. Read-only.

**Own leave application (Section 28.4):**
- "My Leaves" page to apply for leave (submit leave request with date range, leave type, reason, optional supporting document).
- Views own submitted leave requests with statuses (Pending/Approved/Rejected/Cancelled). Cancel pending requests.
- Views own leave balance per type with progress bars. Personal leave calendar (color-coded by status).

**Own document upload (Section 29.2):**
- "My Documents" page to upload required documents (Aadhaar Card, PAN Card, Resume, Bank Details, Offer Letter/Agreement).
- Views verified/pending/rejected status per document as Admin updates. Re-uploads rejected or verified documents (status resets to Pending).
- Overall KYC progress bar. Receives notifications on document verification/rejection/KYC completion.

**Notification center (Section 11):**
- Receives notifications for: own leave approvals/rejections, own document verification status changes, own attendance alerts (late login, half-day), assigned recruiters' leave approvals/revocations, assigned recruiters' late logins/absences/half-days, assigned recruiters' report submissions, assigned recruiters' target achievements, own account changes (password reset, device reset, session revoked), system alerts (maintenance mode).
- Notification panel (dropdown/drawer + full page) with unread count badge, "Mark All as Read" button, "Clear All" button, unread highlight.

**Form auto-save (Section 23.8):**
- If the Reporting Manager also submits reports (based on platform configuration), draft auto-save applies to their forms as well.

### 3.3 Recruiter

**Account:** Created by Admin only. Can login but NOT register.

**Data access:**
- Can submit daily reports via the report form (see Section 5).
- Can view ONLY their own submitted data/reports — cannot see any other recruiter's data.

**Profile:**
- Can upload own profile photo.

**Auto-populated fields in their form:**
- Recruiter Name: auto-set, read-only (from their account).
- Reporting Manager: auto-set, read-only (from admin assignment).

**Profile page (Section 30):**
- Dedicated "My Profile" page to view personal information, update mobile number and address, upload/change/remove profile photo with full image manipulation controls (crop, rotate, scale, reposition, fixed ratio).

**Personal dashboard (Section 23.4.1):**
- Personal performance dashboard showing own stats: candidates sourced today/this week/this month, completion rate, pending count.
- Daily trend line, weekly performance bar chart, status breakdown donut, zone distribution pie.
- Today's attendance & working hours: today's status badge (Present/Not In/On Leave), punch-in time, **live working hours counter** (ticks every minute, e.g., "5h 23m"), late indicator, yesterday's/this week's/this month's hours.
- Daily attendance overview: 7–14 day attendance streak as colored dots, monthly attendance rate percentage.
- Leave overview: compact balance display ("CL: 8 · SL: 6 · EL: 15"), upcoming approved leaves, pending leave request count, next leave date.
- Target progress (if targets set by Admin — Section 23.9): target progress bar ("12 of 15 today"), target achievement history.

**Own attendance self-view (Section 27.7):**
- "My Attendance" page showing own attendance log with Punch In, Punch Out, Working Hours, Status, Late By.
- Monthly summary and color-coded calendar view. Read-only.

**Leave application (Section 28.4):**
- "My Leaves" page to apply for leave (submit leave request with date range, leave type, reason, optional supporting document).
- Views own leave requests with statuses. Cancel pending requests. Views own leave balance per type. Personal leave calendar.

**Document upload (Section 29.2):**
- "My Documents" page to upload required documents (Aadhaar Card, PAN Card, Resume, Bank Details, Offer Letter/Agreement).
- Views verified/pending/rejected status per document as Admin updates. Re-uploads documents (status resets to Pending).
- Overall KYC progress bar. Receives notifications on verification/rejection/KYC completion.

**Live status indicator (Section 23.15):**
- Green dot next to own avatar in the navigation header — indicates own online/connection status.
- Recruiter sees **only their own** live indicator. **Cannot see** other recruiters' or reporting managers' live status or last active info.

**Form auto-save / draft system (Section 23.8):**
- Auto-save of in-progress report form every 30 seconds, on field blur, and on browser beforeunload.
- Draft resume prompt when reopening the form with an existing draft.
- "Save Draft" manual button and "Unsaved changes" warning on navigation.

**Notification center (Section 11):**
- Receives notifications for: leave approvals/rejections/revocations, leave balance low warnings, document verification/rejection/status changes, KYC reminders and completion, late login flags, half-day recorded, password/device/session/account changes by Admin, daily target achieved, target updated by Admin, system maintenance alerts.
- Notification panel (dropdown/drawer + full page) with unread count badge, "Mark All as Read" button, "Clear All" button, unread highlight.

---

## 4. AUTHENTICATION & SESSION MANAGEMENT

### Authentication

- **Method:** JWT-based authentication.
  - **Recruiters and Reporting Managers:** Login with **Employee ID + password**. Employee ID is a unique auto-generated identifier assigned at account creation (see Section 6.3.1). Email is NOT used for login credentials — email is stored in the account for notifications and communication purposes only.
  - **Admin:** Login with **email + password** (single admin account).
- **Password storage:** Hashed and salted (use bcrypt or argon2).
- **Password complexity requirements:** Minimum 8 characters, must contain at least 1 uppercase, 1 lowercase, 1 digit, 1 special character. Common password blocklist enforced. Personal info rejection (email/name in password). Max 128 characters. Full specification in Section 25.2.
- **Multiple sensitive data fields:** Hashed and salted as appropriate (identify PII fields during implementation).
- **Login only:** Recruiters and Reporting Managers can only login — no self-registration. Only Admin can create accounts.
- **Captcha:** Cloudflare Turnstile captcha on the login page for all roles.
- **No forgot password / reset password on login page:** There is NO "Forgot Password" link, NO "Reset Password" option, and NO self-service password recovery on the login page for ANY role (Admin, Recruiter, or Reporting Manager). Password resets are handled exclusively by Admin from the admin panel (Section 6.3). If an employee forgets their password, they must contact Admin.
- **Password reset (Admin-side only):** Admin can change/reset passwords for self, Recruiters, and Reporting Managers from the admin panel. This is the only way passwords are reset.
- **Account lockout:** After 5 consecutive failed login attempts, the account is temporarily locked for 15 minutes (configurable). Admin is notified. Admin can manually unlock. Full specification in Section 25.1.
- **Login history tracking:** Every login attempt (successful and failed) is logged to the `LoginHistory` table with: timestamp, deviceId, IP (display only), userAgent, success/failure reason. Full specification in Section 22.12/22.16.

### Login Page UI

**No public landing page.** The platform has NO public-facing landing page, marketing page, or homepage. If a user is not authenticated (no valid session), they are **always redirected to the login page**. The login page IS the entry point for the entire platform. After successful login, the user is redirected to their role-specific dashboard.

**Tab-based login interface:**

The login page has a **3-tab system** for the three user roles:

```
┌──────────────┬─────────────────────┬───────────┐
│  Recruiter   │  Reporting Manager  │   Admin   │
│  (default)   │                     │           │
└──────────────┴─────────────────────┴───────────┘
┌─────────────────────────────────────────────────┐
│                                                 │
│   Employee ID: [____________]                   │
│   Password:    [____________]                   │
│                                                 │
│   [  Turnstile Captcha  ]                       │
│                                                 │
│   [      Login      ]                           │
│                                                 │
└─────────────────────────────────────────────────┘
```

| Aspect | Behavior |
|--------|----------|
| **Tabs** | Three tabs at the top of the login form: **Recruiter** (leftmost), **Reporting Manager** (center), **Admin** (rightmost). |
| **Default tab** | **Recruiter tab is open by default** when the login page loads. |
| **Recruiter tab** | Shows: Employee ID field + Password field + Turnstile captcha + Login button. |
| **Reporting Manager tab** | Shows: Employee ID field + Password field + Turnstile captcha + Login button. Same layout as Recruiter tab. |
| **Admin tab** | Shows: Email field + Password field + Turnstile captcha + Login button. Admin logs in with email, NOT employee ID. |
| **Tab visual** | Active tab is highlighted (filled background, bold text). Inactive tabs are muted (outline or lighter background). Clean, professional styling. |
| **No forgot password** | There is NO "Forgot Password?" link, NO "Reset Password" button, and NO self-service password recovery anywhere on the login page. Not on any tab. |
| **No registration** | There is NO "Sign Up" or "Register" link. Accounts are created by Admin only. |
| **No public content** | The login page shows ONLY the login form, the OMG Teams logo/branding, and optionally a tagline. No marketing content, no features list, no public information. |
| **Error messages** | Clear error messages for: invalid credentials ("Invalid Employee ID or password"), account locked ("Account temporarily locked. Contact admin."), account suspended ("Account suspended. Contact admin."), device mismatch ("Account registered on another device. Contact admin."). |
| **After login redirect** | On successful login, redirect to the user's role-specific dashboard: Recruiter → Recruiter Dashboard, Reporting Manager → RM Dashboard, Admin → Admin Dashboard. |

### Login Flow — Complete Sequence

The login flow integrates authentication, device binding, session creation, attendance tracking, and presence detection. The complete sequence on every login attempt:

| Step | Action | Reference |
|------|--------|-----------|
| 1 | User selects their role tab (Recruiter / Reporting Manager / Admin) and submits credentials: **Employee ID + password** (for Recruiter/RM) or **email + password** (for Admin) + deviceId (from localStorage/cookie). Turnstile captcha validated. | Section 4 |
| 2 | **Account lockout check:** If account is locked (5+ failed attempts within cooldown) → reject with lockout error. | Section 25.1 |
| 3 | **Credential lookup:** For Recruiter/RM: find user by Employee ID. For Admin: find user by email. If not found → reject with "Invalid credentials." | Section 4 |
| 4 | **Password validation:** Verify password against stored hash. If invalid → increment failed attempt counter in Redis, log to LoginHistory, reject. | Section 4, Section 22.16 |
| 5 | **Account status check:** If account is Suspended/Deactivated → reject with suspension error. | Section 4 |
| 6 | **Device binding enforcement:** If user has no bound device → bind this device permanently. If same device → allow. If different device → block with error "Account already registered on another device. Contact admin." Alternatively, user can provide a backup code to bypass device lock and bind a new device. | Section 22.5, Section 23.16 |
| 7 | **Single active session enforcement:** Check Redis for existing session. If existing session from different device → block. If same device → replace session. | Section 22.7 |
| 8 | **Create JWT + session:** Issue JWT with userId, role, deviceId. Create Redis session. Set HTTPS-only BFF cookie. | Section 4 |
| 9 | **Log successful login:** Record in LoginHistory table (success, deviceId, IP, userAgent). Reset failed attempt counter. | Section 22.16 |
| 10 | **Attendance punch-in (with leave day check):** Check if the employee has an approved leave for today. **If leave is approved:** login is allowed (employee can access the platform), but working timer does NOT start — AttendanceRecord status remains `ON_LEAVE`, working hours = 0, login is recorded as `leaveLoginAt` for audit only. **If no approved leave:** record the login timestamp as the official Punch In time in the AttendanceRecord (first login of the day only — subsequent logins do NOT overwrite). | Section 27.1.1 |
| 11 | **Firebase presence:** Establish Firebase Realtime Database connection. Set `/presence/{userId}` to `online: true` with server timestamp. Register `onDisconnect()` handler to auto-set offline on disconnect. | Section 23.15.3 |
| 12 | **Socket.io connection:** Establish Socket.io connection authenticated with the session. Join appropriate rooms (user-specific, role-specific). Broadcast `presence:online` event to Admin and assigned Reporting Managers. | Section 23.15.5 |
| 13 | **Redirect to dashboard:** Route user to their role-specific dashboard (Recruiter Dashboard / RM Dashboard / Admin Dashboard). | — |

### Logout Flow — Complete Sequence

| Step | Action | Reference |
|------|--------|-----------|
| 1 | **Destroy session:** Delete Redis session key `session:{userId}`. | Section 22.6 |
| 2 | **Clear JWT + cookies:** Clear HTTPS-only BFF cookie. | Section 4 |
| 3 | **Device binding preserved:** `deviceId` in database is NOT cleared — device binding persists after logout. | Section 22.6 |
| 4 | **Attendance punch-out:** Record the logout timestamp as the Punch Out time. If user logs out and back in, the last logout of the day is the official Punch Out. | Section 27.1.2 |
| 5 | **Firebase presence:** Set `/presence/{userId}` to `online: false`, update `lastActiveAt`. Firebase `onDisconnect()` also handles this automatically if browser closes without explicit logout. | Section 23.15.3 |
| 6 | **Socket.io disconnect:** Disconnect Socket.io. Broadcast `presence:offline` event. | Section 23.15.5 |
| 7 | **Redirect to login page.** | — |

### Session Management

- **Cookie strategy:** HTTPS-only cookies using BFF (Backend-for-Frontend) pattern. No tokens exposed to client-side JavaScript.
- **Session storage:** Redis-backed sessions.
- **Session persistence across browser close:** If a user closes their browser tab or the entire browser and later reopens the website, **they should remain logged in** and be redirected to their dashboard — NOT forced to login again. The HTTPS-only session cookie persists across browser close (it is NOT a session-only cookie — it has an explicit expiry, not tied to browser session lifetime). The session remains valid in Redis until it is explicitly destroyed by: (a) the midnight session reset cron job, (b) manual logout, (c) idle timeout, (d) Admin session revocation. **Auto logout happens only at midnight** (via the midnight cron job — Section 27.1.3). Until midnight, the session persists across browser reopens.
- **Session idle timeout:** Sessions expire after 30 minutes of inactivity (configurable). Every authenticated API request refreshes the TTL. Absolute session lifetime: until midnight (reset by midnight cron job). 5-minute client-side warning before idle timeout. Full specification in Section 25.3.
- **Session expiry as attendance punch-out:** If a session expires due to idle timeout without explicit logout, the session expiry timestamp is recorded as the Punch Out time (Section 27.1.2).
- **Midnight session reset cron job:** A BullMQ cron job runs every day at midnight (configurable) and automatically destroys ALL active employee sessions (recruiters and reporting managers). This forces every employee to login fresh each day so a fresh working timer starts. Without this, if an employee stayed logged in overnight, their working hours would continue counting into the next day, producing incorrect multi-day working hours. The midnight reset: (1) records Punch Out at midnight for the closing day, (2) destroys all employee Redis sessions, (3) invalidates all active JWTs, (4) sets Firebase presence to offline. Admin sessions are NOT affected. Employees see the login page on their next interaction the following day. Full specification in Section 27.1.3.
- **Admin session control:**
  - View all active sessions for any Reporting Manager or Recruiter.
  - View session metadata: geolocation of each session, timestamps of all location changes.
  - Revoke all sessions for a user at once.
  - Revoke individual sessions selectively.
- **Account states:** Active, Suspended/Deactivated (by Admin), Deleted. Suspended users cannot login; Admin can reactivate.

---

## 5. RECRUITER MODULE

### 5.1 Report Submission Form

When a Recruiter clicks "Add Report," they are first presented with a **Zone Selection** step.

**Zone selection:**
- There are **5 zones**: North, South, East, West, Central.
- These 5 zones map to **2 distinct form configurations** (two sets of zones):
  - **Set A** (**West, Central** — 2 zones): Shows all 33 fields including the 5 screening/assessment fields (fields 26–30).
  - **Set B** (**East, North, South** — 3 zones): Shows 28 fields — the 5 screening/assessment fields (fields 26–30: CTC informed, off-roll okay, on-roll explained, two-wheeler, communication skills) are **hidden** for these zones.
- The form fields shown adapt based on the selected zone's set. Full zone-conditional field visibility specification in Section 8.

### 5.2 Recruiter Form Fields (33 Fields)

**Dropdown values source:** All dropdown fields in the form (State, Location, Profile, Higher Qualification, Notice Period, Diploma Part/Full) are populated from **admin-configurable dropdown options** (Section 23.19). Admin manages these lists from the "Dropdown Management" / "Master Data" page without code changes. Dropdown values may also vary by zone set (Section 8).

| # | Field Name | Type / Behavior |
|---|-----------|----------------|
| 1 | Sr. No | Display only on UI (not a database input — auto-generated serial). In DB, serial numbers are global across all recruiters. In UI, each recruiter sees their OWN sequential serial numbers. |
| 2 | Date Sourced / Profile Received | Date picker |
| 3 | Candidate Name | Text input |
| 4 | Contact No | Phone input with validation |
| 5 | State | Dropdown / searchable select |
| 6 | Location | Dropdown / searchable select (may vary by zone) |
| 7 | Profile | Dropdown / searchable select (may vary by zone) |
| 8 | Years of Experience | Number input |
| 9 | Current CTC | Number input (₹) |
| 10 | Current Designation | Text input |
| 11 | Current Organization | Text input |
| 12 | Email ID | Email input with validation |
| 13 | Higher Qualification | Dropdown / text |
| 14 | Expected CTC | Number input (₹) |
| 15 | Diploma Part / Full | Dropdown: Part, Full |
| 16 | Graduation % | Number input (percentage) |
| 17 | Graduation Year | Year picker / number |
| 18 | 12th Passing Year | Year picker / number |
| 19 | 12th % | Number input (percentage) |
| 20 | 10th Passing Year | Year picker / number |
| 21 | 10th % | Number input (percentage) |
| 22 | Date of Birth | Date picker |
| 23 | Age | Auto-calculated from DOB (read-only display) |
| 24 | Notice Period | Text / dropdown (e.g., Immediate, 15 days, 30 days, 60 days, 90 days) |
| 25 | Remarks | Textarea (free text) |
| 26 | Is CTC informed and okay? | Toggle / select: Yes / No. **Zone-conditional: visible ONLY in Set A zones (West, Central). Hidden in Set B zones (East, North, South) — Section 8.** |
| 27 | Is off-roll nature of job okay with candidate? | Toggle / select: Yes / No. **Zone-conditional: visible ONLY in Set A zones (West, Central). Hidden in Set B zones (East, North, South) — Section 8.** |
| 28 | Is the on-roll opportunity explained with 18 months clause? | Toggle / select: Yes / No. **Zone-conditional: visible ONLY in Set A zones (West, Central). Hidden in Set B zones (East, North, South) — Section 8.** |
| 29 | Do have two wheeler and two wheeler Licence? | Toggle / select: Yes / No. **Zone-conditional: visible ONLY in Set A zones (West, Central). Hidden in Set B zones (East, North, South) — Section 8.** |
| 30 | Communication skills rate by scale of 10 | Slider / number input (1–10). **Zone-conditional: visible ONLY in Set A zones (West, Central). Hidden in Set B zones (East, North, South) — Section 8.** |
| 31 | Recruiter Name | Auto-set from logged-in user. Read-only. |
| 32 | Reporting Manager | Auto-set from admin assignment. Read-only. |
| 33 | Status | Dropdown: Complete / Pending |

### 5.3 Form Auto-Save & Draft System

The recruiter report form has a built-in **auto-save / draft system** to prevent data loss if the browser crashes, the tab is closed, or the recruiter accidentally navigates away while filling the 33-field form. Full specification in Section 23.8.

- Auto-saves current form state to the backend every 30 seconds, on field blur, and on browser `beforeunload`.
- Manual "Save Draft" button available.
- Draft resume: when reopening the form with an existing draft, the recruiter is prompted to resume or discard.
- "Unsaved changes" warning on navigation. Draft badge on the "Add Report" button if a draft exists.
- Drafts are automatically deleted when the form is successfully submitted.

### 5.4 Pre-Submission Validation — Duplicate Detection

Before saving a submitted report, the system performs **real-time candidate duplicate detection** (full specification in Section 23.3):

- Checks the submitted Contact No and Email ID against all existing candidate records in the database.
- If a match is found (same phone or same email): shows a warning to the recruiter with details of the existing record (who submitted it, when, for which company).
- The recruiter can choose to **proceed** (save with duplicate flag) or **cancel** (go back and edit).
- This prevents wasted effort and double invoicing.

### 5.5 Candidate Pipeline Stages

Beyond the binary Status field (Complete/Pending), each candidate report can also be tracked through a **multi-stage recruitment pipeline** (full specification in Section 23.11):

```
Sourced → Screened → CV Shared → Interview Scheduled → Selected → Joined → Invoiced → Closed
```

- The pipeline stage is managed primarily by Admin (who updates stages as candidates progress).
- Recruiters can view the pipeline stage of their own submissions (read-only, set by Admin).
- Pipeline stages feed into the recruitment funnel visualization on the Admin Analytics page (Section 21.3).

### 5.6 Recruiter Data Visibility

- Recruiters can view ONLY their own submitted reports and candidate data.
- They cannot see any other recruiter's data.
- Serial numbers displayed to each recruiter are scoped to their own records (even though DB stores global serials).
- Recruiters can **export their own data view** as XLSX/CSV directly from their data table using a quick export button (Section 23.14).

---

## 6. ADMIN MODULE

### 6.1 Admin Form (Superset of Recruiter Form)

Admin can view and edit all data submitted by recruiters, plus has **additional admin-only fields** (fields 34–48). Admin can add/modify data in these fields for any record.

| # | Field Name | Type / Behavior |
|---|-----------|----------------|
| 1–33 | *(Same as Recruiter form — see Section 5.2)* | *(Same types — but Admin has read/write on all)* |
| 34 | Company | Relational dropdown — see Section 9 |
| 35 | Service Provider | Relational dropdown (filtered by selected Company) — see Section 9 |
| 36 | HR Manager | Relational dropdown (filtered by selected Company) — see Section 9 |
| 37 | Location | Text / dropdown (admin-level, may differ from recruiter location field) |
| 38 | State | Text / dropdown (admin-level) |
| 39 | Date of Joining | Date picker |
| 40 | Invoice Date | Date picker |
| 41 | Invoice Number | Special auto-generation logic — see Section 14 |
| 42 | Invoice Amount Total | Number input (₹) |
| 43 | GST Amount | Number input (₹) |
| 44 | Amount Received | Number input (₹) |
| 45 | TDS Amount | Number input (₹) |
| 46 | Payment Status — Status / Date | Dropdown + Date picker composite |
| 47 | CV Shared On Date | Date picker |
| 48 | Feedback from HR | Dropdown: Rejected / Hold / Profile Closed |

### 6.1.1 Admin Candidate Detail / Edit View — Tabbed Interface

When Admin opens a candidate record to view or edit, the data is organized into a **tabbed interface** so Admin can quickly see and edit relevant information without scrolling through all 48 fields. The view has **4 tabs**:

```
┌──────────┬──────────────┬───────────────┬──────────────┐
│   All    │  Candidate   │  Recruitment  │     MIS      │
└──────────┴──────────────┴───────────────┴──────────────┘
```

#### Tab 1: All (Default)

Shows **all 48 fields** in a single scrollable view — the complete candidate record with every field visible. This is the default tab when opening a record, giving Admin the full picture at a glance.

- All fields are editable (Admin has read/write on all 48 fields).
- Fields grouped into logical sections within the tab for readability (Candidate Info, Education, Employment, Screening Questions, Recruitment Details, Invoice & Payment) — but all visible in one scrollable view.
- This tab is the only one that shows every field — the other tabs are filtered subsets for quick focused access.

#### Tab 2: Candidate (Personal & Qualification Details)

Shows only the **candidate's personal information, contact details, and educational qualifications** — the data that describes WHO the candidate is.

| # | Fields Shown |
|---|-------------|
| 2 | Date Sourced / Profile Received |
| 3 | Candidate Name |
| 4 | Contact No |
| 5 | State |
| 6 | Location |
| 12 | Email ID |
| 22 | Date of Birth |
| 23 | Age |
| 13 | Higher Qualification |
| 15 | Diploma Part / Full |
| 16 | Graduation % |
| 17 | Graduation Year |
| 18 | 12th Passing Year |
| 19 | 12th % |
| 20 | 10th Passing Year |
| 21 | 10th % |
| 25 | Remarks |

**Purpose:** Quick access to candidate identity, contact, and education data — useful for verifying candidate profiles, checking qualifications, and updating personal details.

#### Tab 3: Recruitment (Screening, Employment & HR Feedback)

Shows the **recruitment-specific data** — the candidate's current employment, screening responses, communication assessment, pipeline status, and HR feedback.

| # | Fields Shown |
|---|-------------|
| 7 | Profile |
| 8 | Years of Experience |
| 9 | Current CTC |
| 10 | Current Designation |
| 11 | Current Organization |
| 14 | Expected CTC |
| 24 | Notice Period |
| 26 | Is CTC informed and okay? *(Zone-conditional: Set A only — West, Central)* |
| 27 | Is off-roll nature of job okay with candidate? *(Zone-conditional: Set A only — West, Central)* |
| 28 | Is the on-roll opportunity explained with 18 months clause? *(Zone-conditional: Set A only — West, Central)* |
| 29 | Do have two wheeler and two wheeler Licence? *(Zone-conditional: Set A only — West, Central)* |
| 30 | Communication skills rate (scale of 10) *(Zone-conditional: Set A only — West, Central)* |
| 31 | Recruiter Name |
| 32 | Reporting Manager |
| 33 | Status (Complete / Pending) |
| — | Candidate Stage / Pipeline Status (Section 23.11) |
| 34 | Company |
| 35 | Service Provider |
| 36 | HR Manager |
| 37 | Location (Admin) |
| 38 | State (Admin) |
| 39 | Date of Joining |
| 47 | CV Shared On Date |
| 48 | Feedback from HR (Rejected / Hold / Profile Closed) |

**Purpose:** Quick access to everything related to the recruitment process — the candidate's professional profile, screening question responses, recruiter assessment, company assignment, HR feedback, and joining details. Useful for tracking candidate progress through the pipeline and making recruitment decisions.

#### Tab 4: MIS (Management Information System — Invoice, Payment & Financial Data)

Shows the **financial and administrative data** — invoicing, payment tracking, GST, TDS, and payment status. This is the Management Information System view for administrative and accounting purposes.

| # | Fields Shown |
|---|-------------|
| 3 | Candidate Name (read-only context — so Admin knows which candidate) |
| 34 | Company (read-only context) |
| 35 | Service Provider (read-only context) |
| 36 | HR Manager (read-only context) |
| 39 | Date of Joining |
| 40 | Invoice Date |
| 41 | Invoice Number |
| 42 | Invoice Amount Total |
| 43 | GST Amount |
| 44 | Amount Received |
| 45 | TDS Amount |
| 46 | Payment Status — Status / Date |
| — | Computed: Outstanding Amount (Invoice Total − Amount Received) |
| — | Computed: Net Receivable (Invoice Total − TDS − GST adjustments) |

**Purpose:** Quick access to all financial data for a candidate record — invoice details, payment tracking, tax components. Useful for Admin/accounts to process invoices, track payments, reconcile amounts, and manage cash flow without wading through candidate personal or recruitment data.

#### Tab Behavior & UX

| Behavior | Description |
|----------|-------------|
| **Default tab** | "All" tab is selected by default when opening a candidate record. |
| **Tab persistence** | If Admin switches to a tab (e.g., MIS), edits data, and saves — the view stays on that tab (doesn't reset to All). |
| **Tab URL state** | Active tab is reflected in the URL query parameter (e.g., `?tab=mis`) so Admin can share links to specific tabs and browser back/forward works. |
| **Editable on all tabs** | All fields on every tab are editable (Admin has full read/write). Changes are saved from any tab — the save action persists all field changes regardless of which tab is active. |
| **Unsaved changes warning** | If Admin has unsaved changes on any tab and tries to navigate away or switch tabs — show "You have unsaved changes" warning (same as form auto-save pattern — Section 23.8). |
| **Cross-tab field sync** | Some fields appear on multiple tabs (e.g., Candidate Name on both Candidate and MIS tabs). Editing a field on one tab updates it on all tabs in real-time (single source of truth — same record). |
| **Keyboard navigation** | Tabs navigable via keyboard (arrow keys to switch tabs, Tab key to move between fields within a tab). |
| **Responsive** | Tab bar scrolls horizontally on small screens. Tab content stacks vertically on mobile. |
| **Quick navigation** | From any data table row (candidate list), Admin can click directly into a specific tab: right-click context menu or action dropdown with "View Candidate Details," "View Recruitment Info," "View MIS / Invoice." |

#### Data-Aware Save Button (Admin Candidate Edit Form)

The Save button on the admin candidate detail/edit form is **data-aware** — it intelligently detects whether the current form state differs from the originally loaded (saved) data and only activates when there is a genuine change to save.

**Core behavior:**

| Behavior | Description |
|----------|-------------|
| **Deactivated by default** | When a candidate record is opened, the Save button is in a **deactivated/disabled state** (grayed out, not clickable). No data has changed yet — there is nothing to save. |
| **Activates on genuine change** | The Save button becomes **active/enabled** (full color, clickable) only when at least one field's current value differs from the originally loaded value from the database. |
| **Deactivates when reverted** | If Admin changes a field and then changes it back to its original value, the Save button returns to the **deactivated state** — because the form data is identical to the saved data again. There is no genuine change to persist. |
| **Example — revert scenario** | Suppose the Candidate Name field is prefilled with "Rahul Sharma." Admin clears the field (Save button activates — data changed). Admin then types "Rahul Sharma" back into the field (Save button deactivates — data is the same as the original). The system compares the current field value against the originally loaded value, not against the previous keystroke. |
| **Deep comparison** | The system performs a **field-by-field deep comparison** between the current form state and the original loaded state (snapshot taken when the record was first loaded). This is NOT a "dirty flag that stays dirty once touched" — it is a live comparison that can return to "clean" if all fields match their originals. |
| **All field types supported** | The deep comparison works correctly for all field types: text, numbers, dates (compared as ISO strings or timestamps), dropdowns (compared by value/ID), toggles (Yes/No booleans), textareas, relational dropdowns (compared by selected entity ID). |

**Technical implementation:**

| Aspect | Specification |
|--------|---------------|
| **Original state snapshot** | When the record loads, take a snapshot of all 48 field values as the `originalState` object. This snapshot is immutable — it does not change until the record is successfully saved (at which point it is refreshed with the new saved values). |
| **Current state tracking** | Track the current form state in a `currentState` object (React state / form state). Updated on every field change (onChange). |
| **Comparison function** | On every field change, run a comparison: `isDirty = !deepEqual(currentState, originalState)`. If `isDirty === true` → Save button active. If `isDirty === false` → Save button deactivated. |
| **Performance** | The comparison runs on every field change (onChange event), but for 48 fields this is a trivial shallow-object comparison — no performance concern. Use a memoized comparison to avoid unnecessary re-renders. |
| **After successful save** | On successful save: update the `originalState` snapshot to match the newly saved values (now the current state IS the original state). Save button deactivates immediately. |
| **Keyboard shortcut** | `Ctrl+S` / `Cmd+S` triggers save — but only if the Save button is active (data has changed). If the button is deactivated, the keyboard shortcut does nothing (prevents accidental no-op saves). |

**Visual states of the Save button:**

| State | Appearance | Clickable? |
|-------|-----------|------------|
| **Deactivated (no changes)** | Grayed out / muted colors, reduced opacity (e.g., 50% opacity). Cursor: `not-allowed`. | No |
| **Active (changes detected)** | Full primary color (e.g., solid blue/green), normal opacity. Cursor: `pointer`. | Yes |
| **Saving (in progress)** | Loading spinner replaces button text. Button disabled during save to prevent double-click. | No (loading) |
| **Save successful** | Brief success state — button text changes to "Saved ✓" with green color for 2 seconds, then reverts to deactivated state. | No |
| **Save failed** | Error toast shown. Button remains active so Admin can retry. | Yes |

**Scope:** This data-aware save button behavior applies to the **admin candidate detail/edit form** (Section 6.1 / 6.1.1) since candidate editing is only done by Admin. The same pattern can be extended to other admin edit forms across the platform for consistency.

### 6.2 Admin Dashboard Features

**Admin Dashboard Overview (Home / Landing Page):**

The Admin dashboard is the first screen Admin sees on login. It provides an at-a-glance operational summary of the entire platform — recruitment activity, employee attendance, and key alerts.

**Today's Attendance Status (top-level cards):**

| Card | Metric |
|------|--------|
| **Present Today** | Count of employees (recruiters + reporting managers) who have punched in today. Real-time — updates live as employees log in. |
| **Absent Today** | Count of employees with no punch-in today (after absent threshold time). |
| **Late Today** | Count of employees who punched in after the configured late threshold. |
| **On Leave Today** | Count of employees on approved leave today. |
| **Half Day Today** | Count of employees with half-day status today. |

**Login Times Display:**
- A compact **"Today's Logins"** panel on the dashboard showing a scrollable list of employees who have logged in today, each with:
  - Employee name, role, login time (Punch In timestamp), status indicator (On Time ✅ / Late ⚠️).
  - Sorted by login time (most recent first).
  - Employees who have NOT logged in yet are listed separately below with a "Not Yet Logged In" label.
- This gives Admin immediate visibility into who is working and who hasn't shown up.

**Monthly Attendance Percentage Tracker:**
- A **monthly attendance rate** card showing the auto-calculated percentage: `(Total Present Days across all employees) / (Total Working Days × Total Employees) × 100`.
- Displayed as a prominent percentage with a circular progress gauge or donut chart.
- Comparison indicator: vs. last month's attendance rate (↑ or ↓ with percentage change).
- Breakdown: clickable to see per-employee monthly attendance percentage.

**Pending Leave Requests Alert:**
- Card showing count of pending leave requests awaiting Admin action, with a "Review" button linking to the Leave Management dashboard (Section 28.3).

**Pending Document / KYC Verifications Alert:**
- Card showing count of documents with "Pending Verification" status across all employees, with a "Review" button linking to the Document Verification panel (Section 29.5).

**Recruitment KPI Cards (top-level, alongside attendance cards):**

| Card | Metric |
|------|--------|
| **Candidates Sourced Today** | Count of candidate reports submitted by all recruiters today. Real-time — updates as recruiters submit. |
| **Candidates This Month** | Count for the current month. |
| **Pending Reports** | Count of candidate reports with Status = "Pending." |
| **Conversion Rate** | % of candidates who reached Date of Joining out of total sourced (current period). |
| **Outstanding Amount** | Total Invoice Amount − Total Amount Received (pending collections). |

**Global Search:**
- A platform-wide search bar on the Admin dashboard (and accessible from the navigation header on every page) allowing Admin to search across all entities — candidates, companies, service providers, HR managers, recruiters, reporting managers — by name, phone number, email, or company name. Results grouped by entity type. See Section 23.10.

**Date-wise data tabs (side panel):**
- Today
- Yesterday
- Predefined periods (weekly, 15-day, monthly, etc.)
- Custom period selector (date range picker)
- "All" viewer option

**Data viewing modes:**
- Daily, Weekly, 15-day, Monthly, 3-month, 6-month, Yearly, All-time, Custom range.

**Report downloads from admin panel:**
- Generated on-the-fly and downloaded directly (NOT saved to cloud).
- Format: XLSX.
- Download scopes:
  - By time range: daily, weekly, 15-day, monthly, 3-month, 6-month, yearly, custom.
  - By recruiter: batch (all recruiters combined) or individual recruiter reports.
  - By report type: all report types combined, or each type separately.

### 6.3 User Management (Admin Only)

- **Create** Recruiter and Reporting Manager accounts.
  - During account creation: option to **generate Offer Letter / Agreement** from the platform template with dynamic fields pre-filled from the employee info being entered (Section 29.4.3). Can also be generated after creation.
  - On successful account creation: a **success modal** is displayed (see Section 6.3.2).
- **Delete** Recruiter and Reporting Manager accounts.
- **Suspend/Deactivate** any Recruiter or Reporting Manager.
- **Reactivate** suspended Recruiters and Reporting Managers.
- **Assign** Reporting Managers to Recruiters (can be multiple).
- **Remove and reassign** Reporting Managers from/to Recruiters.
- **Reset/change passwords** for self, Recruiters, and Reporting Managers. This is the ONLY way passwords are reset — there is no self-service "forgot password" for any role (Section 4).
- **Upload profile photos** for any user.
- **Full session management** — view sessions, session locations, timestamps, revoke individual or all sessions.
- **Device management** — one-click "Reset Device" button per employee to reset device binding, force-logout all sessions, force-switch device (reset + logout in one action), view bound device info (deviceId, lock timestamp, user agent). Full specification in Section 22.9.
- **Paginated user management views** with filtering and search.

#### 6.3.1 Employee ID Generation

When Admin creates a Recruiter or Reporting Manager account, a **unique Employee ID** is automatically generated with a logical naming convention.

**Employee ID format:**

```
OMG-XXXX
```

| Component | Description |
|-----------|-------------|
| **Prefix: `OMG`** | Stands for **"Opportunity Makers Group"** — the parent company of this platform. The prefix is fixed and consistent across all employee IDs. |
| **Separator: `-`** | Hyphen separating the prefix from the numeric portion. |
| **Numeric portion: `XXXX`** | Auto-incrementing sequential number, zero-padded to 4 digits minimum. Starts from `0001`. Examples: `OMG-0001`, `OMG-0002`, ..., `OMG-0150`, ..., `OMG-9999`. If the count exceeds 9999, the numeric portion expands: `OMG-10000`, `OMG-10001`, etc. |

**Employee ID rules:**

| Rule | Description |
|------|-------------|
| **Unique** | Every Employee ID is unique across all employees (recruiters + reporting managers). Enforced by unique constraint in the database. |
| **Auto-generated** | Generated automatically by the system on account creation. Admin does NOT manually type the Employee ID. |
| **Immutable** | Once generated, the Employee ID cannot be changed — it is the employee's permanent identifier on the platform. |
| **Not reused** | If an employee is deleted, their Employee ID is NOT reused for a new employee. The sequence continues from the last used number. |
| **Login credential** | The Employee ID is what recruiters and reporting managers use to log in (along with their password). It replaces email as the login identifier for employees (Section 4). |
| **Saved to database** | Stored in the `employeeId` field on the User model (Section 17). |
| **Displayed everywhere** | Shown in: employee management page, employee detail view, employee profile, attendance logs, leave requests, reports, audit trail, notification context — wherever an employee is referenced. |

**Admin login:** Admin does NOT have an Employee ID. Admin logs in with email + password (Section 4).

#### 6.3.2 Account Creation Success Modal

When Admin successfully creates a new Recruiter or Reporting Manager account, a **success modal dialog** is displayed showing the created employee's information and credentials.

**Modal content:**

| Element | Content |
|---------|---------|
| **Title** | "Employee Account Created Successfully ✅" |
| **Employee Name** | Full name of the created employee. |
| **Role** | Recruiter / Reporting Manager. |
| **Email** | Email address added to the account. |
| **Employee ID** | The auto-generated Employee ID (e.g., `OMG-0042`) — displayed prominently. **Copy icon** (📋) next to the Employee ID — one click copies the Employee ID to clipboard. Toast confirmation: "Employee ID copied." |
| **Password** | The password set during account creation — displayed in plaintext in this modal ONLY (this is the only time the plaintext password is shown). **Copy icon** (📋) next to the password — one click copies the password to clipboard. Toast confirmation: "Password copied." |
| **Assigned Reporting Manager(s)** | Names of the RM(s) assigned during creation (if any). |
| **Action buttons** | "Close" button to dismiss the modal. Optionally: "Download Credentials" button — downloads a text file or PDF with the Employee ID + password for Admin to provide to the employee securely. |

**Important:** This modal is the ONLY place where the plaintext password is visible. After the modal is dismissed, the password is stored only as a hash in the database and cannot be retrieved in plaintext — only reset by Admin.

#### 6.3.3 Employee ID & Password in Employee Detail/Edit Page

In the **employee detail/edit page** within the Employees Management section (Section 6.4), the Employee ID and password are displayed with special security controls:

**Employee ID display:**

| Aspect | Behavior |
|--------|----------|
| **Visibility** | Employee ID is always visible in the employee detail/edit page — displayed as a read-only field (e.g., `OMG-0042`). |
| **Copy icon** | A **copy icon** (📋) is displayed beside the Employee ID field. Clicking it copies the Employee ID to clipboard. Toast confirmation: "Employee ID copied." |
| **Not editable** | Employee ID is read-only — cannot be changed by Admin or anyone. |

**Password display:**

| Aspect | Behavior |
|--------|----------|
| **Default state** | Password is **hidden, hashed, encrypted, salted, and masked** in the employee detail/edit page. Displayed as `••••••••••••` or `********` — the actual password is NOT visible by default. |
| **View icon** | A **view/eye icon** (👁️) is displayed beside the masked password field. |
| **Click to view — Admin password verification required** | When Admin clicks the view icon to reveal the password, the system **requires Admin's own password verification** before showing the password. A verification dialog appears: "Enter your admin password to view this employee's password." Admin types their own password → verified against admin's stored hash → if correct, the employee's password is revealed in plaintext for viewing. If incorrect → "Invalid admin password" error. |
| **Copy icon** | A **copy icon** (📋) is displayed beside the password field. |
| **Click to copy — Admin password verification required** | When Admin clicks the copy icon, the same **Admin password verification** is required before the password is copied to clipboard. Same verification dialog and flow as the view action. |
| **5-minute verification cache** | Once Admin successfully verifies their password (for either view or copy), the verification is **cached for 5 minutes**. During this 5-minute window: clicking view icon → password shows immediately (no re-verification). Clicking copy icon → password copies immediately (no re-verification). After 5 minutes, the cache expires and the next view or copy action requires fresh Admin password verification. |
| **Verification cache logic** | If Admin first clicks the **copy icon** → password verification is required → after successful verification, the password is copied AND the 5-minute cache starts. Then within 5 minutes, clicking the **view icon** does NOT require verification again (cache is still active). The cache applies to BOTH view and copy — one verification unlocks both for 5 minutes. |
| **Auto-hide** | If the password is revealed (view icon clicked), it auto-hides after 30 seconds (reverts to masked state). Admin can click view again within the 5-minute cache window without re-verification. |
| **Security note** | The plaintext password is fetched from a secure backend endpoint that requires Admin auth + Admin password verification. The password is NEVER stored in plaintext on the client — it is fetched on-demand and cleared from client memory after auto-hide. |

**These copy icons and password view/verification behaviors apply to every employee's detail/edit page** in the employee management section — consistent across all recruiters and reporting managers.

### 6.4 Employees Page (Admin — Consolidated Employee View)

A dedicated **Employees** page in the Admin panel providing a unified view of all employees (recruiters and reporting managers) with their complete profile, performance, attendance, leave, and report-generation capabilities in one place.

**Employee list table:**

| Column | Content |
|--------|---------|
| Name | Employee name + profile photo thumbnail. |
| Employee ID | Auto-generated unique ID (e.g., `OMG-0042`). With copy icon (📋) for quick copying. See Section 6.3.1. |
| Role | Recruiter / Reporting Manager. |
| Status | Active / Suspended / Deactivated. |
| Assigned RM(s) | Reporting Manager(s) assigned (for recruiters). |
| Candidates Sourced (Period) | Count for the selected date range. |
| Completion Rate | % of records with Status = Complete. |
| Attendance Rate | % of working days present in the selected period. |
| Late Count | Number of late logins in the selected period. |
| Leave Balance | Summary of remaining leave days (total across types). |
| Target Achievement | % of target achieved in the selected period (if targets set). |
| Device Status | Bound / Unbound. |
| Live Status | **Online/Offline indicator dot** — green (online), yellow (idle), gray (offline). Real-time via Firebase Realtime Database (Section 23.15). |
| Last Active | Last seen / last login timestamp. "Last active X hours ago" or "Online now" — real-time (Section 23.15). |
| KYC Status | Document verification status: "Complete ✅" (all documents verified), "Incomplete (X/Y)" (X verified out of Y required), "Pending Review," "Not Started" (Section 29.8). |
| Actions | View Profile, Generate Report, Edit, Suspend, Reset Device. |

**Filtering:**
- Filter by: role (All / Recruiters / Reporting Managers), status (Active / Suspended / All), reporting manager, KYC status (Complete / Incomplete / Pending Review / Not Started), date range for metrics.
- Quick filters: "All Employees," "All Recruiters," "All Reporting Managers," "Active Only," "Suspended."
- Search by name, email, or Employee ID.
- Sortable by any column.

**Per-employee detail view (click into any employee):**
- **Profile tab:** Full account info, role, assigned RMs, device info, session info, account creation date.
- **Performance tab:** Candidates sourced over time (chart), completion rate trend, target progress, recruiter leaderboard rank.
- **Attendance tab:** Full attendance log (same as Admin attendance view but pre-filtered to this employee), monthly summary, calendar view.
- **Leave tab:** Leave balance, leave request history, leave calendar.
- **Documents tab:** All uploaded documents for this employee with verification status per document (Verified/Pending/Rejected). Admin can verify/reject documents directly from this tab. Offer letter generation and download. KYC completion status. Full document history. See Section 29.5.
- **Reports tab:** Generate and download employee-specific reports directly from this view — individual performance report, attendance report, leave report (see Section 20 report types 16–19).

**Generate reports from Employees page:**
- Admin can generate employee reports directly from this page without going to the Reports Management page (Section 20):
  - Select one or more employees (checkboxes) → "Generate Report" button → choose report type → download XLSX.
  - Or click "Generate Report" on an individual employee row → generates their individual performance report.
  - Reports generated here follow the same rules as Section 20 (saved to R2/Cloudinary, appear in report history).

**Schedule email reports for employees:**
- From the Employees page, Admin can also set up scheduled email reports for employee data — same scheduling system as Section 20.3 but pre-scoped to employee report types:
  - Schedule: All Employees performance report (daily/monthly/yearly).
  - Schedule: All Recruiters performance report.
  - Schedule: All Reporting Managers performance report.
  - Schedule: Individual employee performance report.
  - These scheduled reports appear in the Active Scheduled Reports Info section (Section 20.5) alongside all other scheduled reports.

---

## 7. REPORTING MANAGER MODULE

### Data Access

- View reports and data ONLY from Recruiters assigned to them by Admin.
- Read-only access on all recruiter-submitted data.
- Cannot edit any data.
- Cannot view data from Recruiters not assigned to them.

### Features

**Recruitment data access:**
- Dashboard view of assigned recruiters' data.
- Filters, search, sorting on viewable data.
- Pagination with all standard controls.

**Profile & personal management:**
- Profile photo upload for self with full image manipulation controls (crop, rotate, scale, reposition, fixed ratio — Section 30).
- "My Profile" page to update mobile number and address (Section 30.1).

**Team dashboard (Section 23.4.2):**
- Team performance dashboard: total candidates (team) today, active recruiters today, team completion rate, top performer.
- Per-recruiter bar chart, team daily trend line, individual recruiter trend overlays, team status breakdown.
- Own attendance & working hours: today's status, punch-in time, live working hours counter, late indicator, monthly attendance rate, attendance streak.
- Own leave overview: leave balance summary, upcoming approved leaves, pending leave requests.
- Team attendance snapshot: team present/absent/late/on leave today, team avg working hours, team login list with per-recruiter punch-in times.

**Own attendance self-view (Section 27.7):**
- "My Attendance" page with personal attendance log, monthly summary, color-coded calendar view. Read-only.

**Own leave application (Section 28.4):**
- "My Leaves" page to apply for leave (submit request with date range, type, reason, document). View own requests/statuses. Cancel pending requests. View own balance per type with progress bars. Personal leave calendar.

**Team attendance view (Section 27.8):**
- View attendance data for assigned recruiters (punch times, working hours, status). Read-only — cannot edit.
- Team attendance summary cards: present, absent, late count for the team today.

**Team leave view (Section 28.5):**
- View leave requests from assigned recruiters (Pending/Approved/Rejected). Read-only — **cannot approve or reject** (only Admin can).
- Team leave calendar showing which assigned recruiters are on leave on which dates.
- Receives notification when assigned recruiter's leave is approved or revoked by Admin.

**Own document upload (Section 29.2):**
- "My Documents" page to upload Aadhaar Card, PAN Card, Resume, Bank Details, Offer Letter/Agreement.
- View verified/pending/rejected status per document. Re-upload documents. KYC progress bar.

**Employee live status visibility (Section 23.15):**
- Own green dot in navigation header (own connection status).
- Online/offline dot + "last active X hours ago" for all assigned recruiters on My Recruiters page and Team Dashboard.
- Cannot see other reporting managers' or unassigned recruiters' status.

**Notification center (Section 11):**
- Receives notifications for: own leave/document/attendance events, assigned recruiters' leave approvals, assigned recruiters' late logins/absences/half-days/report submissions/target achievements, own account changes, system alerts.
- Full notification panel (dropdown/drawer + page) with unread badge, "Mark All as Read," "Clear All," unread highlight.

**Quick export (Section 23.14):**
- Export current data table view as XLSX/CSV directly from any data table showing assigned recruiters' data.

### My Recruiters Page (View-Only)

Reporting Managers have a dedicated **"My Recruiters"** page showing all the recruiters assigned under them by Admin. This is a **view-only** page — Reporting Managers have **no control** on adding or removing recruiter assignments. Only Admin can assign or remove recruiters from Reporting Managers (Section 6.3).

**Page content:**

| Column | Content |
|--------|---------|
| Profile Photo | Thumbnail of the recruiter's profile photo (or default avatar). |
| Name | Recruiter's full name. |
| Email | Recruiter's email address. |
| Status | Account status: Active / Suspended. |
| Live Status | **Online/Offline indicator dot** — green (online), yellow (idle), gray (offline). Real-time via Firebase. See Section 23.15. |
| Last Active | "Last active X hours ago" or "Online now" — real-time. See Section 23.15. |
| Candidates Today | Count of candidate reports submitted by this recruiter today. |
| Candidates This Month | Count for the current month. |
| Attendance Today | Punch-in time, or "Not In" / "On Leave." |
| Completion Rate | % of records with Status = Complete. |
| Target Progress | Target achievement % (if targets set — Section 23.9). |
| KYC Status | Complete / Incomplete. |

**Features:**
- Searchable by recruiter name or email.
- Sortable by any column.
- Paginated with standard controls.
- Click on any recruiter row → opens a read-only detail view showing the recruiter's performance summary, recent submissions, attendance overview, and leave status. No edit capabilities.
- **No "Add" or "Remove" buttons** — Reporting Managers cannot modify their recruiter assignments. The page only shows what Admin has assigned.
- **Live status indicators update in real-time** (via Firebase Realtime Database + Socket.io — see Section 23.15).

---

## 8. ZONE-BASED FORM LOGIC

### Zone Configuration

There are **5 zones** available for selection when submitting a report:

1. **North**
2. **South**
3. **East**
4. **West**
5. **Central**

### Zone-to-Form Mapping

These 5 zones are divided into **2 distinct form sets**:

- **Form Set A** (applies to **2 zones: West, Central**): These 2 zones show **all 33 fields** — including the 5 screening/assessment fields (fields 26–30). All fields are visible and fillable.
- **Form Set B** (applies to **3 zones: East, North, South**): These 3 zones show **28 fields** — the 5 screening/assessment fields listed below are **hidden and NOT shown** on the form. All other fields remain the same as Set A.

### Zone-Conditional Field Visibility

The following **5 fields are ONLY visible in Form Set A (West, Central zones)** and are **hidden/removed in Form Set B (East, North, South zones)**:

| Field # | Field Name | Set A (West, Central) | Set B (East, North, South) |
|---------|-----------|:---------------------:|:--------------------------:|
| 26 | Is CTC informed and okay? | ✅ Visible | ❌ Hidden |
| 27 | Is off-roll nature of job okay with candidate? | ✅ Visible | ❌ Hidden |
| 28 | Is the on-roll opportunity explained with 18 months clause? | ✅ Visible | ❌ Hidden |
| 29 | Do have two wheeler and two wheeler Licence? | ✅ Visible | ❌ Hidden |
| 30 | Communication skills rate (scale of 10) | ✅ Visible | ❌ Hidden |

**All other fields (1–25, 31–33) are visible in BOTH form sets.** The zone selection only affects the visibility of these 5 screening/assessment fields.

**Database handling for hidden fields:**
- When a report is submitted from an East, North, or South zone (Set B), the 5 hidden fields are stored as `null` in the database — they are not displayed, not required, and not submitted.
- When Admin views a Set B record, these 5 fields show as "N/A" or "—" (not applicable for this zone) rather than blank/empty.
- Reports and analytics that aggregate these 5 fields automatically exclude Set B zone records from calculations (since they have no values for these fields).

### Implementation Requirements

- Zone selection must happen BEFORE the form renders (as a first step / modal / zone selector screen).
- The form must conditionally render fields and populate dropdowns based on the selected zone's set (A or B).
- The zone-set mapping must be configurable (admin-manageable or easily adjustable in config) so zone-to-set assignments can change without code changes. **Zone-to-set mapping is managed from the Admin Settings / Configuration page (Section 23.12).**
- The selected zone must be stored with each report record in the database.
- **Dropdown options** (State, Location, Profile, and other dropdowns that vary by zone) are managed as **admin-configurable dropdown options** via the Dropdown Management / Master Data page (Section 23.19). Admin can add, edit, remove, and reorder dropdown values per zone set without code changes.
- **Zone data feeds into reporting and analytics:** The stored zone field is used for zone-wise report generation (Section 20.2, report type #11 — filterable by individual zone or zone batch Set A / Set B), zone distribution analytics (Section 21.4.4 — pie/donut chart showing candidate distribution across zones), and zone-based filtering across all data views.

---

## 9. COMPANY / SERVICE PROVIDER / HR — RELATIONAL DROPDOWNS

### Architecture

These three entities are **relationally linked** and must behave consistently across ALL forms and ALL roles wherever they appear:

```
Company (top-level)
├── Service Providers (belong to a Company)
└── HR Managers (belong to a Company)
```

### Dropdown Behavior (Applies to All Forms & All Roles)

**Company Field:**
- Dropdown listing all existing Companies (created previously).
- Searchable / filterable.
- "Create New" option available inline — creating a new Company here syncs it to the database immediately and makes it available in all Company dropdowns across all forms and roles instantly.

**Service Provider Field:**
- First, a Company must be selected (or displayed contextually).
- Dropdown shows all Service Providers that belong to the selected Company.
- Searchable / filterable.
- "Create New" option available inline — creates a new Service Provider under the currently selected Company, syncs to DB, available everywhere instantly.
- UI can show the Company association via submenu or nested table.

**HR Manager Field:**
- First, a Company must be selected (or displayed contextually).
- Dropdown shows all HR Managers that belong to the selected Company.
- Searchable / filterable.
- "Create New" option available inline — creates a new HR Manager under the currently selected Company, syncs to DB, available everywhere instantly.

### Sync Requirements

- Any creation (Company, Service Provider, HR Manager) from any form or any role must immediately persist to the database.
- All dropdown instances across the platform must reflect the latest data (real-time or near-real-time sync).
- Deletions/edits of these entities should be restricted to Admin and must cascade or warn appropriately.
- **Soft delete:** Companies, Service Providers, and HR Managers support soft delete with restore (Section 23.7). Soft-deleted entities are hidden from all dropdowns and default views. Admin can restore from Trash or permanently delete.
- **Audit trail:** All create, edit, and delete actions on Companies, Service Providers, and HR Managers are logged in the audit trail (Section 23.1) with old → new value tracking.
- **Report filtering:** Companies, Service Providers, and HR Managers are used as report filters — Admin can generate Company-specific reports (Section 20.2 type #8), Service Provider-specific reports (type #9), and HR Manager-specific reports (type #10). They also appear as filter dimensions in analytics charts (Section 21.4.5).

---

## 10. REPORT GENERATION & DISTRIBUTION SYSTEM

> **Note:** This section provides the foundational overview of the report generation and distribution system. The comprehensive, detailed specification — including all 20+ report types, full filtering/scoping options, scheduled email report management, report history with re-download, and the dedicated Admin Reports Management Page — is in **Section 20**.

### 10.1 Report Types

Multiple types of reports are generated. The system supports 20+ report types and must support adding new report types easily (config-driven or plugin-based registry):

1. **Daily Recruitment Report** (Batch — all recruiters combined / Individual — per recruiter)
2. **Work Profile Report**
3. **Candidate Report**
4. **Recruitment Report**
5. **Candidate MIS Report**
6. **HR Feedback Report**
7. **Company-Specific Report**
8. **Service Provider-Specific Report**
9. **HR Manager-Specific Report**
10. **Zone-Wise Report**
11. **Status-Based Report**
12. **Payment & Invoice Report**
13. **Attendance Report** (Section 27)
14. **Leave Report** (Section 28)
15. **Employee Performance Report** (All Employees / All Recruiters / All Reporting Managers / Individual)
16. *(Additional report types as needed — extensible)*

Full report type details, filtering, and scoping options: see Section 20.2.

### 10.2 Report Format

- All reports generated in **XLSX format** — both for admin panel download and email distribution.

### 10.3 Email Distribution (Automated)

**Sending mechanism:**
- SMTP with Nodemailer.

**Frequency:**
- **Daily:** All report types are sent daily to Admin's email.
  - The Daily Recruitment Report is a **batch report** combining all recruiters' daily recruitment data into one consolidated report.
- **Monthly:** On every month boundary, monthly consolidated versions of all report types are also sent (each report type sent as a separate email/attachment — individually).
- **Yearly:** Configurable yearly reports sent on a defined schedule (Section 20.3).

**Email content:**
- Email contains a download link.
- Clicking the link downloads the XLSX report file.

**Email is also used for (beyond reports):** Leave approval/rejection notifications, document verification alerts, KYC reminders, account creation/suspension/reactivation notifications, lockout alerts, password reset confirmations, scheduled report delivery confirmations (configurable per notification category — Section 11.5).

### 10.4 Cloud Storage for Email Reports

**Storage:** Cloudinary or Cloudflare R2 (choose one; R2 preferred for cost).

**Lifecycle:**
- Report files uploaded to cloud storage when generated — both for email distribution AND for on-page generated reports (for history and re-download from the Report History section — Section 20.4).
- **Auto-cleanup job:** Files are automatically deleted after a configurable retention period (default: 30 days).
- The cleanup job runs on a scheduled basis (BullMQ scheduled job).

### 10.5 Admin Panel Direct Downloads

- Reports downloaded from the Admin panel are generated on-the-fly at the moment of request.
- Reports are also **saved to R2/Cloudinary** so they appear in the Report History section (Section 20.4) and can be re-downloaded later.
- Download options:
  - **By time range:** daily, weekly, 15-day, monthly, 3-month, 6-month, yearly, custom range.
  - **By recruiter scope:** batch (all recruiters) or individual recruiter.
  - **By employee scope:** all employees, all recruiters, all reporting managers, or individual employee.
  - **By report type:** all types combined or each type separately.
- Full download and scheduling specification: see Section 20.

---

## 11. NOTIFICATION SYSTEM

> **A robust in-app notification panel (page and dropdown/drawer) for all roles** — Admin, Recruiters, and Reporting Managers. The system delivers real-time notifications via Socket.io (Section 24.10 / 23.15.5), stores all notifications persistently in the database, and provides a rich notification UI with unread badges, read/clear all controls, filtering, and role-specific notification channels.

### 11.1 Notification Delivery — Real-Time via Socket.io

- All notifications are pushed to connected clients in **real-time via Socket.io** (Section 23.15.5). No polling required.
- When a notification is created on the backend, it is: (1) saved to the database, (2) immediately pushed via Socket.io to the target user(s).
- If the target user is offline at the time of notification, they receive it when they next open the app (fetched from the database on page load).
- Notifications are persistent — stored in the database and never lost, regardless of connection state.

### 11.2 Notification UI — Two Access Points

Every user has **two ways** to access their notifications:

#### 11.2.1 Notification Dropdown / Drawer (Quick Access)

Accessible from the **bell icon** in the navigation header — present on every page for all roles.

| Element | Description |
|---------|-------------|
| **Bell icon** | Notification bell icon in the top navigation bar, always visible. |
| **Unread count badge** | A red/colored circular badge overlaid on the bell icon showing the count of unread notifications (e.g., "5"). Badge is hidden when unread count is 0. Badge updates in real-time as new notifications arrive or as notifications are read. Displayed on the dashboard and across all pages. |
| **Click to open** | Clicking the bell icon opens a **dropdown panel** (desktop) or **slide-in drawer** (mobile) showing the notification list. |
| **Notification list** | Scrollable list of recent notifications (most recent first). Shows the last 20–30 notifications. Each notification shows: icon (type-specific), title, message preview (truncated), relative timestamp ("5 min ago," "2 hours ago"), and read/unread state. |
| **Unread highlight** | Unread notifications are displayed with a **highlighted/changed background** (e.g., light blue or light yellow background) to visually distinguish them from read notifications. When a notification is read, the highlight is removed and the notification reverts to the **default background** (white or standard card background). |
| **Mark as read on click** | Clicking a notification marks it as read (highlight removed) and navigates to the relevant page/resource (e.g., clicking a leave request notification navigates to the leave management page). |
| **"Mark All as Read" button** | A **"Read All"** button at the top of the dropdown/drawer. One click marks ALL unread notifications as read. Unread count badge resets to 0. All highlights removed. |
| **"Clear All" button** | A **"Clear All"** button at the top of the dropdown/drawer. One click removes ALL notifications from the dropdown view (they remain in the database — archived/hidden, not deleted). Custom confirmation dialog before clearing: "Clear all notifications? They will be removed from your notification panel but remain in your notification history." |
| **"View All" link** | A link at the bottom of the dropdown: "View All Notifications" — navigates to the full Notification Page (Section 11.2.2). |
| **Empty state** | If no notifications: show "No notifications" with a subtle illustration. |
| **Real-time update** | When a new notification arrives (via Socket.io): the dropdown list updates instantly (new notification appears at the top with unread highlight), the badge count increments, and optionally a subtle toast/sound alert plays (configurable by user). |

#### 11.2.2 Notification Page (Full View)

A dedicated **"Notifications"** page accessible from the sidebar navigation and from the "View All" link in the dropdown.

| Element | Description |
|---------|-------------|
| **Full notification list** | Complete list of ALL notifications (not just recent 20–30). Paginated with all standard controls (Section 12). |
| **Unread highlight** | Same as dropdown — unread notifications have a highlighted/changed background. Read notifications have the default background. |
| **"Mark All as Read" button** | Prominent button at the top of the page. Marks ALL unread notifications as read across all pages. Badge resets to 0. |
| **"Clear All" button** | Prominent button at the top. Archives/hides all notifications from view. Custom confirmation dialog before clearing. Notifications remain in database for audit purposes. |
| **Mark individual as read** | Click a notification or click a "mark as read" icon/button per notification. |
| **Mark individual as unread** | Option to mark a previously read notification as unread again (to revisit later). |
| **Delete individual notification** | Trash icon per notification — removes it from view (soft delete). Custom confirmation dialog. |
| **Bulk actions** | Checkboxes per notification. Bulk "Mark as Read," "Mark as Unread," "Delete" for selected notifications. |
| **Filtering** | Filter by: read/unread status, notification type/category (see Section 11.3), date range. |
| **Searching** | Search notifications by title or message content. |
| **Sorting** | Sort by: newest first (default), oldest first. |
| **Notification detail** | Click a notification to expand inline or navigate to the related resource. Shows full message (not truncated), timestamp, and action link. |
| **Empty state** | "No notifications yet" with illustration. |

### 11.3 Notification Types & Categories

Notifications are categorized by type for filtering and visual distinction (each category has a unique icon and color):

| Category | Icon Color | Description |
|----------|-----------|-------------|
| **Document / KYC** | Blue | Document uploads, verification status changes, KYC completion. |
| **Leave** | Green | Leave requests submitted, approved, rejected, revoked, cancelled. |
| **Attendance** | Orange | Late logins, absences, incomplete punch-outs, half-day flags, excessive late alerts. |
| **Report** | Purple | Report submissions, report generation complete, scheduled report delivery. |
| **Account** | Gray | Account created, suspended, reactivated, password reset, device reset. |
| **System** | Red | Session revoked, maintenance mode, system alerts, security alerts. |
| **Target** | Teal | Target achievement, target missed, target updated. |
| **General** | Default | All other notifications. |

### 11.4 Comprehensive Notification Triggers — By Role

#### 11.4.1 Notifications to Admin

Admin receives notifications for ALL platform-level events:

**Document / KYC Notifications:**

| Trigger | Notification |
|---------|-------------|
| Employee uploads a new document | "[Employee Name] uploaded [Document Type]. Review and verify." |
| Employee re-uploads a rejected document | "[Employee Name] re-uploaded [Document Type] (previously rejected). Review required." |
| Employee re-uploads a verified document | "[Employee Name] re-uploaded [Document Type] (previously verified — status reset to Pending)." |
| Offer letter auto-verified | "[Employee Name]'s Offer Letter was auto-verified (platform match)." |
| Multiple pending documents | "You have [X] documents pending verification." (Daily summary.) |
| Employee KYC complete | "[Employee Name] has completed KYC — all documents verified." |

**Leave Notifications:**

| Trigger | Notification |
|---------|-------------|
| Employee submits leave request | "[Employee Name] submitted a [Leave Type] request for [dates] ([X] days). Reason: [preview]." With quick-action: Approve / Reject. |
| Employee cancels pending request | "[Employee Name] cancelled their [Leave Type] request for [dates]." |
| Leave balance exhausted | "[Employee Name]'s [Leave Type] balance is exhausted (0 days)." |
| Multiple pending leave requests | "You have [X] pending leave requests awaiting action." (Daily summary.) |

**Attendance Notifications:**

| Trigger | Notification |
|---------|-------------|
| Employee logs in late | "[Employee Name] logged in late at [time] (expected by [threshold])." |
| Employee absent (no login by threshold) | "[Employee Name] has not logged in today." |
| Incomplete punch-out | "[Employee Name]'s attendance for [date] is incomplete — no punch out." |
| Excessive late threshold exceeded | "[Employee Name] has been late [X] times this month — exceeds threshold." |
| Half-day detected | "[Employee Name] recorded a half day on [date] ([X] hours worked)." |
| Monthly attendance summary | "Monthly attendance summary for [Month] is ready." |

**Report Notifications:**

| Trigger | Notification |
|---------|-------------|
| Recruiter submits daily report | "[Recruiter Name] submitted [X] candidate reports today." |
| Report generation complete | "Your [Report Type] report is ready for download." |
| Scheduled report sent | "[Report Type] scheduled report sent to [X] recipients." |
| Scheduled report failed | "Scheduled report [Report Name] failed to generate. Check logs." |

**Account & Session Notifications:**

| Trigger | Notification |
|---------|-------------|
| Login blocked (device mismatch) | "Login attempt blocked for [Employee Name] — device mismatch. From device: [deviceInfo]." |
| Account lockout (failed attempts) | "[Employee Name]'s account locked after [X] failed login attempts." |
| Backup code used | "[Employee Name] used a backup code to login from a new device." |
| New user registered (by self or admin) | New account created: [Employee Name] ([Role])." |

**System Notifications:**

| Trigger | Notification |
|---------|-------------|
| BullMQ job failed | "Background job [Job Name] failed. Reason: [error]." |
| Cloud storage cleanup complete | "Auto-cleanup removed [X] expired report files." |
| Database backup complete | "Daily database backup completed successfully." |
| High error rate detected | "Server error rate elevated: [X]% in the last hour." |

#### 11.4.2 Notifications to Recruiters

Recruiters receive notifications relevant to their own activity only:

| Category | Trigger | Notification |
|----------|---------|-------------|
| **Leave** | Leave request approved | "Your [Leave Type] for [dates] has been **approved**. [X] days deducted. Remaining: [Y]." |
| **Leave** | Leave request rejected | "Your [Leave Type] for [dates] has been **rejected**. Reason: [reason]. Balance unchanged." |
| **Leave** | Approved leave revoked | "Your approved [Leave Type] for [dates] has been **revoked**. Reason: [reason]. [X] days restored." |
| **Leave** | Leave balance low | "Your [Leave Type] balance is low: only [X] days remaining." |
| **Document** | Document verified | "Your [Document Type] has been **verified ✅**." |
| **Document** | Document rejected | "Your [Document Type] has been **rejected ❌**. Reason: [reason]. Please re-upload." |
| **Document** | Document status changed | "Your [Document Type] status changed to [new status] by Admin." |
| **Document** | KYC reminder | "You have [X] documents not yet uploaded. Complete your KYC." |
| **Document** | KYC complete | "Your KYC is complete — all documents verified. ✅" |
| **Attendance** | Late login flagged | "You logged in late today at [time]. Expected by [threshold]." |
| **Attendance** | Half-day recorded | "Today recorded as half day ([X] hours worked)." |
| **Account** | Password reset | "Your password was reset by Admin." |
| **Account** | Device reset | "Your device binding was reset by Admin. Please login again." |
| **Account** | Session revoked | "Your session was revoked by Admin." |
| **Account** | Account suspended | "Your account has been suspended. Contact Admin." |
| **Account** | Account reactivated | "Your account has been reactivated." |
| **Target** | Daily target achieved | "You reached your daily target: [X] candidates sourced today! 🎯" |
| **Target** | Target updated by Admin | "Your [daily/weekly/monthly] target has been updated to [X] by Admin." |
| **System** | Maintenance mode | "Platform will be under maintenance from [time]. Save your work." |

#### 11.4.3 Notifications to Reporting Managers

Reporting Managers receive notifications about their own activity AND their assigned recruiters' activity:

| Category | Trigger | Notification |
|----------|---------|-------------|
| **Leave (own)** | Own leave approved/rejected/revoked | Same as recruiter notifications (Section 11.4.2 — leave section). |
| **Leave (team)** | Assigned recruiter's leave approved | "[Recruiter Name]'s [Leave Type] for [dates] has been approved. They will be on leave." |
| **Leave (team)** | Assigned recruiter's leave revoked | "[Recruiter Name]'s approved leave for [dates] has been revoked." |
| **Document (own)** | Own document verified/rejected/status changed | Same as recruiter notifications (Section 11.4.2 — document section). |
| **Document (own)** | KYC reminder / KYC complete | Same as recruiter notifications. |
| **Attendance (own)** | Own late login / half-day | Same as recruiter notifications. |
| **Attendance (team)** | Assigned recruiter logged in late | "[Recruiter Name] logged in late at [time]." |
| **Attendance (team)** | Assigned recruiter absent | "[Recruiter Name] has not logged in today." |
| **Attendance (team)** | Assigned recruiter half-day | "[Recruiter Name] recorded a half day today." |
| **Report (team)** | Assigned recruiter submitted report | "[Recruiter Name] submitted [X] candidate reports today." |
| **Account (own)** | Own password/device/session/account changes | Same as recruiter notifications. |
| **Target (team)** | Assigned recruiter achieved target | "[Recruiter Name] reached their daily target today! 🎯" |
| **System** | Maintenance mode | Same as recruiter notifications. |

### 11.5 Notification Preferences (Per-User)

Each user can configure their notification preferences from a "Notification Settings" page (accessible from profile menu or settings):

| Setting | Description |
|---------|-------------|
| **Enable/disable by category** | User can toggle notifications on/off per category (Document, Leave, Attendance, Report, Account, System, Target). Disabled categories are not shown in the panel — but still stored in the database for audit. |
| **Sound alert** | Toggle: play a subtle notification sound when a new notification arrives. Default: on. |
| **Desktop/browser notification** | Toggle: show browser push notifications (via Notification API) for critical notifications even when the OMG Teams tab is not in focus. Requires user permission. Default: off (user must opt-in). |
| **Email notification** | Toggle per category: also send an email copy for critical notification categories (e.g., leave approved/rejected, document rejected, account suspended). Default: off. |
| **Quiet hours** | Optionally set quiet hours (e.g., 10 PM – 7 AM) during which no sound or browser notifications are triggered (in-app notifications still received silently). |

**Admin override:** Admin can force-enable certain notification categories for all users (e.g., System and Account notifications cannot be disabled by users — they are always on).

### 11.6 Notification Persistence & Storage

| Aspect | Specification |
|--------|---------------|
| **Database storage** | All notifications stored in the `Notification` table (Section 11.8). Never lost, regardless of connection state. |
| **Retention** | Notifications retained for 90 days (configurable). Older notifications auto-archived (moved to archive table or soft-deleted). |
| **Read state** | Per-notification `isRead` boolean. Updated when user clicks or explicitly marks as read. |
| **Cleared state** | Per-notification `isCleared` boolean. Set when user clicks "Clear All" or deletes individual notifications. Cleared notifications are hidden from the UI but remain in the database. |
| **Batch read/clear** | "Mark All as Read" and "Clear All" operations update all notifications for the user in a single database transaction. |
| **Pagination** | Notification page uses server-side pagination (Section 12). Dropdown shows the most recent 20–30 (client-side, fetched on open). |
| **Real-time sync across tabs** | If user has multiple tabs open, reading a notification in one tab updates the badge count and read state in all other tabs (via Socket.io `notification:read` event — Section 23.15.5). |

### 11.7 Unread Badge Behavior

The unread notification count badge is a critical UI element visible at all times:

| Behavior | Description |
|----------|-------------|
| **Location** | On the bell icon in the navigation header — visible on every page, every role. Also displayed on the dashboard as part of a notification summary widget. |
| **Count display** | Shows the exact unread count (e.g., "3," "12"). If count exceeds 99: shows "99+." If count is 0: badge is hidden entirely (no "0" badge). |
| **Real-time increment** | When a new notification arrives via Socket.io → badge count increments instantly (no page refresh). |
| **Real-time decrement** | When user reads a notification (click or mark as read) → badge count decrements instantly. |
| **Reset on "Read All"** | When user clicks "Mark All as Read" → badge count resets to 0 → badge hides. |
| **Page load fetch** | On page load, fetch the current unread count from the backend API and display it. Socket.io then handles subsequent real-time updates. |
| **Cross-tab sync** | Badge count stays synchronized across all open tabs via Socket.io events. |

### 11.8 Database Entities for Notifications

**`Notification`:**
- id, userId (FK → User — the recipient), type (DOCUMENT | LEAVE | ATTENDANCE | REPORT | ACCOUNT | SYSTEM | TARGET | GENERAL), title (String), message (Text), actionUrl (String, nullable — URL to navigate to when clicked, e.g., "/admin/leave-requests/123"), metadata (JSONB, nullable — extra data like employeeId, documentId, leaveRequestId for context), isRead (Boolean, default false), isCleared (Boolean, default false), readAt (DateTime, nullable), clearedAt (DateTime, nullable), createdAt (DateTime), expiresAt (DateTime, nullable — for auto-archival).

**`NotificationPreference`:**
- id, userId (FK → User), category (DOCUMENT | LEAVE | ATTENDANCE | REPORT | ACCOUNT | SYSTEM | TARGET | GENERAL), isEnabled (Boolean, default true), emailEnabled (Boolean, default false), soundEnabled (Boolean, default true), browserPushEnabled (Boolean, default false), updatedAt.

**Indexes:**
- Composite index on `(userId, isRead, isCleared, createdAt)` for fast unread count queries and paginated listing.
- Index on `expiresAt` for auto-archival cleanup job.

---

## 12. DATA VIEWING, FILTERING, PAGINATION & VIRTUALIZATION

### 12.1 Pagination (All Roles, All Data Views)

**Implementation:** Server-side pagination (never load all data to the client).

**Required UI controls:**
- Page number tabs/buttons.
- First page and Last page buttons.
- Next page and Previous page buttons.
- Display: "Page X of Y" (current page number out of total pages).
- Total record count display.
- Rows per page selector (e.g., 10, 25, 50, 100 rows per page).

**Applies to:**
- Recruiter: own reports/candidate data, own attendance logs, own leave requests, own documents, notification history.
- Reporting Manager: assigned recruiters' reports/data, team attendance logs, team leave requests, own attendance/leave/documents, notification history, My Recruiters page.
- Admin: all reports, candidate data, joining data, user management, invoicing data, session management, attendance logs (all employees), leave requests (all employees), document verification queue, audit logs, notification history, report history, duplicate management, trash/recently deleted, holiday management, employees page, analytics data tables.

### 12.2 Virtualization

- When a single page displays **50 or more rows** (based on rows-per-page selection — e.g., 50, 100, or more), virtualization (windowed rendering) must be active.
- Use a virtualization library (e.g., `react-window`, `@tanstack/react-virtual`, or equivalent) to render only visible rows in the DOM.
- Virtualization works **alongside** server-side pagination — paginate on the server, virtualize the rendered page on the client.

### 12.3 Filtering, Sorting, Searching & View Controls

All the following features apply to **all roles** and **all pages where data is displayed**:

- **Filters:** Column-level filters (dropdowns, date ranges, text input filters per column).
- **Quick Filters:** Predefined one-click filter buttons for common queries (e.g., "Today's entries," "Pending status," "This week").
- **View By:** Group or segment data by specific dimensions (e.g., by recruiter, by company, by status, by date).
- **Ordering / Sorting:** Click column headers to sort ascending/descending. Multi-column sort support.
- **View Type:** Toggle between table view and other applicable views (e.g., card view, compact view) where appropriate.
- **Searching:** Global search bar and/or per-column search. Debounced, server-side search.
- **Quick Export:** Every data table across all roles has an "Export" button that downloads the current filtered/sorted view as XLSX or CSV without navigating to the Reports Management page. Full specification in Section 23.14.

---

## 13. PROFILE PHOTO SYSTEM

### Functionality

- **All roles** (Admin, Reporting Manager, Recruiter) can upload their own profile photo.
- **Admin** can additionally upload/change profile photos for any Recruiter or Reporting Manager.

### Implementation

- Supported formats: JPEG, PNG, WebP.
- Max file size: configurable (e.g., 5MB).
- Stored in cloud storage (same Cloudinary/R2 bucket or a dedicated one).
- Served via CDN for performance.
- Display in: navigation header/avatar, profile page, user management tables (Admin).

> **See Section 30 for the full detailed specification** of the User Profile Page and Profile Photo Management system — including drag-and-drop upload, image manipulation (rotate, scale, reposition, fixed ratio crop), Cloudinary cleanup on change/delete, URL replacement in database, custom confirmation dialogs, and all related features.

---

## 14. INVOICE NUMBER AUTO-GENERATION LOGIC

### Field: Invoice Number (Admin Form — Field #41)

This field has special auto-generation and sequencing logic:

**Format:**
- Prefix text + Date portion + Serial number.
- Example format: `HF-20260115-001` (prefix `HF-`, date `20260115`, serial `001`).

**Auto-set behavior:**
- The prefix text and date portion are auto-populated (editable / overridable by Admin).
- The serial number is auto-populated as the **next sequential number** after the last generated invoice number.

**Manual override behavior:**
- Admin can manually change any part of the invoice number (prefix, date, serial).
- If Admin manually sets a custom serial number (e.g., changes from `005` to `100`), then the NEXT candidate's invoice number will auto-populate as the next number from that custom one (`101`).
- This means the system always tracks the "last used invoice number" and increments from it, whether it was auto-generated or manually set.

**Concurrency note:**
- Invoice number generation must handle concurrent requests safely (use database sequences or atomic operations to prevent duplicates).

---

## 15. TECH STACK & INFRASTRUCTURE

### Frontend

| Technology | Purpose |
|-----------|---------|
| **Next.js** | React framework (SSR/SSG/ISR capable) |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Utility-first styling |

### Backend

| Technology | Purpose |
|-----------|---------|
| **Node.js** | Runtime |
| **Express.js** | HTTP framework |
| **TypeScript** | Type safety |

### Database

| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary relational database |
| **Prisma** | ORM / database toolkit / migrations |

### Caching, Sessions & Job Processing

| Technology | Purpose |
|-----------|---------|
| **Redis** | Caching, session storage, BullMQ backend |
| **BullMQ** | Job queues, workers, scheduled jobs (report generation, email sending, cloud cleanup) |

### Cloud Storage

| Technology | Purpose |
|-----------|---------|
| **Cloudinary or Cloudflare R2** | Report file storage (generated reports for history and email distribution — Section 20), profile photo storage (Section 30), employee document/KYC storage (Aadhaar, PAN, Resume, Bank Details — Section 29), offer letter PDF storage (Section 29.4), generated report history storage (Section 20.4). Auto-cleanup job for report files after configurable retention (default: 30 days). |

### Email

| Technology | Purpose |
|-----------|---------|
| **SMTP + Nodemailer** | Sending report emails (daily + monthly + yearly scheduled reports). Also used for: leave approval/rejection notifications, document verification alerts, KYC reminders, account creation/suspension notifications, lockout alerts, password reset confirmations, and other configurable email notifications (Section 11.5). |

### Web Server / Reverse Proxy

| Technology | Purpose |
|-----------|---------|
| **Nginx** | Reverse proxy, SSL termination, static file serving, rate limiting. |

### Real-Time Presence & Live Data

| Technology | Purpose |
|-----------|---------|
| **Firebase Realtime Database** | Live online/offline presence tracking for employees (recruiters and reporting managers). Stores real-time connection state and last active timestamps. Used for the live status indicator (online/offline dot) system. |
| **Firebase Firestore** | Persistent storage and querying of last active timestamps and presence history. Used for "last active X hours ago" status display and Admin/RM presence queries. Complements Realtime Database for structured queries. |
| **Socket.io** | Real-time bidirectional communication for live notifications, presence state broadcasts, analytics updates, and all push-based events. Used alongside Firebase for notification delivery and event broadcasting. See Section 24.10. |

### Error Tracking

| Technology | Purpose |
|-----------|---------|
| **Sentry** (or Bugsnag) | Client-side and server-side error tracking. Captures unhandled exceptions, stack traces, breadcrumbs, user context, and groups errors by frequency. Critical for production debugging. See Section 24.14. |

---

## 16. SECURITY LAYER

### Authentication & Authorization

- JWT-based auth (Employee ID + password for Recruiters/RMs, email + password for Admin).
- HTTPS-only cookies via BFF pattern (tokens never exposed to client JS).
- Passwords hashed and salted (bcrypt/argon2).
- **Password complexity requirements:** 8+ characters, uppercase + lowercase + digit + special character, common password blocklist, personal info rejection. Full specification in Section 25.2.
- Multiple sensitive data fields hashed and salted.
- Cloudflare Turnstile captcha on login page.
- Role-based access control (RBAC) enforced on both frontend routes and backend API endpoints.
- **Account lockout:** Account locked after 5 consecutive failed login attempts for 15-minute cooldown. Admin notified. Full specification in Section 25.1.
- **Single-device lock & persistent device binding:** Each recruiter/RM account is bound to the device of their first login. Login from a different device is blocked. Logout does NOT unlock the device. Admin can reset device binding. Full specification in Section 22.
- **Backup codes:** One-time emergency codes for device lock bypass when device is lost. Full specification in Section 23.16.
- **Login history:** Every login attempt (success/failure) logged with deviceId, IP, userAgent, failure reason. Full specification in Section 22.16.

### Session Security

- **Session idle timeout:** 30-minute inactivity timeout (configurable). Absolute session lifetime: until midnight (midnight session reset cron job destroys all employee sessions daily — Section 27.1.3). Full specification in Section 25.3.
- **Single active session enforcement:** Only one active session per user at a time. Enforced via Redis. Full specification in Section 22.7.
- **Device validation middleware:** Every authenticated API request validates `token.deviceId === user.deviceId`. Full specification in Section 22.8.
- **Admin session control:** View all sessions, geolocations, timestamps. Revoke individual or all sessions. Force-logout. Force device switch.

### Web Security

| Measure | Description |
|---------|------------|
| **CSP (Content Security Policy)** | Strict CSP headers to prevent XSS. |
| **WAF (Web Application Firewall)** | Application-level firewall rules (Cloudflare WAF or equivalent). |
| **CORS (Cross-Origin Resource Sharing)** | Strict CORS policy — only allow requests from the frontend domain (`teams.opportunitymakers.in`). |
| **HTTPS** | Enforced everywhere (Nginx SSL termination + HSTS headers). TLS 1.2+ minimum. Section 26.2. |
| **Rate Limiting (Nginx)** | Network-level rate limiting on all endpoints via Nginx. |
| **Rate Limiting (Application)** | Per-user/role/endpoint rate limiting via Redis. Recruiter: 100 reports/day, 200 req/min. Admin: 500 req/min. Login: 5 attempts/min/IP. Full specification in Section 24.9. |
| **Input Validation** | Server-side validation on all inputs (Zod). Client-side validation as supplement. |
| **SQL Injection Protection** | Prisma parameterized queries (inherent). |
| **CSRF Protection** | Via BFF pattern + SameSite cookie attributes. |

### Data Security

| Measure | Description |
|---------|------------|
| **Data encryption at rest** | PostgreSQL encrypted at rest (Neon/Supabase default AES-256). Redis encrypted at rest (Redis Cloud). Backups encrypted (GPG/SSE). Application-level AES-256-GCM for high-sensitivity PII fields. Full specification in Section 25.4. |
| **PII data handling** | Data masking for non-admin views (phone: `****-**-1234`, email: `jak***@gmail.com`). Data retention policy (3-year archive, 2-year audit, 90-day trash). GDPR/DPDP compliance. Full specification in Section 25.5. |
| **Signed URLs for documents** | All employee documents (KYC uploads) served via pre-signed URLs with expiry (15 minutes). HMAC-based key signing. Documents not publicly accessible. Full specification in Section 29.3. |
| **File upload security** | File type validated by magic bytes (not just extension). EXIF metadata stripped. Virus/malware scanning (ClamAV). UUID filenames. Separate CDN subdomain. Content-Disposition headers. Full specification in Section 24.11. |
| **Firebase security rules** | Server-side Firebase security rules enforce presence data access control: recruiters read own only, RMs read assigned only, Admin reads all. Full specification in Section 23.15.7. |

> **Full security hardening specification:** See Section 25 for detailed specifications of account lockout (25.1), password complexity (25.2), session idle timeout (25.3), data encryption at rest (25.4), and PII data handling policy (25.5).

---

## 17. DATABASE SCHEMA GUIDELINES

### Core Entities (Prisma Models)

These are the primary entities to model. Exact schema to be designed during implementation, but must cover all entities listed below. Detailed field definitions for entities added in later sections are specified in their respective sections — this is the consolidated master list.

**User & Auth:**
- `User` — id, employeeId (String, unique, nullable — auto-generated for Recruiters/RMs with "OMG-XXXX" format, null for Admin — Section 6.3.1), email, passwordHash, role (ADMIN / REPORTING_MANAGER / RECRUITER), firstName, lastName, profilePhotoUrl, profilePhotoStorageKey (Cloudinary publicId), mobileNumber, address, deviceId (locked device UUID — Section 22), deviceLockedAt, status (ACTIVE / SUSPENDED / DELETED), createdAt, updatedAt, deletedAt, deletedBy.
- `Session` — id, userId, token, deviceId, ipAddress, geoLocation, userAgent, createdAt, lastActiveAt, revokedAt.
- `RecruiterManagerAssignment` — recruiterId, managerId, assignedAt, removedAt (many-to-many with history).
- `UserDevice` — id, userId, deviceId, userAgent, platform, screenSize, lastSeen, isActive, createdAt. (Section 22.11)
- `LoginHistory` — id, userId, attemptedDeviceId, ip, userAgent, success, failureReason, loginMethod (PASSWORD / BACKUP_CODE), createdAt. (Section 22.16)
- `BackupCode` — id, userId, codeHash (bcrypt), isUsed, usedAt, createdAt. (Section 23.16)

**Business Entities:**
- `Company` — id, name, createdAt, updatedAt, deletedAt, deletedBy.
- `ServiceProvider` — id, name, companyId (FK → Company), createdAt, updatedAt, deletedAt, deletedBy.
- `HRManager` — id, name, companyId (FK → Company), email, phone, createdAt, updatedAt, deletedAt, deletedBy.

**Candidate / Report:**
- `CandidateReport` — id, globalSerialNumber (auto-increment, global across all recruiters), recruiterId (FK → User), zone, all 33 recruiter fields, plus 15 admin-only fields (nullable — filled by admin), candidateStage (Section 23.11), isDuplicate, duplicateGroupId, createdAt, updatedAt, deletedAt, deletedBy.
- `CandidateReportDraft` — id, recruiterId, zone, formData (JSONB), lastSavedAt, createdAt. (Section 23.8)
- `Invoice` — id, candidateReportId (FK), invoiceNumber, invoiceDate, invoiceAmountTotal, gstAmount, amountReceived, tdsAmount, paymentStatus, paymentDate.
- `DuplicateGroup` — id, detectedAt, status (PENDING / RESOLVED / DISMISSED), resolvedAt, resolvedByUserId. (Section 23.3)
- `DuplicateGroupMember` — id, duplicateGroupId (FK), candidateReportId (FK). (Section 23.3)

**Notifications:**
- `Notification` — id, userId, type (DOCUMENT / LEAVE / ATTENDANCE / REPORT / ACCOUNT / SYSTEM / TARGET / GENERAL), title, message, actionUrl, metadata (JSONB), isRead, isCleared, readAt, clearedAt, createdAt, expiresAt. (Section 11.8)
- `NotificationPreference` — id, userId, category, isEnabled, emailEnabled, soundEnabled, browserPushEnabled, updatedAt. (Section 11.8)

**Reports & Scheduling:**
- `GeneratedReport` — id, reportType, reportName, source (ON_PAGE / SCHEDULED), filters (JSONB), generatedAt, fileSize, cloudUrl, cloudStorageKey, expiresAt, isExpired, createdByUserId. (Section 20.6)
- `ScheduledReportConfig` — id, reportType, filters (JSONB), frequency (DAILY / MONTHLY / YEARLY), timing, isActive, createdAt, updatedAt. (Section 20.6)
- `ScheduledReportRecipient` — id, scheduledReportConfigId (FK), email, addedAt, removedAt. (Section 20.6)
- `ReportDeliveryLog` — id, generatedReportId (FK), scheduledReportConfigId (FK, nullable), recipientEmail, sentAt, deliveryStatus (SUCCESS / FAILED / PENDING), failureReason. (Section 20.6)

**Attendance:**
- `AttendanceRecord` — id, userId, date, punchInTime, punchOutTime, leaveLoginAt (nullable — audit login on approved leave days, working timer NOT started), grossWorkingMinutes (0 on approved leave days), netWorkingMinutes (0 on approved leave days), overtimeMinutes, status (PRESENT_FULL / PRESENT_HALF / LATE / ABSENT / INCOMPLETE / ON_LEAVE / HOLIDAY / WEEKEND), isLate, lateByMinutes, punchInEditedBy, punchOutEditedBy, midnightResetApplied (Boolean — true if Punch Out was set by midnight cron), remarks, createdAt, updatedAt. (Section 27.14)
- `Holiday` — id, date, name, type (NATIONAL / REGIONAL / CUSTOM), isRecurring, createdBy, createdAt. (Section 27.14)
- `AttendanceConfig` — key-value config table for all attendance settings. (Section 27.13)

**Leave Management:**
- `LeaveType` — id, name, code, description, isPaid, isActive, requiresDocument, requiresDocumentAfterDays, maxConsecutiveDays, advanceNoticeDays, createdAt, updatedAt. (Section 28.12)
- `LeaveRequest` — id, userId, leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod, numberOfDays, reason, supportingDocumentUrl, emergencyContact, status (PENDING / APPROVED / REJECTED / CANCELLED / REVOKED), rejectionReason, revocationReason, actionedBy, actionedAt, createdAt, updatedAt. (Section 28.12)
- `LeaveBalance` — id, userId, leaveTypeId, year, totalAllotted, carriedForward, manualAdjustment, used, remaining, updatedAt. (Section 28.12)
- `LeaveBalanceHistory` — id, leaveBalanceId, changeType, changeAmount, balanceBefore, balanceAfter, reason, changedBy, leaveRequestId, createdAt. (Section 28.12)
- `LeavePolicyConfig` — key-value config table for all leave policy settings. (Section 28.7)

**Documents & KYC:**
- `DocumentType` — id, name, code, acceptedFormats, isRequired, description, isActive, sortOrder, createdAt, updatedAt. (Section 29.10)
- `EmployeeDocument` — id, userId, documentTypeId, fileUrl, fileName, fileSize, mimeType, fileHash (SHA-256), storageKey, status (NOT_UPLOADED / PENDING / VERIFIED / REJECTED), verifiedBy, verifiedAt, rejectionReason, rejectedBy, rejectedAt, expiryDate, adminNotes, version, uploadedAt, createdAt, updatedAt. (Section 29.10)
- `EmployeeDocumentHistory` — id, employeeDocumentId, action, oldStatus, newStatus, reason, fileUrl, actionBy, createdAt. (Section 29.10)
- `OfferLetter` — id, userId, referenceNumber, variant (TEMPLATE | TIPTAP_EDITOR), templateVersion, dynamicFields (JSONB), editorContent (Text/HTML, nullable — Tiptap HTML content for TIPTAP_EDITOR variant), generatedFileUrl, generatedFileHash (SHA-256), generatedBy, generatedAt, isArchived, createdAt. (Section 29.10)

**Targets:**
- `RecruiterTarget` — id, recruiterId, targetType (DAILY / WEEKLY / MONTHLY), targetValue, effectiveFrom, effectiveTo, isActive, createdBy, createdAt, updatedAt. (Section 23.9)

**Audit:**
- `AuditLog` — id, userId, userRole, action (CREATE / UPDATE / DELETE / BULK_UPDATE / etc.), entityType, entityId, changes (JSONB), ipAddress, userAgent, timestamp. (Section 23.1)

**Analytics:**
- `AnalyticsSnapshot` — id, snapshotType, periodStart, periodEnd, data (JSONB), computedAt. (Section 21.9)
- `PlatformHealthLog` — id, metricName, metricValue (JSONB), recordedAt. (Section 21.9)

**Platform Configuration:**
- `AdminSettings` — key-value config table for platform-wide settings (zone mappings, dropdown options, thresholds, policies). (Section 23.12)
- `DropdownOption` — id, category (STATE / LOCATION / PROFILE / QUALIFICATION / NOTICE_PERIOD / etc.), value, label, zoneSet (SET_A / SET_B / ALL, nullable), sortOrder, isActive, createdAt, updatedAt. (Section 23.19)

### Key Schema Constraints

- `globalSerialNumber` on CandidateReport: auto-increment, unique, global across all recruiters. UI displays per-recruiter sequential numbering (computed at query time or via window function).
- All timestamps in UTC.
- **Soft-delete pattern** using `deletedAt` (DateTime, nullable) + `deletedBy` (FK → User, nullable) on: User, Company, ServiceProvider, HRManager, CandidateReport, and all other soft-deletable entities (Section 23.7). Default queries filter `WHERE deletedAt IS NULL` via Prisma middleware.
- Invoice number uniqueness constraint.
- **Comprehensive indexing strategy (Section 24.15):**
  - Single-column indexes: recruiterId, companyId, createdAt, zone, status, userId, email.
  - Composite indexes for common query patterns: `(recruiterId, createdAt)` for recruiter self-view, `(companyId, status)` for company-filtered views, `(userId, isRead, isCleared, createdAt)` for notification queries, `(userId, date)` for attendance records.
  - Partial indexes for soft-deleted records: `WHERE deletedAt IS NULL` on all soft-deletable tables.
  - GIN indexes for JSONB columns: `changes` on AuditLog, `formData` on CandidateReportDraft, `filters` on GeneratedReport/ScheduledReportConfig, `metadata` on Notification.
  - Full-text search indexes for global search (Section 23.10) on: candidate name, company name, email, phone.
  - Unique constraints: User.email, Invoice.invoiceNumber, OfferLetter.referenceNumber, DropdownOption.(category + value + zoneSet).

---

## 18. UI/UX REQUIREMENTS

### Quality Standard

- **Professional, top-notch, and modern UI/UX.** Not intermediate-level — this should look and feel like a polished SaaS product.
- Dashboard-style layout with sidebar navigation, breadcrumbs, and clean data-dense views.

### Design Principles

- **Responsive:** Works on desktop and tablet (primary: desktop).
- **Consistent:** Uniform spacing, typography, color palette, component styling.
- **Data-dense but readable:** Tables, cards, and dashboards should maximize information density without clutter.
- **Accessible:** WCAG 2.1 AA compliance (color contrast, keyboard navigation, screen reader support).
- **Performance:** Fast initial load, optimized re-renders, virtualized lists, lazy loading where appropriate.
- **Dark mode compatible:** All charts, cards, and components must render correctly in both light and dark themes (Section 21.1).
- **Print-optimized layouts:** Print-friendly CSS for candidate profiles, reports, and any printable page (Section 23.17).

### Color System & Palette

The platform uses a comprehensive design color system built from two brand colors. All UI components, charts, status indicators, and themes must use these defined tokens — no arbitrary/hardcoded hex values outside this palette.

**Brand Colors:**
- **Primary:** `#DAA025` (Amber Gold — Opportunity Makers Group brand color)
- **Secondary:** `#001845` (Deep Navy — authority, professionalism, contrast)

---

#### Primary Color Palette (Amber Gold)

Built from `#DAA025` — used for primary actions, CTAs, active states, highlights, and brand elements.

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#FDF8EB` | Lightest tint — subtle backgrounds, selected row highlight, hover states on light surfaces. |
| `primary-100` | `#F9ECCC` | Light tint — notification badges background, info banners, tag backgrounds. |
| `primary-200` | `#F3D999` | Soft tint — progress bar tracks, light borders, secondary button hover backgrounds. |
| `primary-300` | `#EDC566` | Mid-light — active tab underlines, link hover states, icon fills on light backgrounds. |
| `primary-400` | `#E2B33B` | Approaching primary — button hover states, focused input borders. |
| `primary-500` | `#DAA025` | **Base primary** — primary buttons, active navigation items, primary links, brand accents, CTA buttons, toggle active state, checkbox/radio active fill. |
| `primary-600` | `#C08E20` | Slightly darker — primary button hover, pressed state. |
| `primary-700` | `#9A711A` | Dark — primary button active/pressed, text on light primary backgrounds. |
| `primary-800` | `#745514` | Darker — small text on primary-50/100 backgrounds, dark mode primary accents. |
| `primary-900` | `#4E390D` | Darkest — high-contrast text on primary tints, dark mode primary text. |

---

#### Secondary Color Palette (Deep Navy)

Built from `#001845` — used for navigation, headers, text, data-dense elements, and authoritative UI sections.

| Token | Hex | Usage |
|-------|-----|-------|
| `secondary-50` | `#E6EAF0` | Lightest tint — page backgrounds in light mode, subtle section dividers, table row alternation. |
| `secondary-100` | `#CCD5E1` | Light tint — card borders, input field borders (default), sidebar hover background. |
| `secondary-200` | `#99ABC3` | Soft tint — placeholder text, disabled text, muted icons. |
| `secondary-300` | `#6681A5` | Mid-light — secondary text, column headers, breadcrumb text. |
| `secondary-400` | `#335787` | Approaching base — subheadings, icon default fill, chart gridlines. |
| `secondary-500` | `#0A2D5E` | Mid-tone — sidebar active item background, chart secondary color, badge backgrounds. |
| `secondary-600` | `#062247` | Slightly darker — sidebar background (light mode), header text. |
| `secondary-700` | `#001845` | **Base secondary** — primary navigation/sidebar background, page headers, top bar background, footer background. The main structural color of the platform UI. |
| `secondary-800` | `#001233` | Darker — dark mode card backgrounds, deep UI elements. |
| `secondary-900` | `#000C22` | Darkest — dark mode page background, high-contrast overlays, modal backdrop tint. |

---

#### Accent Color Palette

Derived from the interplay of primary and secondary — used sparingly for emphasis, differentiation, and visual interest where primary and secondary are insufficient.

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-blue` | `#1E6FD9` | Links (default), informational icons, "Learn more" buttons, progress indicators. |
| `accent-blue-light` | `#E8F1FC` | Link hover backgrounds, info alert backgrounds, selected filter chip backgrounds. |
| `accent-teal` | `#0D9488` | Secondary charts, alternative data series, comparison metrics, "new" badges. |
| `accent-teal-light` | `#E6F7F5` | Teal badge backgrounds, secondary success states. |
| `accent-amber-warm` | `#F59E0B` | Warm highlights, sparkline accents, notification dot (non-urgent), star ratings fill. |
| `accent-slate` | `#64748B` | Neutral accent — timestamps, metadata text, helper text, secondary icons. |

---

#### Semantic Color Palette

Fixed, role-specific colors for status indicators, alerts, and system feedback. These do NOT change between light/dark mode — only their background tints adjust.

| Token | Hex | Usage |
|-------|-----|-------|
| **Success** | | |
| `success-500` | `#16A34A` | Success toasts, "Verified ✅" badges, "Present" attendance status, "Approved" leave status, "Complete" report status, positive change indicators (↑), active/online status dot. |
| `success-100` | `#DCFCE7` | Success toast background, success alert background, verified document card tint. |
| `success-700` | `#15803D` | Success text on light backgrounds, success icon fills. |
| **Warning** | | |
| `warning-500` | `#EAB308` | Warning toasts, "Pending" badges, "Late" attendance status, "Half Day" status, idle status dot (yellow), caution alerts, approaching-limit counter. |
| `warning-100` | `#FEF9C3` | Warning toast background, warning alert background, pending document card tint. |
| `warning-700` | `#A16207` | Warning text on light backgrounds, warning icon fills. |
| **Error / Danger** | | |
| `error-500` | `#DC2626` | Error toasts, "Rejected ❌" badges, "Absent" attendance status, form validation errors, destructive button backgrounds, delete confirmation buttons, failed delivery status, offline status dot. |
| `error-100` | `#FEE2E2` | Error toast background, error alert background, rejected document card tint, destructive action hover tint. |
| `error-700` | `#B91C1C` | Error text on light backgrounds, destructive button hover, error icon fills. |
| **Info** | | |
| `info-500` | `#2563EB` | Info toasts, "On Leave" attendance status, informational badges, system notification icons, help tooltips. |
| `info-100` | `#DBEAFE` | Info toast background, info alert background, on-leave calendar day tint. |
| `info-700` | `#1D4ED8` | Info text on light backgrounds, info icon fills. |

---

#### Background Color Palette

Page, card, and component backgrounds for light mode and dark mode.

| Token | Hex (Light Mode) | Hex (Dark Mode) | Usage |
|-------|-----------------|-----------------|-------|
| `bg-page` | `#F8FAFC` | `#0A0F1A` | Main page background behind all content. |
| `bg-surface` | `#FFFFFF` | `#111827` | Cards, panels, modals, dropdowns, popovers — the primary content surface. |
| `bg-surface-raised` | `#FFFFFF` | `#1A2236` | Elevated surfaces — modals, dialogs, floating menus (subtle shadow differentiates from bg-surface). |
| `bg-sidebar` | `#001845` | `#000C22` | Sidebar/navigation background — uses secondary-700 (light) / secondary-900 (dark). |
| `bg-header` | `#001845` | `#000C22` | Top navigation bar background — matches sidebar for visual cohesion. |
| `bg-input` | `#FFFFFF` | `#1E293B` | Form input fields, textareas, select dropdowns background. |
| `bg-input-disabled` | `#F1F5F9` | `#1A2236` | Disabled input fields, read-only fields background. |
| `bg-hover` | `#F1F5F9` | `#1E293B` | Row hover in tables, menu item hover, list item hover. |
| `bg-selected` | `#FDF8EB` | `#2A2210` | Selected/active row in tables, selected card, active filter — uses primary-50 tint. |
| `bg-muted` | `#F1F5F9` | `#1E293B` | Muted sections, code blocks, secondary content areas. |
| `bg-overlay` | `rgba(0,24,69,0.5)` | `rgba(0,0,0,0.7)` | Modal/dialog backdrop overlay — semi-transparent secondary-700. |

---

#### Text Color Palette

| Token | Hex (Light Mode) | Hex (Dark Mode) | Usage |
|-------|-----------------|-----------------|-------|
| `text-primary` | `#0F172A` | `#F1F5F9` | Primary body text, headings, table cell content — highest contrast. |
| `text-secondary` | `#475569` | `#94A3B8` | Secondary text, descriptions, labels, helper text, timestamps. |
| `text-muted` | `#94A3B8` | `#64748B` | Placeholder text, disabled text, de-emphasized content. |
| `text-inverse` | `#FFFFFF` | `#0F172A` | Text on primary/secondary filled backgrounds (buttons, sidebar, header, badges). |
| `text-on-primary` | `#FFFFFF` | `#FFFFFF` | Text on primary-500 (`#DAA025`) background — white for contrast. |
| `text-on-secondary` | `#FFFFFF` | `#E2E8F0` | Text on secondary-700 (`#001845`) background — white/light for contrast. |
| `text-link` | `#1E6FD9` | `#60A5FA` | Hyperlinks, clickable text, "View all" links. |
| `text-link-hover` | `#1557B0` | `#93C5FD` | Link hover state — slightly darker (light) / lighter (dark). |
| `text-error` | `#DC2626` | `#FCA5A5` | Inline validation error messages, error state text. |
| `text-success` | `#16A34A` | `#86EFAC` | Success confirmation text, positive change indicators. |
| `text-sidebar` | `#CCD5E1` | `#94A3B8` | Sidebar menu item text (on dark sidebar background). |
| `text-sidebar-active` | `#FFFFFF` | `#FFFFFF` | Active sidebar menu item text. |

---

#### Border Color Palette

| Token | Hex (Light Mode) | Hex (Dark Mode) | Usage |
|-------|-----------------|-----------------|-------|
| `border-default` | `#E2E8F0` | `#2D3748` | Default borders — cards, panels, dividers, table cell borders, input field borders (unfocused). |
| `border-strong` | `#CBD5E1` | `#4A5568` | Stronger borders — section dividers, table header bottom border, emphasized card borders. |
| `border-muted` | `#F1F5F9` | `#1E293B` | Subtle borders — inner dividers, nested card borders, light separators. |
| `border-focus` | `#DAA025` | `#DAA025` | Focused input border ring — uses primary-500 for brand-consistent focus indicator. |
| `border-error` | `#DC2626` | `#FCA5A5` | Error state input borders, invalid field outline. |
| `border-success` | `#16A34A` | `#86EFAC` | Success state input borders (e.g., verified field). |
| `border-sidebar` | `#0A2D5E` | `#001233` | Sidebar internal dividers — slightly lighter than sidebar background. |

---

#### Live Status Indicator Colors

| Status | Dot Color | Usage |
|--------|-----------|-------|
| **Online** | `#16A34A` (`success-500`) | Employee is currently active on the platform (Firebase presence = online). |
| **Idle** | `#EAB308` (`warning-500`) | Employee logged in but inactive for 5+ minutes (no API requests). |
| **Offline** | `#94A3B8` (`text-muted` light) | Employee is not connected (logged out, session expired, or browser closed). |

---

#### Attendance Calendar Color Coding

| Status | Background Color | Text/Icon | Token |
|--------|-----------------|-----------|-------|
| Present (Full Day) | `#DCFCE7` | `#16A34A` | `success-100` / `success-500` |
| Present (Half Day) | `#FEF9C3` | `#EAB308` | `warning-100` / `warning-500` |
| Late | `#FFEDD5` | `#EA580C` | Custom orange tint / `#EA580C` |
| Absent | `#FEE2E2` | `#DC2626` | `error-100` / `error-500` |
| On Leave | `#DBEAFE` | `#2563EB` | `info-100` / `info-500` |
| Holiday | `#F3E8FF` | `#9333EA` | Custom purple tint / `#9333EA` |
| Weekend | `#F1F5F9` | `#94A3B8` | `bg-muted` / `text-muted` |
| Incomplete | `#FEF9C3` | `#A16207` | `warning-100` / `warning-700` |

---

#### Chart Color Palette

Sequential colors for data visualization — charts, graphs, funnels, treemaps. Designed to be distinguishable, accessible (colorblind-friendly), and consistent with the brand.

| Slot | Hex | Usage |
|------|-----|-------|
| Chart 1 (Primary) | `#DAA025` | First data series — primary brand color. |
| Chart 2 (Secondary) | `#001845` | Second data series — secondary brand color. |
| Chart 3 | `#1E6FD9` | Third data series — accent blue. |
| Chart 4 | `#0D9488` | Fourth data series — accent teal. |
| Chart 5 | `#9333EA` | Fifth data series — purple. |
| Chart 6 | `#EA580C` | Sixth data series — orange. |
| Chart 7 | `#DC2626` | Seventh data series — red. |
| Chart 8 | `#16A34A` | Eighth data series — green. |
| Chart 9 | `#6366F1` | Ninth data series — indigo. |
| Chart 10 | `#EC4899` | Tenth data series — pink. |

---

#### CSS Implementation

All colors should be defined as CSS custom properties (variables) on `:root` for light mode and within a `.dark` / `[data-theme="dark"]` selector for dark mode. Components reference tokens — never raw hex values:

```css
:root {
  --color-primary-500: #DAA025;
  --color-secondary-700: #001845;
  --color-bg-page: #F8FAFC;
  --color-text-primary: #0F172A;
  --color-border-default: #E2E8F0;
  /* ... all tokens ... */
}

[data-theme="dark"] {
  --color-bg-page: #0A0F1A;
  --color-text-primary: #F1F5F9;
  --color-border-default: #2D3748;
  /* ... dark mode overrides ... */
}
```

In Tailwind CSS, these map to the `tailwind.config.js` `theme.extend.colors` configuration so they are available as utility classes (e.g., `bg-primary-500`, `text-secondary-700`, `border-focus`).

### Typography

**Primary font family:** `"Plus Jakarta Sans"` — a clean, modern, geometric sans-serif typeface. Used for ALL text across the entire platform UI (headings, body text, labels, buttons, inputs, navigation, tables, cards, modals, toasts — everything).

**Font loading:**
- Loaded via Google Fonts (`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap`) or self-hosted from `/fonts/` for performance and privacy.
- `font-display: swap` to prevent invisible text during font load (FOIT).
- Preloaded in `<head>` for critical rendering path: `<link rel="preload" href="..." as="font" type="font/woff2" crossorigin>`.

**Font weight scale:**

| Weight | CSS Value | Token | Usage |
|--------|:---------:|-------|-------|
| Extra Light | `200` | `font-extralight` | Decorative large display text only (e.g., hero numbers on analytics page). |
| Light | `300` | `font-light` | Subtle helper text, placeholders, de-emphasized labels. |
| Regular | `400` | `font-normal` | Default body text, table cell content, form input values, descriptions, paragraphs. |
| Medium | `500` | `font-medium` | Labels, navigation menu items, column headers, card titles, button text, form field labels. |
| Semi-Bold | `600` | `font-semibold` | Subheadings, section titles, sidebar active item, badge text, emphasis within body text, KPI card values. |
| Bold | `700` | `font-bold` | Page headings (H1–H3), dashboard card numbers, modal titles, strong emphasis. |
| Extra Bold | `800` | `font-extrabold` | Hero metrics on dashboards (large KPI numbers), primary CTAs where extra emphasis is needed. |

**Font size scale:**

| Token | Size | Line Height | Usage |
|-------|------|:-----------:|-------|
| `text-xs` | 12px / 0.75rem | 16px | Timestamps, metadata, table footnotes, micro labels. |
| `text-sm` | 14px / 0.875rem | 20px | Secondary text, helper text, table cell content, sidebar menu items, form labels. |
| `text-base` | 16px / 1rem | 24px | **Default body text**, form input values, descriptions, paragraphs. |
| `text-lg` | 18px / 1.125rem | 28px | Card titles, subheadings within sections, modal body text. |
| `text-xl` | 20px / 1.25rem | 28px | Section headings, page subtitles. |
| `text-2xl` | 24px / 1.5rem | 32px | Page titles, modal titles. |
| `text-3xl` | 30px / 1.875rem | 36px | Dashboard KPI card values, major section headings. |
| `text-4xl` | 36px / 2.25rem | 40px | Hero metrics, analytics page headline numbers. |

**Fallback font stack:**
```css
font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Tailwind CSS configuration:**
```js
// tailwind.config.js
module.exports = {
  theme: {
    fontFamily: {
      sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
    },
  },
}
```

**Monospace font (code/technical):** For code blocks, JSON previews, Employee IDs, Invoice Numbers, and any technical/code content: `"JetBrains Mono", "Fira Code", "SF Mono", "Consolas", monospace`.

### UI Components Required

- **Sidebar navigation** with role-based menu items.
- **Data tables** with sorting, filtering, pagination, row selection, inline actions, quick export button (Section 23.14).
- **Forms** with validation feedback, conditional rendering (zone-based), relational dropdowns with search + create inline, auto-save/draft indicators (Section 23.8).
- **Dashboard widgets** — summary cards (total candidates today, pending reports, attendance status, pending leave requests, pending KYC verifications, etc.), charts/graphs for trends.
- **Date pickers** and **date range selectors** throughout.
- **Modal/dialog** for confirmations, inline create (new Company, Service Provider, HR).
- **Custom confirmation dialogs** — styled modal (not browser native) for all destructive actions: delete, remove, replace, revoke. Clear title + body + consequence text, Cancel + destructive button, no auto-dismiss, Escape = cancel, loading state on confirm (Section 30.4).
- **Toast/snackbar notifications** for actions (success, error, warning, info).
- **Notification panel** — bell icon with unread count badge + dropdown/drawer showing recent notifications with unread highlight (changed background), "Mark All as Read" button, "Clear All" button, "View All" link to full Notification Page (Section 11.2).
- **Profile avatar** in header with dropdown menu + live status dot (green/yellow/gray — Section 23.15).
- **Image cropper/editor modal** — for profile photo upload with crop (fixed 1:1 ratio), rotate, scale, reposition, flip, live preview, reset, cancel, confirm controls (Section 30.2.3).
- **Live status indicators** — green (online), yellow (idle), gray (offline) dots displayed next to employee names in tables, dashboards, and headers (Section 23.15).
- **Attendance calendar views** — monthly calendar with color-coded days (green/yellow/red/blue/gray/orange) for attendance and leave status (Sections 27.7, 28.4.4).
- **Leave calendar views** — personal leave calendar and team-wide leave calendar with conflict detection (Sections 28.4.4, 28.10).
- **Document upload cards** — per-document cards with upload button, preview thumbnail, status badges (Not Uploaded / Pending / Verified / Rejected), rejection reason display, re-upload button (Section 29.2).
- **KYC progress bar** — overall KYC completion indicator showing X of Y documents verified (Section 29.2.1).
- **Onboarding tour** — first-login guided walkthrough highlighting key features for new recruiters and reporting managers. Contextual tooltips on complex form fields (Section 23.18).
- **Global search bar** — platform-wide search in the navigation header, results grouped by entity type (Section 23.10).
- **Maintenance mode page** — "Platform is under maintenance" screen shown to all users except Admin during deployments (Section 24.18).
- **Loading states, empty states, error states** — all handled gracefully with appropriate illustrations and messaging.

---

## 19. IMPLEMENTATION ORDER & PHASING

> **Suggested phasing for AI agent or development team. All features are required — this is a sequencing guide.**

### Phase 1: Foundation

1. Project scaffolding (Next.js frontend + Express backend + Prisma + PostgreSQL + Redis).
2. Database schema design and initial migration.
3. Authentication system (JWT + BFF cookies + password hashing + Turnstile captcha).
4. Admin account seeding (single admin).
5. User management (Admin creates/deletes/suspends Recruiters and Reporting Managers).
6. Role-based routing and API authorization middleware.
7. Environment configuration (.env management, dev/staging/prod separation) — see Section 24.1.
8. Docker + Docker Compose setup for all services — see Section 24.6.
9. Global error handling (Express error handler, Next.js error boundaries, standardized API error format) — see Section 24.2.
10. Structured logging setup (Winston/Pino, JSON logs, log levels) — see Section 24.3.
11. Sentry error tracking integration (client + server) — see Section 24.14.
12. Color system & typography setup — CSS custom properties for all color tokens (Primary #DAA025, Secondary #001845, 9 palettes), Plus Jakarta Sans font loading, Tailwind config — see Section 18.
13. Next.js infrastructure files — not-found.tsx (custom 404), error.tsx (route error boundary), global-error.tsx (root error boundary), loading.tsx (route loading), robots.ts, sitemap.ts, manifest.ts (PWA manifest), middleware.ts (auth + role + maintenance check) — see Section 24.19.

### Phase 2: Core Data Entry

14. Company / Service Provider / HR Manager CRUD with relational dropdowns.
15. Company / SP / HR Management Page (Admin — dedicated CRUD view for editing, deleting, bulk operations on Companies, Service Providers, HR Managers) — see Section 9.
16. Zone-based report form (Recruiter module).
17. Admin form (superset of recruiter form with admin-only fields).
18. Serial number logic (global DB serial + per-recruiter UI serial).
19. Invoice number auto-generation logic.
20. Admin configurable dropdown options / master data management — see Section 23.19.
21. Admin Settings / Configuration page — see Section 23.12.
22. Form auto-save / draft system for recruiter report form — see Section 23.8.
23. Candidate duplicate detection (phone + email dedup) — see Section 23.3.
24. Candidate pipeline stages — see Section 23.11.
25. Soft delete with restore across all entities + Admin trash view — see Section 23.7.
26. Bulk operations (bulk edit, delete, status update, assign) — see Section 23.2.
27. Data import via bulk CSV/XLSX upload — see Section 23.6.
28. Document upload & KYC verification system — employee document uploads (Aadhaar, PAN, Resume, Bank Details, Offer Letter/Agreement), admin verification workflow, offer letter generation (two variants: static template + Tiptap rich text editor) — see Section 29.

### Phase 3: Data Viewing & Management

29. Data tables with server-side pagination + virtualization.
30. Filtering, sorting, searching, quick filters, view-by, view-type toggles.
31. Quick export from any data table (XLSX/CSV) — see Section 23.14.
32. Global search (platform-wide search across all entities + dedicated search results page) — see Section 23.10.
33. Admin date-wise tabs (Today, Yesterday, custom, all).
34. Recruiter self-view (own data only).
35. Reporting Manager view (assigned recruiters' data only).
36. Recruiter personal dashboard (own stats, trends, targets progress, attendance, leave overview) — see Section 23.4.
37. Reporting Manager team dashboard (team stats, per-recruiter breakdown, own attendance/leave, team attendance snapshot) — see Section 23.4.
38. Reporting Manager "My Recruiters" page (view-only) — see Section 7.
39. Recruiter targets / goals system (admin sets, dashboards track) — see Section 23.9.
40. Audit / activity log system (all CRUD actions logged) — see Section 23.1.
41. Attendance management system — punch in/out, working hours calculation, late login alerts, half-day flags, admin attendance dashboard — see Section 27.
42. Leave application & management system — employee leave requests, admin approve/reject, leave balances, notifications, leave policies, team calendar — see Section 28.
43. User Profile Page & Profile Photo Management — profile page for all roles with photo upload (drag-and-drop, crop, rotate, scale, reposition, fixed ratio), mobile/address update, Cloudinary storage with cleanup on change/delete, custom confirmation dialogs — see Section 30.
44. Help / FAQ page — see Section 23.18.

### Phase 4: Reports & Distribution

45. Report generation engine (XLSX format, 20+ report types).
46. Admin panel download (generated + saved to R2/Cloudinary for history).
47. Cloudinary/R2 integration for report storage.
48. Email distribution via SMTP + Nodemailer (daily + monthly + yearly schedules).
49. BullMQ scheduled jobs (report generation, email sending, cloud auto-cleanup, midnight session reset).
50. Daily batch report (all recruiters' daily recruitment data consolidated).
51. Admin Reports Management Page — dedicated page with generate/download section, schedule management section, report history section, and scheduled email info section — see Section 20.
52. Report cloud persistence — all generated reports (both on-page and scheduled) saved to R2/Cloudinary for re-download from history.
53. Email templates management (customizable email subjects, bodies, branding) — see Section 23.13.

### Phase 5: Security, Session Management & Device Binding

54. Session management (Admin views, geolocations, timestamps, revoke).
55. CSP, WAF, CORS, HTTPS enforcement.
56. Nginx configuration (reverse proxy, SSL, rate limiting).
57. Input validation hardening (Zod schemas on all endpoints).
58. Single-device lock & persistent device binding system — device fingerprint, database device lock, strict session enforcement, request validation middleware, admin device reset controls — see Section 22.
59. Backup codes for device lock emergency bypass — see Section 23.16.
60. Account lockout on failed login attempts + admin notification — see Section 25.1.
61. Password complexity requirements enforcement — see Section 25.2.
62. Session idle timeout (configurable inactivity expiry, absolute lifetime until midnight via cron) — see Section 25.3, Section 27.1.3.
63. Data encryption at rest (PostgreSQL + backups) — see Section 25.4.
64. PII data handling policy (retention, masking, DPDP compliance) — see Section 25.5.
65. Application-level API rate limiting per user/role/endpoint — see Section 24.9.
66. File upload infrastructure (validation, scanning, CDN) — see Section 24.11.

### Phase 6: Analytics, Notifications, Real-Time & Frontend Polish

67. Admin Analytics & Statistics Page — enterprise-grade dashboard with KPI cards, charts, funnels, real-time metrics, platform health monitoring, employee overview analytics — see Section 21.
68. Socket.io real-time communication layer for live notifications and presence broadcasts — see Section 24.10.
69. Firebase Realtime Database + Firestore for live employee presence tracking (online/offline dots, last active) — see Section 23.15.
70. In-app notification system (panel, dropdown/drawer, full page, unread badges, read/clear all, preferences) — see Section 11.
71. Toast notification system — robust, production-grade toast/snackbar (success/error/warning/info/loading/promise types, deduplication, action buttons, persistent toasts) — see Section 24.19.11.
72. Skeleton loading system — shimmer/pulse placeholder UI with page-specific skeletons (dashboard, data table, employee detail, form, card grid, calendar, sidebar) — see Section 24.19.8.
73. Spinner component — reusable loading spinner (3 sizes, brand colors, accessible) — see Section 24.19.7.
74. PWA setup — service worker (sw.js), web app manifest, offline fallback page, install prompt, update detection toast, app shell caching — see Section 24.19.1, 24.19.2, 24.19.12, 24.19.13.
75. Onboarding / in-app help system (first-login tour, contextual tooltips, help/FAQ) — see Section 23.18.
76. Print view (print-optimized CSS for candidate profiles, reports, attendance) — see Section 23.17.
77. Database indexing strategy (composite, partial, GIN, full-text indexes) — see Section 24.15.
78. Performance budgets / SLAs (API p95 < 500ms, FCP < 1.5s, TTI < 3s) — see Section 24.16.
79. Browser compatibility (Chrome 90+, Firefox 90+, Edge 90+, Safari 15+) — see Section 24.17.
80. Maintenance mode — see Section 24.18.
81. UI/UX polish — animations, transitions, loading/empty/error states, custom confirmation dialogs.
82. Performance optimization — query optimization, caching strategies, bundle optimization, database connection pooling (see Section 24.13).
83. Data archiving strategy for aged records — see Section 23.5.
84. Health check endpoints (/health, /ready) — see Section 24.12.
85. API documentation (Swagger/OpenAPI auto-generated) — see Section 24.7.

### Phase 7: Deployment, CI/CD & Monitoring

86. Hosting deployment — frontend on Vercel (teams.opportunitymakers.in), backend on Render (api.opportunitymakers.in), PostgreSQL on Neon/Supabase, Redis on Redis Cloud — see Section 26.1.
87. Domain & SSL certificate management — see Section 26.2.
88. CI/CD pipeline (GitHub Actions — lint, test, build, deploy) — see Section 24.5.
89. Testing suite (unit + integration + E2E) — see Section 24.4.
90. Database backup & disaster recovery (automated pg_dump, Redis persistence) — see Section 24.8.
91. External monitoring & alerting (UptimeRobot, Grafana, PagerDuty-style notifications) — see Section 26.3.

---

## 20. ADMIN REPORTS MANAGEMENT PAGE

> **This is a dedicated, standalone page in the Admin panel** that centralizes all report generation, downloading, email scheduling, and report history into one unified interface. This page is the single source of truth for all report operations.

### 20.1 Page Layout — Four Sections

The Admin Reports Management Page is divided into **four distinct sections/tabs/panels**:

1. **Generate & Download Reports** — on-demand report generation and immediate download.
2. **Schedule Email Reports** — configure recurring automated email report delivery.
3. **Report History** — log of all generated and scheduled-sent reports with re-download capability.
4. **Active Scheduled Reports Info** — overview of all currently active scheduled email report configurations.

---

### 20.2 Section 1: Generate & Download Reports

Admin can generate and download reports on-demand with the following options. All generated reports are saved to R2/Cloudinary (for re-download from the History section) in addition to being downloaded immediately.

**Report Types Available for Generation:**

| # | Report Type | Description |
|---|------------|-------------|
| 1 | Daily Recruitment Report (Batch) | Consolidated report of all recruiters' daily recruitment data combined into one report. |
| 2 | Daily Recruitment Report (Individual) | Per-recruiter daily recruitment report — select specific recruiter(s). |
| 3 | Work Profile Report | Report organized by work profiles / job roles. |
| 4 | Candidate Report | Full candidate-level data report. |
| 5 | Recruitment Report | Recruitment activity and pipeline report. |
| 6 | Candidate MIS Report | Management Information System report for candidate data analytics. |
| 7 | HR Feedback Report | Report on HR feedback received (Rejected / Hold / Profile Closed) across candidates. |
| 8 | Company-Specific Report | Report filtered by a specific Company — select from Company dropdown. |
| 9 | Service Provider-Specific Report | Report filtered by a specific Service Provider — select from Service Provider dropdown (with Company context). |
| 10 | HR Manager-Specific Report | Report filtered by a specific HR Manager — select from HR dropdown (with Company context). |
| 11 | Zone-Wise Report | Report filtered by zone. Since there are 2 batches/sets of zones, zone-wise reports can be generated per individual zone (North, South, East, West, Central) or per zone batch (Set A / Set B). |
| 12 | Status-Based Report | Report filtered by candidate/record status (Complete / Pending). |
| 13 | Payment & Invoice Report | Report on payment statuses, invoice details, amounts received, TDS, GST — filterable by payment status (paid, pending, partial, etc.). |
| 14 | Attendance Report | Daily/weekly/monthly attendance data — punch in/out times, working hours, late logins, half-days, absences — per recruiter or batch. See Section 27. |
| 15 | Leave Report | Leave requests, balances, usage, and trends — per employee or batch. See Section 28. |
| 16 | Employee Performance Report (All Employees) | Consolidated report covering all employees (recruiters + reporting managers combined) — candidates sourced, completion rate, attendance, late count, leave usage, target achievement, working hours, activity volume. |
| 17 | Employee Performance Report (All Recruiters) | Same as above but scoped to all recruiters only. |
| 18 | Employee Performance Report (All Reporting Managers) | Same as above but scoped to all reporting managers only — includes team-level metrics (team size, team output, team attendance). |
| 19 | Employee Performance Report (Individual) | Detailed individual employee report — select specific recruiter or reporting manager. Includes: personal recruitment stats, attendance history, leave history, target progress, working hours trend, late/absent frequency, device info, account status. |
| 20 | *(Additional report types)* | The system must be extensible — adding new report types should require minimal changes (config-driven or plugin-based report type registry). |

**Filtering & Scoping Options (Apply to All Report Types):**

| Filter | Options |
|--------|---------|
| **Time Range** | Daily, Weekly, 15-day, Monthly, 3-month, 6-month, Yearly, Custom date range picker. |
| **Recruiter Scope** | Batch (all recruiters combined) or Individual (select specific recruiter from dropdown). |
| **Employee Scope** | All Employees (recruiters + reporting managers combined), All Recruiters only, All Reporting Managers only, or Individual employee (select specific employee from dropdown). Applies to Employee Performance Reports, Attendance Reports, and Leave Reports. |
| **Company** | Filter by specific Company (dropdown with search). |
| **Service Provider** | Filter by specific Service Provider (dropdown filtered by Company). |
| **HR Manager** | Filter by specific HR Manager (dropdown filtered by Company). |
| **Zone** | Filter by individual zone (North/South/East/West/Central) or by zone batch (Set A / Set B). |
| **Status** | Filter by record status (Complete / Pending). |
| **Payment Status** | Filter by payment status. |

**Generation & Download Behavior:**

- Admin selects report type + filters → clicks "Generate & Download."
- Report is generated in **XLSX format**.
- Report is immediately downloaded to admin's browser.
- Report is **also saved to R2/Cloudinary** so it appears in the Report History section and can be re-downloaded later.
- Auto-cleanup job applies to these saved reports as well (configurable retention, default 30 days).

---

### 20.3 Section 2: Schedule Email Reports

Admin can configure **recurring automated email report delivery**. Scheduled reports are generated automatically by BullMQ workers and sent to specified email addresses via SMTP + Nodemailer.

**Schedule Configuration Options:**

| Setting | Description |
|---------|------------|
| **Report Type** | Select from the same full list of report types available in Generate & Download (Section 20.2) — Daily Recruitment Report (batch/individual), Work Profile Report, Candidate Report, Recruitment Report, Candidate MIS Report, HR Feedback Report, Company-specific, Service Provider-specific, HR Manager-specific, Zone-wise, Status-based, Payment & Invoice Report, Attendance Report, Leave Report, Employee Performance Report (All Employees / All Recruiters / All Reporting Managers / Individual), and all others. |
| **All Filtering/Scoping Options** | Same filters as Generate & Download — time range, recruiter scope, employee scope (all employees / all recruiters / all reporting managers / individual), company, service provider, HR, zone, status, payment status. These filters define what data goes into the scheduled report. |
| **Frequency** | Daily, Monthly, Yearly. Admin can set which reports are scheduled for daily delivery, which for monthly, and which for yearly. Multiple schedules can coexist (e.g., Daily Recruitment Report sent daily + Candidate MIS Report sent monthly + Payment & Invoice Report sent yearly). |
| **Timing** | Configurable time of day for delivery (e.g., send daily reports at 8:00 AM IST). |
| **Recipient Emails** | Admin can add **multiple email addresses** to each scheduled report configuration. Admin can add and remove emails at any time. |

**Schedule Management Actions:**

- **Create** new scheduled report configurations.
- **Edit** existing schedules (change report type, filters, frequency, timing, recipients).
- **Delete / Deactivate** scheduled reports.
- **Add / Remove** individual email addresses from any schedule.
- Multiple schedules can exist simultaneously — e.g., 5 different daily reports going to different email lists, 3 monthly reports, 1 yearly report.

**Scheduled Report Execution Behavior:**

- BullMQ worker generates the report at the configured time.
- Report is saved to R2/Cloudinary.
- Email is sent to all configured recipients with a download link to the cloud-stored file.
- The sent report and delivery metadata appear in the Report History section.
- Auto-cleanup job applies (configurable retention, default 30 days).

---

### 20.4 Section 3: Report History

A comprehensive log of **all reports ever generated** — both from on-page generation (Section 20.2) and from scheduled email delivery (Section 20.3).

**History Entry Fields:**

| Field | Description |
|-------|------------|
| **Report Name / Type** | Which report type was generated. |
| **Source** | How it was generated: "On-Page Download" or "Scheduled Email." |
| **Generated At** | Timestamp of when the report was generated. |
| **File Size** | Size of the generated XLSX file. |
| **Time Range / Filters** | The filters/scope that were applied when generating the report. |
| **Recipient Emails** | *(For scheduled reports only)* Which email addresses the report was sent to. |
| **Sent At** | *(For scheduled reports only)* Timestamp of when the email was sent. |
| **Delivery Status** | *(For scheduled reports only)* Whether the email was sent successfully or failed. |
| **Download Button** | A download button on every history entry — admin can re-download any past report (whether it was generated on-page or sent via scheduled email). Downloads from R2/Cloudinary. |

**History Features:**

- **Pagination** with all standard controls (page numbers, first/last/next/prev, rows per page, "Page X of Y").
- **Filtering:** Filter by report type, source (on-page vs scheduled), date range, recipient email.
- **Sorting:** Sort by date, report type, file size.
- **Searching:** Search by report name, email address, etc.
- **Expiration indicator:** Show if a report file has been auto-cleaned from cloud storage (expired) — in which case the download button is disabled/grayed out with a tooltip explaining the file has been removed after the retention period.

**Cloud Storage Implication (Updated Requirement):**

- All generated reports — whether from on-page download (Section 20.2) or scheduled email (Section 20.3) — are **saved to R2/Cloudinary**.
- This extends the original specification where on-page downloads were "generated → streamed → discarded." Now they are "generated → downloaded to browser → also saved to cloud for history re-download."
- Auto-cleanup job applies uniformly: all cloud-stored report files are deleted after the configurable retention period (default 30 days).
- Once a report file is cleaned up, the history entry remains in the database (for audit trail) but the download button becomes unavailable.

---

### 20.5 Section 4: Active Scheduled Reports Info

A dashboard-style overview panel showing **all currently active scheduled email report configurations** at a glance.

**Info Displayed Per Active Schedule:**

| Field | Description |
|-------|------------|
| **Schedule Name / ID** | Identifier for the schedule configuration. |
| **Report Type** | Which report type is being generated. |
| **Filters / Scope** | What data filters are applied (recruiter scope, company, zone, etc.). |
| **Frequency** | Daily, Monthly, or Yearly. |
| **Timing** | Time of day the report is generated and sent. |
| **Recipient Emails** | List of all email addresses configured for this schedule. |
| **Last Sent** | Timestamp of the most recent successful delivery. |
| **Next Scheduled** | Timestamp of the next upcoming delivery. |
| **Status** | Active or Paused/Deactivated. |

**Quick Actions from This Section:**

- **Edit** a schedule (opens edit form).
- **Pause / Resume** a schedule.
- **Delete** a schedule (with confirmation).
- **Add / Remove emails** inline.
- **View delivery history** for a specific schedule (links to filtered Report History).

---

### 20.6 Database Entities for Reports Management

These entities supplement the schema in Section 17:

**`GeneratedReport` (extended):**
- id, reportType, reportName, source (ON_PAGE | SCHEDULED), filters (JSON — stores all applied filter/scope options), generatedAt, fileSize, cloudUrl, cloudStorageKey, expiresAt, isExpired (computed/flag), createdByUserId (FK → User).

**`ScheduledReportConfig`:**
- id, reportType, filters (JSON), frequency (DAILY | MONTHLY | YEARLY), timing (time of day, timezone), isActive, createdAt, updatedAt.

**`ScheduledReportRecipient`:**
- id, scheduledReportConfigId (FK → ScheduledReportConfig), email, addedAt, removedAt (nullable — soft delete).

**`ReportDeliveryLog`:**
- id, generatedReportId (FK → GeneratedReport), scheduledReportConfigId (FK → ScheduledReportConfig, nullable), recipientEmail, sentAt, deliveryStatus (SUCCESS | FAILED | PENDING), failureReason (nullable).

---

## 21. ADMIN ANALYTICS & STATISTICS PAGE

> **This is a dedicated, enterprise-grade analytics and statistics page in the Admin panel.** It provides a comprehensive, real-time operational intelligence dashboard covering recruitment performance, financial health, team productivity, pipeline funnels, and platform health — all in one view. This page is designed to support executive-level decision-making and day-to-day operational monitoring.

### 21.1 Page Layout & Design Philosophy

- **Enterprise-grade quality** — this is not a basic stats summary. It should match the visual and functional quality of analytics dashboards in products like Salesforce, HubSpot, Metabase, or Amplitude.
- **Dense but scannable** — maximize information density with clear visual hierarchy, whitespace, and consistent card/chart sizing.
- **Responsive grid layout** — cards and charts arranged in a responsive grid (e.g., 12-column grid) that adapts from desktop to tablet.
- **Dark mode compatible** — all charts and cards must render correctly in both light and dark themes (if the platform supports theming).
- **Real-time where applicable** — key metrics update in real-time or near-real-time (via WebSocket, polling, or server-sent events) without requiring page refresh.
- **Date range context** — a global date range selector at the top of the page (Today, Yesterday, This Week, This Month, This Quarter, This Year, All Time, Custom Range) that filters ALL cards and charts on the page simultaneously. Individual cards/charts may additionally have their own date override if needed.

---

### 21.2 KPI Summary Cards (Top Row)

A row of high-visibility KPI cards at the top of the page showing the most critical numbers at a glance. Each card displays the metric value, a comparison indicator (vs. previous period — e.g., ↑12% vs last week), and a sparkline or mini trend graph.

| # | KPI Card | Metric | Comparison |
|---|----------|--------|------------|
| 1 | **Total Candidates Sourced** | Count of all candidate reports submitted (within selected date range). | vs. previous equivalent period (e.g., today vs. yesterday, this week vs. last week). |
| 2 | **Candidates Sourced Today** | Count of candidate reports submitted today. Real-time — updates live as recruiters submit. | vs. yesterday, vs. same day last week. |
| 3 | **Active Recruiters** | Number of recruiters with status ACTIVE who have submitted at least one report in the selected period. | vs. previous period. |
| 4 | **Total Revenue (Invoice Amount)** | Sum of all Invoice Amount Total within date range. | vs. previous period, percentage change. |
| 5 | **Amount Received** | Sum of all Amount Received within date range. | vs. previous period. |
| 6 | **Outstanding Amount** | Total Invoice Amount − Total Amount Received (pending collections). | Trend direction. |
| 7 | **Pending Reports** | Count of candidate reports with Status = "Pending." | vs. previous period. |
| 8 | **Conversion Rate** | Percentage of candidates who reached Date of Joining out of total sourced. | vs. previous period. |
| 9 | **Average Time to Join** | Average number of days from Date Sourced to Date of Joining. | vs. previous period. |
| 10 | **HR Feedback Rate** | Percentage of candidates that have received HR feedback (Rejected / Hold / Profile Closed) out of total submitted. | vs. previous period. |

---

### 21.3 Recruitment Pipeline Funnel

A visual **funnel chart** showing the candidate journey through stages:

```
Candidates Sourced (total)
    ↓
CV Shared (CV Shared On Date is set)
    ↓
HR Feedback Received (Feedback from HR is set)
    ↓
Hold / Shortlisted (Feedback = Hold or not Rejected)
    ↓
Joined (Date of Joining is set)
```

**Funnel features:**
- Visual funnel (tapering bar chart or classic funnel shape).
- Each stage shows: absolute count, percentage of previous stage (stage-to-stage conversion), percentage of top (overall conversion from sourced to that stage).
- Clickable stages — clicking a funnel stage filters a data table below (or navigates to filtered candidate view) showing candidates at that stage.
- Filterable by date range (inherits global date range selector), by recruiter, by company, by zone, by profile.

---

### 21.4 Charts & Visualizations

All charts must be interactive (hover tooltips, click-to-drill-down where applicable), responsive, and consistent in color palette. Use a professional charting library (Recharts, Chart.js, Nivo, or ApexCharts).

#### 21.4.1 Recruitment Trend Line Chart

- **X-axis:** Time (daily / weekly / monthly — togglable).
- **Y-axis:** Number of candidates sourced.
- **Lines:** Total sourced, CV shared, Joined (overlaid for comparison).
- **Filterable by:** recruiter, company, zone, profile.

#### 21.4.2 Recruiter Performance Bar Chart

- **X-axis:** Recruiter names.
- **Y-axis:** Number of candidates sourced (within date range).
- **Color coding:** stacked or grouped bars showing status breakdown (Complete vs. Pending).
- **Sortable:** by total count, by completion rate, alphabetical.

#### 21.4.3 Recruiter Leaderboard

- Ranked list/table of recruiters by candidates sourced in the selected period.
- Columns: Rank, Recruiter Name, Candidates Sourced, Completion Rate (%), Conversion Rate (sourced → joined), Avg Communication Score.
- Highlights: top 3 with badges/medals, bottom 3 flagged.
- Sortable by any column.

#### 21.4.4 Zone-Wise Distribution (Pie / Donut Chart)

- Pie or donut chart showing candidate distribution across the 5 zones (North, South, East, West, Central).
- Also groupable by zone batch (Set A vs. Set B).
- Clickable slices — filter other charts/data by that zone.

#### 21.4.5 Company-Wise Recruitment Volume (Horizontal Bar Chart)

- Horizontal bar chart showing number of candidates sourced per Company.
- Sortable by volume (descending by default).
- Drill-down: click a company bar → shows service providers within that company and their volumes.

#### 21.4.6 Profile-Wise Distribution (Treemap or Grouped Bar)

- Distribution of candidates by Profile (job role).
- Treemap or grouped bar chart — each profile sized/colored by volume.
- Filterable by zone, company, recruiter.

#### 21.4.7 HR Feedback Breakdown (Stacked Bar / Donut)

- Distribution of HR feedback: Rejected vs. Hold vs. Profile Closed vs. No Feedback Yet.
- Stacked bar (per company or per recruiter) or donut (overall).
- Shows feedback response rate and outcome ratios.

#### 21.4.8 Revenue & Financial Analytics

**Revenue Over Time (Area Chart):**
- X-axis: Time (monthly default).
- Y-axis: Amount (₹).
- Stacked areas: Invoice Amount Total, Amount Received, Outstanding.
- Togglable layers.

**Payment Status Distribution (Donut / Pie):**
- Breakdown of payment statuses across all invoices.
- Shows: Paid, Pending, Partial, Overdue (if applicable).

**GST & TDS Summary Cards:**
- Total GST Amount collected/payable in period.
- Total TDS Amount deducted in period.
- Net receivable (Invoice Total − TDS − GST adjustments).

**Company-Wise Revenue Table:**
- Table showing per-company: Total Invoiced, Amount Received, Outstanding, TDS, GST.
- Sortable, searchable, exportable.

#### 21.4.9 Notice Period Distribution (Histogram / Grouped Bar)

- Distribution of candidates by notice period buckets (Immediate, 15 days, 30 days, 60 days, 90 days, 90+ days).
- Useful for pipeline planning.

#### 21.4.10 Age & Experience Distribution

**Age Distribution (Histogram):**
- Candidate age distribution in buckets (18–25, 25–30, 30–35, 35–40, 40+).

**Experience Distribution (Histogram):**
- Years of experience distribution in buckets (0–1, 1–3, 3–5, 5–10, 10+).

#### 21.4.11 CTC Analysis (Box Plot / Range Chart)

- Current CTC vs. Expected CTC comparison across profiles or companies.
- Box plot or range chart showing min, max, median, quartiles.
- Helps identify expectation mismatches.

#### 21.4.12 Daily Activity Heatmap

- Calendar-style heatmap (like GitHub contribution graph) showing recruiter submission density per day.
- Color intensity = number of reports submitted that day.
- Scope: per recruiter (selectable) or aggregate (all recruiters combined).
- Time range: last 3 months, 6 months, 1 year (togglable).

#### 21.4.13 Employee Overview Analytics

A dedicated section within the Admin Analytics page providing a consolidated view of all employees (recruiters and reporting managers) as a workforce — not just their recruitment output but their overall engagement, attendance, and productivity.

**Employee summary cards:**

| Card | Metric |
|------|--------|
| Total Employees | Total active recruiters + reporting managers. |
| Present Today | Employees who have punched in today. |
| On Leave Today | Employees on approved leave today. |
| Absent Today | Employees with no punch-in and no approved leave. |
| Average Attendance Rate (Month) | % of working days with attendance across all employees this month. |
| Top Performer (Month) | Employee with highest candidate sourcing + best attendance + target achievement. |

**Employee performance comparison chart (grouped bar / radar):**
- Compare employees side by side across multiple dimensions: candidates sourced, completion rate, attendance rate, late frequency, average working hours, target achievement %.
- Selectable: pick 2–5 employees to compare, or view all as a ranked bar chart per metric.
- Filterable by role: All Employees, Recruiters only, Reporting Managers only.

**Employee productivity trend (multi-line chart):**
- X-axis: time (daily/weekly/monthly).
- Y-axis: candidates sourced.
- Lines: overlay multiple employees for trend comparison, or show aggregate (all employees, all recruiters, all reporting managers).

**Employee attendance heatmap:**
- Rows: employees. Columns: days of the month.
- Cell color: green (present full), light green (half-day), yellow (late), red (absent), blue (on leave), gray (weekend/holiday).
- At-a-glance view of the entire team's attendance pattern.

**Employee leave utilization (stacked bar):**
- Per employee: stacked bar showing leave used by type (Casual, Sick, Earned, etc.) vs. total allotted.
- Quickly see who is using all their leave, who has surplus, who has exhausted specific types.

**Workforce distribution (donut / pie):**
- Active vs. Suspended vs. Deactivated employees.
- Role distribution: Recruiters vs. Reporting Managers.
- Device-bound vs. Unbound employees (from Section 22).

---

### 21.5 Real-Time Statistics & Live Metrics

These metrics update in real-time (via WebSocket, server-sent events, or short-interval polling) without requiring page refresh:

| # | Live Metric | Description |
|---|------------|-------------|
| 1 | **Live Submissions Counter** | Real-time count of reports submitted today, ticking up as recruiters submit. Animated number counter. |
| 2 | **Active Users Right Now** | Number of recruiters and reporting managers currently logged in / active (based on session data). |
| 3 | **Last Submission** | Timestamp and recruiter name of the most recent report submission. Updates live. |
| 4 | **Today's Submission Rate** | Reports per hour rate for today, displayed as a live-updating sparkline or gauge. |
| 5 | **Pending Reports Alert** | Real-time count of reports in "Pending" status. Highlighted if above a configurable threshold. |

**Implementation notes:**
- Use WebSocket or Server-Sent Events (SSE) for push-based updates.
- Fallback: short-interval polling (every 15–30 seconds) if WebSocket/SSE is not feasible.
- Redis Pub/Sub can be used as the backend broadcast mechanism for real-time events.

---

### 21.6 Platform Health & System Monitoring

A collapsible or tab-separated section showing operational health of the platform itself (primarily for the Admin's awareness, not full DevOps monitoring):

| # | Health Metric | Description |
|---|--------------|-------------|
| 1 | **API Response Time** | Average API response time over the last hour / day. Display as gauge or number with trend. |
| 2 | **Database Query Performance** | Average query time, slow query count (queries > threshold). |
| 3 | **Active Sessions** | Total active sessions across all users. Breakdown by role (Admin, Reporting Manager, Recruiter). |
| 4 | **Redis Status** | Connection status (Connected / Disconnected), memory usage, cache hit rate. |
| 5 | **BullMQ Job Queue Status** | Counts of: Active jobs, Waiting jobs, Completed (last 24h), Failed (last 24h). Alerts if failed jobs > 0. |
| 6 | **Cloud Storage Usage** | Total storage used on R2/Cloudinary. Count of stored report files. Next auto-cleanup date/time. |
| 7 | **Email Delivery Health** | Last 24h: emails sent, delivered, failed. Failure rate percentage. Alert if failure rate > threshold. |
| 8 | **Uptime** | Platform uptime since last restart/deploy. |
| 9 | **Error Rate** | Server-side error rate (5xx responses) over last hour / day. Alert if elevated. |
| 10 | **Scheduled Jobs Status** | List of all active BullMQ scheduled jobs (report generation, email sending, cloud cleanup) with their next run time, last run status (success/fail), and last run timestamp. |

**Implementation notes:**
- Collect metrics via lightweight middleware (e.g., Express middleware logging response times).
- Store aggregated metrics in Redis (time-windowed counters, not per-request logs).
- BullMQ exposes job counts natively — query these directly.
- Cloud storage usage: query R2/Cloudinary API periodically (cached in Redis, refresh every 5–15 minutes).
- Display health indicators as: green (healthy) / yellow (degraded) / red (critical) status dots.

---

### 21.7 Interaction & Drill-Down Capabilities

The analytics page must support interactive exploration, not just static display:

- **Global date range selector** — applies to all cards and charts simultaneously. Options: Today, Yesterday, This Week, Last Week, This Month, Last Month, This Quarter, Last Quarter, This Year, Last Year, All Time, Custom Range (date picker).
- **Cross-filtering** — clicking a segment in one chart (e.g., a zone slice in the pie chart) filters related charts on the page to that segment. Visual indicator shows active filters. "Clear all filters" button.
- **Drill-down** — clicking aggregated data navigates to or opens a detail view (e.g., clicking a company bar → shows that company's service providers and candidate details). Breadcrumb-style navigation for drill-down levels.
- **Hover tooltips** — all charts display rich tooltips on hover with exact values, percentages, and comparisons.
- **Chart export** — each chart has an export button: export as PNG image or underlying data as CSV/XLSX.
- **Full-screen mode** — each chart/card can be expanded to full-screen for presentations or detailed viewing.
- **Data refresh** — manual "Refresh" button at page level + individual chart level, in addition to auto-refresh for real-time metrics.

---

### 21.8 Analytics Data Layer

**Backend requirements:**

- Dedicated analytics API endpoints optimized for aggregation queries (use PostgreSQL aggregate functions, window functions, CTEs — not application-level looping).
- Pre-computed materialized views or Redis-cached aggregations for heavy queries (e.g., monthly revenue trends, recruiter leaderboards) to ensure sub-second page loads.
- BullMQ worker for periodic aggregation refresh (e.g., every 5 minutes for near-real-time, hourly for heavy aggregations).
- Separate analytics query path — analytics queries should not impact the performance of transactional operations (consider read replicas if scale demands).

**Caching strategy:**
- KPI cards: cached in Redis, refreshed every 1–5 minutes (configurable per metric).
- Charts: cached in Redis with date-range-keyed cache keys, invalidated on new data writes or on a time-based expiry.
- Real-time metrics: Redis counters (INCR/DECR) updated on each event, read directly for display.
- Platform health: Redis-stored, refreshed by background workers at intervals.

---

### 21.9 Database Entities for Analytics

These entities supplement the schema in Section 17:

**`AnalyticsSnapshot` (periodic pre-computed aggregations):**
- id, snapshotType (DAILY_SUMMARY | WEEKLY_SUMMARY | MONTHLY_SUMMARY), periodStart, periodEnd, data (JSONB — stores pre-computed metrics for the period), computedAt.

**`PlatformHealthLog`:**
- id, metricName, metricValue (JSONB), recordedAt.
- Retained for a configurable window (e.g., 7 days of granular data, then auto-purged or rolled up).

**`RealTimeCounter` (Redis-only, not persisted to PostgreSQL):**
- Keys: `analytics:today:submissions`, `analytics:today:active_users`, `analytics:today:rate_per_hour`, etc.
- TTL-based: auto-expire at end of day, reset counters.

---

## 22. SINGLE-DEVICE LOCK & PERSISTENT DEVICE BINDING

> **Core Requirement:** Implement single-device lock + persistent device binding (even after logout) for Recruiters and Reporting Managers. The system must rely on device identity + backend validation. IP-based tracking MUST NOT be used (dynamic IPs, VPNs, NAT make IP unreliable).

---

### 22.1 Functional Requirements

The system must enforce the following rules absolutely:

| Scenario | Behavior |
|----------|----------|
| A recruiter/reporting manager logs in for the first time | Device gets locked to their account. ✅ |
| After logout → same device attempts login | Same device remains authorized — login allowed. ✅ |
| Login attempt from a DIFFERENT device | MUST be blocked. ❌ |
| Admin resets/unlocks device binding | MUST be allowed — user can then login from a new device. ✅ |

**Applies to:** Recruiters and Reporting Managers only. Admin is exempt from device locking.

**Purpose & Prevention Goals:**

This single-device lock system prevents:
- **Proxy attendance** — employees cannot have someone else log in on their behalf from a different device to submit reports.
- **Unauthorized multi-device access** — an account cannot be used from multiple devices simultaneously or sequentially without Admin intervention.
- **Credential sharing** — even if credentials are shared, only the originally bound device can access the account.

**Clear error messaging requirement:**
- When a login attempt is blocked due to device mismatch, the system MUST show a clear, user-friendly error message explaining why access is denied and instructing the user to contact Admin. Example: "This account is already registered on another device. Please contact your administrator to reset device access."
- The error message must NOT expose technical details (deviceId values, internal error codes) to the end user.

---

### 22.2 Architecture — Three Mandatory Layers

The system MUST include these 3 layers working together:

```
┌─────────────────────────────────────────┐
│  Layer 1: Device Fingerprint (Frontend) │   ← Generate + persist deviceId
├─────────────────────────────────────────┤
│  Layer 2: Device Binding (Database)     │   ← Lock deviceId to user permanently
├─────────────────────────────────────────┤
│  Layer 3: Session Enforcement           │   ← Validate deviceId on every request
│          (Redis + Backend Middleware)    │
└─────────────────────────────────────────┘
```

---

### 22.3 Layer 1 — Device Fingerprint (Frontend / Next.js)

**Generate a `deviceId` on the client side:**

- Use UUID (random unique identifier) as the primary device identity.
- Store the `deviceId` in:
  - `localStorage` — for persistence across browser sessions.
  - HTTP-only cookie — for security binding (sent automatically with every request, not accessible via JS).
- Optionally combine with supplemental signals for fingerprint enrichment:
  - `navigator.userAgent`
  - `navigator.platform`
  - `screen.width` × `screen.height`

**Reference implementation:**

```typescript
import { v4 as uuidv4 } from 'uuid';

let deviceId = localStorage.getItem("deviceId");

if (!deviceId) {
  deviceId = uuidv4();
  localStorage.setItem("deviceId", deviceId);
}
```

**Send `deviceId` in every login request:**

```json
{
  "email": "recruiter@example.com",
  "password": "...",
  "deviceId": "abc-123-def-456"
}
```

---

### 22.4 Layer 2 — Persistent Device Binding (Database / Prisma)

**Extend the User model with device lock fields:**

```prisma
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  password        String

  role            Role

  deviceId        String?   // LOCKED DEVICE — null until first login
  deviceLockedAt  DateTime? // Timestamp of when device was bound

  isActive        Boolean   @default(true)

  // ... other existing fields
}
```

**Key rules:**
- `deviceId` is `null` on account creation (no device bound yet).
- `deviceId` is set on first successful login and NEVER cleared by logout.
- Only Admin can set `deviceId` back to `null` (device reset/unlock).

---

### 22.5 Layer 3 — Login Logic (Critical Enforcement)

**Strict validation on every login attempt:**

```typescript
async function handleLogin(email: string, password: string, incomingDeviceId: string) {
  const user = await findUserByEmail(email);
  // ... password validation ...

  if (!user.deviceId) {
    // FIRST LOGIN → bind device permanently
    user.deviceId = incomingDeviceId;
    user.deviceLockedAt = new Date();
    await saveUser(user);
    allowLogin();
  }

  else if (user.deviceId === incomingDeviceId) {
    // SAME DEVICE → allow login
    allowLogin();
  }

  else {
    // DIFFERENT DEVICE → BLOCK
    throw new Error("Account already registered on another device. Contact admin.");
  }
}
```

**This logic is non-negotiable.** Do not simplify. Do not skip edge cases. Do not rely on assumptions.

---

### 22.6 Logout Behavior (Critical Rule)

**Logout MUST NOT unlock the device binding.**

On logout:

| Action | Allowed? |
|--------|----------|
| Destroy session (Redis) | ✅ Yes — always |
| Clear JWT / cookies | ✅ Yes — always |
| Clear `deviceId` from database | ❌ **NEVER** — device binding persists |

```typescript
async function handleLogout(userId: string) {
  await deleteSession(userId); // Destroy Redis session
  // deviceId remains unchanged in database — DO NOT touch it
}
```

---

### 22.7 Session Management (Redis + JWT Hybrid)

**Session storage in Redis:**

```
Key:    session:{userId}

Value:  {
  deviceId,       // The device that created this session
  ip,             // For admin visibility only — NOT for enforcement
  userAgent,      // For admin visibility only — NOT for enforcement
  createdAt
}
```

**Single active session enforcement — on every login:**

```typescript
const existingSession = await redis.get(`session:${user.id}`);

if (existingSession) {
  const parsed = JSON.parse(existingSession);

  if (parsed.deviceId !== incomingDeviceId) {
    throw new Error("Another device already active");
  }

  // Same device → replace/refresh session (allowed)
}

// Create new session
await redis.set(`session:${user.id}`, JSON.stringify({
  deviceId: incomingDeviceId,
  ip: request.ip,        // For admin display only, NOT for blocking
  userAgent: request.headers['user-agent'],
  createdAt: new Date().toISOString()
}));
```

**Prevention of simultaneous logins from multiple tabs or browsers:**

The single-session-per-user design (one Redis key `session:{userId}`) inherently prevents simultaneous logins from multiple tabs or browsers:

| Scenario | Behavior |
|----------|----------|
| **Same browser, multiple tabs** | All tabs share the same session cookie → they share the same session. No conflict. Only one active session exists. |
| **Different browser, same device** | Different browsers have separate `localStorage` but the device UUID is also stored in an HTTP-only cookie. If the cookie is shared (same device), same session applies. If a second browser generates a new `deviceId`, the login is blocked by device mismatch. |
| **Different device entirely** | Blocked by device binding (Section 22.5). |
| **Same browser, logout + re-login in new tab** | Old session destroyed on logout, new session created on re-login. Only one active session at any time. |

- At no point can two separate active sessions exist for the same user — the Redis key `session:{userId}` is singular and overwritten on each valid login.
- If a user attempts to log in from a second browser/tab while already logged in elsewhere on the same device, the existing session is replaced (not duplicated) — ensuring exactly one active session.

---

### 22.8 Request Validation Middleware (Mandatory)

**Every authenticated API request MUST validate device identity:**

```typescript
async function deviceValidationMiddleware(req, res, next) {
  const tokenDeviceId = req.token.deviceId;  // From JWT payload
  const user = await getUserById(req.token.userId);

  if (tokenDeviceId !== user.deviceId) {
    // Device mismatch — token was issued for a different device
    throw new Error("Device mismatch - unauthorized");
  }

  next();
}
```

This middleware runs on EVERY authenticated endpoint — no exceptions. It catches scenarios where a device binding was reset by Admin but old tokens are still in circulation.

---

### 22.9 Admin Device Controls (Mandatory Features)

Admin MUST have the following device management capabilities:

| Admin Action | Behavior |
|-------------|----------|
| **Reset device binding** | Sets `user.deviceId = null` and `user.deviceLockedAt = null`. User can now login from any device (next login will bind the new device). |
| **Force logout all sessions** | Destroys all Redis sessions for the user. Does NOT clear device binding. |
| **Force switch device** | Resets device binding + destroys sessions in one action. User must login again from their new device. |
| **View bound device info** | Admin can see: bound `deviceId`, `deviceLockedAt` timestamp, associated `userAgent`, `platform`, `screen size` (if captured). |
| **Reactivate user login capability** | Combines: reactivate suspended account + optionally reset device binding. |

**Admin panel UI for device management:**
- In the user management table: a "Device" column showing bound device status (Bound / Unbound).
- Per-user detail view: device info card showing `deviceId`, lock timestamp, last seen, user agent.
- **One-click "Reset Device" button** per employee — Admin can reset any recruiter's or reporting manager's device binding with a single click (followed by confirmation dialog). This is the primary mechanism for allowing an employee to switch to a new device.
- Additional action buttons: "Force Logout," "Force Switch Device."
- Confirmation dialog before any device reset action.

---

### 22.10 IP-Based Tracking — Strictly Forbidden

**DO NOT use IP address as a device identity or for access enforcement.** IP is used ONLY for Admin session visibility (display purposes).

| Reason | Explanation |
|--------|-------------|
| Mobile networks change IP frequently | Cellular connections rotate IPs constantly. |
| VPN usage invalidates tracking | Users on VPN appear as different IPs. |
| NAT causes shared IPs | Multiple users behind the same router share one IP. |
| ISP reassignment | Dynamic IP addresses change on router restart. |

IP may be **stored** for Admin to view session locations, but it MUST NOT be used for blocking, validation, or device identity.

---

### 22.11 Advanced — Device Tracking Table (Recommended Extension)

In addition to the single `deviceId` field on the User model, implement a full device tracking history table:

```prisma
model UserDevice {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  deviceId  String
  userAgent String
  platform  String?
  screenSize String?
  lastSeen  DateTime @updatedAt
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([deviceId])
}
```

**Purpose:**
- Track all devices that have ever been bound to a user (historical record).
- When Admin resets a device and user logs in from a new one, the old device record is marked `isActive = false` and the new one is created.
- Enables: device history view, suspicious activity detection, audit trail.

---

### 22.12 Additional Features (Recommended)

**Implement the following alongside the core device lock system:**

| Feature | Description |
|---------|------------|
| **Admin panel device visibility** | Dedicated section in Admin panel showing all users and their bound devices — filterable by bound/unbound status, last seen date. |
| **Login history tracking** | Log every login attempt (successful and failed) with: timestamp, deviceId, IP (display only), userAgent, success/failure reason. Stored in a `LoginHistory` table. |
| **Suspicious activity detection** | Flag and notify Admin when: repeated failed logins from different devices, login attempts after device reset, rapid device switching patterns. |
| **"Force switch device" feature** | One-click Admin action that resets device binding + destroys all sessions + optionally notifies the user via in-app notification. |
| **Device lock notification** | When a login is blocked due to device mismatch, send an in-app notification (and optionally email) to Admin with the blocked user's details and the attempted device info. |

---

### 22.13 Security Considerations & Limitations

**This system:**

| Aspect | Status |
|--------|--------|
| Strong for web apps | ✅ Yes |
| Completely unbreakable | ❌ No (no client-side system is) |

**Known bypass vectors (and mitigations):**

| User Action | Impact | Mitigation |
|-------------|--------|------------|
| Clear `localStorage` | `deviceId` lost — generates new UUID on next visit | HTTP-only cookie serves as backup; if cookie also cleared, backend still has the bound `deviceId` → new UUID won't match → login blocked. User must contact Admin. |
| Change browser | Different `localStorage` → different `deviceId` | Login blocked — different device identity. User must contact Admin. |
| Use incognito mode | No `localStorage` persistence → new UUID each time | Login blocked. User must contact Admin. |
| Clear cookies | HTTP-only cookie lost | Backend validation catches mismatch. Login blocked. |

**Therefore: Backend validation of `deviceId` is mandatory and authoritative.** The database `deviceId` is the single source of truth. Frontend storage is for convenience; backend enforcement is for security.

---

### 22.14 Final Best Practice Combination

The complete device lock system MUST combine all of the following — no layer can be omitted:

```
✅ deviceId (UUID) — generated on client, sent with every login
✅ localStorage persistence — survives browser close
✅ HTTP-only cookie binding — survives localStorage clear, not accessible via JS
✅ Database device lock — permanent binding, survives logout, single source of truth
✅ Redis session validation — single active session enforcement
✅ Request middleware — validates deviceId on every authenticated API call
✅ Admin override system — reset binding, force logout, force switch device
✅ Device tracking table — historical audit trail of all device bindings
✅ Login history — audit log of all login attempts (success + failure)
✅ Suspicious activity detection — automated flagging of anomalous patterns
```

---

### 22.15 Implementation Expectations

The solution must be:

| Requirement | Description |
|-------------|-------------|
| **Production-ready** | No TODO stubs, no placeholder logic, no simplified enforcement. |
| **Secure against bypass attempts** | Backend is authoritative. Client-side storage is convenience, not security. |
| **Scalable** | Redis-backed sessions scale horizontally. Device table indexed for fast lookups. |
| **Cleanly structured** | Separated into distinct modules: fingerprint service, auth service, device service, middleware. |
| **Fully integrated** | Must integrate with the existing JWT + BFF cookie auth system (Section 4), session management (Section 4), and Admin user management (Section 6). |

**The implementation must provide all of:**
- Backend login/logout logic with device enforcement.
- Device validation middleware for all authenticated routes.
- Database schema updates (User model extension + UserDevice table + LoginHistory table).
- Frontend deviceId generation and persistence flow (Next.js).
- Redis session handling with single-session enforcement.
- Admin UI for device management (view, reset, force switch, history).

**Do not skip edge cases. Do not simplify enforcement logic. Do not rely on assumptions.**

---

### 22.16 Database Entities for Device Binding

These entities supplement the schema in Section 17:

**User model extension (fields added to existing User):**
- `deviceId` (String, nullable) — the currently locked device UUID.
- `deviceLockedAt` (DateTime, nullable) — when the device was first bound.

**`UserDevice` (device history tracking):**
- id, userId (FK → User), deviceId, userAgent, platform, screenSize, lastSeen, isActive, createdAt.

**`LoginHistory` (audit log):**
- id, userId (FK → User), attemptedDeviceId, ip (display only), userAgent, success (Boolean), failureReason (nullable — e.g., "device_mismatch", "account_suspended", "invalid_password"), createdAt.

---

## 23. ADDITIONAL PLATFORM FEATURES

### 23.1 Audit / Activity Log System

Every CRUD action across the platform must be logged in a general audit trail. This goes beyond the login history in Section 22 — it covers **all data changes** by all users. Critical for an enterprise platform where Admin needs to trace data changes.

**What gets logged:**

| Action Category | Examples |
|----------------|----------|
| **Candidate records** | Created, edited (which fields changed, old value → new value), deleted, status changed. |
| **User management** | Recruiter/RM created, suspended, reactivated, deleted, password reset, device reset, reporting manager assigned/removed. |
| **Company / SP / HR** | Company created/edited/deleted, Service Provider added/removed, HR Manager added/removed. |
| **Reports** | Report generated, downloaded, scheduled, schedule edited/deleted, email sent. |
| **Invoice & payment** | Invoice created, payment status changed, amount updated. |
| **Settings & config** | Recruiter targets set/changed, scheduled reports configured, bulk operations performed. |
| **Session actions** | Session revoked (individual or all), force logout triggered. |

**Audit log record structure:**

| Field | Description |
|-------|-------------|
| `id` | Unique log entry ID. |
| `userId` | Who performed the action (FK → User). |
| `userRole` | Role at the time of action (ADMIN / REPORTING_MANAGER / RECRUITER). |
| `action` | Action type (CREATE / UPDATE / DELETE / BULK_UPDATE / BULK_DELETE / STATUS_CHANGE / EXPORT / LOGIN / LOGOUT). |
| `entityType` | What was affected (CANDIDATE_REPORT / USER / COMPANY / SERVICE_PROVIDER / HR_MANAGER / INVOICE / SCHEDULED_REPORT / etc.). |
| `entityId` | ID of the affected record. |
| `changes` | JSON object with `{ field: { oldValue, newValue } }` for UPDATE actions. Null for CREATE/DELETE. |
| `ipAddress` | IP of the request (for display/audit only). |
| `userAgent` | Browser/client info. |
| `timestamp` | When the action occurred (UTC). |

**Admin UI for audit log:**
- Dedicated "Audit Log" page in Admin panel.
- Filterable by: user, action type, entity type, date range.
- Searchable by entity ID, user name.
- Paginated with all standard controls.
- Each entry expandable to show full change details (old → new values).
- Export audit log to XLSX.

**Implementation:**
- Middleware-based: an audit middleware that intercepts all write operations and logs automatically.
- Alternatively, a service-level decorator/wrapper that wraps all Prisma mutations.
- Audit logs are append-only — they cannot be edited or deleted (even by Admin).
- Retention: configurable (default: retain indefinitely; optionally archive to cold storage after 1 year).

---

### 23.2 Bulk Operations

When Admin has hundreds or thousands of records, they need to perform actions on multiple records at once. Bulk operations must be supported across all relevant Admin data views.

**Supported bulk actions:**

| Bulk Action | Applies To | Description |
|-------------|-----------|-------------|
| **Bulk edit** | Candidate records | Select multiple records → change a common field value for all (e.g., set Status = Complete for 50 records, assign Company for 30 records). |
| **Bulk delete** | Candidate records, Companies, Service Providers, HR Managers | Select multiple → soft delete all (moved to trash — see Section 23.7). |
| **Bulk status update** | Candidate records | Select multiple → change Status (Complete/Pending) in one action. |
| **Bulk assign** | Candidate records | Select multiple → assign Company, Service Provider, or HR Manager to all selected. |
| **Bulk payment status update** | Candidate records (admin fields) | Select multiple → update Payment Status for all selected. |
| **Bulk export** | Any data view | Select multiple or all → export selected records to XLSX. |

**UI implementation:**
- Checkbox column on all data tables (first column).
- "Select all on page" checkbox in header + "Select all X records across all pages" option.
- Floating action bar appears when records are selected, showing: count of selected items + available bulk action buttons.
- Confirmation dialog before destructive actions (delete, status change) showing count and action summary.
- Progress indicator for large bulk operations.
- Result summary after completion (X succeeded, Y failed, with failure reasons).

**Backend implementation:**
- Bulk operations processed as database transactions (all succeed or all rollback).
- For very large batches (500+ records), process via BullMQ background job with progress tracking.
- Each individual change within a bulk operation is logged in the audit trail (Section 23.1).
- Rate limiting: bulk operations limited to prevent abuse (e.g., max 1000 records per bulk action).

---

### 23.3 Candidate Duplicate Detection

If two recruiters source the same candidate (same phone number or same email), the system should detect and flag it. This prevents wasted effort and double invoicing.

**Detection rules:**

| Match Field | Behavior |
|-------------|----------|
| **Contact No** (exact match) | Flag as duplicate — highest confidence. |
| **Email ID** (exact match) | Flag as duplicate — high confidence. |
| **Candidate Name + Contact No** (both match) | Flag as definite duplicate. |
| **Candidate Name + Email** (both match) | Flag as definite duplicate. |

**Detection timing:**
- **Real-time (on form submission):** When a recruiter submits a report, before saving, check for existing records with the same Contact No or Email ID. If a match is found, show a warning to the recruiter with details of the existing record (who submitted it, when, for which company). The recruiter can choose to proceed (save with duplicate flag) or cancel.
- **Batch detection (admin):** Admin can trigger a batch duplicate scan across all records, generating a report of all suspected duplicates.

**Duplicate management (Admin):**
- Dedicated "Duplicates" view in Admin panel showing all flagged duplicate pairs/groups.
- For each duplicate group: show all matching records side by side.
- Admin actions: Merge records (choose which data to keep), Dismiss duplicate flag (mark as not-duplicate), Delete duplicate.
- Duplicate flag stored on the record: `isDuplicate` (Boolean), `duplicateGroupId` (to link related duplicates).

**Database:**
- Index on `contactNo` and `emailId` for fast lookup during duplicate detection.
- `DuplicateGroup` table: id, detectedAt, status (PENDING / RESOLVED / DISMISSED), resolvedAt, resolvedByUserId.
- `DuplicateGroupMember` table: id, duplicateGroupId (FK), candidateReportId (FK).

---

### 23.4 Recruiter & Reporting Manager Dashboards

Recruiters currently only have a form and a self-view of their data. Reporting Managers see data but no summary. Both roles need personal dashboards with stats and performance trends.

#### 23.4.1 Recruiter Personal Dashboard

A dashboard visible to each recruiter showing ONLY their own performance data:

**KPI Cards (top row):**

| Card | Metric |
|------|--------|
| Candidates Sourced Today | Count of today's submissions. |
| Candidates This Week | Count for current week. |
| Candidates This Month | Count for current month. |
| Completion Rate | % of records with Status = Complete out of total. |
| Pending Count | Records with Status = Pending. |

**Today's Attendance & Working Hours (prominent section):**

| Card / Widget | Metric |
|---------------|--------|
| **Today's Status** | Current attendance status for today: "Present" (with punch-in time) / "Not Yet Punched In" / "On Leave." Displayed as a prominent status badge with color coding (green/yellow/red). |
| **Punch In Time** | Today's login/punch-in timestamp displayed prominently (e.g., "Punched in at 9:47 AM"). |
| **Today's Working Hours** | Live counter showing hours and minutes worked today so far — `Current Time − Punch In Time`. Updates in real-time (ticks every minute). Displayed as a large, readable counter (e.g., "5h 23m"). If not yet punched in, shows "0h 0m" with a note. |
| **Late Indicator** | If punched in after the configured late threshold: shows "Late by X minutes" with a warning icon. If on time: shows "On Time ✅." |
| **Yesterday's Hours** | Working hours logged yesterday (for quick reference). |
| **This Week's Hours** | Total working hours accumulated this week. |
| **This Month's Hours** | Total working hours accumulated this month. |

**Daily Attendance Overview (mini calendar or streak):**
- A compact **attendance streak** widget showing the last 7–14 days as colored dots: green (present), yellow (half-day), red (absent), blue (on leave), gray (weekend/holiday), orange (late).
- Or a mini monthly calendar with the same color coding (integrates with Section 27.7 but shown inline on the dashboard for quick glance).
- Shows current month's attendance rate as a percentage (e.g., "Attendance: 92% this month").

**Leave Overview (compact section):**

| Widget | Content |
|--------|---------|
| **Leave Balance Summary** | Compact display of remaining leave balance per type — e.g., "CL: 8 · SL: 6 · EL: 15." |
| **Upcoming Approved Leaves** | List of the recruiter's own upcoming approved leave dates (next 30 days). If none: "No upcoming leaves." |
| **Pending Leave Requests** | Count of their own leave requests currently in Pending status, with a link to "My Leaves" page. |
| **Next Leave** | If any approved leave is upcoming: "Next leave: [Date] ([Leave Type])." |

**Charts:**
- **Daily trend line** — candidates sourced per day over the last 30 days.
- **Weekly performance bar chart** — candidates per week over the last 12 weeks.
- **Status breakdown donut** — Complete vs. Pending ratio.
- **Zone distribution pie** — distribution of their submissions by zone.

**If recruiter targets are set (see Section 23.9):**
- Target progress bar — "12 of 15 today" with visual fill.
- Target achievement history — daily target hit/miss over the last 30 days.

**Recent submissions table** — last 10 submitted records with quick status view.

#### 23.4.2 Reporting Manager Team Dashboard

A dashboard visible to each Reporting Manager showing aggregate performance of all recruiters assigned under them:

**KPI Cards:**

| Card | Metric |
|------|--------|
| Total Candidates (Team) Today | Sum of all assigned recruiters' submissions today. |
| Active Recruiters Today | Count of assigned recruiters who submitted at least one report today. |
| Team Completion Rate | Aggregate completion rate across all assigned recruiters. |
| Top Performer Today | Recruiter name with highest count today. |

**Reporting Manager's Own Attendance & Working Hours:**

The Reporting Manager's dashboard also shows their **own** personal attendance data (same as the recruiter dashboard — they are employees too):

| Card / Widget | Metric |
|---------------|--------|
| **Today's Status** | Own attendance status: "Present" (with punch-in time) / "Not Yet Punched In" / "On Leave." |
| **Punch In Time** | Own login timestamp today. |
| **Today's Working Hours** | Live counter — hours and minutes worked so far today. Updates in real-time. |
| **Late Indicator** | "Late by X minutes" or "On Time ✅." |
| **This Month's Hours** | Total working hours this month. |
| **Attendance Streak** | Last 7–14 days as colored dots (same as recruiter dashboard). |
| **Monthly Attendance Rate** | Own attendance percentage this month. |

**Reporting Manager's Own Leave Overview:**

| Widget | Content |
|--------|---------|
| **Leave Balance Summary** | Own remaining balance per type — "CL: 8 · SL: 6 · EL: 15." |
| **Upcoming Approved Leaves** | Own upcoming approved leave dates (next 30 days). |
| **Pending Leave Requests** | Count of own pending leave requests. |

**Team Attendance Snapshot (assigned recruiters):**

| Card | Metric |
|------|--------|
| **Team Present Today** | Count of assigned recruiters who have punched in today. |
| **Team Absent Today** | Count of assigned recruiters with no punch-in (and no approved leave). |
| **Team Late Today** | Count of assigned recruiters who punched in late. |
| **Team On Leave Today** | Count of assigned recruiters on approved leave today. |
| **Team Avg Working Hours (Today)** | Average working hours across assigned recruiters who are present today. |

- Compact **team login list** showing each assigned recruiter: name, punch-in time (or "Not In"), status (On Time / Late / Absent / On Leave).
- **Team monthly attendance rate** — aggregate attendance % for assigned recruiters this month.

**Charts:**
- **Per-recruiter bar chart** — candidates sourced by each assigned recruiter (today / this week / this month — togglable).
- **Team daily trend line** — aggregate team submissions per day over the last 30 days.
- **Individual recruiter trend lines** — overlay selectable recruiter trends for comparison.
- **Status breakdown (team)** — aggregate Complete vs. Pending.

**Recruiter summary table** — all assigned recruiters with: name, today's count, week count, month count, completion rate, last submission time, today's punch-in time, today's working hours, attendance status (Present/Late/Absent/On Leave), monthly attendance %, leave balance remaining.

---

### 23.5 Data Archiving Strategy

No mention of what happens to data after 1+ years. Old candidate records, completed reports, closed invoices — should they be archived to a separate table/storage? Important for query performance as data grows.

**Archiving rules:**

| Data Type | Archive After | Criteria |
|-----------|--------------|----------|
| Candidate records | 12 months | Records with Status = Complete AND Date of Joining > 12 months ago AND Payment Status = Paid. |
| Generated reports (cloud files) | Already handled | Auto-cleanup after 30 days (Section 10.4 / 20.4). |
| Audit logs | 12 months | Move granular logs to archive; keep summarized data. |
| Login history | 6 months | Move detailed login logs to archive table. |
| Notifications | 3 months | Mark old notifications as archived, exclude from default queries. |

**Archiving implementation:**
- **Archive tables:** Mirror tables with `_archive` suffix (e.g., `CandidateReport_archive`) — same schema, separate table. Archived records are moved (not copied) from the main table to the archive table.
- **BullMQ scheduled job:** Monthly archiving job that identifies eligible records and moves them.
- **Admin controls:** Admin can configure archiving rules (thresholds, which data types). Admin can search/view archived data in a dedicated "Archive" section. Admin can restore individual archived records back to the main table.
- **Query performance:** Primary tables stay lean. Archived data is queryable but separated from default views and dashboards.
- **Data integrity:** Foreign key references to archived records are handled gracefully (soft references or denormalized snapshots in the archive).

---

### 23.6 Data Import (Bulk CSV/XLSX Upload)

Admin may need to import historical candidate data or batch upload records. Currently only manual form entry exists.

**Import functionality:**

| Feature | Description |
|---------|-------------|
| **File upload** | Admin uploads a CSV or XLSX file containing candidate records. |
| **Template download** | Admin can download a blank template (XLSX) with all column headers matching the expected format, with field descriptions and example data. |
| **Column mapping** | After upload, the system shows a column mapping screen where Admin can match file columns to database fields (auto-mapped where column headers match, with manual override). |
| **Validation** | Each row is validated against the same rules as the form (required fields, data types, email format, phone format, etc.). Invalid rows are flagged with specific error messages per cell. |
| **Preview** | After validation, Admin sees a preview: total rows, valid rows, invalid rows, duplicate detections. Admin can review and fix errors before committing. |
| **Import execution** | Admin clicks "Import" → valid rows are inserted into the database. Invalid rows are skipped and exported as an error report (XLSX with error annotations per row). |
| **Duplicate handling** | Detected duplicates (per Section 23.3) are flagged during preview. Admin chooses: skip duplicates, import and flag, or overwrite existing. |
| **Audit trail** | The import action is logged in the audit trail (Section 23.1) with: file name, total rows, imported count, skipped count, importing user. |

**Technical implementation:**
- File parsing: use SheetJS (xlsx) or Papaparse (CSV) on the backend.
- Large file support: files up to 10MB / 10,000 rows. Larger files processed via BullMQ background job with progress notification.
- Import is transactional per batch (configurable batch size, e.g., 100 rows per transaction).

---

### 23.7 Soft Delete with Restore

Users have soft delete via status field, but no mention of soft delete for candidate records, companies, service providers, HR managers, or reports. Also no "Trash / Recently Deleted" view for Admin to restore accidentally deleted items.

**Soft delete scope:**

| Entity | Soft Delete Behavior |
|--------|---------------------|
| **Candidate records** | Marked as deleted (not removed from DB). Hidden from all default views. |
| **Companies** | Marked as deleted. Hidden from dropdowns. Associated Service Providers and HR Managers also hidden (cascade soft delete). |
| **Service Providers** | Marked as deleted. Hidden from dropdowns. |
| **HR Managers** | Marked as deleted. Hidden from dropdowns. |
| **Users (Recruiters/RMs)** | Already handled via status field (Section 3). |
| **Reports (generated)** | Marked as deleted in history. |

**Database implementation:**
- Add `deletedAt` (DateTime, nullable) and `deletedBy` (FK → User, nullable) fields to all soft-deletable entities.
- `deletedAt = null` means active. `deletedAt = <timestamp>` means soft-deleted.
- All default queries filter `WHERE deletedAt IS NULL` (use Prisma middleware or soft-delete extension for automatic filtering).

**"Trash / Recently Deleted" view (Admin only):**
- Dedicated "Trash" page in Admin panel.
- Shows all soft-deleted records across all entity types.
- Filterable by entity type, deleted by, deleted date range.
- Paginated with standard controls.
- Actions per record: **Restore** (sets `deletedAt = null`, restores to active state) or **Permanently delete** (irreversible — removes from database entirely, with confirmation dialog).
- Bulk restore and bulk permanent delete supported.

**Auto-purge:**
- Soft-deleted records are permanently purged after a configurable retention period (default: 90 days).
- BullMQ scheduled job runs weekly to permanently delete records where `deletedAt` is older than retention threshold.
- Admin is notified before auto-purge (e.g., weekly summary of records about to be purged).

**Audit trail:**
- All soft deletes, restores, and permanent deletes are logged in the audit trail (Section 23.1).

---

### 23.8 Form Auto-Save / Draft System

If a recruiter is filling a 33-field form and their browser crashes or they accidentally navigate away, all data is lost. No draft/auto-save mechanism mentioned.

**Auto-save behavior:**

| Trigger | Action |
|---------|--------|
| **Every 30 seconds** (configurable) | Auto-save current form state to backend as a draft. |
| **On field blur** (when user moves to next field) | Auto-save current form state. |
| **On browser beforeunload** (tab close / navigate away) | Attempt final save of current state. |
| **Manual "Save Draft" button** | User explicitly saves current state without submitting. |

**Draft storage:**
- Drafts are saved to the database in a `CandidateReportDraft` table.
- Draft fields: id, recruiterId (FK → User), zone, formData (JSONB — stores all field values), lastSavedAt, createdAt.
- One active draft per recruiter per zone at a time (new draft overwrites previous for same zone).
- Drafts are automatically deleted when the form is successfully submitted.

**Draft resume behavior:**
- When a recruiter opens the "Add Report" form, the system checks for existing drafts.
- If a draft exists: show a prompt — "You have an unsaved draft from [timestamp]. Resume or discard?"
- Resume: pre-fills all fields from the draft.
- Discard: deletes the draft, opens a blank form.

**UI indicators:**
- "Draft saved" indicator (subtle toast or inline text) after each auto-save.
- "Unsaved changes" warning if the user tries to navigate away with unsaved data.
- Draft badge on the "Add Report" button if a draft exists.

---

### 23.9 Recruiter Targets / Goals

No KPI target system. Admin should be able to set daily/weekly/monthly targets per recruiter (e.g., "source 10 candidates/day") and track progress against targets on dashboards.

**Target configuration (Admin):**

| Setting | Description |
|---------|-------------|
| **Target type** | Daily, Weekly, Monthly (can set all three independently). |
| **Target metric** | Number of candidate reports submitted (primary metric). |
| **Target value** | Numeric goal (e.g., 10 per day, 50 per week, 200 per month). |
| **Scope** | Per-recruiter (individual targets) or global default (applies to all recruiters unless overridden). |
| **Effective period** | Start date → End date (or ongoing). Allows changing targets over time without losing historical data. |

**Target management UI (Admin):**
- Dedicated "Targets" section in Admin panel.
- Set global default targets (applies to all recruiters).
- Override for individual recruiters (specific recruiter gets different targets).
- View current targets for all recruiters in a table.
- Edit / deactivate targets.
- Target history — log of all target changes with timestamps.

**Target tracking (visible on dashboards):**
- **Recruiter dashboard** (Section 23.4.1): shows personal target progress — "12 of 15 today" with progress bar, daily/weekly/monthly target achievement rate, streak tracking (consecutive days target met).
- **Admin analytics** (Section 21): aggregate target achievement across all recruiters — team achievement rate, per-recruiter target performance, underperformers flagged.
- **Reporting Manager dashboard** (Section 23.4.2): team target achievement — per-recruiter target progress for assigned recruiters.

**Database:**
- `RecruiterTarget` table: id, recruiterId (FK → User, nullable for global default), targetType (DAILY / WEEKLY / MONTHLY), targetValue (integer), effectiveFrom (Date), effectiveTo (Date, nullable for ongoing), isActive, createdBy (FK → User), createdAt, updatedAt.

---

### 23.10 Global Search

No platform-wide search exists. Admin should be able to type a name, phone number, email, or company name in one search bar and get results across all entities (candidates, companies, service providers, HR managers, recruiters). Currently each data view has its own column-level search, but there's no unified global search.

**Search scope (by role):**

| Role | Searchable Entities |
|------|-------------------|
| **Admin** | Candidate reports (name, phone, email), Companies, Service Providers, HR Managers, Recruiters, Reporting Managers, Invoices (invoice number), Audit logs. |
| **Reporting Manager** | Candidate reports submitted by assigned recruiters (name, phone, email), assigned Recruiter names. |
| **Recruiter** | Own submitted candidate reports (name, phone, email). |

**Search behavior:**
- **Single search bar** in the top navigation header, accessible from any page.
- **Debounced input** — search triggers after 300ms of typing pause (not on every keystroke).
- **Server-side search** — search query sent to backend API, which queries across multiple tables and returns categorized results.
- **Results grouped by entity type** — results displayed in a dropdown panel grouped under headers: "Candidates," "Companies," "Service Providers," "HR Managers," "Users," "Invoices."
- **Result item format:** Entity icon + primary text (name) + secondary text (phone/email/company) + entity type badge.
- **Click behavior:** Clicking a result navigates to that entity's detail view or highlights it in the relevant data table.
- **Keyboard navigation:** Arrow keys to navigate results, Enter to select, Escape to close.
- **"See all results" link** at the bottom → navigates to a full search results page with all matches, pagination, and filtering.
- **Empty state:** "No results found for '[query]'" with suggestion to refine search terms.

**Backend implementation:**
- Dedicated search API endpoint: `GET /api/search?q={query}&types={candidate,company,...}`.
- PostgreSQL full-text search (`tsvector`/`tsquery`) or `ILIKE` queries across indexed columns.
- Results limited to top 5 per entity type in the quick-search dropdown (full results on the dedicated page).
- RBAC enforced: search results filtered by the user's role and access scope (recruiter sees only own data, RM sees only assigned recruiters' data).

**Database:**
- Full-text search indexes (GIN indexes) on: `CandidateReport.candidateName`, `CandidateReport.contactNo`, `CandidateReport.emailId`, `Company.name`, `ServiceProvider.name`, `HRManager.name`, `User.firstName`, `User.lastName`, `User.email`.
- See also Section 24.15 (Database Indexing Strategy) for full indexing plan.

---

### 23.11 Candidate Status Workflow / Pipeline Stages

Currently there's only a binary Status: Complete/Pending. In reality, a candidate goes through multiple stages. No multi-stage pipeline, no stage transitions, no stage-based filtering or reporting.

**Pipeline stages (ordered):**

| # | Stage | Description | Set By |
|---|-------|------------|--------|
| 1 | **Sourced** | Candidate record created by recruiter. Default stage on submission. | Auto (on report creation). |
| 2 | **Screened** | Recruiter has screened the candidate (communication assessed, qualifications verified). | Recruiter. |
| 3 | **CV Shared** | CV has been shared with the company/HR (CV Shared On Date is set). | Admin. |
| 4 | **Interview Scheduled** | Interview has been arranged with the company/HR. | Admin. |
| 5 | **Selected** | Candidate has been selected by the company/HR. | Admin. |
| 6 | **Joined** | Candidate has joined (Date of Joining is set). | Admin. |
| 7 | **Invoiced** | Invoice has been generated for this candidate. | Admin. |
| 8 | **Closed** | Process complete — payment received and record finalized. | Admin. |
| 9 | **Rejected** | Candidate rejected at any stage (maps to HR Feedback = Rejected). | Admin. |
| 10 | **On Hold** | Candidate on hold at any stage (maps to HR Feedback = Hold). | Admin. |

**Transition rules:**
- Stages must progress forward (Sourced → Screened → CV Shared → etc.). Cannot skip stages except for Rejected/On Hold which can be set from any stage.
- Backward transitions allowed only by Admin (e.g., moving from "Selected" back to "Interview Scheduled" if circumstances change).
- Each transition is timestamped and logged in the audit trail (Section 23.1).
- The existing binary "Status" field (Complete/Pending) is retained for backward compatibility but supplemented by this pipeline stage field.

**UI representation:**
- **Pipeline view (Admin):** Kanban-style board showing candidates grouped by stage, with drag-and-drop to move between stages. Card shows candidate name, company, recruiter, days in current stage.
- **Pipeline funnel (Admin analytics — Section 21.3):** Already defined — this pipeline feeds directly into the recruitment funnel visualization.
- **Stage column in data tables:** All data tables showing candidates include a "Pipeline Stage" column with color-coded stage badges.
- **Stage-based filtering:** Filter by pipeline stage in all data views. Quick filter buttons for each stage.
- **Stage-based reporting:** All report types (Section 20) can be filtered by pipeline stage.

**Database:**
- Add `pipelineStage` field (ENUM) to `CandidateReport` model. Default: `SOURCED`.
- `CandidateStageHistory` table: id, candidateReportId (FK), fromStage, toStage, changedByUserId (FK → User), changedAt, notes (optional text for transition reason).

---

### 23.12 Admin Settings / Configuration Page

No centralized settings page. Admin needs a dedicated page to manage platform-wide configurations without code changes.

**Settings categories:**

| Category | Configurable Settings |
|----------|----------------------|
| **Zone Configuration** | Zone-to-form-set mappings (which zones belong to Set A vs Set B). Zone names (if they need to be renamed). Enable/disable zones. |
| **Dropdown Options / Master Data** | State list, Location list (per zone), Profile list (per zone), Higher Qualification options, Notice Period options, Diploma Part/Full options. Add/edit/remove/reorder options. See also Section 23.19 (Admin Configurable Dropdown Options). |
| **Recruiter Targets** | Default daily/weekly/monthly targets (global). Override targets per recruiter. See Section 23.9. |
| **Session & Security** | Session idle timeout duration (default: 30 min). Absolute session lifetime: until midnight (midnight session reset cron job — Section 27.1.3). Account lockout threshold (default: 5 attempts). Lockout cooldown period (default: 15 min). Password complexity rules (min length, required character types). |
| **Report Schedule Defaults** | Default email recipients for scheduled reports. Default report types for daily/monthly/yearly schedules. Report file retention period (default: 30 days). |
| **Invoice Configuration** | Invoice number prefix text (e.g., "HF-"). Invoice number date format. Invoice number serial starting value. |
| **Data Management** | Auto-archive threshold (default: 12 months). Soft delete auto-purge retention (default: 90 days). Archived data retention (default: 3 years). |
| **Notification Preferences** | Which events trigger in-app notifications. Which events trigger email notifications. Admin email addresses for system alerts. |
| **Platform** | Platform name / branding (if customizable). Maintenance mode toggle (see Section 24.18). |

**UI implementation:**
- Dedicated "Settings" page in Admin sidebar navigation.
- Organized by category with tabs or accordion sections.
- Each setting has: label, current value, edit control (input/dropdown/toggle), description/help text, "Save" button per section (or auto-save with confirmation toast).
- Settings changes are logged in the audit trail (Section 23.1).
- Validation on all settings (e.g., session timeout can't be set to 0 or negative).

**Backend implementation:**
- `PlatformSetting` table: id, category (STRING), key (STRING, unique), value (JSONB — supports strings, numbers, booleans, arrays, objects), updatedAt, updatedBy (FK → User).
- Settings loaded into memory/Redis cache at app startup. Cache invalidated on any settings update.
- Fallback to code-defined defaults if a setting is not found in the database.

---

### 23.13 Email Templates

The system sends emails (daily reports, monthly reports, lockout notifications, password resets) but there's no mention of email template management. Without this, every email change requires a code deployment.

**Email types requiring templates:**

| Email Type | Trigger | Key Variables |
|-----------|---------|---------------|
| **Daily Report Email** | BullMQ daily schedule. | Report date, report type, download link, report summary stats. |
| **Monthly Report Email** | BullMQ monthly schedule. | Report month, report type, download link, summary stats. |
| **Yearly Report Email** | BullMQ yearly schedule. | Report year, report type, download link, summary stats. |
| **Account Created** | Admin creates recruiter/RM account. | User name, email, temporary password (or login link), role. |
| **Password Reset** | Admin resets user's password. | User name, new temporary password (or reset link). |
| **Account Suspended** | Admin suspends user. | User name, reason (if provided), admin contact. |
| **Account Reactivated** | Admin reactivates user. | User name, login link. |
| **Account Lockout Notification** | 5 failed login attempts. | User name, lock timestamp, unlock time, admin contact. |
| **Device Lock Blocked** | Login from unauthorized device. | User name, attempted device info, admin contact. |

**Template management (Admin):**
- Dedicated "Email Templates" section within Admin Settings (Section 23.12) or as a standalone page.
- For each email type: editable subject line and body HTML.
- **Template editor:** Rich text editor (WYSIWYG) or HTML editor with preview.
- **Template variables:** Placeholders like `{{userName}}`, `{{reportDate}}`, `{{downloadLink}}` that are auto-replaced when the email is sent. List of available variables shown next to the editor per template type.
- **Branding elements:** Configurable logo URL, brand color, footer text (applied globally to all templates via a shared layout wrapper).
- **Preview & test:** "Send Test Email" button to send a preview to admin's email with sample data filled in.
- **Reset to default:** Each template can be reset to the system default.

**Implementation:**
- Templates stored in the `PlatformSetting` table (Section 23.12) or a dedicated `EmailTemplate` table: id, templateKey (unique — e.g., `daily_report`, `account_created`), subject (STRING with variable placeholders), bodyHtml (TEXT with variable placeholders), updatedAt, updatedBy.
- Rendering engine: use a template library (Handlebars, Mustache, or EJS) to replace variables at send time.
- Templates cached in Redis. Cache invalidated when admin updates a template.
- Fallback to hardcoded default templates if no custom template exists in the database.

---

### 23.14 Export from Data Tables

There's formal report generation (Section 20) but no quick export from any data table view. When viewing a filtered/sorted table, users should be able to export what they currently see without navigating to the reports page.

**Export availability by role:**

| Role | Where Export is Available |
|------|-------------------------|
| **Admin** | All data tables — candidate reports, user management, companies, service providers, HR managers, invoices, audit logs, duplicates, trash. |
| **Reporting Manager** | Assigned recruiters' candidate report data tables. |
| **Recruiter** | Own submitted candidate report data table. |

**Export behavior:**
- **"Export" button** visible above every data table (next to filter/search controls).
- Export respects the current state of the table: active filters, sorting, search query, column visibility. What you see is what you export.
- **Export scope options:**
  - "Export current page" — exports only the rows on the current paginated page.
  - "Export all filtered results" — exports all rows matching current filters (across all pages). For large datasets, triggers a background job (BullMQ) with a notification when ready.
- **Export format:** XLSX (primary), CSV (secondary option).
- **Column selection:** Before export, a modal allows the user to select/deselect which columns to include in the export.
- **File naming:** Auto-generated: `{entity_type}_{date}_{filter_summary}.xlsx` (e.g., `candidates_2026-03-27_status-pending.xlsx`).

**Implementation:**
- Small exports (< 1000 rows): generated on-the-fly, streamed to browser.
- Large exports (≥ 1000 rows): queued via BullMQ background job. User receives in-app notification with download link when ready. File temporarily stored on R2/Cloudinary (auto-cleaned after 24 hours).
- RBAC enforced: export API validates that the user has access to the data being exported.

---

### 23.15 User Activity Indicators — Live Status Tracker & Last Active System

A live status tracker (online/offline dot) for employees (recruiters and reporting managers) with "last active" timestamps, powered by **Firebase Realtime Database** and **Firebase Firestore**, and broadcast via **Socket.io** for real-time UI updates.

**Activity states:**

| State | Indicator | Criteria |
|-------|-----------|---------|
| **Online** | Green dot 🟢 | User has an active session AND has made an API request within the last 5 minutes. Firebase Realtime Database connection is active. |
| **Idle** | Yellow dot 🟡 | User has an active session BUT no API request in the last 5–30 minutes. |
| **Offline** | Gray dot ⚫ | No active session, or no API request in the last 30+ minutes. Firebase Realtime Database connection is disconnected. |

**"Last active" status:** Displayed next to offline and idle users — shows a human-readable relative timestamp of their most recent activity (e.g., "Last active 5 hours ago," "Last active 2 minutes ago," "Last active yesterday"). For online users, shows "Online now" or "Active now."

#### 23.15.1 Visibility Rules — Who Sees What

| Viewer | What They See | Details |
|--------|--------------|---------|
| **Admin** | Live status (online/offline dot) + last active status for **ALL employees** (all recruiters and all reporting managers). | Visible on: Admin Dashboard, Employees page (Section 6.4), User Management table, Admin Analytics "Active Users" widget. Admin sees every employee's live indicator and last active info. |
| **Reporting Manager** | Live status (online/offline dot) + last active status for **themselves** AND for **all recruiters assigned under them**. | Visible on: RM's own header (their own live indicator), My Recruiters page (Section 7), RM Team Dashboard (Section 23.4.2). Reporting Managers can see this last active info of recruiters assigned under them. |
| **Recruiter** | Live status (online/offline dot) for **themselves only** — shown in their **header** as a live indicator. | Visible on: Recruiter's own navigation header — a small dot next to their avatar indicating their own online status (green dot when connected). Recruiters **cannot see** other recruiters' or reporting managers' live status or last active info. Recruiters can't see last active info of anyone. |

#### 23.15.2 Where Live Indicators Are Displayed

| Location | Indicator | Who Sees |
|----------|-----------|----------|
| **Recruiter's own header (navigation bar)** | Green dot next to their avatar when online. Serves as a live connection indicator — confirms the recruiter's session is active and connected. | Recruiter (own status only). |
| **Reporting Manager's own header** | Green dot next to their avatar when online. Live indicator of their own connection status. | Reporting Manager (own status only). |
| **Admin's own header** | Green dot next to their avatar when online. | Admin (own status only). |
| **Admin → Employees page** | Status dot + last active for every employee row. | Admin. |
| **Admin → User Management table** | Status dot + last active for every recruiter/RM row. | Admin. |
| **Admin → Dashboard "Today's Logins" panel** | Status dot per employee in the login list. | Admin. |
| **Admin → Analytics "Active Users Right Now"** | Real-time count + list of online users. | Admin. |
| **RM → My Recruiters page** | Status dot + last active for each assigned recruiter row. | Reporting Manager. |
| **RM → Team Dashboard recruiter summary table** | Status dot + last active for each assigned recruiter. | Reporting Manager. |
| **RM → Team Attendance Snapshot** | Status dot in the team login list. | Reporting Manager. |

#### 23.15.3 Firebase Realtime Database — Presence System

**Firebase Realtime Database** is used for the core online/offline presence detection because it provides built-in connection state management via `.info/connected` and `onDisconnect()` hooks — which reliably detect when a user's browser tab closes, their network drops, or their device goes offline, even without an explicit logout.

**Presence architecture:**

```
Firebase Realtime Database structure:

/presence/{userId}
  ├── online: true/false
  ├── lastActiveAt: timestamp (server timestamp)
  ├── connectedAt: timestamp (when connection was established)
  └── metadata:
        ├── role: "RECRUITER" | "REPORTING_MANAGER"
        ├── deviceId: "abc-123"
        └── userAgent: "Mozilla/5.0..."
```

**Client-side implementation (Next.js):**

```typescript
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';

// On authenticated login, establish presence:
const presenceRef = ref(db, `/presence/${userId}`);
const connectedRef = ref(db, '.info/connected');

onValue(connectedRef, (snapshot) => {
  if (snapshot.val() === true) {
    // User is connected — set online
    set(presenceRef, {
      online: true,
      lastActiveAt: serverTimestamp(),
      connectedAt: serverTimestamp(),
      metadata: { role, deviceId, userAgent }
    });

    // When disconnected (tab close, network drop) — automatically set offline
    onDisconnect(presenceRef).set({
      online: false,
      lastActiveAt: serverTimestamp(),
      connectedAt: null,
      metadata: { role, deviceId, userAgent }
    });
  }
});
```

**Key behavior:**
- When the user opens the app and authenticates → Firebase Realtime Database connection is established → `online: true` is set.
- When the user closes the tab, navigates away, loses network, or their device sleeps → Firebase's `onDisconnect()` automatically fires → `online: false` is set, `lastActiveAt` is updated to the disconnect timestamp.
- This works reliably even without explicit logout — covers browser crashes, network drops, and tab closures.

#### 23.15.4 Firebase Firestore — Last Active Persistence & Querying

**Firebase Firestore** is used alongside Realtime Database for persistent storage and structured querying of presence data:

**Firestore structure:**

```
Collection: userPresence
Document: {userId}
  ├── isOnline: boolean
  ├── lastActiveAt: Firestore Timestamp
  ├── lastLoginAt: Firestore Timestamp
  ├── role: string
  └── assignedManagerIds: string[] (for query filtering)
```

**Why Firestore in addition to Realtime Database:**
- **Realtime Database** excels at connection state detection (`.info/connected`, `onDisconnect`), but has limited querying capabilities.
- **Firestore** provides structured queries needed by Admin and Reporting Managers — e.g., "show me all employees sorted by last active time," "filter by role = RECRUITER and status = offline," "get all recruiters assigned to RM-X who are currently online."
- **Sync mechanism:** When presence changes in Realtime Database (online → offline or vice versa), a Cloud Function or backend listener syncs the change to Firestore for queryable persistence.

**Querying examples:**

| Query | Used By | Firestore Query |
|-------|---------|----------------|
| All online employees | Admin | `where('isOnline', '==', true)` |
| All offline recruiters sorted by last active | Admin | `where('role', '==', 'RECRUITER').where('isOnline', '==', false).orderBy('lastActiveAt', 'desc')` |
| Online recruiters under a specific RM | Reporting Manager | `where('assignedManagerIds', 'array-contains', rmId).where('isOnline', '==', true)` |
| Last active time for a specific employee | Admin / RM | `doc(userId).get()` → `lastActiveAt` |

#### 23.15.5 Socket.io — Real-Time UI Broadcasts & Live Notifications

**Socket.io** is used alongside Firebase for broadcasting presence changes and live notifications to connected clients:

**Presence events via Socket.io:**

| Event | Payload | Recipients | Purpose |
|-------|---------|------------|---------|
| `presence:online` | `{ userId, role, timestamp }` | Admin (all), assigned RM(s) | User came online — update their dot to green. |
| `presence:idle` | `{ userId, role, timestamp }` | Admin (all), assigned RM(s) | User went idle — update their dot to yellow. |
| `presence:offline` | `{ userId, role, lastActiveAt }` | Admin (all), assigned RM(s) | User went offline — update their dot to gray, show "Last active X ago." |

**Socket.io for live notifications:**

Socket.io is the primary transport for all in-app live notifications (Section 11). When any notification is created (report submitted, leave request, document uploaded, KYC verified, attendance alert, etc.), it is pushed to the target user(s) via Socket.io in real-time — no polling required.

| Event | Payload | Recipients |
|-------|---------|------------|
| `notification:new` | Full notification object (id, title, message, type, createdAt). | Target user(s) — determined by notification type and role. |
| `notification:read` | `{ notificationId }` | The user who read it (sync across tabs). |
| `notification:count` | `{ unreadCount }` | Target user — updated unread badge count. |

**Integration of Socket.io with Firebase:**
- Firebase Realtime Database handles the **source of truth** for presence (connection detection, onDisconnect).
- When Firebase detects a presence change → backend listener picks it up → emits the corresponding Socket.io event to Admin and relevant RM rooms.
- Socket.io handles the **delivery** of presence change events to connected admin/RM clients for instant UI dot updates.
- Socket.io also handles all other real-time events (notifications, analytics updates, session revocations) as already defined in Section 24.10.

#### 23.15.6 Last Active Display Format

The "last active" status is displayed as a human-readable relative time string:

| Time Since Last Active | Display |
|-----------------------|---------|
| 0–1 minutes | "Active now" or "Online now" (with green dot). |
| 1–59 minutes | "Last active X minutes ago" (e.g., "Last active 5 minutes ago"). |
| 1–23 hours | "Last active X hours ago" (e.g., "Last active 5 hours ago"). |
| 1–6 days | "Last active X days ago" (e.g., "Last active 2 days ago"). |
| 7+ days | "Last active on [date]" (e.g., "Last active on 15 Mar 2026"). |

- The relative time updates dynamically on the client (recalculated every minute via a client-side timer — no server roundtrip needed for display updates).
- Stored as an absolute timestamp in Firebase; converted to relative display on the client.

#### 23.15.7 Privacy & Access Control

| Rule | Enforcement |
|------|-------------|
| **Recruiters cannot see other recruiters' status** | Firebase security rules + backend API authorization: recruiters can only read their own `/presence/{userId}` node. Firestore rules restrict recruiter queries to their own document. |
| **Reporting Managers see only assigned recruiters** | Firestore queries filtered by `assignedManagerIds`. Firebase security rules enforce that RMs can only read presence for users where their ID is in the assigned managers list. |
| **Admin sees all** | Admin has unrestricted read access to all presence data. |
| **Recruiters can't see last active info of anyone** | Last active display is only rendered for Admin and RM views. Recruiter UI only shows their own connection indicator (green dot in header) — no last active text for anyone. |
| **Firebase security rules** | Server-side Firebase security rules enforce all access control. Client-side filtering is supplemental, not authoritative. |

---

### 23.16 Backup Codes for Device Lock

If a recruiter's device breaks or localStorage + cookies are lost, they're completely locked out until Admin manually resets (Section 22.9). There should be one-time backup codes that allow emergency login from a new device without admin intervention.

**Backup code system:**

| Aspect | Specification |
|--------|---------------|
| **Generation** | 8 one-time backup codes generated when Admin creates a recruiter/RM account. |
| **Format** | 8-character alphanumeric codes (e.g., `A3F7-K9M2`). |
| **Storage** | Hashed (bcrypt) in the database — plaintext codes are shown ONCE at generation and never again. |
| **Delivery** | Displayed to Admin at account creation time. Admin can download codes as PDF or copy them. Admin provides codes to the recruiter (out-of-band — verbal, printed, or secure channel). |
| **Usage** | When login is blocked due to device mismatch, the login form shows a "Use backup code" link. User enters their Employee ID + password + backup code (instead of deviceId). For Admin: email + password + backup code. |
| **Effect** | Successful backup code login: (1) invalidates the used backup code (one-time use), (2) binds the current device as the new locked device, (3) creates a new session. |
| **Regeneration** | Admin can regenerate a fresh set of 8 backup codes for any user (invalidates all previous codes). |
| **Audit trail** | Backup code usage logged in LoginHistory (Section 22.16) with `loginMethod: "backup_code"`. |
| **Notification** | When a backup code is used, Admin receives an in-app notification with: user name, timestamp, new device info. |

**Database:**
- `UserBackupCode` table: id, userId (FK → User), codeHash (STRING — bcrypt hash), isUsed (Boolean, default false), usedAt (DateTime, nullable), createdAt.
- 8 rows per user (one per code). On regeneration, delete all existing rows and insert 8 new ones.

---

### 23.17 Print View

No print functionality. Admin may need to print candidate profiles, interview sheets, or specific report pages. A print-optimized CSS layout (or PDF generation from individual records) is missing.

**Printable content:**

| Content | Who Can Print | Format |
|---------|--------------|--------|
| **Individual candidate profile** | Admin | Print-optimized single-page layout with all 48 fields formatted cleanly. |
| **Candidate interview sheet** | Admin | Subset of candidate fields formatted as an interview preparation sheet (name, contact, experience, qualification, remarks). |
| **Data table (current page)** | Admin, Reporting Manager | Print the currently visible data table page with active filters. |
| **Invoice** | Admin | Single invoice formatted as a printable document (company name, candidate, invoice number, amounts, dates). |
| **Report summary** | Admin | Summary statistics page (KPIs, chart snapshots) formatted for print. |

**Implementation:**
- **CSS print stylesheet:** `@media print` styles that hide navigation, sidebar, action buttons, and reformat content for paper (A4 or Letter size).
- **"Print" button** on relevant pages (candidate detail, invoice detail, data tables). Triggers `window.print()` with print-optimized layout active.
- **PDF generation (alternative):** For candidate profiles and invoices, offer a "Download PDF" option that generates a PDF server-side (using Puppeteer, jsPDF, or a PDF library) and downloads it. Useful for sharing without printing.
- **Print header/footer:** Include platform name, print date, page numbers in the print layout.

---

### 23.18 Onboarding / In-App Help System

No guidance for new users. Recruiters and Reporting Managers (whose accounts are created by Admin) log in for the first time to an unfamiliar platform. Needs first-login guidance and ongoing help access.

**First-login onboarding tour:**

| Step | Screen | Description |
|------|--------|-------------|
| 1 | **Welcome modal** | "Welcome to OMG Teams, [Name]! Let us show you around." with "Start Tour" and "Skip" buttons. |
| 2 | **Dashboard overview** | Highlight the dashboard area, explain KPI cards and what they show. |
| 3 | **Add Report** | Highlight the "Add Report" button, explain zone selection and the form. |
| 4 | **My Reports** | Highlight the data table, explain how to view, filter, and search their submissions. |
| 5 | **Profile** | Highlight profile photo upload and account settings. |
| 6 | **Notifications** | Highlight the notification bell and explain what notifications they'll receive. |
| 7 | **Help** | Highlight the help section for future reference. |

- Tour uses a spotlight/tooltip overlay library (e.g., `react-joyride`, `intro.js`, `driver.js`).
- Tour is shown only on first login (tracked via `hasCompletedOnboarding` flag on User model).
- User can restart the tour anytime from the help section.
- Different tour steps for Recruiter vs Reporting Manager vs Admin (role-specific).

**Contextual tooltips on complex form fields:**
- Info icon (ℹ️) next to complex or ambiguous form fields.
- Hover/click reveals a tooltip with an explanation. Examples:
  - "Is off-roll nature of job okay with candidate?" → "Off-roll means the candidate will be employed through a third-party staffing agency, not directly by the company. Confirm the candidate understands and accepts this arrangement."
  - "Is the on-roll opportunity explained with 18 months clause?" → "On-roll conversion may be available after 18 months of service. Confirm this has been communicated to the candidate."
  - "Communication skills rate by scale of 10" → "Rate the candidate's verbal communication skills during your screening call. 1 = very poor, 5 = average, 10 = excellent."

**Help / FAQ section:**
- Accessible from the sidebar navigation (all roles).
- Organized by role: "For Recruiters," "For Reporting Managers," "For Admins."
- Content: FAQ-style Q&A covering common tasks — "How do I submit a report?", "How do I filter my data?", "What does each status mean?", "Who do I contact if I'm locked out?"
- Searchable.
- Admin can edit help content from the Admin Settings page (Section 23.12) or a dedicated CMS-like help editor.

---

### 23.19 Admin Configurable Dropdown Options

Dropdown values for fields like State, Location, Profile, Higher Qualification, Notice Period are mentioned in the form but there's no mechanism for Admin to manage these lists. Currently they'd be hardcoded. Admin needs a "Master Data" or "Dropdown Management" page to add/edit/remove/reorder dropdown options without code changes.

**Configurable dropdown fields:**

| Dropdown Field | Zone-Dependent? | Notes |
|---------------|-----------------|-------|
| **State** | No | Single list used across all zones. |
| **Location** | Yes | Different location options per zone set (Set A vs Set B). |
| **Profile** | Yes | Different profile options per zone set. |
| **Higher Qualification** | No | Single list (e.g., 10th, 12th, Diploma, Graduate, Post-Graduate, MBA, etc.). |
| **Notice Period** | No | Single list (e.g., Immediate, 15 Days, 30 Days, 60 Days, 90 Days). |
| **Diploma Part / Full** | No | Fixed: Part, Full (unlikely to change, but configurable for consistency). |
| **Feedback from HR** | No | Fixed: Rejected, Hold, Profile Closed (configurable for extensibility). |
| **Payment Status** | No | List of payment status options (e.g., Paid, Pending, Partial, Overdue). |

**Master Data management page (Admin):**
- Dedicated "Master Data" or "Dropdown Options" page in Admin sidebar.
- For each dropdown field: a list view showing all current options.
- **Actions per option:** Edit label, Reorder (drag-and-drop or up/down arrows), Deactivate (hide from dropdowns without deleting — preserves historical data integrity), Delete (only if not referenced by any existing record).
- **Add new option:** Inline "Add" button at the bottom of each list.
- **Zone-dependent dropdowns:** For Location and Profile, options are organized under zone set tabs (Set A / Set B). Admin adds options to specific zone sets.
- **Sync:** Changes take effect immediately across all forms and roles (dropdown options served from database, cached in Redis with invalidation on change).

**Database:**
- `MasterDropdownOption` table: id, fieldKey (STRING — e.g., `state`, `location`, `profile`, `higher_qualification`, `notice_period`, `diploma_type`, `hr_feedback`, `payment_status`), label (STRING — display text), value (STRING — stored value), zoneSet (ENUM: `ALL` / `SET_A` / `SET_B` — `ALL` for non-zone-dependent fields), sortOrder (INTEGER — for custom ordering), isActive (BOOLEAN — default true), createdAt, updatedAt.
- Index on `fieldKey` + `zoneSet` + `isActive` for fast dropdown population queries.
- All form dropdown fields pull options from this table (filtered by `fieldKey`, `zoneSet`, and `isActive = true`, ordered by `sortOrder`).

---

## 24. DEVELOPMENT, ARCHITECTURE & TECH-STACK STANDARDS

### 24.1 Environment Configuration

No mention of `.env` management, environment separation (development, staging, production), or config management strategy.

**Environment strategy:**

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| **Development** | Local development and debugging. | Local PostgreSQL, local Redis, hot reload, verbose logging, no SSL. |
| **Staging** | Pre-production testing, QA. | Cloud-hosted (mirrors production), test data, full SSL, relaxed rate limits. |
| **Production** | Live platform. | Cloud-hosted, real data, strict security, full monitoring. |

**`.env` management:**
- Separate `.env` files per environment: `.env.development`, `.env.staging`, `.env.production`.
- `.env.example` committed to repo with all required variables (no values — placeholder descriptions only).
- Actual `.env` files are in `.gitignore` — never committed.
- Required environment variables (non-exhaustive): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CLOUDINARY_URL` / `R2_ENDPOINT` + `R2_ACCESS_KEY` + `R2_SECRET_KEY`, `NEXT_PUBLIC_API_URL` (production: `https://api.opportunitymakers.in`), `CORS_ORIGIN` (production: `https://teams.opportunitymakers.in`), `NODE_ENV`.
- Validation: on app startup, validate that all required env vars are present and correctly formatted (use Zod schema validation on env vars). Fail fast with clear error messages if any are missing.

---

### 24.2 Error Handling Strategy

No global error handling plan. The platform needs a consistent, predictable error handling approach across frontend and backend.

**Backend (Express):**

- **Global error handler middleware** — catches all unhandled errors. Returns standardized error response. Logs the error with stack trace (never exposes stack trace to client in production).
- **Standardized API error response format:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Contact number is required.",
    "details": [
      { "field": "contactNo", "message": "This field is required." }
    ]
  },
  "statusCode": 400
}
```

- **Error code taxonomy:** `VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `NOT_FOUND`, `DUPLICATE_ENTRY`, `DEVICE_MISMATCH`, `ACCOUNT_SUSPENDED`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.
- **Async error catching:** all async route handlers wrapped with a try-catch utility or Express async error handler (e.g., `express-async-errors`).
- **Prisma error mapping:** Prisma-specific errors (unique constraint violation, record not found, etc.) mapped to standardized error codes before reaching the client.

**Frontend (Next.js):**

- **Error boundaries** — React error boundaries at the layout level to catch rendering errors. Show a fallback UI (not a white screen). Implemented via Next.js App Router `error.tsx` (route-level — Section 24.19.9) and `global-error.tsx` (root-level last-resort — Section 24.19.10).
- **API error interceptor** — centralized fetch/axios interceptor that parses standardized error responses and triggers appropriate UI feedback via the toast system (Section 24.19.11).
- **Client-side error toasts** — robust toast notifications for non-critical errors (e.g., "Failed to save draft"). Modal dialogs for critical errors (e.g., "Session expired — please login again"). Full toast specification in Section 24.19.11.
- **Network error handling** — detect offline state via service worker (Section 24.19.12), show connectivity banner, serve offline fallback page (Section 24.19.13), queue failed requests for retry.
- **Loading states** — skeleton loading system (Section 24.19.8) for data-heavy pages, spinner component (Section 24.19.7) for inline loading, `loading.tsx` (Section 24.19.6) for route transitions.
- **404 handling** — custom `not-found.tsx` (Section 24.19.5) for invalid routes.

---

### 24.3 Logging Strategy

No structured logging mentioned. The platform needs structured, queryable logs for debugging production issues.

**Logging framework:** Winston or Pino (Pino preferred for performance in Node.js).

**Log levels:**

| Level | Usage |
|-------|-------|
| `error` | Application errors, unhandled exceptions, failed critical operations. |
| `warn` | Degraded performance, retry attempts, deprecated feature usage, rate limit near-threshold. |
| `info` | Successful operations, request/response summaries, job completions, user actions. |
| `debug` | Detailed diagnostic info — query details, intermediate computation, variable states. Only enabled in development/staging. |

**Log format:** Structured JSON logs (not plain text). Each log entry includes:
- `timestamp` (ISO 8601, UTC)
- `level` (error / warn / info / debug)
- `message` (human-readable summary)
- `service` (backend / worker / scheduler)
- `requestId` (unique per HTTP request — for tracing)
- `userId` (if authenticated request)
- `method` + `path` (for HTTP requests)
- `duration` (response time in ms)
- `error` (stack trace, only for error level)

**Log rotation:** Daily rotation, retain 30 days of logs, compress older files (gzip).

**Centralized log aggregation (optional but recommended):** Ship logs to a centralized service for searching and alerting — e.g., Grafana Loki, Datadog, or a self-hosted ELK stack. Particularly important for debugging production issues across multiple services.

---

### 24.4 Testing Strategy

Zero mention of testing. The platform needs a multi-layer testing strategy.

**Testing layers:**

| Layer | Tool | Coverage Target | What to Test |
|-------|------|----------------|-------------|
| **Unit tests** | Jest or Vitest | 80%+ | Business logic functions, utility functions, validation schemas, data transformations, invoice number generation, duplicate detection logic, target calculation. |
| **Integration tests** | Jest/Vitest + Supertest | Key endpoints | API endpoints end-to-end (request → middleware → controller → service → database → response). Auth flows, RBAC enforcement, device lock flow, bulk operations, report generation. |
| **E2E tests** | Playwright or Cypress | Critical user flows | Login flow (with Turnstile bypass for test), recruiter report submission, admin user management, admin report generation, bulk operations, form auto-save/draft resume. |

**Testing infrastructure:**
- **Test database:** Separate PostgreSQL instance (or schema) for tests. Seeded with deterministic test data before each test suite. Cleaned/reset between test suites.
- **Test Redis:** Separate Redis instance or namespace for tests.
- **Mock external services:** Mock SMTP (no actual emails sent during tests), mock Cloudinary/R2 uploads, mock Turnstile verification.
- **CI integration:** All tests run in the CI/CD pipeline (Section 24.5). Build fails if any test fails or coverage drops below threshold.

---

### 24.5 CI/CD Pipeline

No deployment automation. The platform needs automated build, test, and deploy workflows.

**Tool:** GitHub Actions (or equivalent).

**Pipeline stages:**

| Stage | Trigger | Actions |
|-------|---------|---------|
| **Lint** | On every push and PR | Run ESLint (backend + frontend), Prettier check, TypeScript type check (`tsc --noEmit`). |
| **Test** | On every push and PR | Run unit tests, integration tests. Run E2E tests on PRs to `main`/`staging`. |
| **Build** | On push to `main` or `staging` | Build Next.js frontend, compile TypeScript backend, generate Prisma client. |
| **Deploy (staging)** | On push to `staging` branch | Auto-deploy frontend to Vercel preview, backend to Render staging, run database migrations. |
| **Deploy (production)** | On push to `main` branch (or manual trigger) | Auto-deploy frontend to Vercel production, backend to Render production, run database migrations. |

**Pipeline requirements:**
- Build fails fast on lint errors or test failures — no deployment if quality gates fail.
- Database migrations run automatically as part of deployment (`prisma migrate deploy`).
- Environment-specific secrets stored in GitHub Actions secrets (never in code).
- Deployment notifications sent to team (Slack/email) on success or failure.
- Rollback procedure documented: revert to previous deployment via Vercel/Render dashboard or git revert.

---

### 24.6 Docker / Containerization

No containerization strategy. The entire stack (Next.js, Express, PostgreSQL, Redis, Nginx) should be containerized with Docker + Docker Compose for consistent environments.

**Containerization scope:**

| Service | Container | Purpose |
|---------|-----------|---------|
| **Frontend (Next.js)** | `OMG Teams-frontend` | Next.js application. Multi-stage build (build stage + production stage with minimal image). |
| **Backend (Express)** | `OMG Teams-backend` | Express + TypeScript application. Multi-stage build. |
| **PostgreSQL** | `OMG Teams-db` | Database. Uses official `postgres:16` image. Volume-mounted for data persistence. |
| **Redis** | `OMG Teams-redis` | Cache, sessions, BullMQ. Uses official `redis:7` image. Volume-mounted for persistence. |
| **Nginx** | `OMG Teams-nginx` | Reverse proxy, SSL termination, static file serving. Custom config mounted. |
| **BullMQ Worker** | `OMG Teams-worker` | Separate container running BullMQ workers (report generation, email sending, cleanup jobs). Same codebase as backend, different entry point. |

**Docker Compose:**
- `docker-compose.yml` for local development — all services with hot reload, exposed debug ports.
- `docker-compose.production.yml` for production-like local testing — optimized builds, no debug ports.
- Shared network for inter-container communication.
- Named volumes for database and Redis data persistence.
- Health checks on all services.

**Dockerfiles:**
- Multi-stage builds to minimize image size.
- `.dockerignore` to exclude `node_modules`, `.env`, test files, docs.
- Non-root user in production containers (security best practice).
- Specific Node.js version pinned (e.g., `node:20-alpine`).

---

### 24.7 API Documentation

No mention of documenting the backend API. Swagger/OpenAPI spec should be auto-generated for all endpoints.

**Implementation:**

| Aspect | Specification |
|--------|---------------|
| **Standard** | OpenAPI 3.0 (Swagger). |
| **Generation** | Auto-generated from route definitions and Zod validation schemas. Use `swagger-jsdoc` or `tsoa` or `zod-to-openapi`. |
| **Swagger UI** | Hosted at `/api/docs` (development and staging only — disabled in production or behind admin auth). |
| **Content** | Every endpoint documented with: HTTP method, path, description, request body schema, query params, response schema (success + error), authentication requirements, role restrictions. |
| **Maintenance** | Documentation auto-updates when routes or schemas change — no manual doc maintenance. |
| **Export** | OpenAPI JSON/YAML spec downloadable for use with Postman, Insomnia, or code generators. |

---

### 24.8 Database Backup & Disaster Recovery

No backup strategy. The platform needs automated backups and a tested recovery procedure.

**PostgreSQL backups:**

| Aspect | Configuration |
|--------|---------------|
| **Tool** | `pg_dump` (logical backups) via scheduled BullMQ job or cron. |
| **Frequency** | Daily full backup. Hourly incremental WAL archiving (if supported by hosting provider — Neon/Supabase may handle this natively). |
| **Retention** | Keep daily backups for 30 days. Keep weekly backups for 6 months. Keep monthly backups for 2 years. |
| **Storage** | Backups stored in a separate cloud storage bucket (R2 or S3), NOT on the same server as the database. |
| **Encryption** | Backups encrypted at rest (using cloud storage encryption). |
| **Restore procedure** | Documented step-by-step restore process. Tested quarterly (restore backup to a test instance, verify data integrity). |

**Redis persistence config:**

| Setting | Value |
|---------|-------|
| **RDB snapshots** | Every 5 minutes if 100+ keys changed (configurable). |
| **AOF (Append Only File)** | Enabled, `appendfsync everysec` for balance between durability and performance. |
| **Redis Cloud** | If using Redis Cloud (Section 26.1), persistence is managed by the provider — verify settings. |

**Disaster recovery plan:**
- **RTO (Recovery Time Objective):** < 1 hour for full service restoration.
- **RPO (Recovery Point Objective):** < 1 hour of data loss maximum (hourly WAL or cloud-managed backups).
- Runbook documented with exact steps for: database restore, Redis restore, application redeployment, DNS failover.

---

### 24.9 API Rate Limiting (Application Level)

Nginx rate limiting is mentioned (Section 16), but no application-level rate limiting per user/role/endpoint. Application-level rate limiting is needed for granular control.

**Rate limit tiers:**

| Role / Endpoint | Limit | Window |
|----------------|-------|--------|
| **Login endpoint** (all roles) | 5 attempts per minute per IP. | 1 minute. After 5 fails → account lockout (Section 25.1). |
| **Recruiter — report submission** | Max 100 reports per day per recruiter. | 24 hours (rolling). |
| **Recruiter — API calls (general)** | 200 requests per minute. | 1 minute. |
| **Reporting Manager — API calls** | 300 requests per minute. | 1 minute. |
| **Admin — API calls** | 500 requests per minute. | 1 minute. |
| **Bulk operations** | 5 bulk actions per minute per admin. | 1 minute. |
| **File upload** | 10 uploads per minute per user. | 1 minute. |
| **Report generation** | 10 report generations per minute per admin. | 1 minute. |

**Implementation:**
- Use Redis-based rate limiter (e.g., `rate-limiter-flexible` or `express-rate-limit` with Redis store).
- Rate limits enforced at the middleware level, before business logic executes.
- Rate limit info returned in response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- When limit exceeded: return `429 Too Many Requests` with standardized error response (Section 24.2).

---

### 24.10 WebSocket / SSE Setup — Socket.io for Live Notifications & Real-Time Events

Analytics section (Section 21) mentions real-time updates via WebSocket/SSE but there's no dedicated specification for the real-time communication layer.

**Technology choice:** **Socket.io** is the primary real-time communication layer for the platform. Socket.io is used for:
- **Live notifications** — all in-app notifications (Section 11) are pushed to connected clients in real-time via Socket.io. No polling required.
- **Presence state broadcasts** — online/offline/idle status changes detected by Firebase Realtime Database are broadcast to Admin and RM clients via Socket.io events (Section 23.15.5).
- **Analytics live updates** — real-time KPI counters, live submission counts, active user updates on the Admin Analytics page.
- **Session control events** — force-logout, session revocation, device reset signals pushed to affected users instantly.
- **All other push-based events** — report status changes, leave approvals, document verifications, attendance alerts.

**Socket.io is used alongside Firebase** (Section 23.15): Firebase Realtime Database handles presence detection (connection state, onDisconnect). Socket.io handles event delivery to UI clients. Both work together — Firebase is the source of truth for presence, Socket.io is the transport for broadcasting changes and notifications.

**Real-time events to broadcast:**

| Event | Payload | Recipients |
|-------|---------|------------|
| `report:submitted` | Recruiter name, count, timestamp. | Admin, assigned Reporting Managers. |
| `report:statusChanged` | Record ID, old status, new status. | Admin, assigned Reporting Managers. |
| `analytics:update` | Updated KPI values, live counters. | Admin (analytics page). |
| `notification:new` | Notification object. | Target user(s). |
| `session:revoked` | Session ID, user ID. | Affected user (force logout on client). |
| `user:suspended` | User ID. | Affected user (force logout on client). |
| `device:reset` | User ID. | Affected user (force logout on client). |

**Authentication for WebSocket connections:**
- WebSocket connections authenticated using the same JWT/session cookie as HTTP requests.
- On connection: validate token, extract userId and role, join appropriate rooms.
- On token expiry: disconnect client, client auto-reconnects with refreshed token.

**Reconnection strategy:**
- Client auto-reconnects on disconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s).
- On reconnect: re-join rooms, fetch missed events since last received timestamp.

**Server-side architecture:**
- Redis Pub/Sub as the backend broadcast mechanism (allows horizontal scaling — multiple backend instances share events via Redis).
- Socket.io with Redis adapter (`@socket.io/redis-adapter`) for multi-instance support.

---

### 24.11 File Upload Infrastructure

Profile photos (Section 13) need a defined upload pipeline with proper validation, security, and delivery.

**Upload pipeline:**

| Step | Description |
|------|-------------|
| 1. **Client validation** | Validate file type and size on the client before uploading (fail fast, save bandwidth). |
| 2. **Server validation** | Re-validate file type (check magic bytes, not just extension), file size, dimensions (for images). |
| 3. **Virus/malware scanning** | Scan uploaded files for malware. Use ClamAV (self-hosted) or a cloud-based scanning API. Reject infected files with clear error message. |
| 4. **Processing** | For images: resize/compress to standard dimensions (e.g., 200×200 for avatars, max 1MB). Strip EXIF metadata (privacy). |
| 5. **Storage** | Upload processed file to Cloudinary or R2. Generate a unique filename (UUID-based, not user-supplied). |
| 6. **CDN** | Serve files via CDN for performance (Cloudinary CDN or Cloudflare CDN in front of R2). |

**File constraints:**

| Constraint | Value |
|-----------|-------|
| **Allowed image types** | JPEG, PNG, WebP. |
| **Max file size (images)** | 5MB (configurable). |
| **Max dimensions** | 4096×4096 pixels (reject larger). |
| **Storage naming** | `uploads/{entityType}/{entityId}/{uuid}.{ext}` (e.g., `uploads/profile/user-abc/550e8400.jpg`). |

**Security:**
- File type validated by magic bytes (not just MIME type or extension — these can be spoofed).
- No user-supplied filenames stored — always UUID-generated names.
- Presigned URLs for direct-to-cloud uploads (recommended for large files) or server-side proxy upload (simpler, acceptable for profile photos).
- Uploaded files served from a separate domain/subdomain (prevents cookie leakage if serving from CDN).
- Content-Disposition header set to prevent browser from executing uploaded files.

---

### 24.12 Health Check Endpoints

No `/health` or `/ready` endpoints specified for load balancers, monitoring, and container orchestration.

**Endpoints:**

| Endpoint | Purpose | Checks | Response |
|----------|---------|--------|----------|
| `GET /health` | **Liveness probe.** Is the process alive and accepting requests? | Process is running, HTTP server is listening. | `200 OK` with `{ "status": "ok", "uptime": 12345 }`. No external dependency checks. |
| `GET /ready` | **Readiness probe.** Is the service ready to handle real traffic? | PostgreSQL connection active, Redis connection active, Prisma client connected. | `200 OK` if all dependencies healthy. `503 Service Unavailable` if any dependency is down, with details of which dependency failed. |

**Implementation:**
- Both endpoints are unauthenticated (no JWT required — load balancers and monitoring tools need access).
- `/health` must always respond fast (< 50ms) — no database queries.
- `/ready` checks external dependencies with timeout (e.g., 2-second timeout per dependency check).
- Response format:

```json
{
  "status": "ok",
  "uptime": 123456,
  "timestamp": "2026-03-27T10:00:00Z",
  "dependencies": {
    "postgresql": "connected",
    "redis": "connected",
    "prisma": "connected"
  }
}
```

- Used by: Docker health checks, Render/Vercel health monitoring, external uptime monitors (Section 26.3).

---

### 24.13 Database Connection Pooling

No mention of Prisma connection pool configuration or PgBouncer for production PostgreSQL performance.

**Prisma connection pooling:**

| Setting | Development | Production |
|---------|-------------|------------|
| `connection_limit` | 5 | 20–50 (based on hosting plan limits). |
| `pool_timeout` | 10s | 10s |
| `connect_timeout` | 5s | 5s |

**Configuration via `DATABASE_URL`:**
```
postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10&connect_timeout=5
```

**Neon/Supabase considerations (Section 26.1):**
- **Neon:** Uses serverless connection pooling natively (HTTP-based or WebSocket-based). Configure Prisma to use Neon's pooler URL (`:5432` for session mode, `:6543` for transaction mode). Use transaction mode for short-lived serverless connections.
- **Supabase:** Built-in PgBouncer connection pooler on port 6543. Use the pooler URL for the backend, direct URL only for migrations.

**PgBouncer (if self-hosted PostgreSQL):**
- Run PgBouncer as a connection proxy between the application and PostgreSQL.
- Mode: `transaction` (recommended for web apps — connections returned to pool after each transaction).
- Max client connections: 200. Max server connections: 20 (matches PostgreSQL `max_connections`).

**BullMQ workers:**
- Workers use a separate connection pool (not shared with the HTTP server) to prevent job processing from starving API requests.

---

### 24.14 Error Tracking Service (Sentry)

Logging (Section 24.3) covers server-side structured logs, but there's no client-side or server-side error tracking service. Sentry (or equivalent like Bugsnag) captures unhandled exceptions, stack traces, breadcrumbs, user context, and groups errors by frequency — fundamentally different from log files. Critical for production debugging.

**Implementation:**

| Layer | Integration |
|-------|------------|
| **Backend (Express)** | Install `@sentry/node`. Initialize Sentry with DSN at app startup. Sentry error handler middleware added AFTER all routes (catches unhandled exceptions). Attach user context (userId, role) to each event. Attach request context (method, path, query params). Environment tag (development/staging/production). |
| **Frontend (Next.js)** | Install `@sentry/nextjs`. Initialize in `sentry.client.config.ts` and `sentry.server.config.ts`. Captures: unhandled JS errors, unhandled promise rejections, React rendering errors (error boundary integration). Attach user context (userId, role) on login. Source maps uploaded to Sentry during build for readable stack traces. |
| **BullMQ Workers** | Install `@sentry/node` in the worker process. Wrap job handlers with Sentry error capturing. Attach job metadata (job name, queue name, job data) to error context. |

**Configuration:**

| Setting | Value |
|---------|-------|
| **Sample rate (errors)** | 1.0 (capture 100% of errors). |
| **Sample rate (performance/transactions)** | 0.1–0.2 in production (10–20% of transactions for performance monitoring — configurable). |
| **Environment** | `development`, `staging`, `production` (from `NODE_ENV`). |
| **Release tracking** | Tag each Sentry event with the git commit SHA or version number. Enables: regression detection, release health monitoring. |
| **Alerting** | Configure Sentry alerts: notify on new error types (first occurrence), notify on error rate spikes, weekly error summary digest. Channels: email + Slack/Discord. |

**What Sentry provides that logs don't:**
- Automatic error grouping (similar errors consolidated, not scattered across log files).
- Breadcrumbs (sequence of events leading to the error — clicks, navigation, API calls).
- User impact metrics (how many users affected by each error).
- Release tracking (which deploy introduced a new error).
- Performance monitoring (slow transactions, database query bottlenecks).

---

### 24.15 Database Indexing Strategy

Indexes are mentioned briefly (Section 17: "indexes on recruiterId, companyId, createdAt, zone, status") but there's no comprehensive indexing plan. Proper indexing is critical for query performance as data grows.

**Single-column indexes:**

| Table | Column | Rationale |
|-------|--------|-----------|
| `CandidateReport` | `recruiterId` | Recruiter self-view, RM assigned view. |
| `CandidateReport` | `companyId` | Company-filtered views and reports. |
| `CandidateReport` | `createdAt` | Date-range queries, sorting by date. |
| `CandidateReport` | `zone` | Zone-wise filtering and reports. |
| `CandidateReport` | `status` | Status-based filtering. |
| `CandidateReport` | `pipelineStage` | Pipeline stage filtering (Section 23.11). |
| `CandidateReport` | `contactNo` | Duplicate detection (Section 23.3). |
| `CandidateReport` | `emailId` | Duplicate detection. |
| `Company` | `name` | Company search/dropdown. |
| `ServiceProvider` | `companyId` | Relational dropdown filtering. |
| `HRManager` | `companyId` | Relational dropdown filtering. |
| `AuditLog` | `userId` | Audit log filtering by user. |
| `AuditLog` | `entityType` | Audit log filtering by entity. |
| `AuditLog` | `timestamp` | Audit log date-range queries. |
| `Notification` | `userId` | User's notification list. |
| `LoginHistory` | `userId` | Login history per user. |

**Composite indexes (multi-column — for common query patterns):**

| Table | Columns | Query Pattern |
|-------|---------|--------------|
| `CandidateReport` | `(recruiterId, createdAt)` | Recruiter self-view sorted by date. |
| `CandidateReport` | `(companyId, status)` | Company-filtered status views. |
| `CandidateReport` | `(companyId, createdAt)` | Company-filtered date-range reports. |
| `CandidateReport` | `(zone, createdAt)` | Zone-wise date-range reports. |
| `CandidateReport` | `(recruiterId, pipelineStage)` | Recruiter's records by pipeline stage. |
| `CandidateReport` | `(status, createdAt)` | Status-filtered date-range queries. |
| `AuditLog` | `(entityType, entityId)` | View audit trail for a specific record. |
| `AuditLog` | `(userId, timestamp)` | View a user's actions over time. |
| `Notification` | `(userId, isRead, createdAt)` | Unread notifications for a user, ordered by date. |
| `RecruiterManagerAssignment` | `(managerId, removedAt)` | Active assignments for an RM. |

**Partial indexes (filtered — for performance on frequent subset queries):**

| Table | Condition | Rationale |
|-------|-----------|-----------|
| `CandidateReport` | `WHERE deletedAt IS NULL` | Exclude soft-deleted records from all default queries. |
| `CandidateReport` | `WHERE status = 'PENDING'` | Fast count of pending records (KPI cards). |
| `CandidateReport` | `WHERE pipelineStage = 'SOURCED'` | Fast access to new/unprocessed candidates. |
| `UserBackupCode` | `WHERE isUsed = false` | Quick lookup of available backup codes. |

**GIN indexes (for JSONB and full-text search):**

| Table | Column | Type | Rationale |
|-------|--------|------|-----------|
| `AuditLog` | `changes` | GIN | Query within JSONB change details. |
| `CandidateReportDraft` | `formData` | GIN | Query within draft JSONB data (if needed). |
| `CandidateReport` | `candidateName` | GIN (tsvector) | Full-text search (Section 23.10). |
| `Company` | `name` | GIN (tsvector) | Full-text search. |

**Indexing rules:**
- Create indexes during initial migration — do not add them as afterthoughts.
- Monitor query performance via `EXPLAIN ANALYZE` during development. Add indexes for any query with sequential scans on large tables.
- Avoid over-indexing: each index adds write overhead. Only index columns used in WHERE, JOIN, ORDER BY, or GROUP BY clauses of frequent queries.
- Review and optimize indexes quarterly as query patterns evolve.

---

### 24.16 Performance Budgets / SLAs

No defined performance targets. The platform needs explicit performance budgets for accountability and monitoring.

**API performance targets:**

| Endpoint Category | Target (p95) | Max Acceptable |
|-------------------|-------------|----------------|
| **Simple reads** (get user, get single record) | < 200ms | < 500ms |
| **List endpoints** (paginated data tables) | < 500ms | < 1000ms |
| **Search endpoints** (global search, filtered queries) | < 500ms | < 1500ms |
| **Write operations** (create/update record) | < 300ms | < 800ms |
| **Bulk operations** (bulk edit/delete < 100 records) | < 2000ms | < 5000ms |
| **Report generation** (on-the-fly, < 10,000 rows) | < 5000ms | < 15,000ms |
| **Authentication** (login, token refresh) | < 300ms | < 800ms |

**Frontend performance targets:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| **First Contentful Paint (FCP)** | < 1.5s | Lighthouse / Web Vitals. |
| **Largest Contentful Paint (LCP)** | < 2.5s | Lighthouse / Web Vitals. |
| **Time to Interactive (TTI)** | < 3.0s | Lighthouse / Web Vitals. |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Lighthouse / Web Vitals. |
| **First Input Delay (FID)** | < 100ms | Lighthouse / Web Vitals. |
| **JavaScript bundle size** | < 300KB gzipped (initial load) | Build analysis (webpack-bundle-analyzer or equivalent). |

**Database query targets:**

| Query Type | Target | Slow Query Threshold (Section 21.6) |
|-----------|--------|--------------------------------------|
| **Simple SELECT** | < 10ms | > 100ms |
| **Paginated list with filters** | < 50ms | > 200ms |
| **Aggregation queries (analytics)** | < 200ms | > 1000ms |
| **Full-text search** | < 100ms | > 500ms |

**Monitoring enforcement:**
- API response times tracked via Express middleware (Section 24.3 logging).
- Frontend metrics tracked via Web Vitals reporting (send to analytics or Sentry performance monitoring — Section 24.14).
- Database slow queries logged and flagged (Section 21.6 platform health).
- Performance budgets checked in CI/CD pipeline (Section 24.5): Lighthouse CI for frontend, load test scripts for backend.

---

### 24.17 Browser Compatibility Requirements

No mention of which browsers are supported. Explicit definition prevents wasted effort on unsupported environments.

**Supported browsers:**

| Browser | Minimum Version | Platform |
|---------|----------------|----------|
| **Google Chrome** | 90+ | Desktop (Windows, macOS, Linux) |
| **Mozilla Firefox** | 90+ | Desktop (Windows, macOS, Linux) |
| **Microsoft Edge** | 90+ | Desktop (Windows, macOS) |
| **Apple Safari** | 15+ | Desktop (macOS) |
| **Chrome Mobile** | 90+ | Android |
| **Safari Mobile** | 15+ | iOS |

**Explicitly NOT supported:**
- Internet Explorer 11 (or any version).
- Opera Mini.
- Browsers below the minimum versions listed above.

**Implementation implications:**
- CSS and JS can use features available in the minimum supported versions (check caniuse.com).
- `browserslist` config in `package.json` set to match the above targets (used by Babel, PostCSS, Autoprefixer).
- No IE11 polyfills needed.
- Testing (Section 24.4): E2E tests run on Chrome (primary) and Firefox (secondary). Safari testing recommended but not mandatory in CI.

---

### 24.18 Maintenance Mode

No way to gracefully put the platform into maintenance mode during deployments or database migrations. Needs a mechanism to show a "Platform is under maintenance" page to all users except Admin, with an estimated time of return.

**Maintenance mode behavior:**

| Aspect | Specification |
|--------|---------------|
| **Activation** | Admin toggles maintenance mode ON via Admin Settings page (Section 23.12), or via environment variable / API endpoint for emergency activation during deployment. |
| **Who is affected** | All Recruiters and Reporting Managers. They see a full-page maintenance screen instead of the app. |
| **Who is exempt** | Admin can still access the full platform (to verify things are working before turning off maintenance). |
| **Maintenance screen** | Full-page static HTML/CSS (no API calls needed). Shows: platform logo, "We're currently undergoing maintenance" message, estimated time of return (configurable when activating), contact email for urgent issues. |
| **API behavior** | All authenticated API requests from non-admin users return `503 Service Unavailable` with `{ "error": { "code": "MAINTENANCE_MODE", "message": "Platform is under maintenance. Please try again later.", "estimatedReturn": "2026-03-27T12:00:00Z" } }`. |
| **Deactivation** | Admin toggles maintenance mode OFF. All users can access the platform immediately. |
| **Notification** | When maintenance mode is activated, an in-app notification is queued for all users: "Platform maintenance scheduled. Expected duration: [X]." Notification delivered when they next access the platform after maintenance ends. |

**Implementation:**
- Maintenance mode flag stored in Redis (`platform:maintenance_mode` → `{ active: true, estimatedReturn: "...", activatedBy: "...", activatedAt: "..." }`). Redis is checked by middleware on every request — fast, no DB query.
- Express middleware checks Redis flag before processing any request. If active and user is not Admin → return 503.
- Frontend middleware/layout checks maintenance flag on app load. If active → render maintenance page (can be a static page that doesn't depend on the API being fully functional).
- Maintenance mode toggle also available via CLI command or direct API call (for use in CI/CD deployment scripts — activate before migration, deactivate after).

### 24.19 Next.js Frontend Infrastructure & PWA

The platform frontend built with Next.js (App Router) requires a complete set of infrastructure files, error handling boundaries, loading systems, PWA configuration, SEO meta files, and UI feedback systems. Every file listed below must be created.

---

#### 24.19.1 Progressive Web App (PWA)

The platform is installable as a Progressive Web App on desktop and mobile devices. PWA enables: app-like experience, home screen installation, offline fallback page, push notification readiness, and faster subsequent loads via service worker caching.

| Aspect | Specification |
|--------|---------------|
| **Installability** | The platform meets PWA install criteria: valid web manifest, registered service worker, served over HTTPS. Users see the browser's "Install App" prompt or a custom in-app install banner. |
| **Install prompt** | A subtle, dismissible banner at the top/bottom of the page: "Install OMG Teams for a faster experience" with "Install" and "Dismiss" buttons. Shown once per session. Respects `beforeinstallprompt` event. |
| **Offline fallback** | When the user is offline and navigates to an uncached page, the service worker serves a custom offline fallback page: "You're offline. Please check your internet connection." with the platform logo, a retry button, and cached data indicator (if any data was previously cached). |
| **Caching strategy** | **App shell caching** — cache the static app shell (HTML layout, CSS, JS bundles, fonts, logo/icons) on first load via service worker. API responses are NOT cached (all data is real-time from the backend). Only static assets are cached. |
| **Background sync** | Not required for V1. All actions require real-time connectivity. Offline form submission is NOT supported — the platform shows an offline banner and blocks submissions until connectivity is restored. |
| **Update flow** | When a new version is deployed, the service worker detects the update. A toast notification appears: "A new version is available. Refresh to update." with a "Refresh" button. Clicking refresh activates the new service worker and reloads the page. |

---

#### 24.19.2 `app/manifest.ts` — Web App Manifest

Next.js App Router dynamic manifest file that generates the `manifest.webmanifest` JSON for PWA installation.

```typescript
// app/manifest.ts
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OMG Teams — Opportunity Makers Group',
    short_name: 'OMG Teams',
    description: 'Internal Recruitment, Employee & Workforce Management Platform',
    start_url: '/login',
    display: 'standalone',
    background_color: '#F8FAFC',       // bg-page light mode
    theme_color: '#001845',            // secondary-700 (navbar color)
    orientation: 'portrait-primary',
    scope: '/',
    icons: [
      { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}
```

**Icon requirements:** OMG/OMG Teams logo exported as PNG at all 8 required sizes. Maskable versions (with safe zone padding) for `192x192` and `512x512`. Placed in `/public/icons/`.

---

#### 24.19.3 `app/robots.ts` — Robots Meta File

Next.js App Router dynamic robots file. Since this is an internal platform (not public-facing), ALL pages are disallowed from search engine indexing.

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',   // Block ALL crawlers from ALL pages
      },
    ],
    // No sitemap reference — internal platform
  }
}
```

**Rationale:** This is a private, login-protected internal platform. No page should be indexed by search engines. The login page, dashboard, and all other routes are private.

---

#### 24.19.4 `app/sitemap.ts` — Sitemap Meta File

Next.js App Router dynamic sitemap file. Since all pages are behind authentication and the platform is internal (not public), the sitemap is either empty or omitted entirely.

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return []   // Empty — no public pages to index
}
```

**Rationale:** No SEO benefit — all routes require authentication. The `robots.ts` already disallows all crawling. The sitemap file exists for completeness and to prevent framework warnings.

---

#### 24.19.5 `app/not-found.tsx` — Custom 404 Page

A custom-styled 404 "Not Found" page that renders when a user navigates to a route that does not exist.

| Aspect | Specification |
|--------|---------------|
| **Visual design** | Branded 404 page matching the platform's design system. Platform logo, large "404" heading (using `text-4xl font-extrabold` in `secondary-700`), subtitle "Page not found", friendly message: "The page you're looking for doesn't exist or has been moved.", illustration (optional — a simple branded SVG illustration). |
| **Actions** | "Go to Dashboard" primary button (navigates to the user's role-specific dashboard if authenticated, or to `/login` if not). "Go Back" secondary button (navigates to previous page via `router.back()`). |
| **Authenticated vs unauthenticated** | If the user is authenticated: show sidebar + header + 404 content within the app layout. If not authenticated: show 404 content on a clean page with "Go to Login" button. |
| **No sidebar flash** | The 404 page should not flash the sidebar/layout before rendering. Use Next.js `not-found.tsx` at the app root level so it renders cleanly. |

---

#### 24.19.6 `app/loading.tsx` — Root Loading Page

A full-page loading screen shown by Next.js during route transitions and initial page loads (via React Suspense boundary).

| Aspect | Specification |
|--------|---------------|
| **Visual** | Centered loading state: platform logo (OMG/OMG Teams) with a subtle animation (gentle pulse or fade), the spinner component (Section 24.19.7) below the logo, and optionally "Loading..." text in `text-muted`. |
| **Placement** | `app/loading.tsx` at root level → shows during initial app load and top-level route transitions. Additional `loading.tsx` files in nested route groups (e.g., `app/(dashboard)/loading.tsx`) for section-specific loading. |
| **Background** | Uses `bg-page` color. No jarring white flash — matches the app's background. |
| **Transition** | Smooth fade-out when the page content loads. No abrupt content pop-in. |

---

#### 24.19.7 Spinner Component

A reusable, consistent loading spinner used across the entire platform wherever an inline loading state is needed.

| Aspect | Specification |
|--------|---------------|
| **Design** | A circular spinning indicator using the primary brand color (`primary-500` / `#DAA025`). Clean, minimal — not a generic browser spinner. CSS-only animation (no GIF/image). |
| **Sizes** | 3 size variants: `sm` (16px — inline in buttons, table cells), `md` (32px — card loading, section loading), `lg` (48px — full-page loading, route transitions). |
| **Color variants** | Default: `primary-500`. On dark backgrounds (sidebar, header): `white`. On primary button: `white` (spinner replaces button text during loading). |
| **Accessibility** | `role="status"` + `aria-label="Loading"` + visually hidden "Loading..." text for screen readers. |
| **Usage locations** | Button loading states (Save, Submit, Generate, Export), data table loading, form submission, API call in progress, image upload progress, page route transitions, infinite scroll loading trigger, "Load more" button. |
| **Implementation** | Single React component: `<Spinner size="sm|md|lg" className="..." />`. CSS animation via Tailwind (`animate-spin`) or custom keyframes. |

---

#### 24.19.8 Skeleton Loading System

A robust, comprehensive skeleton loading system that shows placeholder UI shapes (gray animated blocks) mimicking the layout of the actual content while data is being fetched. Skeletons provide a much better UX than spinners for content-heavy pages because they communicate the structure of what's coming.

| Aspect | Specification |
|--------|---------------|
| **Skeleton primitives** | Reusable base components: `<SkeletonLine />` (text line placeholder — rounded rectangle), `<SkeletonCircle />` (avatar/icon placeholder), `<SkeletonRect />` (card/image/block placeholder), `<SkeletonButton />` (button placeholder). Each accepts `width`, `height`, `className` props. |
| **Animation** | Shimmer/pulse animation — a subtle left-to-right gradient sweep (shimmer) or gentle opacity pulse. Uses `bg-muted` as base color with a lighter shimmer highlight. Consistent animation timing across all skeletons (1.5s cycle). |
| **Page-specific skeletons** | Every page that fetches data on load has a dedicated skeleton layout matching its actual content structure: |
| | **Dashboard skeleton:** KPI card skeletons (5 rectangular blocks), chart area skeleton (large rectangle), login list skeleton (stacked line items). |
| | **Data table skeleton:** Table header skeleton (row of rectangles) + 10 table row skeletons (each row = multiple cells with varying widths matching actual column proportions). |
| | **Employee detail skeleton:** Tab bar skeleton + profile section skeleton (circle for avatar + lines for name/role/details) + content area skeleton. |
| | **Form skeleton:** Label + input field skeletons stacked vertically, matching the actual form layout. |
| | **Card grid skeleton:** Grid of card-shaped rectangles matching the card layout (e.g., notification cards, document upload cards). |
| | **Calendar skeleton:** Grid of small squares matching the calendar month layout. |
| | **Sidebar skeleton:** Stacked rectangular line items matching sidebar menu structure. |
| **When to show** | Skeleton loading is shown on: initial page load (first data fetch), route transitions to data-heavy pages, lazy-loaded sections within a page, tab switches that trigger new data fetches, and any component that awaits async data. |
| **When NOT to show** | Do NOT show skeletons for: button clicks (use spinner inside button instead), form submissions (use spinner + disabled state), refetching/refreshing data that is already displayed (use subtle refresh indicator instead — keep stale data visible). |
| **Transition** | Skeleton → real content transition should be smooth. No layout shift — the skeleton dimensions must match the actual content dimensions exactly. Content fades in or replaces skeleton without jumping. |

---

#### 24.19.9 `app/error.tsx` — Route-Level Error Boundary

A Next.js App Router error boundary that catches runtime errors within a route segment and displays a fallback error UI instead of a blank white screen.

```typescript
// app/error.tsx (and also in nested route groups)
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Render error UI
}
```

| Aspect | Specification |
|--------|---------------|
| **Visual design** | Branded error page within the app layout (sidebar + header remain visible). Shows: warning/error icon (using `error-500` color), heading "Something went wrong", error message (generic in production — never expose stack traces to users), "Try Again" primary button (calls `reset()` to re-render the segment), "Go to Dashboard" secondary button. |
| **Error reporting** | On render, automatically reports the error to Sentry (Section 24.14) with: error message, stack trace, component tree, user context (userId, role), route path. |
| **Nested boundaries** | Place `error.tsx` at multiple levels for granular error isolation: `app/error.tsx` (root catch-all), `app/(dashboard)/error.tsx` (dashboard-level), `app/(dashboard)/admin/error.tsx` (admin section). A section error doesn't crash the entire app — only the affected section shows the error UI. |
| **Recovery** | The "Try Again" button calls Next.js `reset()` function which re-renders the route segment — useful for transient errors (network blips, temporary API failures). |
| **Error details (dev only)** | In development mode (`NODE_ENV=development`), show the full error message and stack trace below the error UI for debugging. Hidden in production. |

---

#### 24.19.10 `app/global-error.tsx` — Root-Level Error Boundary

A Next.js App Router global error boundary that catches errors in the root layout itself — the last line of defense. This handles errors that `error.tsx` cannot catch (because `error.tsx` is rendered inside the layout, so if the layout itself fails, `error.tsx` cannot render).

```typescript
// app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Render minimal error UI — no layout dependency
}
```

| Aspect | Specification |
|--------|---------------|
| **Visual design** | A completely standalone error page with NO dependency on the app layout, sidebar, header, or any shared components (because those may be what crashed). Includes its own `<html>` and `<body>` tags. Shows: platform logo (inline SVG or base64 — not fetched from CDN), large "Something went wrong" heading, "We're experiencing a critical error. Please try refreshing the page." message, "Refresh Page" button (calls `reset()` or `window.location.reload()`). |
| **Minimal dependencies** | This file must have ZERO imports from the app's component library or layout. Inline styles only (or a minimal standalone CSS file). It must be able to render even if the entire React app tree is broken. |
| **Error reporting** | Sends error to Sentry via a standalone fetch call (not via the app's Sentry integration which may be broken): `fetch('/api/report-error', { ... })` or direct Sentry DSN. |
| **When it triggers** | Only triggers when the root layout (`app/layout.tsx`) itself throws an error. This is extremely rare in production but must be handled. |

---

#### 24.19.11 Toast Notification System (Robust, Top-Notch)

A robust, polished, production-grade toast/snackbar notification system for all user-facing feedback across the platform. Every API response, user action, and system event that requires feedback uses this toast system.

**Toast library:** Use `sonner` (https://sonner.emilkowal.dev/) or `react-hot-toast` — both are lightweight, accessible, and highly customizable. Must be wrapped in a custom `<Toaster />` provider at the root layout with platform-specific styling.

**Toast types:**

| Type | Icon | Colors | Usage Examples |
|------|------|--------|---------------|
| **Success** | ✅ Checkmark circle | `success-500` icon + `success-100` background + `success-700` text | "Report submitted successfully", "Employee account created", "Document verified", "Leave approved", "Password changed", "Settings saved", "Export downloaded". |
| **Error** | ❌ X circle | `error-500` icon + `error-100` background + `error-700` text | "Failed to save report", "Invalid credentials", "Session expired — please login again", "Network error — please try again", "File upload failed", "Permission denied". |
| **Warning** | ⚠️ Triangle | `warning-500` icon + `warning-100` background + `warning-700` text | "Unsaved changes will be lost", "Character limit approaching", "Duplicate candidate detected", "Leave balance low", "Pasted content was trimmed". |
| **Info** | ℹ️ Info circle | `info-500` icon + `info-100` background + `info-700` text | "Draft auto-saved", "A new version is available", "Midnight reset in 5 minutes", "Report is being generated...", "Employee ID copied". |
| **Loading** | Spinner | `primary-500` spinner + `bg-surface` background | "Generating report...", "Uploading document...", "Processing...", "Saving..." — auto-dismisses when the async operation completes (replaced by success or error toast). |
| **Promise** | Spinner → ✅/❌ | Auto-transitions | `toast.promise(apiCall, { loading: 'Saving...', success: 'Saved!', error: 'Failed to save' })` — shows loading spinner during the promise, then auto-transitions to success or error. |

**Toast behavior:**

| Behavior | Specification |
|----------|---------------|
| **Position** | Bottom-right corner of the viewport (consistent across all pages). Stacks vertically — newest at the bottom. |
| **Duration** | Success: 3 seconds. Error: 5 seconds (longer to ensure user reads it). Warning: 4 seconds. Info: 3 seconds. Loading: persists until dismissed or resolved. |
| **Dismissal** | Manual dismiss via X button on each toast. Auto-dismiss after duration. Swipe to dismiss (on touch devices). Hover pauses auto-dismiss timer (so user can read long messages). |
| **Stacking** | Max 5 toasts visible simultaneously. If more than 5, oldest auto-dismisses. Stacked with slight overlap/offset for visual depth. |
| **Animation** | Slide-in from right + fade-in on appear. Slide-out to right + fade-out on dismiss. Smooth, 200ms duration. No jarring pop-in. |
| **Accessibility** | `role="alert"` for error/warning toasts (announced by screen readers). `role="status"` for success/info toasts. Focus management — toasts don't steal focus from the user's current task. |
| **Deduplication** | If the same toast message is triggered multiple times within 2 seconds, only show it once (prevent toast spam from rapid API retries). |
| **Action buttons** | Toasts can optionally include an action button: "Undo" (for reversible actions like delete), "Retry" (for failed API calls), "View" (for navigation — e.g., "Report generated — View"), "Refresh" (for update prompts). |
| **Persistent toasts** | Some toasts persist until manually dismissed (no auto-dismiss): critical errors, session expiry warnings, offline connectivity banner, PWA update prompt. |

**Toast styling (matches platform design system):**

| Property | Value |
|----------|-------|
| **Border radius** | `8px` (rounded-lg) |
| **Shadow** | `shadow-lg` — elevated above page content |
| **Font** | `"Plus Jakarta Sans"` — matches platform typography |
| **Font size** | `text-sm` (14px) for message, `text-xs` (12px) for description |
| **Font weight** | `font-medium` for title, `font-normal` for description |
| **Max width** | `400px` |
| **Padding** | `16px` |
| **Border** | `1px solid` using the semantic border color for each type (e.g., `success-500` border for success toast) |

---

#### 24.19.12 `public/sw.js` — Service Worker

The service worker file that powers the PWA functionality. Handles: static asset caching (app shell), offline fallback page, and new version detection.

| Aspect | Specification |
|--------|---------------|
| **File location** | `/public/sw.js` — must be at the root of the public directory so it has scope over the entire domain. |
| **Registration** | Registered in the root layout (`app/layout.tsx`) or via a client-side `useEffect` in the root client component. Only registers in production (`process.env.NODE_ENV === 'production'`). |
| **Caching strategy — static assets** | **Cache-first** for static assets: JS bundles, CSS files, font files (`Plus Jakarta Sans` woff2), platform logo/icons. These rarely change and are safe to serve from cache. Cached on `install` event. |
| **Caching strategy — HTML/pages** | **Network-first** for HTML page navigations. Always try the network first (to get the latest server-rendered page). Fall back to cache only if network fails (offline). |
| **Caching strategy — API calls** | **Network-only** for all API calls to `api.opportunitymakers.in`. API responses are NEVER cached — all data must be real-time. If an API call fails due to network issues, the frontend error handling shows an error toast (Section 24.19.11). |
| **Offline fallback** | If the user is offline and navigates to an uncached page, serve `/offline.html` — a static HTML page with: platform logo, "You're offline" message, "Retry" button that calls `window.location.reload()`. This file is pre-cached on `install`. |
| **Cache versioning** | Cache name includes a version string (e.g., `OMG Teams-static-v1`). On new deployment, the new service worker updates the cache version, and the `activate` event deletes old caches. |
| **Update detection** | The service worker checks for updates on every page load (`registration.update()`). When a new SW is found, it enters `waiting` state. The app shows a "New version available" toast (Section 24.19.11) with a "Refresh" button that calls `skipWaiting()` + `clients.claim()` + `reload()`. |
| **What to cache (pre-cache on install)** | App shell HTML, all JS chunks, all CSS files, `Plus Jakarta Sans` font files (woff2), platform logo and PWA icons, `/offline.html` fallback page. |
| **What NOT to cache** | API responses, user-uploaded images/documents, dynamically generated content, Cloudinary/R2 URLs. |
| **Libraries** | Use `next-pwa` (if compatible with App Router) or `workbox` (Google's SW toolkit) for robust caching strategies and pre-caching. Manual `sw.js` is also acceptable if kept simple. |

---

#### 24.19.13 `public/offline.html` — Offline Fallback Page

A static HTML file served by the service worker when the user is offline and no cached version of the requested page exists.

| Aspect | Specification |
|--------|---------------|
| **Completely standalone** | Pure HTML + inline CSS. No external dependencies (no CDN links, no API calls, no JS framework). Must render without any network connectivity. |
| **Content** | Platform logo (inline SVG or base64-encoded image), "You're currently offline" heading, "Please check your internet connection and try again." message, "Retry" button (`onclick="window.location.reload()"`), subtle background using `bg-page` color. |
| **Design** | Matches platform design system — uses `Plus Jakarta Sans` (with system font fallback since the font may not be cached), `secondary-700` for heading, `text-secondary` for body text, `primary-500` for the Retry button. |

---

#### 24.19.14 Additional Next.js App Router Files

| File | Purpose | Specification |
|------|---------|---------------|
| **`app/layout.tsx`** | Root layout | Wraps all pages. Includes: `<html>`, `<body>`, font loading (`Plus Jakarta Sans`), global CSS, `<Toaster />` provider, Socket.io provider, auth session provider, theme provider (light/dark mode), service worker registration script, meta tags (viewport, charset, theme-color `#001845`). |
| **`app/(auth)/layout.tsx`** | Auth layout | Clean layout for login page — no sidebar, no header. Centered content. Background with subtle brand pattern. |
| **`app/(dashboard)/layout.tsx`** | Dashboard layout | Sidebar navigation + top header + main content area. Role-based menu rendering. Notification bell. Profile avatar. Live status dot. Breadcrumbs. |
| **`app/favicon.ico`** | Browser tab icon | OMG/OMG Teams logo as `.ico` format (16x16, 32x32, 48x48 multi-size). |
| **`app/apple-icon.png`** | iOS home screen icon | 180x180 PNG with platform logo for Apple devices. |
| **`app/opengraph-image.png`** | Social sharing preview | 1200x630 PNG with platform branding for link previews (though unlikely to be shared since it's internal — included for completeness). |
| **`middleware.ts`** | Edge middleware | Auth check on every route: redirect unauthenticated users to `/login`, redirect authenticated users away from `/login` to their dashboard, role-based route protection (admin routes blocked for non-admin), maintenance mode check. |

---

## 25. SECURITY HARDENING

### 25.1 Account Lockout on Failed Login Attempts

No brute force protection beyond Turnstile captcha. Should lock account after N failed attempts for a cooldown period, and notify Admin.

**Lockout rules:**

| Rule | Value |
|------|-------|
| **Max failed attempts** | 5 consecutive failed login attempts (configurable). |
| **Cooldown period** | 15 minutes (configurable). After cooldown, counter resets and user can try again. |
| **Counter scope** | Per-user (not per-IP — since IP tracking is not used for enforcement). |
| **Counter storage** | Redis key: `login_attempts:{userId}` with TTL = cooldown period. |
| **Counter reset** | Resets to 0 on successful login. |

**Lockout behavior:**
- After 5 failed attempts: account is temporarily locked. Login returns error: "Account temporarily locked due to multiple failed attempts. Try again in 15 minutes, or contact admin."
- **Admin notification:** When an account is locked out, send an in-app notification (and optionally email) to Admin with: user name, email, number of attempts, lock timestamp, device info from attempts.
- **Admin override:** Admin can manually unlock a locked-out account immediately (resets counter and cooldown).
- **Audit trail:** All lockout events logged (Section 23.1).

**Integration with device lock (Section 22):**
- Failed attempts from a different device still count toward the lockout counter (they're per-user, not per-device).
- Lockout applies regardless of whether the failure reason is wrong password or device mismatch.

---

### 25.2 Password Complexity Requirements

Passwords are hashed, but no rules defined for minimum length, character requirements, or common password rejection.

**Password rules:**

| Rule | Requirement |
|------|-------------|
| **Minimum length** | 8 characters. |
| **Maximum length** | 128 characters (prevent DoS via extremely long password hashing). |
| **Character requirements** | Must contain at least: 1 uppercase letter, 1 lowercase letter, 1 digit, 1 special character (`!@#$%^&*()-_+=[]{}|;:',.<>?/`). |
| **Common password rejection** | Reject passwords that appear in common password lists (e.g., top 10,000 most common passwords). Use a server-side blocklist. |
| **Personal info rejection** | Reject passwords that contain the user's email, name, or other account info. |

**Validation:**
- Enforced on: account creation (by Admin), password change, password reset.
- Server-side validation is mandatory (never trust client-side only).
- Client-side: real-time strength indicator (weak/fair/strong) as user types, showing which requirements are met/unmet.
- Error messages: specific about which requirement is not met (not just "password too weak").

---

### 25.3 Session Idle Timeout

Sessions exist in Redis but no idle timeout mentioned. If a recruiter leaves their browser open and walks away, the session should expire after configurable inactivity.

**Idle timeout configuration:**

| Setting | Default Value |
|---------|--------------|
| **Session idle timeout** | 30 minutes of inactivity (configurable by Admin). |
| **Absolute session lifetime** | Until midnight — the midnight session reset cron job (Section 27.1.3) destroys all employee sessions daily. Sessions persist across browser close until midnight. Admin sessions are exempt from midnight reset. |
| **Idle detection** | "Activity" = any authenticated API request. Each request resets the idle timer. |

**Implementation:**
- Redis session key TTL set to idle timeout value (e.g., 30 minutes).
- Every authenticated request: refresh the TTL (`EXPIRE session:{userId} 1800`).
- If no request within timeout: Redis key auto-expires → next request fails authentication → user redirected to login.
- Absolute lifetime is enforced by the midnight session reset cron job (Section 27.1.3), NOT by a per-session TTL. The cron job bulk-destroys all employee sessions at midnight daily, ensuring every employee must login fresh the next day for a fresh working timer.

**Client-side behavior:**
- **Inactivity warning:** 5 minutes before timeout, show a modal: "Your session will expire in 5 minutes due to inactivity. Click to stay logged in."
- "Stay logged in" button sends a keep-alive request (extends session).
- If no action: session expires, user sees "Session expired — please login again."
- Client-side activity detection: mouse movement, keyboard input, scroll — used only to show/suppress the warning modal, NOT for server-side enforcement (server-side TTL is authoritative).

---

### 25.4 Data Encryption at Rest

Sensitive data is hashed, but no mention of encrypting the database at rest (PostgreSQL TDE or disk-level encryption) or encrypting backups.

**Encryption requirements:**

| Layer | Encryption | Implementation |
|-------|-----------|----------------|
| **Database at rest** | Encrypted. | Neon and Supabase (Section 26.1) encrypt data at rest by default (AES-256). Verify this is enabled. If self-hosted PostgreSQL: enable full-disk encryption (LUKS/dm-crypt) or PostgreSQL TDE. |
| **Backups** | Encrypted. | All backup files (pg_dump outputs) encrypted before upload to cloud storage. Use GPG or cloud storage server-side encryption (SSE-S3/SSE-R2). |
| **Redis at rest** | Encrypted. | Redis Cloud (Section 26.1) supports encryption at rest — enable it. If self-hosted: enable Redis disk encryption. |
| **Cloud storage (R2/Cloudinary)** | Encrypted. | R2 encrypts at rest by default (SSE). Verify Cloudinary encryption policy. |
| **Sensitive fields in transit** | HTTPS. | Already covered (Section 16) — all traffic over HTTPS. |

**Application-level encryption (additional layer):**
- For highly sensitive PII fields (e.g., Aadhaar-adjacent data, if stored), consider application-level encryption (encrypt before writing to DB, decrypt on read) using AES-256-GCM with a key management strategy (environment variable or cloud KMS).
- This provides defense-in-depth: even if database is compromised, encrypted fields are not readable without the application key.

---

### 25.5 PII Data Handling Policy

The system stores extensive PII (names, phones, emails, DOB, Aadhaar-adjacent data). No data retention policy, data masking for non-admin views, or GDPR/DPDP compliance considerations.

**PII inventory:**

| Field | PII Level | Handling |
|-------|----------|----------|
| Candidate Name | Medium | Stored in plaintext. Masked for non-admin roles where applicable. |
| Contact No | High | Stored in plaintext (or hashed if not needed for display). Masked in exports (last 4 digits visible). |
| Email ID | High | Stored in plaintext. Masked in non-admin views (show first 3 chars + domain). |
| Date of Birth | High | Stored in plaintext. Access restricted to Admin and original submitting recruiter. |
| Current CTC / Expected CTC | Medium | Stored in plaintext. Access restricted. |
| 10th / 12th / Graduation % | Low | Stored in plaintext. No special handling. |
| Address / State / Location | Medium | Stored in plaintext. No special masking needed. |

**Data retention policy:**
- **Active candidate records:** Retained indefinitely while in active use.
- **Archived records (Section 23.5):** Retained in archive for 3 years after archiving, then permanently deleted.
- **Audit logs:** Retained for 2 years, then purged.
- **Login history:** Retained for 1 year, then purged.
- **Deleted records (trash):** Permanently purged after 90 days (Section 23.7).
- **Generated reports (cloud):** Deleted after 30 days (already specified).

**Data masking for non-admin views:**
- Reporting Managers see candidate data but with sensitive fields partially masked (e.g., phone shows `****-**-1234`, email shows `jak***@gmail.com`).
- Recruiters see their own submitted data in full (they entered it), but cannot see other recruiters' data at all.

**GDPR / DPDP (India's Digital Personal Data Protection Act) compliance considerations:**
- **Consent:** Candidate data is collected by recruiters during the screening process. The platform should track consent status if applicable.
- **Right to deletion:** Admin must be able to permanently delete all data associated with a specific candidate upon request (true deletion from all tables, archives, backups — or anonymization if true deletion is infeasible from backups).
- **Data minimization:** Only collect data that is necessary for the recruitment process (already defined by the form fields).
- **Access logging:** All access to PII-heavy records is logged in the audit trail (Section 23.1).

---

## 26. DEPLOYMENT & INFRASTRUCTURE

### 26.1 Hosting / Deployment Target

**Platform hosting decisions:**

| Component | Hosting Provider | Notes |
|-----------|-----------------|-------|
| **Frontend (Next.js)** | **Vercel** | Native Next.js hosting. Auto-deploys from Git. Edge network for performance. Preview deployments for PRs. |
| **Backend (Express)** | **Render** | Managed Node.js hosting. Auto-deploys from Git. Built-in health checks, auto-scaling, zero-downtime deploys. |
| **PostgreSQL** | **Neon or Supabase** | Serverless PostgreSQL. Auto-scaling, branching (Neon), built-in connection pooling, automated backups, encryption at rest. Choose one based on pricing and feature needs. |
| **Redis** | **Redis Cloud** | Managed Redis. Persistence, encryption at rest, high availability. Free tier available for development. |
| **Cloud Storage (Reports/Photos)** | **Cloudflare R2 or Cloudinary** | R2 for cost (no egress fees). Cloudinary for image transformation features. Already specified in Section 15. |
| **Nginx** | **Not required** | Vercel and Render handle reverse proxy, SSL termination, and load balancing natively. Nginx only needed if self-hosting. |

**Cross-service connectivity:**
- Backend (Render) connects to PostgreSQL (Neon/Supabase) via connection string with pooler.
- Backend connects to Redis (Redis Cloud) via Redis URL with TLS.
- Frontend (Vercel) calls backend API via public HTTPS URL (`https://api.opportunitymakers.in`).
- CORS configured to allow only the Vercel frontend domain (`teams.opportunitymakers.in`).

**Environment-specific URLs:**
- Production: `https://teams.opportunitymakers.in` (frontend), `https://api.opportunitymakers.in` (backend).
- Staging: `https://staging-teams.opportunitymakers.in` (frontend), `https://staging-api.opportunitymakers.in` (backend).
- Development: `http://localhost:3000` (frontend), `http://localhost:4000` (backend).

---

### 26.2 Domain & SSL Certificate Management

HTTPS is mentioned but no cert management strategy.

**SSL/TLS configuration:**

| Aspect | Configuration |
|--------|---------------|
| **Frontend (Vercel)** | Vercel provides automatic SSL certificates for custom domains. No manual cert management needed. |
| **Backend (Render)** | Render provides automatic SSL certificates for custom domains. No manual cert management needed. |
| **Custom domain setup** | Point `teams.opportunitymakers.in` DNS to Vercel (frontend) and `api.opportunitymakers.in` to Render (backend API subdomain). Use Cloudflare as DNS provider for additional DDoS protection and caching. |
| **If self-hosting (fallback)** | Use Let's Encrypt with Certbot for free SSL certificates. Auto-renewal via cron job (`certbot renew --quiet`). Nginx configured with the certs. |
| **HSTS** | Strict-Transport-Security header with `max-age=31536000; includeSubDomains; preload`. |
| **TLS version** | Minimum TLS 1.2. Prefer TLS 1.3. |

---

### 26.3 Monitoring & Alerting (External)

Platform health is shown on the admin analytics page (Section 21.6), but no external monitoring/alerting for when the platform itself is DOWN. The admin analytics page is useless if the platform is unreachable.

**External monitoring stack:**

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **UptimeRobot** (or BetterUptime/Pingdom) | Uptime monitoring. | Monitor: `https://teams.opportunitymakers.in` (frontend), `https://api.opportunitymakers.in/health` (backend health), `https://api.opportunitymakers.in/ready` (backend readiness). Check interval: 1 minute. Alert on: downtime (3 consecutive failures). |
| **Alert channels** | Notify dev team on incidents. | Email + Slack/Discord webhook + SMS (for critical). Configure escalation: email first → Slack after 5 min → SMS after 15 min. |
| **Grafana** (optional but recommended) | Metrics dashboard + alerting. | Connect to application metrics (response times, error rates, request counts). Alert on: error rate > 5%, response time p95 > 2s, Redis disconnection, BullMQ failed jobs > 0. |
| **PagerDuty-style escalation** (for production) | Incident management. | Integrate with UptimeRobot/Grafana. Define on-call rotation. Auto-escalate unacknowledged alerts. |

**What to monitor externally:**

| Check | Endpoint / Target | Alert Condition |
|-------|-------------------|----------------|
| Frontend is up | `https://teams.opportunitymakers.in` | HTTP status ≠ 200 for 3+ minutes. |
| Backend is alive | `https://api.opportunitymakers.in/health` | HTTP status ≠ 200 for 3+ minutes. |
| Backend is ready | `https://api.opportunitymakers.in/ready` | HTTP status ≠ 200 for 5+ minutes (allows for transient DB reconnections). |
| SSL certificate expiry | `https://teams.opportunitymakers.in`, `https://api.opportunitymakers.in` | Certificate expiring within 14 days. |
| Database connectivity | Via `/ready` endpoint dependency check. | PostgreSQL connection failing for 5+ minutes. |
| Redis connectivity | Via `/ready` endpoint dependency check. | Redis connection failing for 5+ minutes. |

**Incident response:**
- Monitoring alerts trigger notifications to the dev team (not to Admin or platform users).
- Admin analytics page (Section 21.6) shows platform health from the inside — external monitoring watches from the outside.
- Both are complementary: internal health = operational insight for Admin; external monitoring = availability assurance for the dev/ops team.

---

## 27. ATTENDANCE MANAGEMENT SYSTEM

> **A robust attendance tracking system for Recruiters and Reporting Managers**, fully managed by Admin. This system tracks daily work presence through punch in (login) and punch out (logout) timestamps, automatically calculates working hours, detects late logins, flags half-days, and gives Admin comprehensive attendance oversight across all employees.

**Applies to:** Recruiters and Reporting Managers. Admin manages and views the system but is not subject to attendance tracking.

---

### 27.1 Core Attendance Workflow

#### 27.1.1 Daily Punch In (Login)

| Aspect | Behavior |
|--------|----------|
| **Trigger** | When a recruiter or reporting manager successfully logs into the platform. |
| **Timestamp capture** | The exact date and time of login is recorded as the **Punch In** time. Stored in UTC, displayed in IST (or configurable timezone). |
| **Automatic** | Punch In is automatic on login — no separate "clock in" button needed. The login event IS the punch in. |
| **Multiple logins per day** | If a user logs out and logs back in during the same day, the system records the **first login of the day** as the official Punch In time. Subsequent logins on the same day do NOT overwrite the original Punch In. |
| **Approved leave day — NO working timer** | **If leave is approved for that day, the working timer should NOT start even if the employee logs in.** The login is still recorded for audit purposes (the employee accessed the platform), but: (1) the AttendanceRecord status remains `ON_LEAVE` — it is NOT changed to `PRESENT`, (2) working hours are NOT calculated — `grossWorkingMinutes` and `netWorkingMinutes` remain 0, (3) the live working hours counter on the employee's dashboard shows "On Leave Today — working timer inactive" instead of a ticking counter, (4) the punch-in is logged in a separate field (`leaveLoginAt`) for Admin visibility but does NOT count as official Punch In. This ensures approved leave days are fully respected even if an employee logs in to check something. |
| **Geo-context (optional)** | If session location data is available (Section 4), capture the approximate location at punch-in for Admin visibility. |

#### 27.1.2 Daily Punch Out (Logout)

| Aspect | Behavior |
|--------|----------|
| **Trigger** | When a recruiter or reporting manager logs out of the platform, OR when their session expires due to idle timeout (Section 25.3), OR at end-of-day auto-cutoff, OR via the midnight session reset cron job. |
| **Timestamp capture** | The exact date and time is recorded as the **Punch Out** time. |
| **Multiple logouts per day** | If a user logs in and out multiple times during the same day, the system records the **last logout of the day** as the official Punch Out time. |
| **Session expiry as punch out** | If a user's session expires due to idle timeout (Section 25.3) without explicit logout, the session expiry timestamp is recorded as the Punch Out time. |
| **End-of-day auto-cutoff** | If a user remains logged in past a configurable end-of-day time (default: 11:59 PM), the system automatically records Punch Out at the cutoff time. This prevents inflated working hours from overnight sessions left open. |
| **Missed punch out** | If a user has a Punch In but no Punch Out recorded by end of day (due to browser crash, force close, etc.), the attendance record is flagged as "Incomplete — Punch Out Missing." Admin can manually set the Punch Out time. |

#### 27.1.3 Midnight Session Reset Cron Job

**A cron job that automatically resets all employee sessions at midnight every day,** ensuring every employee must login fresh each day so a fresh working timer starts. Without this, an employee who stays logged in overnight would have their working hours continue counting into the next day.

**Cron job specification:**

| Aspect | Behavior |
|--------|----------|
| **Schedule** | Runs every day at midnight (12:00 AM, configurable — `attendance.midnightResetTime` in Section 27.13). |
| **Engine** | BullMQ repeatable/scheduled job. |
| **Action — Session destruction** | For every active employee session (recruiters and reporting managers) in Redis: destroy the session (delete Redis key `session:{userId}`). This forces the employee to login again the next day. |
| **Action — Attendance punch-out** | For every employee with an active session at midnight: record Punch Out at the midnight reset time (e.g., 12:00 AM). This closes the current day's attendance record with the working hours calculated up to midnight. |
| **Action — Working hours finalization** | Calculate and store final `grossWorkingMinutes` and `netWorkingMinutes` for the day being closed. |
| **Action — Firebase presence** | Set `/presence/{userId}` to `online: false` for all affected users. Broadcast `presence:offline` via Socket.io. |
| **Action — JWT invalidation** | All active JWTs for affected users become invalid because their Redis sessions no longer exist. On next API request, the middleware rejects the token → client-side redirects to login page. |
| **Result — Next day** | When the employee logs in the next day, it is treated as a completely fresh login: new session created, new Punch In recorded, fresh working timer starts from zero. |
| **Admin exemption** | Admin sessions are NOT reset by this cron job — Admin can remain logged in across midnight if needed. |
| **If employee stayed logged in** | If an employee stayed logged in without the cron job, their working hours would continue counting across midnight into the next day, producing incorrect multi-day working hours. The midnight reset prevents this by: (1) closing the current day's record at midnight, (2) destroying the session so the employee must login fresh, (3) the next login starts a new day's working timer from zero. |
| **Logging** | The midnight reset job logs: timestamp, number of sessions destroyed, list of affected userIds. Logged in the audit trail (Section 23.1) as a system action. |
| **Notification to employees** | No notification is sent for the midnight reset — it is a silent background operation. The employee simply sees the login page when they next interact with the platform the following day. |

---

### 27.2 Automatic Working Hours Calculation

**Formula:**

```
Working Hours = Punch Out Time − Punch In Time
```

**Calculation rules:**

| Rule | Description |
|------|-------------|
| **Basic calculation** | Straight subtraction of timestamps: `Punch Out − Punch In = Working Hours`. Displayed as hours and minutes (e.g., "8h 32m"). |
| **Approved leave day — zero working hours** | **If leave is approved for that day, working hours are NOT calculated — they remain 0 even if the employee logs in.** The AttendanceRecord status stays `ON_LEAVE`, and `grossWorkingMinutes` = 0, `netWorkingMinutes` = 0, regardless of any login activity. The working timer does not start on approved leave days. |
| **Midnight session reset — daily boundary** | Working hours are calculated only within a single calendar day (midnight to midnight). The midnight session reset cron job (Section 27.1.3) closes the current day's attendance record at midnight and forces a fresh login the next day. This ensures working hours never span across two calendar days. If an employee stays logged in until midnight, their working hours for that day are `midnight − Punch In`. The next day starts fresh with a new Punch In after re-login. |
| **Deductions (optional)** | Admin can configure a standard break deduction (e.g., 1 hour lunch break) that is automatically subtracted from gross working hours to get net working hours. `Net Working Hours = Gross Working Hours − Break Deduction`. |
| **Overtime calculation** | If net working hours exceed a configurable standard day length (default: 8 hours), the excess is flagged as **Overtime**. `Overtime = Net Working Hours − Standard Day Length` (only if positive). |
| **Minimum threshold** | If working hours are below a configurable minimum (e.g., 1 hour), the day may be flagged as a possible error or "token login" for Admin review. |
| **Rounding** | Working hours rounded to the nearest minute for display. Stored as exact timestamps internally. |

---

### 27.3 Late Login Alert System

A configurable late login detection system that automatically flags employees who punch in after the expected start time.

**Configuration (Admin-managed via Settings — Section 23.12):**

| Setting | Default | Description |
|---------|---------|-------------|
| **Expected login time** | 10:00 AM (IST) | The time by which all recruiters and reporting managers are expected to be logged in. |
| **Grace period** | 15 minutes | Time buffer after expected login time before a late flag is triggered. Login between 10:00–10:15 AM is NOT flagged as late. |
| **Late threshold** | 10:15 AM (expected + grace) | Login after this time triggers the late login flag. |
| **Configurable per role** | Optional | Admin can set different expected times for Recruiters vs. Reporting Managers if needed. |

**Late login behavior:**

| Event | Action |
|-------|--------|
| Employee logs in after late threshold | Attendance record for that day is automatically flagged as **"Late."** |
| Late flag applied | An in-app notification is sent to Admin (and optionally to the employee's assigned Reporting Manager). |
| Late count tracking | The system tracks total late count per employee — daily, weekly, monthly, and cumulative. |
| Excessive late alerts | If an employee exceeds a configurable late count threshold within a period (e.g., 5 late logins in one month), Admin receives a highlighted alert / notification. |
| No login at all | If an employee has no Punch In recorded by a configurable "absent threshold" time (e.g., 12:00 PM), the day is flagged as **"Absent"** (see Section 27.5). |

---

### 27.4 Half-Day Auto-Detection

The system automatically flags attendance records as half-day when working hours fall below the threshold.

**Half-day rules:**

| Rule | Value | Description |
|------|-------|-------------|
| **Half-day threshold** | 4 hours (configurable) | If net working hours for a day are under 4 hours, the day is automatically flagged as **"Half Day."** |
| **Full day threshold** | ≥ 4 hours (configurable) | If net working hours are 4 hours or more, the day is counted as a **"Full Day."** |
| **Standard full day** | 8 hours (configurable) | The expected standard working hours for a full day. Used for overtime calculation and target metrics. |

**Half-day behavior:**
- Half-day flag is applied automatically when Punch Out is recorded and working hours are calculated.
- The flag is visible on the employee's attendance record and in Admin's attendance dashboard.
- Half-days are tracked in attendance reports and monthly summaries.
- Admin can manually override the half-day flag (e.g., if the employee was on approved short leave).

---

### 27.5 Attendance Status Classification

Each day's attendance for each employee is classified into one of the following statuses:

| Status | Condition | Auto/Manual |
|--------|-----------|-------------|
| **Present (Full Day)** | Punch In recorded AND net working hours ≥ half-day threshold (default 4h). | Automatic. |
| **Present (Half Day)** | Punch In recorded AND net working hours < half-day threshold (default 4h). | Automatic. |
| **Late** | Punch In recorded after late threshold time. Can co-exist with Full Day or Half Day. | Automatic. |
| **Absent** | No Punch In recorded for the entire day by absent threshold time. | Automatic. |
| **Incomplete** | Punch In recorded but no Punch Out by end of day (session crash, no logout). | Automatic (Admin resolves manually). |
| **On Leave** | Employee was on approved leave. | Manual (Admin marks). |
| **Holiday** | Platform-wide or employee-specific holiday. | Manual (Admin configures holiday calendar). |
| **Weekend** | Saturday/Sunday (or configurable non-working days). | Automatic (from holiday/weekend config). |
| **Overtime** | Working hours exceed standard day length. Supplementary flag on Present days. | Automatic. |

---

### 27.6 Admin Attendance Dashboard

A dedicated **Attendance** page in the Admin panel providing full visibility into all employees' attendance.

#### 27.6.1 Dashboard Overview

**Summary cards (top row):**

| Card | Metric |
|------|--------|
| **Present Today** | Count of employees who have punched in today. Real-time — updates as employees log in. |
| **Absent Today** | Count of employees with no punch in today (after absent threshold). |
| **Late Today** | Count of employees who punched in late today. |
| **Half Days Today** | Count of employees with half-day status today. |
| **On Leave Today** | Count of employees on approved leave today. |
| **Average Working Hours (Today)** | Average net working hours across all present employees today. |

#### 27.6.2 Attendance Log Table

A detailed data table showing attendance records for all employees:

**Columns:**

| Column | Content |
|--------|---------|
| Employee Name | Recruiter or Reporting Manager name. |
| Role | Recruiter / Reporting Manager. |
| Date | Attendance date. |
| Punch In Time | First login timestamp for the day. |
| Punch Out Time | Last logout / session expiry timestamp for the day. |
| Gross Working Hours | Punch Out − Punch In. |
| Net Working Hours | Gross − break deduction. |
| Overtime | Hours beyond standard day length (if any). |
| Status | Present (Full/Half) / Late / Absent / Incomplete / On Leave / Holiday. |
| Late By | Duration late (e.g., "27 minutes") — only if Late status. |
| Actions | Admin actions: Edit Punch In/Out times, Mark as Leave, Override status. |

**Filtering & controls:**
- Filter by: date (single day, date range), employee (dropdown with search), role (Recruiter / Reporting Manager), status (Present / Late / Absent / Half Day / On Leave / Incomplete), reporting manager.
- Quick filters: "Today," "Yesterday," "This Week," "This Month."
- Sort by: any column.
- Search by: employee name.
- Paginated with all standard controls (Section 12).

#### 27.6.3 Admin Actions on Attendance Records

| Action | Description |
|--------|-------------|
| **Edit Punch In time** | Admin can manually adjust the punch-in time (e.g., if employee logged in on phone first but system recorded later desktop login). Audit-logged. |
| **Edit Punch Out time** | Admin can manually set/adjust punch-out time (critical for "Incomplete" records where punch-out was missed). Audit-logged. |
| **Mark as On Leave** | Admin can mark a day as approved leave for an employee (overrides Absent status). |
| **Override half-day flag** | Admin can change Half Day to Full Day or vice versa with a reason note. |
| **Override late flag** | Admin can remove the Late flag with a reason (e.g., approved late start). |
| **Add remarks** | Admin can add notes/remarks to any attendance record (e.g., "Approved WFH," "Client meeting off-site"). |

All manual edits are logged in the audit trail (Section 23.1) with old value, new value, and Admin's reason.

---

### 27.7 Employee Attendance Self-View

**Recruiters and Reporting Managers** can view their own attendance data (but NOT other employees' data):

- **My Attendance page** — shows their own attendance log with all columns (Punch In, Punch Out, Working Hours, Status, Late By).
- **Monthly summary** — total present days, half days, late count, absent count, total working hours, average daily hours.
- **Calendar view** — monthly calendar with color-coded days (green = present, yellow = half day, red = absent, blue = leave, orange = late, gray = weekend/holiday).
- Read-only — employees cannot edit their own attendance records.

---

### 27.8 Attendance in Reporting Manager View

Reporting Managers can view attendance data for their assigned recruiters (but NOT for other reporting managers or unassigned recruiters):

- **Team attendance table** — same columns as Admin view but scoped to their assigned recruiters only.
- **Team summary cards** — present count, absent count, late count for their team today.
- Read-only — Reporting Managers cannot edit attendance records.

---

### 27.9 Holiday & Weekend Configuration

**Admin manages a holiday calendar and weekend configuration:**

| Setting | Description |
|---------|-------------|
| **Working days** | Admin configures which days of the week are working days (default: Monday–Saturday). Sundays are non-working by default. Configurable per organization needs. |
| **Holiday list** | Admin can add/edit/delete holidays for the year. Each holiday: date, name (e.g., "Diwali," "Republic Day"), type (National / Regional / Custom). |
| **Holiday impact** | On holidays, employees are not expected to log in. No "Absent" flag is triggered. If an employee logs in on a holiday, their attendance is recorded normally (could count as overtime or extra day, per Admin preference). |
| **Recurring holidays** | Admin can set holidays that recur every year (e.g., 26 January, 15 August) — auto-populated for the next year. |

**Database:**
- `Holiday` table: id, date, name, type (NATIONAL / REGIONAL / CUSTOM), isRecurring, createdBy (FK → User), createdAt.

---

### 27.10 Leave Management (Basic)

A basic leave tracking system integrated with attendance:

| Feature | Description |
|---------|-------------|
| **Leave types** | Configurable leave types: Casual Leave, Sick Leave, Earned Leave, Comp Off, Other (Admin-manageable list). |
| **Leave balance** | Admin sets annual leave balance per type for each employee (or a default for all). Balance decremented as leaves are marked. |
| **Marking leave** | Admin marks an employee as "On Leave" for specific dates — choosing leave type. This prevents Absent flags and deducts from balance. |
| **Leave calendar** | Admin can view a team-wide leave calendar showing who is on leave on which dates. |
| **Leave balance view** | Admin can view remaining leave balance per employee. Employees can view their own balance on their attendance page. |

> **Note:** This section covers basic leave tracking from the Admin side (Admin directly marks leaves). The full leave request/approval workflow — where employees submit leave requests and Admin approves/rejects — is specified in **Section 28: Leave Application & Management System**.

---

### 27.11 Attendance Reports & Analytics

**Attendance reports (integrated with Section 20 — Admin Reports Management):**

| Report | Content |
|--------|---------|
| **Daily Attendance Report** | All employees' attendance for a specific date — punch times, working hours, status. |
| **Monthly Attendance Summary** | Per-employee monthly rollup — total present days, half days, late count, absent count, leave count, total hours, average hours, overtime hours. |
| **Late Login Report** | List of all late logins within a date range — employee, date, expected time, actual time, late by duration. |
| **Absentee Report** | List of all absences within a date range — employee, date, whether leave was marked or unexplained. |
| **Working Hours Report** | Per-employee working hours breakdown — daily hours over a period, average, min, max, total. |
| **Overtime Report** | Employees with overtime hours — date, regular hours, overtime hours, total. |

All attendance reports are available for download in XLSX format from the Admin Reports Management page and can be included in scheduled email reports.

**Attendance analytics (integrated with Section 21 — Admin Analytics):**

| Chart / Widget | Description |
|----------------|-------------|
| **Attendance rate trend** | Line chart — daily/weekly/monthly attendance rate (% of employees present) over time. |
| **Late login frequency** | Bar chart — count of late logins per employee over a period. Highlights chronic late-comers. |
| **Working hours distribution** | Histogram — distribution of daily working hours across all employees. |
| **Absenteeism rate** | KPI card + trend line — percentage of absent days over total working days. |
| **Team attendance heatmap** | Calendar heatmap (per employee or aggregate) showing attendance patterns — similar to the daily activity heatmap in Section 21.4.12. |
| **Attendance leaderboard** | Ranked table — employees sorted by attendance rate, punctuality, average working hours. |

---

### 27.12 Attendance Notifications

| Trigger | Notification To | Message |
|---------|----------------|---------|
| Employee punches in late | Admin + assigned Reporting Manager | "[Employee Name] logged in late at [time] (expected by [threshold])." |
| Employee has no punch-in by absent threshold | Admin + assigned Reporting Manager | "[Employee Name] has not logged in today." |
| Employee's punch-out is missing (Incomplete) | Admin | "[Employee Name]'s attendance record for [date] is incomplete — no punch out recorded." |
| Excessive late count threshold exceeded | Admin | "[Employee Name] has been late [X] times this month — exceeds the threshold of [N]." |
| Monthly attendance summary ready | Admin | "Monthly attendance summary for [Month] is ready for review." |

All notifications use the in-app notification system (Section 11). Email notifications for critical alerts (absent, excessive late) are optional and configurable.

---

### 27.13 Attendance Configuration (Admin Settings)

These settings are managed from the Admin Settings / Configuration page (Section 23.12):

| Setting | Default | Description |
|---------|---------|-------------|
| `attendance.expectedLoginTime` | 10:00 AM | Expected daily login time. |
| `attendance.gracePeriodMinutes` | 15 | Grace period after expected login time before late flag. |
| `attendance.absentThresholdTime` | 12:00 PM | If no login by this time, mark as Absent. |
| `attendance.halfDayThresholdHours` | 4 | Working hours below this = Half Day. |
| `attendance.standardDayHours` | 8 | Standard working day length (for overtime calculation). |
| `attendance.breakDeductionMinutes` | 60 | Automatic break deduction from gross hours (0 to disable). |
| `attendance.endOfDayCutoff` | 11:59 PM | Auto punch-out time if session still active. |
| `attendance.excessiveLateThreshold` | 5 | Late count per month that triggers an Admin alert. |
| `attendance.workingDays` | Mon–Sat | Which days of the week are working days. |
| `attendance.minimumHoursThreshold` | 1 | Working hours below this flagged as possible "token login." |
| `attendance.midnightResetTime` | 12:00 AM | Time at which the midnight session reset cron job runs daily. Destroys all employee sessions, records Punch Out, forces fresh login next day. See Section 27.1.3. |
| `attendance.midnightResetEnabled` | true | Enable/disable the midnight session reset cron job. If disabled, sessions persist across midnight (not recommended). |

All settings configurable by Admin without code changes. Changes take effect immediately (or from the next day, as appropriate).

---

### 27.14 Database Entities for Attendance

These entities supplement the schema in Section 17:

**`AttendanceRecord`:**
- id, userId (FK → User), date (Date — one record per user per day), punchInTime (DateTime), punchOutTime (DateTime, nullable), leaveLoginAt (DateTime, nullable — records login time on approved leave days for audit; working timer is NOT started), grossWorkingMinutes (Integer, computed — 0 on approved leave days), netWorkingMinutes (Integer, computed after break deduction — 0 on approved leave days), overtimeMinutes (Integer, computed), status (PRESENT_FULL | PRESENT_HALF | LATE | ABSENT | INCOMPLETE | ON_LEAVE | HOLIDAY | WEEKEND), isLate (Boolean), lateByMinutes (Integer, nullable), punchInEditedBy (FK → User, nullable — if Admin manually edited), punchOutEditedBy (FK → User, nullable), midnightResetApplied (Boolean, default false — true if this day's Punch Out was set by the midnight session reset cron job), remarks (Text, nullable), createdAt, updatedAt.

**`Holiday`:**
- id, date (Date), name (String), type (NATIONAL | REGIONAL | CUSTOM), isRecurring (Boolean), createdBy (FK → User), createdAt.

**`LeaveRecord`:**
- id, userId (FK → User), date (Date), leaveType (CASUAL | SICK | EARNED | COMP_OFF | OTHER), markedBy (FK → User — Admin who marked the leave), remarks (Text, nullable), createdAt.

**`LeaveBalance`:**
- id, userId (FK → User), leaveType (CASUAL | SICK | EARNED | COMP_OFF | OTHER), year (Integer — e.g., 2026), totalAllotted (Integer), used (Integer), remaining (Integer, computed or stored), updatedAt.

**`AttendanceConfig` (stored in a general settings table or dedicated config table):**
- All settings from Section 27.13 stored as key-value pairs with data types.

---

## 28. LEAVE APPLICATION & MANAGEMENT SYSTEM

> **A robust leave application and management system for Recruiters and Reporting Managers.** Employees (recruiters and reporting managers) submit leave requests through the platform. Admin reviews, approves, or rejects requests. Leave balances are automatically tracked and deducted on approval. The system integrates with the Attendance Management System (Section 27) to ensure leave days are correctly reflected in attendance records.

**Applies to:** Recruiters and Reporting Managers submit leave requests. Admin manages, approves, and rejects. Reporting Managers can optionally view leave requests from their assigned recruiters.

---

### 28.1 Leave Types

**Core leave types (required):**

| Leave Type | Code | Description |
|-----------|------|-------------|
| **Casual Leave (CL)** | `CASUAL` | For personal errands, family events, short-notice absences. Typically pre-planned. |
| **Sick Leave (SL)** | `SICK` | For illness, medical appointments, health-related absences. May be applied retroactively (after being sick). |

**Extended leave types (Admin-configurable — managed via Section 23.19 / Admin Settings):**

| Leave Type | Code | Description |
|-----------|------|-------------|
| **Earned Leave (EL)** | `EARNED` | Accrued over time based on tenure. Typically for planned vacations or extended absences. |
| **Comp Off** | `COMP_OFF` | Compensatory off granted for working on holidays or overtime. Admin grants comp-off credits manually. |
| **Half-Day Leave** | `HALF_DAY` | Employee works half a day and takes leave for the other half (morning or afternoon). |
| **Unpaid Leave (LWP)** | `UNPAID` | Leave without pay — used when all paid leave balances are exhausted. Does NOT deduct from balance (no balance to deduct). |
| **Other** | `OTHER` | Any custom leave type Admin defines (e.g., Bereavement Leave, Marriage Leave, Maternity/Paternity Leave). |

**Admin can add, edit, rename, activate, or deactivate leave types** from the Admin Settings page (Section 23.12 / 23.19) without code changes. Each leave type has: name, code, description, isPaid (Boolean), isActive (Boolean), requiresDocument (Boolean — e.g., Sick Leave may require a medical certificate upload).

---

### 28.2 Leave Request Submission (Employee Side)

Recruiters and Reporting Managers submit leave requests through a dedicated "Apply Leave" form accessible from their dashboard/sidebar.

#### 28.2.1 Leave Request Form Fields

| # | Field | Type | Description |
|---|-------|------|-------------|
| 1 | Leave Type | Dropdown | Select from active leave types (Casual Leave, Sick Leave, Earned Leave, etc.). |
| 2 | Start Date | Date picker | First day of leave. Cannot be in the past (except for Sick Leave — can be backdated up to configurable days, default 3 days). |
| 3 | End Date | Date picker | Last day of leave. Must be ≥ Start Date. |
| 4 | Half-Day Option | Toggle + Dropdown | If leave is for a single day, employee can choose "Half Day" and select "First Half" or "Second Half." |
| 5 | Number of Days | Auto-calculated | Automatically calculated from Start Date to End Date, excluding weekends and holidays (per Section 27.9 config). Read-only display. |
| 6 | Reason | Textarea | Mandatory reason for the leave request. Minimum 10 characters. |
| 7 | Supporting Document | File upload (optional) | Upload supporting documents (e.g., medical certificate for Sick Leave). Allowed formats: PDF, JPEG, PNG. Max 5MB. |
| 8 | Emergency Contact | Text (optional) | Contact number during leave (optional, for extended leaves). |
| 9 | Remaining Balance | Auto-displayed | Shows current remaining balance for the selected leave type. Read-only. If balance is insufficient, show a warning: "You have X days remaining for this leave type. Requesting Y days." |

#### 28.2.2 Leave Request Submission Rules

| Rule | Description |
|------|-------------|
| **Balance check** | System checks if the employee has sufficient leave balance for the selected type and requested days. If insufficient: warn the employee but still allow submission (Admin decides whether to approve). Alternatively, for Casual and Sick Leave: block submission if balance is 0 (configurable per leave type). |
| **Overlap check** | System checks for overlapping leave requests (same dates already requested or approved). If overlap exists: block submission with error "You already have a leave request for [overlapping dates]." |
| **Advance notice** | Configurable minimum advance notice per leave type (e.g., Casual Leave requires 1 day notice, Earned Leave requires 7 days). Sick Leave has no advance notice requirement (can be same-day or backdated). Admin can override. |
| **Max consecutive days** | Configurable maximum consecutive days per leave type (e.g., Casual Leave max 3 consecutive days, Earned Leave max 15 consecutive days). Exceeding shows a warning but allows submission with Admin approval. |
| **Holiday/weekend exclusion** | Requested date range automatically excludes configured weekends and holidays — only working days are counted against leave balance. |
| **Duplicate prevention** | Cannot submit a new request for dates already covered by a Pending or Approved request. |

#### 28.2.3 Leave Request Statuses

| Status | Description |
|--------|-------------|
| **Pending** | Submitted by employee, awaiting Admin action. Default status on submission. |
| **Approved** | Admin approved the request. Leave balance deducted. Attendance records updated. |
| **Rejected** | Admin rejected the request. Leave balance NOT deducted. |
| **Cancelled** | Employee cancelled their own pending request (only allowed while status is Pending). |
| **Revoked** | Admin revoked a previously approved leave (exceptional — e.g., business urgency). Leave balance restored. |

---

### 28.3 Admin Leave Management Dashboard

A dedicated **Leave Management** section in the Admin panel for managing all leave requests.

#### 28.3.1 Pending Requests Queue

The primary view Admin sees — a list of all pending leave requests awaiting action.

**Columns:**

| Column | Content |
|--------|---------|
| Employee Name | Name of the requester. |
| Role | Recruiter / Reporting Manager. |
| Leave Type | Casual / Sick / Earned / etc. |
| Date Range | Start Date — End Date. |
| Days Requested | Number of working days. |
| Reason | Leave reason (expandable if long). |
| Document | Download link if supporting document was uploaded. |
| Current Balance | Employee's remaining balance for this leave type (before this request). |
| Balance After | What the balance will be if approved. |
| Submitted On | Timestamp of request submission. |
| **Actions** | **Approve** (one-click) / **Reject** (one-click + reason) buttons. |

**One-click approve/reject:**
- **Approve:** Single click → confirmation dialog ("Approve [X] days of [Leave Type] for [Employee Name]?") → on confirm, status changes to Approved, leave balance is auto-deducted, attendance records for those dates are marked as "On Leave," employee is notified.
- **Reject:** Single click → modal opens with mandatory "Rejection Reason" textarea → on submit, status changes to Rejected, balance is NOT deducted, employee is notified with the rejection reason.

**Bulk approve/reject:**
- Checkboxes on each request. Admin can select multiple pending requests and approve all or reject all in one action.
- Bulk reject still requires a single shared reason.

#### 28.3.2 Leave Request History

A complete log of all leave requests (past and present) across all employees:

- **Filterable by:** employee, leave type, status (Pending / Approved / Rejected / Cancelled / Revoked), date range, role.
- **Sortable by:** submission date, start date, employee name, status.
- **Searchable by:** employee name.
- **Paginated** with all standard controls (Section 12).
- Each entry expandable to show full details: reason, rejection reason (if rejected), supporting document, approval/rejection timestamp, who approved/rejected.

#### 28.3.3 Leave Balance Management

Admin can view and manage leave balances for all employees:

**Leave balance table:**

| Column | Content |
|--------|---------|
| Employee Name | — |
| Role | Recruiter / Reporting Manager. |
| Casual Leave (Allotted / Used / Remaining) | e.g., 12 / 4 / 8 |
| Sick Leave (Allotted / Used / Remaining) | e.g., 10 / 2 / 8 |
| Earned Leave (Allotted / Used / Remaining) | e.g., 15 / 0 / 15 |
| Comp Off (Allotted / Used / Remaining) | e.g., 3 / 1 / 2 |
| Total Leave Taken | Sum of all used leaves across types. |

**Admin actions on balances:**

| Action | Description |
|--------|-------------|
| **Set annual balance** | Admin sets the annual allotment per leave type — globally (default for all employees) or per individual employee (override). |
| **Adjust balance** | Admin can manually credit or debit leave balance (e.g., grant extra Comp Off, correct an error). Each adjustment logged with reason in audit trail. |
| **Carry forward config** | Admin configures whether unused leave carries forward to the next year and how much (e.g., max 5 Casual Leave days carry forward, Sick Leave does NOT carry forward). |
| **Reset balances (yearly)** | At the start of each new year (configurable date, default January 1), balances auto-reset to the annual allotment, with carry-forward applied per policy. BullMQ scheduled job handles this. |
| **View balance history** | Admin can see balance change history per employee — every deduction (from approved leave), credit (from revoked leave, manual adjustment, carry forward), with timestamps and reasons. |

---

### 28.4 Employee Leave View (Self-Service)

Recruiters and Reporting Managers have a dedicated "My Leaves" page:

#### 28.4.1 Apply Leave

- Access the leave request form (Section 28.2) from "My Leaves" page or a prominent "Apply Leave" button on their dashboard.
- View all their submitted requests with statuses.

#### 28.4.2 My Leave Requests

A table showing all the employee's own leave requests:

| Column | Content |
|--------|---------|
| Leave Type | Casual / Sick / etc. |
| Date Range | Start — End. |
| Days | Number of working days. |
| Reason | Their submitted reason. |
| Status | Pending / Approved / Rejected / Cancelled / Revoked. |
| Rejection Reason | Shown only if Rejected — Admin's reason. |
| Submitted On | Timestamp. |
| Actioned On | Timestamp of approval/rejection (if actioned). |
| Actions | **Cancel** button (only visible for Pending requests). |

- Filterable by status, leave type, date range.
- Sortable by date.
- Paginated.

#### 28.4.3 My Leave Balance

A summary card showing the employee's current leave balance:

| Leave Type | Allotted | Used | Remaining |
|-----------|----------|------|-----------|
| Casual Leave | 12 | 4 | **8** |
| Sick Leave | 10 | 2 | **8** |
| Earned Leave | 15 | 0 | **15** |
| Comp Off | 3 | 1 | **2** |

- Visual: progress bar for each type showing used vs. remaining.
- Balance updates in real-time after Admin approves/rejects/revokes.

#### 28.4.4 Leave Calendar (Personal)

- Monthly calendar view showing the employee's own leave days, color-coded by status:
  - **Green:** Approved leave.
  - **Yellow:** Pending request.
  - **Red:** Rejected request.
  - **Gray:** Weekends / Holidays.
- Integrates with the attendance calendar (Section 27.7).

---

### 28.5 Reporting Manager Leave View

Reporting Managers can view leave requests from their assigned recruiters:

| Feature | Description |
|---------|-------------|
| **Team leave requests** | Table showing all leave requests from recruiters assigned under them. Same columns as Admin view but scoped to their team. |
| **Team leave calendar** | Calendar view showing which of their assigned recruiters are on leave on which dates. Useful for planning. |
| **Status visibility** | Can see Pending / Approved / Rejected statuses of their team's requests. |
| **No approval power** | Reporting Managers can view but **cannot** approve or reject leave requests — only Admin can. (This can be made configurable in future if delegation is needed.) |
| **Notification on team leaves** | Reporting Manager receives in-app notification when any of their assigned recruiters' leave requests are approved by Admin. |

---

### 28.6 Leave Notifications

All notifications use the in-app notification system (Section 11). Critical notifications can also be sent via email (configurable).

#### 28.6.1 Notifications to Admin

| Trigger | Notification |
|---------|-------------|
| Employee submits a new leave request | "**[Employee Name]** has submitted a **[Leave Type]** request for **[Start Date] — [End Date]** ([X] days). Reason: [Reason preview]." With quick-action buttons: Approve / Reject / View Details. |
| Employee cancels a pending request | "[Employee Name] has cancelled their [Leave Type] request for [dates]." |
| Leave balance reaches zero for any employee | "[Employee Name]'s [Leave Type] balance has been exhausted (0 days remaining)." |
| Multiple pending requests alert | "You have [X] pending leave requests awaiting action." (Daily summary if pending count > 0.) |

#### 28.6.2 Notifications to Employee

| Trigger | Notification |
|---------|-------------|
| Leave request approved | "Your **[Leave Type]** request for **[Start Date] — [End Date]** has been **approved**. [X] day(s) deducted from your balance. Remaining balance: [Y] days." |
| Leave request rejected | "Your **[Leave Type]** request for **[Start Date] — [End Date]** has been **rejected**. Reason: [Admin's rejection reason]. Your balance remains unchanged." |
| Previously approved leave revoked | "Your approved **[Leave Type]** for **[dates]** has been **revoked** by Admin. Reason: [Revocation reason]. [X] day(s) restored to your balance." |
| Leave balance low warning | "Your **[Leave Type]** balance is low: only **[X]** day(s) remaining." (Triggered when balance drops below configurable threshold, default 2 days.) |

#### 28.6.3 Notifications to Reporting Manager

| Trigger | Notification |
|---------|-------------|
| Assigned recruiter's leave is approved | "[Recruiter Name]'s [Leave Type] for [dates] has been approved. They will be on leave." |
| Assigned recruiter's leave is revoked | "[Recruiter Name]'s approved leave for [dates] has been revoked." |

---

### 28.7 Leave Policies & Rules Engine

Configurable leave policies managed by Admin (via Section 23.12 / Admin Settings):

| Policy | Default | Description |
|--------|---------|-------------|
| `leave.casualLeave.annualAllotment` | 12 days | Annual Casual Leave balance per employee. |
| `leave.sickLeave.annualAllotment` | 10 days | Annual Sick Leave balance per employee. |
| `leave.earnedLeave.annualAllotment` | 15 days | Annual Earned Leave balance per employee. |
| `leave.casualLeave.maxConsecutiveDays` | 3 days | Max consecutive days for a single Casual Leave request. |
| `leave.sickLeave.maxConsecutiveDays` | 7 days | Max consecutive days for a single Sick Leave request without escalation. |
| `leave.earnedLeave.advanceNoticeDays` | 7 days | Minimum advance notice required for Earned Leave requests. |
| `leave.casualLeave.advanceNoticeDays` | 1 day | Minimum advance notice for Casual Leave. |
| `leave.sickLeave.advanceNoticeDays` | 0 days | No advance notice for Sick Leave (same-day / backdated allowed). |
| `leave.sickLeave.backdateLimitDays` | 3 days | Max days a Sick Leave can be backdated. |
| `leave.sickLeave.requiresDocumentAfterDays` | 2 days | Sick Leave requests exceeding this duration require a supporting document (medical certificate). |
| `leave.carryForward.casualLeave` | 5 days max | Max Casual Leave days carried forward to next year. |
| `leave.carryForward.sickLeave` | 0 days | Sick Leave does NOT carry forward. |
| `leave.carryForward.earnedLeave` | 10 days max | Max Earned Leave days carried forward. |
| `leave.lowBalanceWarningThreshold` | 2 days | Notify employee when balance drops below this. |
| `leave.yearResetDate` | January 1 | Date on which annual balances reset (with carry-forward applied). |
| `leave.allowNegativeBalance` | false | If true, employees can apply for leave even with 0 balance (goes negative — treated as Unpaid Leave). If false, requests exceeding balance are blocked or warned. |

All policies configurable by Admin without code changes. Changes take effect immediately for new requests.

---

### 28.8 Leave & Attendance Integration

The leave system is tightly integrated with the Attendance Management System (Section 27):

| Integration Point | Behavior |
|-------------------|----------|
| **Approved leave → Attendance** | When Admin approves a leave request, the AttendanceRecord for each leave day is automatically created/updated with status = `ON_LEAVE` and the leave type noted. This prevents "Absent" flags for approved leave days. |
| **Approved leave → Working timer suppressed** | **If leave is approved for a day, the working timer does NOT start even if the employee logs in on that leave day.** The login is recorded for audit purposes (`leaveLoginAt` field) but: AttendanceRecord status remains `ON_LEAVE`, `grossWorkingMinutes` = 0, `netWorkingMinutes` = 0, no Punch In is recorded as official, the live working hours counter on the employee's dashboard shows "On Leave Today — working timer inactive" instead of a ticking counter. This ensures approved leave days are fully respected and working hours are not artificially inflated by casual logins on leave days. |
| **Revoked leave → Attendance** | When Admin revokes an approved leave, the corresponding AttendanceRecord is updated — status reverted from `ON_LEAVE` to `ABSENT` (unless the employee actually logged in on those days, in which case working hours are retroactively calculated from the audit login timestamps). |
| **Half-day leave → Attendance** | Half-day leave requests update the AttendanceRecord with status = `PRESENT_HALF` and note the leave type for the half not worked. Working hours for the present half are still tracked. |
| **Leave balance deduction** | Balance is deducted ONLY on approval, NOT on submission. Revocation restores the balance. Cancellation of pending requests does not affect balance. |
| **Attendance reports** | Leave days are included in attendance reports (Section 27.11) with the leave type indicated. Working hours show as 0 for full-day leave days. |
| **Leave on holidays** | If an employee applies for leave on a date that is a configured holiday, the system excludes that day from the leave count (holidays don't consume leave balance). |

---

### 28.9 Leave Reports

Integrated with the Admin Reports Management page (Section 20):

| Report | Content |
|--------|---------|
| **Leave Summary Report** | Per-employee leave balance and usage summary for a given period — allotted, used, remaining per leave type. |
| **Leave Request History Report** | All leave requests within a date range — employee, type, dates, days, status, reason, approval/rejection details. |
| **Leave Trend Report** | Trends over time — total leaves taken per month/quarter, by leave type, by team. |
| **Absenteeism vs Leave Report** | Correlation of unmarked absences vs. approved leaves — identifies employees who are frequently absent without applying leave. |
| **Leave Balance Forecast** | Projected balance depletion — at current usage rate, when will each employee exhaust their balance for each type. |

All leave reports available in XLSX format for download and schedulable via email (Section 20).

---

### 28.10 Leave Calendar (Team-Wide / Admin View)

A visual team-wide calendar showing all employees' leave status:

| Feature | Description |
|---------|-------------|
| **Monthly view** | Calendar grid — rows are employees, columns are dates. Each cell color-coded: green (approved leave), yellow (pending request), gray (weekend/holiday), white (working day). |
| **Conflict detection** | If too many employees on the same team are on leave on the same day, highlight the date with a warning color. Admin can configure a threshold (e.g., alert if > 30% of team is on leave same day). |
| **Quick approve from calendar** | Admin can click a pending leave cell on the calendar to view details and approve/reject inline. |
| **Export** | Calendar exportable as PNG or PDF for printing/sharing. |

---

### 28.11 Employee Leave Request Cancellation

| Rule | Description |
|------|-------------|
| **Cancel pending request** | Employee can cancel their own leave request while it is in **Pending** status. One-click cancel with confirmation dialog. |
| **Cancel approved leave (before start date)** | Employee can request cancellation of an approved leave if the leave start date has NOT yet arrived. This creates a cancellation request that Admin must approve. If Admin approves cancellation, balance is restored. |
| **Cancel approved leave (after start date)** | Employee CANNOT cancel approved leave after the start date has passed. Only Admin can revoke at this point. |
| **Auto-cancel stale requests** | Pending requests that are not actioned by Admin before the leave start date can be auto-escalated (notification to Admin) or auto-cancelled (configurable policy). |

---

### 28.12 Database Entities for Leave Management

These entities supplement the schema in Section 17 and extend the entities in Section 27.14:

**`LeaveType` (Admin-configurable leave types):**
- id, name (String — e.g., "Casual Leave"), code (String — e.g., "CASUAL"), description (Text), isPaid (Boolean), isActive (Boolean), requiresDocument (Boolean), requiresDocumentAfterDays (Integer, nullable), maxConsecutiveDays (Integer, nullable), advanceNoticeDays (Integer, default 0), createdAt, updatedAt.

**`LeaveRequest` (employee-submitted leave requests):**
- id, userId (FK → User — the requesting employee), leaveTypeId (FK → LeaveType), startDate (Date), endDate (Date), isHalfDay (Boolean, default false), halfDayPeriod (FIRST_HALF | SECOND_HALF, nullable), numberOfDays (Decimal — computed, accounts for half-days), reason (Text), supportingDocumentUrl (String, nullable — file URL on R2/Cloudinary), emergencyContact (String, nullable), status (PENDING | APPROVED | REJECTED | CANCELLED | REVOKED), rejectionReason (Text, nullable — Admin's reason), revocationReason (Text, nullable — Admin's reason), actionedBy (FK → User, nullable — Admin who approved/rejected), actionedAt (DateTime, nullable), createdAt, updatedAt.

**`LeaveBalance` (extended from Section 27.14):**
- id, userId (FK → User), leaveTypeId (FK → LeaveType), year (Integer — e.g., 2026), totalAllotted (Integer), carriedForward (Integer, default 0), manualAdjustment (Integer, default 0 — positive for credits, negative for debits), used (Integer), remaining (Integer — computed: totalAllotted + carriedForward + manualAdjustment − used), updatedAt.

**`LeaveBalanceHistory` (audit trail of all balance changes):**
- id, leaveBalanceId (FK → LeaveBalance), changeType (ALLOTMENT | CARRY_FORWARD | MANUAL_ADJUSTMENT | DEDUCTION | RESTORATION | YEARLY_RESET), changeAmount (Integer — positive or negative), balanceBefore (Integer), balanceAfter (Integer), reason (Text, nullable), changedBy (FK → User), leaveRequestId (FK → LeaveRequest, nullable — linked if change was from a leave request action), createdAt.

**`LeavePolicyConfig` (stored in settings table or dedicated config table):**
- All policies from Section 28.7 stored as key-value pairs with data types.

---

## 29. DOCUMENT UPLOAD & KYC VERIFICATION SYSTEM

> **A robust Document Upload Section for employees (recruiters and reporting managers).** Employees upload required identity, qualification, and employment documents. Admin verifies each document from the admin panel. The system includes offer letter/agreement generation from a template, automated verification for platform-generated documents, secure cloud storage with signed URLs, and notification-driven verification workflow.

**Applies to:** Recruiters and Reporting Managers upload their own documents. Admin manages verification, generates offer letters/agreements, and has full control over document statuses.

---

### 29.1 Required Document Types

Employees (recruiters and reporting managers) must upload the following documents:

| # | Document Type | Code | Accepted Formats | Required? | Description |
|---|--------------|------|-------------------|-----------|-------------|
| 1 | **Aadhaar Card** | `AADHAAR` | PDF, JPEG, PNG | Mandatory | Government-issued identity card. Front and back (or single PDF with both sides). |
| 2 | **PAN Card** | `PAN` | PDF, JPEG, PNG | Mandatory | Permanent Account Number card for tax identification. |
| 3 | **Resume** | `RESUME` | PDF | Mandatory | Employee's professional resume / CV. |
| 4 | **Bank Details** | `BANK_DETAILS` | PDF, JPEG, PNG | Mandatory | Bank passbook front page or cancelled cheque — showing account number, IFSC code, account holder name. |
| 5 | **Offer Letter & Agreement** | `OFFER_LETTER` | PDF, JPEG, PNG | Mandatory | Signed offer letter/agreement — either the PDF generated by Admin from the platform (Section 29.4) provided to the employee, or a scanned copy of the physical signed version. |

**Extensibility:**
- Admin can add new document types from the Admin Settings page (Section 23.12 / 23.19) without code changes. Each document type has: name, code, accepted formats, isRequired (Boolean), description, isActive (Boolean).
- Examples of additional document types Admin may add: Educational Certificates, Experience Letters, Address Proof, Passport, Driving License.

---

### 29.2 Employee Document Upload Interface

A dedicated **"My Documents"** page accessible to all employees (recruiters and reporting managers) from their sidebar/dashboard.

#### 29.2.1 Upload Interface Layout

| Element | Description |
|---------|-------------|
| **Document list** | A card or table for each required document type showing: document name, upload status (Not Uploaded / Uploaded / Verified / Rejected), uploaded file preview/thumbnail, upload date, verification status badge. |
| **Upload action** | Each document card has an "Upload" button (if not yet uploaded) or "Re-upload" button (to replace an existing upload). |
| **File picker** | Standard file picker with drag-and-drop support. |
| **Preview** | After upload, show a thumbnail preview (for images) or a PDF icon with filename (for PDFs). Employee can click to view full-size preview. |
| **Status badges** | Color-coded per document: Gray = "Not Uploaded," Yellow = "Pending Verification," Green = "Verified ✅," Red = "Rejected ❌." |
| **Rejection reason** | If a document is rejected by Admin, the rejection reason is displayed below the document card so the employee knows what to fix and re-upload. |
| **Overall KYC status** | A summary banner at the top: "KYC Status: X of Y documents verified." Progress bar showing completion. All documents verified = "KYC Complete ✅." |

#### 29.2.2 Upload Rules & Validation

| Rule | Description |
|------|-------------|
| **File size limit** | Max 5MB per file (configurable). |
| **File type validation** | Validated by magic bytes on the server (not just extension) — same security as Section 24.11. |
| **Single file per document type** | Each document type accepts one file. Uploading a new file replaces the previous one (previous version is retained in history for audit). |
| **Required documents** | Employee cannot be marked as "KYC Complete" until all mandatory documents are uploaded AND verified. |
| **Re-upload after rejection** | If a document is rejected, the employee can re-upload. The new upload resets the status to "Pending Verification." |
| **Re-upload after verification** | If a document is already verified, the employee can still re-upload (e.g., updated Aadhaar). The new upload resets the status to "Pending Verification" — Admin must re-verify. |
| **Virus/malware scanning** | All uploaded files are scanned for malware before storage (same pipeline as Section 24.11). Infected files are rejected with a clear error message. |

---

### 29.3 Cloud Storage & Security

Documents uploaded by employees (recruiters and reporting managers) are saved to R2/Cloudinary with full security measures.

**Storage:**

| Aspect | Configuration |
|--------|---------------|
| **Storage destination** | Cloudflare R2 or Cloudinary (same as profile photos and reports — Section 15). |
| **Storage path convention** | `documents/{userId}/{documentTypeCode}/{uuid}.{ext}` (e.g., `documents/user-abc/AADHAAR/550e8400.pdf`). |
| **Filename** | UUID-generated — never user-supplied filenames (prevents path traversal and name collision). |
| **Version history** | Previous versions of a document are NOT deleted when a new version is uploaded. Old versions are moved to an archive path: `documents/{userId}/{documentTypeCode}/archive/{uuid}.{ext}`. Admin can view version history. |

**Security:**

| Measure | Description |
|---------|-------------|
| **Signed URLs** | All document access URLs are **pre-signed with expiry** (e.g., 15-minute signed URL). Documents are NOT publicly accessible. Every view/download request generates a fresh signed URL. |
| **Signed key authentication** | Signed URLs use HMAC-based key signing (R2 pre-signed URLs or Cloudinary signed delivery). Keys are stored securely in environment variables. |
| **Access control** | Documents are accessible ONLY to: the owning employee (their own documents) and Admin. Reporting Managers CANNOT view their recruiters' documents. |
| **Encryption at rest** | R2 encrypts at rest by default (SSE). Verify Cloudinary encryption. Same as Section 25.4. |
| **Content-Disposition** | Files served with `Content-Disposition: attachment` header to prevent browser from executing uploaded files. |
| **Separate subdomain** | Documents served from a separate subdomain or CDN path (not the main app domain) to prevent cookie leakage. |
| **EXIF stripping** | For image uploads (Aadhaar, PAN photos): strip EXIF metadata before storage to remove GPS coordinates and device info (privacy). |
| **Audit logging** | Every document upload, download, view, verification, and rejection is logged in the audit trail (Section 23.1). |

---

### 29.4 Offer Letter & Agreement Generation (Admin)

Admin generates offer letters/agreements from a template within the platform. The generated document is provided to employees (offline or electronically), and employees then upload the signed version back to the platform.

#### 29.4.1 Offer Letter Template — Two Generation Variants

The offer letter generation system supports **two variants** for creating offer letters. Admin can choose either variant when generating an offer letter. Both variants share the same **static header, static footer, and watermark** — the difference is in how the body content is produced. **Data automatically applies to both variants** — dynamic fields (Section 29.4.2) are available in both, and the generated PDF output is identical in format regardless of which variant is used.

**Variant selector:** When Admin initiates offer letter generation, a toggle/tab lets them choose:
```
┌─────────────────────────────┬──────────────────────────────┐
│  Template (Static+Dynamic)  │  Rich Text Editor (Tiptap)   │
└─────────────────────────────┴──────────────────────────────┘
```

---

##### 29.4.1.1 Shared Static Header & Footer (Both Variants)

Both variants use the same static header and footer. These are fixed elements that appear on every generated offer letter — they are NOT editable by Admin during generation (they are baked into the template/layout).

> **Reference document:** The header, footer, body structure, and signatory layout described below are based on the actual OMG offer letter PDF (Opportunity_Makers__Letter_Head.pdf) analyzed in Section 29.4.1.4. All findings from that document are reflected in this layout specification.

**Header layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────┐                                   │
│  │ [OMG Logo + Tagline]     │                   Date: DD-MMM-YYYY│
│  │ OPPORTUNITY MAKERS GROUP │                                   │
│  │ "You dream it, we make it."                                  │
│  └──────────────────────────┘                                   │
│                                                                 │
│                        Offer Letter                             │
│                     (centered, italic)                          │
└─────────────────────────────────────────────────────────────────┘
```

| Element | Position | Description |
|---------|----------|-------------|
| **Company Logo + Name + Tagline** | **Top-left** of header | OMG circular logo emblem (blue/gold) + "OPPORTUNITY MAKERS GROUP" in large bold text + tagline "You dream it, we make it." in yellow/gold italic below the company name. |
| **Date** | **Top-right** of header | "Date: DD-MMM-YYYY" (e.g., "Date: 23-Dec-2025"). Dynamic — auto-set to generation date or editable by Admin. |
| **Offer Letter Title** | **Centered below** the logo and date row | Text: "Offer Letter" — displayed in italic, centered horizontally on the page. |
| **Decorative corner elements** | **Top-right and bottom-left corners** of the page | Geometric triangular design elements in blue and gold/yellow — decorative branding, not content. Baked into the template. |

**Footer layout:**

The footer is positioned at the **bottom of the page** with contact information and the company website.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                              info@opportunitymakers.in  [✉]    │
│                                                                 │
│                                 302-Village Dhogri Road,  [📍]  │
│                    Tehsil Nangal Salempur-1, Jalandhar,         │
│                                         Punjab 144004          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  (yellow bar)        www.opportunitymakers.in               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

| Element | Position | Description |
|---------|----------|-------------|
| **Email** | **Right-aligned** in footer area | `info@opportunitymakers.in` with a mail/envelope icon (✉) beside it. |
| **Address** | **Right-aligned** below email | Full address: "302-Village Dhogri Road, Tehsil Nangal Salempur-1, Jalandhar, Punjab 144004" with a location pin icon (📍) beside it. |
| **Website** | **Bottom yellow bar** spanning full width | `www.opportunitymakers.in` displayed inside a yellow/gold colored horizontal bar at the very bottom of the page. The bar spans the full page width as a footer accent. |

**Watermark:**
- OMG/OMG Teams platform watermark embedded in the background of every page (subtle, semi-transparent — visible enough for verification but doesn't obscure content).

**Below body content — Signatory:**
- Below the body content (whether from template or Tiptap editor), on the **bottom-left side**, the following signatory block is displayed:

```
Shalini Singh|HR Manager
```

- "Shalini Singh" — name of the HR Manager / authorized signatory. Displayed in bold.
- "|HR Manager" — designation, displayed immediately after the name separated by a pipe character, matching the format used in the actual OMG offer letter.
- Positioned on the **left side** of the page, below the body content and above the footer (matching the actual OMG offer letter layout — see Section 29.4.1.4 PDF analysis).
- The platform owner's or authorized signatory's **signature image** (e.g., PNG of handwritten signature) can be placed above the name (optional — as specified in the original template, embedded automatically).

---

##### 29.4.1.2 Variant 1: Static + Dynamic Template

This is the **pre-built template variant** where the body content is fixed boilerplate legal text with dynamic field placeholders that are auto-filled with employee data.

**Template location:** The offer letter/agreement template is stored in the codebase as a structured template file (HTML-to-PDF or DOCX template).

**Template static body content (baked into the template):**

| Element | Description |
|---------|-------------|
| **Static body content** | Standard offer letter/agreement legal clauses, terms and conditions, employment terms, confidentiality clauses, non-compete clauses, notice period terms, compensation structure description, and all other boilerplate legal text. This content is NOT editable by Admin during generation — it is fixed in the codebase template. |
| **Dynamic field placeholders** | Within the static body text, placeholders like `{{employeeName}}`, `{{employeeId}}`, `{{dateOfJoining}}`, `{{ctc}}` etc. are replaced with actual employee data at generation time (Section 29.4.2). |

**When to use:** Use this variant when generating standard, uniform offer letters with the same legal content for all employees — only the employee-specific data changes.

---

##### 29.4.1.3 Variant 2: Static Header/Footer + Tiptap Rich Text Editor Body

This variant uses the same static header and footer as Variant 1, but the **body content is completely customizable** by Admin using a **Tiptap rich text editor** — a full-featured HTML editor integrated into the offer letter generation page.

**Tiptap Rich Text Editor Integration:**

The body section of the offer letter is replaced with a **Tiptap rich text editor** (https://tiptap.dev) that gives Admin full control over the body content with all the features and functionalities that a rich text / HTML editor has.

**Editor features (all required — every feature that a rich text editor has):**

| Category | Features |
|----------|----------|
| **Text formatting** | **Bold**, **Italic**, **Underline**, **Strikethrough**, Subscript, Superscript. |
| **Text alignment** | Left align, Center align, Right align, Justify. |
| **Text color** | Text/font color picker — full color palette or custom hex/RGB input. |
| **Text highlight color** | Background highlight color picker — for highlighting text with a background color (like a marker). |
| **Font size** | Font size selector — dropdown or input (e.g., 8pt, 10pt, 12pt, 14pt, 16pt, 18pt, 20pt, 24pt, 28pt, 36pt, 48pt, 72pt). |
| **Font family** | Font family selector — dropdown with available fonts (e.g., Arial, Times New Roman, Helvetica, Georgia, Courier New, Verdana, and more). |
| **Text case** | Uppercase, Lowercase, Title Case, Sentence Case transformations. |
| **Lists** | Ordered list (numbered), Unordered list (bulleted), Nested lists (indent/outdent). |
| **Headings** | Heading levels: H1, H2, H3, H4, H5, H6. Paragraph (normal text). |
| **Block elements** | Blockquote, Code block, Horizontal rule/divider. |
| **Links** | Insert/edit hyperlink (URL, display text, open in new tab option). |
| **Images** | Insert image (upload or URL). Resize, align (left, center, right, inline). |
| **Tables** | Insert table, add/remove rows and columns, merge/split cells, table borders, cell padding, cell background color. |
| **Indentation** | Increase indent, Decrease indent. |
| **Undo / Redo** | Full undo/redo history with `Ctrl+Z` / `Ctrl+Y` keyboard shortcuts. |
| **Clear formatting** | Remove all formatting from selected text. |
| **Find & Replace** | Find text within the editor content, replace individual or all occurrences. |
| **Special characters** | Insert special characters (©, ™, §, ¶, €, ₹, etc.). |
| **Line spacing** | Line height / spacing control (1.0, 1.15, 1.5, 2.0, custom). |
| **Page break** | Insert page break (for multi-page offer letters). |
| **Placeholder/variable insertion** | Insert dynamic field placeholders (e.g., `{{employeeName}}`, `{{employeeId}}`) via a dropdown/button — these are replaced with actual employee data at PDF generation time, same as Variant 1. |
| **Full-screen mode** | Expand editor to full-screen for distraction-free editing. |
| **Source code view** | Toggle to view/edit the raw HTML source code of the content (for advanced users). |
| **Toolbar** | All features accessible via a toolbar at the top of the editor. Toolbar is sticky (stays visible on scroll). Grouped logically (text formatting group, alignment group, color group, list group, etc.). |

**Character / line limit validation:**

The Tiptap editor body has content limits to prevent Admin from writing too much and exceeding the page boundaries of the generated PDF. Without this validation, the body content could overflow beyond the printable area, causing truncated or multi-page documents where a single page was intended.

| Validation | Specification |
|------------|---------------|
| **Character limit** | Maximum character count enforced on the editor body content (configurable, default: 5,000 characters). Counts plain text characters (excludes HTML tags/markup — only visible text counts). |
| **Line limit** | Maximum number of lines enforced (configurable, default: 80 lines). A "line" is defined as one visual line of text at the default font size — line breaks, new paragraphs, list items, and empty lines all count. |
| **Live counter** | A real-time counter displayed below the editor: "X / 5,000 characters | Y / 80 lines". Updates on every keystroke and paste action. |
| **Warning threshold** | At 90% of the limit (e.g., 4,500 characters / 72 lines), the counter changes color to amber/yellow as a warning. |
| **Limit enforcement** | At 100% of the limit, the counter changes to red. Further typing is blocked — new characters are not accepted. A tooltip/message appears: "Character/line limit reached. Please reduce content to fit within the page." |
| **Paste enforcement** | If a paste action would exceed the limit, the paste is partially applied up to the remaining capacity, and a warning toast is shown: "Pasted content was trimmed to fit within the character/line limit." |
| **Admin configuration** | The character limit and line limit values are configurable from Admin Settings (Section 23.12) so they can be adjusted if the page layout or font size changes. |
| **Font-size impact** | If Admin uses larger font sizes, fewer characters will fit on the page. The line limit accounts for this approximately — but the character limit is the primary safeguard. Admin should preview the PDF before finalizing. |

**Copy-paste with formatting preservation:**

When Admin copies text from an external source (Word document, Google Docs, email, webpage, another application) and pastes it into the Tiptap rich text editor, the editor **picks up and preserves the exact text formatting from the copied source** so Admin does not have to manually re-apply formatting.

| Aspect | Specification |
|--------|---------------|
| **Paste with formatting (default)** | When Admin pastes content (`Ctrl+V` / `Cmd+V`), the Tiptap editor preserves the original formatting from the clipboard: bold, italic, underline, strikethrough, font size, font family, text color, highlight/background color, alignment, lists (ordered/unordered), headings, links, tables, indentation, line spacing — all formatting is carried over exactly as it appeared in the source. |
| **HTML clipboard support** | The paste handler reads the `text/html` MIME type from the clipboard (which most applications provide when copying formatted text). The Tiptap editor parses this HTML and applies the corresponding formatting to the pasted content within the editor. |
| **Paste as plain text (alternative)** | Admin can also paste as plain text (stripping all formatting) using `Ctrl+Shift+V` / `Cmd+Shift+V`. This inserts only the raw text without any formatting from the source. |
| **Sanitization** | Pasted HTML is sanitized to remove potentially dangerous elements (scripts, iframes, event handlers) while preserving safe formatting tags (bold, italic, spans with styles, lists, tables, headings, links, images). |
| **Image paste** | If the copied content includes images (e.g., from a Word document), the images are extracted, uploaded to cloud storage (R2/Cloudinary), and inserted into the editor with the cloud URL — they are NOT stored as base64 inline data. |
| **Table paste** | Tables from Excel, Google Sheets, or Word are converted to HTML tables with cell content, borders, and basic formatting preserved. |

**When to use:** Use this variant when Admin needs to create a **custom, one-off offer letter** with unique content for a specific employee — different from the standard template. Or when the body content needs special formatting, custom clauses, tables, or any content that doesn't fit the fixed template.

**Data interoperability between variants:**
- **Dynamic fields apply to both variants.** The same employee data (Section 29.4.2) is available in both — in Variant 1 via template placeholders, in Variant 2 via the placeholder insertion button in the Tiptap editor.
- **Header and footer are identical** in both variants — same logo, title, contact info, website, footer, watermark, and signatory block.
- **The generated PDF output format is the same** regardless of which variant is used — same paper size, margins, header/footer placement, watermark, signatory position. The only difference is the body content source (fixed template vs. Tiptap editor content).
- **Admin can switch between variants** before generation. If Admin starts with the Tiptap editor, types some content, then switches to the Template variant — the Tiptap content is preserved (not lost) so Admin can switch back. However, the Template variant always shows the fixed template content (it does not merge with Tiptap content).
- **Saved Tiptap content:** If Admin uses the Tiptap variant, the HTML content is saved alongside the generated PDF in the `OfferLetter` database entity (in the `editorContent` field — JSONB/HTML) so it can be loaded back for re-editing if the offer letter needs to be re-generated.

##### 29.4.1.4 Reference PDF Analysis — Actual OMG Offer Letter

The following analysis is based on the actual Opportunity Makers Group offer letter PDF (`Opportunity_Makers__Letter_Head.pdf`) uploaded as a reference document. This documents the exact layout, static content, dynamic fields, and visual elements of the real offer letter, which should be faithfully replicated in both template variants.

**Overall page layout:**
- Single-page A4 portrait document.
- White background with decorative geometric elements (yellow and dark blue/navy triangular corners at top-left and top-right).
- Professional, clean design with ample white space.
- Font: Times New Roman (body text), with bold variants for headings and emphasis.

**Header (top of page):**

```
┌─────────────────────────────────────────────────────────────────┐
│  [OMG Logo + "OPPORTUNITY         (decorative yellow/blue       │
│   MAKERS GROUP" text +             triangular corner)            │
│   "You dream it, we make it."                                   │
│   tagline in yellow/green italic]                               │
│                                                                 │
│                                            Date: 23-Dec-2025   │
│                        Offer Letter                             │
│                     (centered, italic)                          │
└─────────────────────────────────────────────────────────────────┘
```

| Element | Position | Details |
|---------|----------|---------|
| **OMG Logo** | **Top-left** | Circular logo with blue/yellow design featuring a checkmark/leaf motif inside a circle. |
| **Company name** | **Right of logo** (top-left block) | "OPPORTUNITY MAKERS GROUP" — large, bold, dark text. Two-line treatment: "OPPORTUNITY" on first line, "MAKERS GROUP" on second line. |
| **Tagline** | **Below company name** (top-left block) | *"You dream it, we make it."* — italic, yellow/olive-green color. |
| **Date** | **Top-right** | "Date: 23-Dec-2025" — right-aligned. **Dynamic field** — the date of issue. |
| **Offer Letter title** | **Centered**, below the logo/date line | "Offer Letter" — italic, centered on the page. Not bold — uses italic styling. |
| **Decorative elements** | **Corners** | Yellow and dark navy blue triangular geometric shapes in the top-left and top-right corners (purely decorative, part of the letterhead design). |

**Body content:**

The body starts after the header and contains the following structure:

| # | Section | Content | Type |
|---|---------|---------|------|
| — | **Greeting** | "Dear Simarjot Kaur ," | **Dynamic** — `{{employeeName}}` |
| — | **Introduction paragraph** | "With reference to your interview at our organization, we are pleased to extend an offer for the position of **Hiring Associate (Work From Home)** with **Opportunity Makers Group**, on the terms and conditions mutually agreed and mentioned below:" | **Mixed** — static text with dynamic fields: `{{positionTitle}}` (bold), static company name (bold) |
| 1 | **APPOINTMENT** | "This appointment is effective from **23rd December 2025**." | **Mixed** — static text + dynamic `{{joiningDate}}` (bold) |
| 2 | **EMOLUMENTS** | "Your monthly in-hand salary will be **Rs. 20,000/-**, payable directly to your registered bank account." | **Mixed** — static text + dynamic `{{salaryAmount}}` (bold) |
| 3 | **OFFICE TIMINGS AND LEAVES** | "Office timings will be 10:00 AM to 6:00 PM (WFH) with Sunday as weekly off. Leave must be informed at least one day in advance, subject to company policy." | **Static** — may be partially dynamic for office timing/WFH specifics |
| 4 | **Terms & Conditions** | "You shall be on probation for a period of **2 months** from the date of joining, during which your performance and suitability for the position will be evaluated. **Notice Period: 15 Days**" | **Mixed** — static text + dynamic `{{probationPeriod}}` (bold) and `{{noticePeriod}}` (bold) |
| 5 | **Code of Conduct & Policies** | "You are expected to comply with company policies, maintain discipline, safeguard confidential information, and uphold professionalism and ethical hiring practices at all times." | **Static** |
| 6 | **Acknowledgment & Acceptance** | "By signing below, the candidate confirms acceptance of all terms and conditions of this offer" | **Static** |
| — | **Welcome message** | ***"We welcome you to the Opportunity Makers Group family and wish you success in your onboarding and future with us."*** | **Static** — bold and italic |

**Body formatting observations:**
- Numbered sections (1–6) use numbered list formatting with bold section headings (e.g., "**1. APPOINTMENT**").
- Section headings in uppercase or title case with bold.
- Body text paragraphs are indented under their section heading.
- Dynamic values within body text are displayed in **bold** (salary, dates, probation period, notice period, position title).
- Company name "Opportunity Makers Group" is always in **bold** when mentioned.

**Signatory (below body, above footer):**

```
Shalini Singh|HR Manager
```

| Element | Position | Details |
|---------|----------|---------|
| **Signatory name** | **Bottom-left** of page, below body content | "Shalini Singh" — bold text. |
| **Designation** | **Immediately after name**, separated by pipe `|` | "HR Manager" — on same line, separated by pipe character. Format: `Shalini Singh|HR Manager`. |
| **Position** | **Left-aligned**, NOT right-aligned | The signatory is on the left side of the page in the actual PDF (differs from some initial spec assumptions). |

**Footer (bottom of page):**

The footer is a distinct bottom section with contact information and website:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                          info@opportunitymakers.in  [📧 icon]   │
│                                                                 │
│                           302-Village Dhogri Road,  [📍 icon]   │
│                 Tehsil Nangal Salempur-1, Jalandhar,            │
│                              Punjab 144004                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [yellow bar]   www.opportunitymakers.in                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

| Element | Position | Details |
|---------|----------|---------|
| **Email** | **Right-aligned**, footer area | `info@opportunitymakers.in` — with a mail envelope icon (📧) to the right of the text. |
| **Address** | **Right-aligned**, below email | `302-Village Dhogri Road, Tehsil Nangal Salempur-1, Jalandhar, Punjab 144004` — with a location pin icon (📍) to the right. Multi-line, right-aligned. |
| **Website** | **Full-width yellow bar** at very bottom | `www.opportunitymakers.in` — displayed inside a yellow/gold horizontal bar that spans the full page width. The website URL is right-aligned within this bar. This is the most prominent footer element. |

**Dynamic fields identified from the PDF (summary for Section 29.4.2):**

| Dynamic Field | Example Value in PDF | Placeholder |
|---------------|---------------------|-------------|
| Employee Name | "Simarjot Kaur" | `{{employeeName}}` |
| Position Title | "Hiring Associate (Work From Home)" | `{{positionTitle}}` |
| Date of Issue | "23-Dec-2025" | `{{dateOfIssue}}` |
| Joining Date | "23rd December 2025" | `{{joiningDate}}` |
| Salary Amount | "Rs. 20,000/-" | `{{salaryAmount}}` |
| Probation Period | "2 months" | `{{probationPeriod}}` |
| Notice Period | "15 Days" | `{{noticePeriod}}` |

**Static elements (fixed in template, not editable):**
- OMG logo and company name block
- Tagline "You dream it, we make it."
- Decorative corner elements (yellow/navy triangles)
- "Offer Letter" title
- All section heading text (APPOINTMENT, EMOLUMENTS, etc.)
- All boilerplate legal text within sections
- Welcome message
- Signatory block ("Shalini Singh|HR Manager")
- Footer contact info (email, address, website)
- Yellow website bar

#### 29.4.2 Dynamic Fields (Auto-Populated)

When Admin generates an offer letter for an employee, the following fields are **automatically pre-filled** from the employee's account information:

| Dynamic Field | Source |
|---------------|--------|
| Employee Full Name | From user account (firstName + lastName). Used in greeting: "Dear {{employeeName}}," |
| Employee Email | From user account email. |
| Employee Role | Recruiter / Reporting Manager (from user role). |
| Position Title | Job title/designation (e.g., "Hiring Associate (Work From Home)"). Manually set by Admin or from role config. Displayed bold in the introduction paragraph. |
| Date of Joining | From employee record or manually set by Admin. Used in Section 1 (Appointment). |
| Employee ID | Auto-generated Employee ID (e.g., `OMG-0042` — Section 6.3.1). |
| Reporting Manager Name(s) | From assigned reporting manager(s). |
| Date of Issue | Auto-set to current date (editable). Displayed in header as "Date: DD-Mon-YYYY". |
| Offer Letter Reference Number | Auto-generated (sequential, e.g., `HF/OL/2026/001`). |
| Salary Amount | Monthly in-hand salary (e.g., "Rs. 20,000/-"). Manually set by Admin. Displayed bold in Section 2 (Emoluments). |
| Probation Period | Duration of probation (e.g., "2 months"). Manually set by Admin. Displayed bold in Section 4 (Terms & Conditions). |
| Notice Period | Required notice period (e.g., "15 Days"). Manually set by Admin. Displayed bold in Section 4 (Terms & Conditions). |
| Compensation / CTC details | Full CTC breakdown if available in the system, or left for Admin to fill manually. |

**Admin can manually add or change any pre-filled field** if anything is missing or incorrect. Admin can also fill fields that are not available in the system (e.g., specific compensation details, probation period, special clauses).

#### 29.4.3 Generation Workflow

| Step | Description |
|------|-------------|
| **1. Trigger** | Admin can generate an offer letter at two points: (a) **During account creation** — while creating a recruiter or reporting manager account, there is an option/section for "Generate Offer Letter/Agreement." (b) **After account creation** — from the Employees Management page (Section 6.4), Admin can generate an offer letter for any employee whose offer letter has not yet been generated. |
| **2. Preview & Edit** | Admin sees a preview of the offer letter with all dynamic fields pre-filled. Admin can edit any field, add missing info, or modify pre-filled values before generation. |
| **3. Generate** | Admin clicks "Generate" → the system renders the template with all dynamic + static content into a **PDF file**. The PDF includes the header, footer, watermark, owner signature, all legal content, and all employee-specific details. |
| **4. Save to cloud** | The generated offer letter PDF is saved to R2/Cloudinary at path: `documents/offer-letters/generated/{userId}/{referenceNumber}.pdf`. |
| **5. Download** | The generated offer letter is immediately downloadable by Admin. Admin can also re-download it later from the employee's profile or the document management section. |
| **6. Provide to employee** | Admin provides the generated offer letter to the employee offline (printed physical copy for signing, or electronically via email/other channel). |
| **7. Employee uploads signed copy** | Employee uploads the signed offer letter/agreement back to the platform via their "My Documents" page (Section 29.2), under the "Offer Letter & Agreement" document type. |

#### 29.4.4 Automatic Verification of Platform-Generated Offer Letters

When an employee uploads an offer letter/agreement, the system should attempt to **automatically verify** whether the uploaded document matches a platform-generated offer letter:

**Verification approach:**

| Method | Description |
|--------|-------------|
| **Watermark detection** | Check if the uploaded PDF/image contains the OMG Teams platform watermark. The watermark is a known pattern — use image processing or PDF content analysis to detect its presence. |
| **Reference number matching** | Extract text from the uploaded document (OCR if scanned image, PDF text extraction if PDF) and search for the offer letter reference number (e.g., `HF/OL/2026/001`). Match against the reference number stored in the database for this employee's generated offer letter. |
| **Hash comparison (for PDF uploads)** | If the employee uploads the exact PDF file that Admin generated (not a scanned physical copy), compare the file hash (SHA-256) of the uploaded file against the hash of the originally generated file stored in the database. Exact match = verified. |
| **Content fingerprinting** | Extract key text blocks from the uploaded document and compare against the generated template's known content fingerprints. |

**Verification outcomes:**

| Outcome | Action |
|---------|--------|
| **Auto-verified (high confidence)** | Uploaded document matches the platform-generated offer letter (hash match, or watermark + reference number detected). Status automatically set to **"Verified ✅."** Admin is notified: "[Employee Name]'s offer letter was auto-verified." The detection should be accurate — only auto-verify on high-confidence matches. |
| **Auto-verification inconclusive (low confidence)** | Document could not be confidently matched (e.g., scanned copy with poor quality, no watermark detected, reference number not found). Status set to **"Pending Verification."** Admin must review manually. |
| **Manual review required** | Admin reviews the uploaded document himself and manually verifies or rejects. This is the fallback for all cases where auto-verification is inconclusive. |

**The detection should be accurate.** If not detected confidently, the system falls back to manual Admin review. Better to require manual review than to auto-verify incorrectly. This provides convincing verification for Admin while maintaining accuracy.

#### 29.4.5 Offer Letter Management (Admin)

| Feature | Description |
|---------|-------------|
| **Generation history** | Admin can view all generated offer letters — employee name, reference number, generated date, generated by (Admin), download link. |
| **Re-generate** | Admin can re-generate an offer letter for an employee (e.g., if terms changed). Previous version is archived, new version created with a new reference number. |
| **Bulk generation** | Admin can generate offer letters for multiple new employees at once (e.g., during batch onboarding). |
| **Template versioning** | If the offer letter template changes (updated legal clauses, new branding), previously generated letters retain their original template version. Only new generations use the updated template. |

---

### 29.5 Admin Document Verification Panel

Admin has a dedicated document verification interface to review and verify employee documents.

#### 29.5.1 Verification Dashboard

**Pending verifications queue:**
- A list/table of all documents with "Pending Verification" status across all employees.
- Columns: Employee Name, Role, Document Type, Uploaded On, File Preview/Link, Actions (Verify / Reject).
- Sorted by: upload date (oldest pending first — FIFO).
- Filterable by: document type, employee, date range.
- **Count badge** on the sidebar: "X documents pending verification."

**Per-employee document view:**
- When Admin views an employee's profile (Section 6.4), there is a "Documents" tab showing all that employee's documents with their statuses.
- Admin can view/download each document and take action.

#### 29.5.2 Verification Actions

| Action | Description |
|--------|-------------|
| **Verify** | Admin clicks "Verify" → document status changes to **"Verified ✅."** One-click action with optional confirmation. Admin can add an optional verification note. |
| **Reject** | Admin clicks "Reject" → modal opens with mandatory **rejection reason** textarea (e.g., "Image is blurry," "Wrong document uploaded," "Name mismatch") → document status changes to **"Rejected ❌."** Employee is notified with the rejection reason. |
| **Change Verified → Pending** | Admin can change a previously verified document back to **"Pending Verification"** (e.g., if Admin realizes the verification was incorrect, or if the document needs re-review). |
| **Change Pending → Verified** | Standard verify action. |
| **Change Rejected → Pending** | Admin can revert a rejection to Pending (e.g., if the rejection was a mistake). Employee is notified. |

**Admin can change document status in any direction** — Verified ↔ Pending ↔ Rejected — at any time. Every status change is logged in the audit trail (Section 23.1) with: old status, new status, reason, Admin who changed it, timestamp.

#### 29.5.3 Verification Status Toggle

**Admin verification toggle: Verified / Pending per document on their panel.**

- Each document in the Admin's employee document view has a clear **status toggle / badge** showing the current verification state.
- Admin can toggle between Verified and Pending with one click (or click to open the verify/reject action dialog for rejection).
- The toggle is prominent and easily accessible — no need to navigate deep into settings.
- Batch verification: Admin can select multiple pending documents (checkbox) and verify all at once.

---

### 29.6 Employee Document Status Visibility

Employees (recruiters and reporting managers) see the **verified/pending/rejected status per document** on their "My Documents" panel as Admin updates.

**Real-time status updates:**
- When Admin verifies, rejects, or changes the status of a document, the employee's "My Documents" page updates in real-time (via WebSocket/SSE — Section 24.10) or on next page load.
- Status badges are color-coded: Gray = "Not Uploaded," Yellow = "Pending Verification ⏳," Green = "Verified ✅," Red = "Rejected ❌."
- If rejected: the rejection reason is displayed prominently below the document, with a "Re-upload" button.

**Employee visibility:**
- Employees can see ALL their document statuses at a glance.
- Employees CANNOT change the verification status — it is read-only and controlled exclusively by Admin.
- Employees CAN re-upload a document (which resets status to Pending).

---

### 29.7 Document / KYC Notifications

All notifications use the in-app notification system (Section 11). Critical notifications can also be sent via email (configurable).

#### 29.7.1 Notifications to Admin

| Trigger | Notification |
|---------|-------------|
| Employee uploads a new document | "**[Employee Name]** uploaded **[Document Type]**. Review and verify." With quick-action link to the document. |
| Employee re-uploads a previously rejected document | "[Employee Name] re-uploaded [Document Type] (previously rejected). Review required." |
| Employee re-uploads a previously verified document | "[Employee Name] re-uploaded [Document Type] (previously verified — status reset to Pending). Re-verification required." |
| Offer letter auto-verified | "[Employee Name]'s Offer Letter was auto-verified (platform-generated document match)." |
| Multiple pending documents alert | "You have [X] documents pending verification." (Daily summary if pending count > 0.) |
| Employee KYC complete | "[Employee Name] has completed KYC — all documents uploaded and verified." |

#### 29.7.2 Notifications to Employee

| Trigger | Notification |
|---------|-------------|
| Document verified by Admin | "Your **[Document Type]** has been **verified ✅** by Admin." |
| Document rejected by Admin | "Your **[Document Type]** has been **rejected ❌.** Reason: [Admin's rejection reason]. Please re-upload the correct document." |
| Document status changed (Verified → Pending) | "Your **[Document Type]** verification status has been changed to **Pending** by Admin. It will be re-reviewed." |
| Document status changed (Rejected → Pending) | "Your **[Document Type]** rejection has been reversed. Status is now **Pending** — it will be reviewed again." |
| KYC reminder | "You have [X] documents not yet uploaded. Please upload all required documents to complete your KYC." (Periodic reminder if KYC is incomplete — configurable frequency, e.g., every 3 days.) |
| KYC complete | "Congratulations! Your KYC is complete — all documents have been verified. ✅" |

---

### 29.8 KYC Status Tracking (Admin Overview)

A summary view for Admin to track KYC completion across all employees:

| Feature | Description |
|---------|-------------|
| **KYC status column** on Employees page (Section 6.4) | A "KYC Status" column in the employee list table showing: "Complete ✅" (all documents verified), "Incomplete (X/Y)" (X verified out of Y required), "Pending Review" (documents uploaded but not yet verified). |
| **KYC completion filter** | Filter employees by KYC status: Complete, Incomplete, Pending Review, Not Started. |
| **KYC dashboard widget** | On the Admin dashboard (Section 6.2): a card showing "KYC Status: X of Y employees fully verified." With progress bar and quick link to unverified employees. |
| **KYC analytics** | On the Admin Analytics page (Section 21): KYC completion rate as a donut chart — Fully Verified vs. Incomplete vs. Not Started. Trend line of KYC completion over time (useful during onboarding waves). |

---

### 29.9 Additional Document Features

| Feature | Description |
|---------|-------------|
| **Document expiry tracking** | Some documents may have expiry dates (e.g., agreements with renewal dates). Admin can set an expiry date on any document. System sends notification 30 days before expiry and on expiry date. Expired documents are flagged and may require re-upload. |
| **Document download (Admin)** | Admin can download any employee's uploaded document at any time. Bulk download: select an employee → "Download All Documents" → generates a ZIP file with all their documents. |
| **Document download (Employee)** | Employees can download their own uploaded documents. Employees can also download their platform-generated offer letter (the Admin-generated PDF). |
| **Document preview** | In-browser preview for images (JPEG, PNG) and PDFs — no download required for quick review. |
| **Document history / version log** | Every upload, re-upload, status change, and Admin action on a document is tracked with timestamps. Admin can view the full history: "Version 1 uploaded [date] → Rejected [date, reason] → Version 2 uploaded [date] → Verified [date]." |
| **Document notes** | Admin can add internal notes to any document (not visible to employee) — e.g., "Verified against original in person," "Aadhaar address doesn't match current address — discussed with employee." |
| **Print document** | Admin can print any uploaded document directly from the preview (browser print). |
| **Mandatory document enforcement** | Admin can configure whether employees are blocked from submitting recruitment reports until all mandatory documents are uploaded and verified (optional enforcement — configurable toggle in Admin Settings). |

---

### 29.10 Database Entities for Document Management

These entities supplement the schema in Section 17:

**`DocumentType` (Admin-configurable document types):**
- id, name (String — e.g., "Aadhaar Card"), code (String — e.g., "AADHAAR"), acceptedFormats (String[] — e.g., ["pdf", "jpeg", "png"]), isRequired (Boolean), description (Text, nullable), isActive (Boolean), sortOrder (Integer — for display ordering), createdAt, updatedAt.

**`EmployeeDocument` (uploaded documents):**
- id, userId (FK → User — the employee), documentTypeId (FK → DocumentType), fileUrl (String — R2/Cloudinary URL), fileName (String — original filename for reference), fileSize (Integer — bytes), mimeType (String), fileHash (String — SHA-256 hash for integrity and dedup), storageKey (String — cloud storage path/key), status (NOT_UPLOADED | PENDING | VERIFIED | REJECTED), verifiedBy (FK → User, nullable — Admin who verified), verifiedAt (DateTime, nullable), rejectionReason (Text, nullable), rejectedBy (FK → User, nullable), rejectedAt (DateTime, nullable), expiryDate (Date, nullable), adminNotes (Text, nullable — internal notes, not visible to employee), version (Integer — incremented on each re-upload), uploadedAt (DateTime), createdAt, updatedAt.

**`EmployeeDocumentHistory` (version and action history):**
- id, employeeDocumentId (FK → EmployeeDocument), action (UPLOADED | RE_UPLOADED | VERIFIED | REJECTED | STATUS_CHANGED | NOTE_ADDED), oldStatus (String, nullable), newStatus (String, nullable), reason (Text, nullable), fileUrl (String, nullable — for re-uploads, stores the previous file URL), actionBy (FK → User), createdAt.

**`OfferLetter` (Admin-generated offer letters):**
- id, userId (FK → User — the employee the offer letter is for), referenceNumber (String, unique — e.g., "HF/OL/2026/001"), variant (TEMPLATE | TIPTAP_EDITOR — which generation variant was used), templateVersion (String — version of the template used, applicable for TEMPLATE variant), dynamicFields (JSONB — stores all field values used during generation, for audit), editorContent (Text/HTML, nullable — the Tiptap rich text editor HTML content, saved for TIPTAP_EDITOR variant so it can be loaded back for re-editing/re-generation; null for TEMPLATE variant), generatedFileUrl (String — R2/Cloudinary URL of the generated PDF), generatedFileHash (String — SHA-256 hash for auto-verification matching), generatedBy (FK → User — Admin who generated), generatedAt (DateTime), isArchived (Boolean — true if re-generated, previous version), createdAt.

---

## 30. USER PROFILE PAGE & PROFILE PHOTO MANAGEMENT

> **All roles — Admin, Recruiters, and Reporting Managers — have a dedicated Profile Page** where they can view and manage their personal information, update their mobile number and address, and upload/change/remove their profile photo with full image manipulation controls. Profile photos are uploaded to Cloudinary with automatic cleanup on change or deletion, URL synchronization in the database, and custom confirmation dialogs for all destructive actions.

---

### 30.1 Profile Page — All Roles

Every user (Admin, Recruiter, Reporting Manager) has a **"My Profile"** page accessible from their avatar/menu in the navigation header.

#### 30.1.1 Profile Page Layout

| Section | Content |
|---------|---------|
| **Profile photo area** | Large circular or rounded-square profile photo display (or default avatar if no photo set). Hover overlay with "Change Photo" and "Remove Photo" options. Full photo management controls (see Section 30.2). |
| **Personal information** | Read-only display of: Full Name, Email, Role, Employee ID, Account Status (Active/Suspended), Date of Account Creation, Assigned Reporting Manager(s) (for recruiters), Device Status (Bound/Unbound). |
| **Editable fields** | Mobile Number, Address — editable by the user themselves (see Section 30.1.2). |
| **KYC Status** | Summary of document verification status (for recruiters and reporting managers — links to "My Documents" page, Section 29.2). Not shown for Admin. |
| **Attendance summary** | Compact monthly attendance summary (for recruiters and reporting managers — current month attendance rate, late count, present days). Not shown for Admin. |
| **Leave balance** | Compact leave balance display (for recruiters and reporting managers — remaining balance per leave type). Not shown for Admin. |
| **Security info** | Last login time, current session info, device binding status. |

#### 30.1.2 Editable Profile Fields

Users can update the following fields on their own profile:

| # | Field | Type | Validation | Notes |
|---|-------|------|------------|-------|
| 1 | **Mobile Number** | Phone input | Required. Valid phone format (10-digit Indian mobile or international with country code). No duplicate check (multiple users may share emergency contacts). | Displayed on profile. Available to Admin in user management. |
| 2 | **Address** | Textarea | Optional. Max 500 characters. | Current residential address. Displayed on profile. Available to Admin. |

**Update behavior:**
- User edits the field → clicks "Save" → server-side validation → saved to database → success toast notification.
- Changes are logged in the audit trail (Section 23.1) with old value → new value.
- Admin can also edit these fields for any user from the Admin user management panel (Section 6.3 / 6.4).

---

### 30.2 Profile Photo Upload System

A comprehensive profile photo upload, manipulation, and management system with the same security and validation standards as the document upload system (Section 29) plus advanced image editing controls.

#### 30.2.1 Upload Methods

| Method | Description |
|--------|-------------|
| **Drag-and-drop** | User can drag an image file from their desktop/file explorer and drop it onto the profile photo area or a designated drop zone. Visual feedback: drop zone highlights with a border and "Drop image here" text on drag-over. |
| **File select (click to browse)** | Standard file picker button — "Choose Photo" or "Upload Photo" — opens the OS file picker dialog. |
| **Click on current photo** | Clicking the existing profile photo (or default avatar) opens the upload/management options. |

#### 30.2.2 File Validation

All validations from Section 24.11 (File Upload Infrastructure) apply, plus:

| Validation | Rule |
|-----------|------|
| **Accepted formats** | JPEG, PNG, WebP only. |
| **Max file size** | 5MB (configurable). Files exceeding this are rejected with a clear error: "File size exceeds 5MB limit. Please choose a smaller image." |
| **Max dimensions** | 4096×4096 pixels. Larger images are rejected. |
| **Min dimensions** | 100×100 pixels. Smaller images are rejected with: "Image is too small. Minimum 100×100 pixels required." |
| **File type validation** | Validated by **magic bytes** on the server — not just file extension or MIME type (prevents spoofed file uploads). Same security as Section 24.11 and Section 29.2.2. |
| **Virus/malware scanning** | Uploaded image scanned for malware before processing. Same pipeline as Section 24.11. Infected files rejected with clear error message. |
| **EXIF metadata stripping** | All EXIF data (GPS coordinates, camera info, device info) is stripped from the image before storage for privacy. Same as Section 29.3. |
| **Client-side pre-validation** | Before uploading to server, validate file type and size on the client (fail fast, save bandwidth). Show immediate error if invalid. |

#### 30.2.3 Image Manipulation Controls

After selecting/dropping an image, the user is presented with an **image editor modal/dialog** with the following manipulation controls before confirming the upload:

| Control | Description |
|---------|-------------|
| **Crop with fixed aspect ratio** | Circular or square crop area (fixed 1:1 ratio for profile photos). The crop frame maintains a fixed ratio — user cannot change the aspect ratio. The crop area is overlaid on the image with the outside area dimmed. |
| **Reposition (pan/move)** | User can click and drag the image within the crop frame to reposition which part of the image is captured. Touch support for mobile devices. |
| **Scale up / Scale down (zoom)** | Slider or pinch-to-zoom to scale the image larger or smaller within the crop frame. Zoom range: 1× (fit) to 3× (zoomed in). |
| **Rotate** | Rotate the image clockwise or counter-clockwise. Rotation buttons (90° increments) and/or a fine rotation slider (−180° to +180° in 1° increments). |
| **Flip** | Horizontal flip (mirror) and vertical flip buttons. |
| **Preview** | Live preview of how the final cropped/manipulated photo will look — shown as a circular avatar thumbnail next to the editor. Updates in real-time as user adjusts controls. |
| **Reset** | "Reset" button to undo all manipulations and return to the original image state. |
| **Cancel** | "Cancel" button to close the editor without saving — no changes made (original photo remains unchanged). |
| **Confirm / Save** | "Save" or "Confirm" button to finalize the manipulations and upload the processed image. |

**Implementation:** Use a client-side image cropping library such as `react-cropper`, `react-image-crop`, `cropperjs`, or equivalent. All manipulation happens on the client side — only the final processed/cropped image is uploaded to the server.

#### 30.2.4 Upload Processing Pipeline

After the user confirms the manipulated image:

| Step | Description |
|------|-------------|
| 1. **Client-side crop/process** | The manipulated image is rendered to a canvas at the final crop dimensions and exported as JPEG or PNG (configurable quality, e.g., 85% JPEG quality for balance of size and clarity). |
| 2. **Client-side validation** | Final processed image re-validated for size and dimensions before upload. |
| 3. **Upload to server** | Processed image sent to the backend API endpoint. |
| 4. **Server-side validation** | Re-validate file type (magic bytes), file size, dimensions. |
| 5. **Virus/malware scan** | Scan the uploaded file. |
| 6. **EXIF stripping** | Strip any remaining EXIF metadata. |
| 7. **Resize** | Resize to standard profile photo dimensions (e.g., 400×400 pixels for storage, with smaller variants generated: 200×200 for display, 50×50 for thumbnails). |
| 8. **Upload to Cloudinary** | Upload the processed image to Cloudinary. Generate a unique filename (UUID-based). Store at path: `profile-photos/{userId}/{uuid}.{ext}`. |
| 9. **Update database** | Save the new Cloudinary image URL to the user's `profilePhotoUrl` field in the database. |
| 10. **Cleanup old photo** | If the user had a previous profile photo → **delete the old image from Cloudinary** (see Section 30.3). |
| 11. **Response** | Return success with the new profile photo URL. Frontend updates all instances of the user's avatar across the app. |

#### 30.2.5 Re-Upload (Change Photo)

- User can change their profile photo at any time by uploading a new image.
- The flow is identical to the initial upload (Section 30.2.1–30.2.4).
- **When a new photo replaces an existing one:**
  - The new image is uploaded to Cloudinary first (ensuring the upload succeeds before deleting the old one).
  - The old image is deleted from Cloudinary (cleanup — see Section 30.3).
  - The database `profilePhotoUrl` is updated to the new URL, replacing the old URL.
  - The old URL becomes invalid (returns 404 if accessed directly).

---

### 30.3 Cloudinary Cleanup & Database URL Synchronization

**Critical requirement:** When a profile photo is changed or deleted, the old image must be removed from Cloudinary storage and the database URL must be updated. No orphaned images should remain on Cloudinary.

#### 30.3.1 Photo Changed (Replaced)

| Step | Action |
|------|--------|
| 1 | New image uploaded to Cloudinary → new URL obtained. |
| 2 | Database `profilePhotoUrl` updated from old URL to new URL. |
| 3 | Old image deleted from Cloudinary using the old `storageKey` / `publicId`. |
| 4 | If Cloudinary deletion fails (network error, etc.) → log the failure → add to a cleanup retry queue (BullMQ) → retry deletion within 24 hours. |
| 5 | Audit trail logged: "Profile photo changed" with old URL and new URL. |

#### 30.3.2 Photo Deleted (Removed)

| Step | Action |
|------|--------|
| 1 | Image deleted from Cloudinary using the `storageKey` / `publicId`. |
| 2 | Database `profilePhotoUrl` set to `null` (or empty string). |
| 3 | Frontend displays the default avatar/placeholder instead. |
| 4 | If Cloudinary deletion fails → same retry queue as above. |
| 5 | Audit trail logged: "Profile photo removed." |

#### 30.3.3 Admin Changes Another User's Photo

- Admin can change or remove any recruiter's or reporting manager's profile photo from the Admin user management panel (Section 6.3 / 6.4).
- Same cleanup flow applies — old image deleted from Cloudinary, URL updated/removed in database.
- Audit trail: "[Admin Name] changed profile photo for [Employee Name]" or "[Admin Name] removed profile photo for [Employee Name]."

#### 30.3.4 Orphaned Image Prevention

- A scheduled BullMQ cleanup job runs weekly to detect orphaned images on Cloudinary — images in the `profile-photos/` path that are NOT referenced by any user's `profilePhotoUrl` in the database. Orphaned images are deleted.
- This catches edge cases where the cleanup in 30.3.1/30.3.2 failed silently.

---

### 30.4 Custom Confirmation Dialogs

**Every deletion or removal action related to profile photos (and all other destructive actions across the platform) must show a custom confirmation dialog box.** The user must explicitly confirm before any irreversible action proceeds.

#### 30.4.1 Profile Photo Confirmation Dialogs

| Action | Confirmation Dialog |
|--------|-------------------|
| **Delete / Remove own profile photo** | Custom dialog: **Title:** "Remove Profile Photo?" **Body:** "Your profile photo will be permanently removed. The default avatar will be shown instead. This action cannot be undone." **Buttons:** "Cancel" (secondary) / "Remove Photo" (destructive, red). |
| **Replace profile photo (upload new one while existing)** | Custom dialog: **Title:** "Replace Profile Photo?" **Body:** "Your current profile photo will be replaced with the new one. The previous photo will be permanently deleted." **Buttons:** "Cancel" / "Replace Photo" (primary). |
| **Admin removes another user's photo** | Custom dialog: **Title:** "Remove [Employee Name]'s Profile Photo?" **Body:** "This will permanently remove [Employee Name]'s profile photo. They will see the default avatar." **Buttons:** "Cancel" / "Remove Photo" (destructive, red). |
| **Admin replaces another user's photo** | Custom dialog: **Title:** "Replace [Employee Name]'s Profile Photo?" **Body:** "[Employee Name]'s current profile photo will be replaced. The previous photo will be permanently deleted." **Buttons:** "Cancel" / "Replace Photo." |

#### 30.4.2 General Confirmation Dialog Requirements

**All deletion/removal actions across the entire platform** (not just profile photos) must use custom confirmation dialogs:

| Requirement | Description |
|-------------|-------------|
| **Custom design** | Not the browser's native `confirm()` dialog. A custom-styled modal/dialog matching the platform's design system (Tailwind CSS + consistent theming). |
| **Clear title** | Descriptive title stating what is about to happen. |
| **Clear body text** | Explains the consequence of the action. Mentions if the action is irreversible. |
| **Two buttons** | "Cancel" (secondary/outline, safe action — always on the left or less prominent) and the destructive action button (red for deletions, primary color for replacements — always requires explicit click). |
| **No auto-dismiss** | Dialog does not auto-dismiss. User must explicitly click a button. |
| **Keyboard support** | Escape key = Cancel. Enter key does NOT trigger the destructive action (prevents accidental confirmation). |
| **Backdrop click** | Clicking outside the dialog = Cancel (closes without action). |
| **Loading state** | After confirming, the destructive button shows a loading spinner while the action processes. Buttons are disabled to prevent double-click. |

---

### 30.5 Admin Photo Management

Admin has additional capabilities for managing profile photos of all users:

| Feature | Description |
|---------|-------------|
| **View any user's photo** | Admin can see profile photos of all recruiters and reporting managers in the user management table and individual profile views. |
| **Upload photo for any user** | Admin can upload/set a profile photo for any recruiter or reporting manager — useful during onboarding if the employee hasn't set one yet. Same upload flow (drag-and-drop, crop, manipulate) applies. |
| **Change any user's photo** | Admin can replace any user's profile photo. Old photo deleted from Cloudinary, new URL saved. Custom confirmation dialog shown. |
| **Remove any user's photo** | Admin can delete any user's profile photo. Photo deleted from Cloudinary, URL removed from database. Custom confirmation dialog shown. |
| **Bulk photo status** | In the Employees page (Section 6.4), a "Photo" column showing whether each employee has a profile photo set (thumbnail preview) or not (placeholder icon). |
| **Photo in exports/reports** | Profile photos are NOT included in XLSX report exports (not applicable for spreadsheet format). But they are displayed in on-screen data tables and employee profile views. |

---

### 30.6 Profile Photo Display Across the Platform

Profile photos, once uploaded, are displayed consistently across all surfaces:

| Location | Display |
|----------|---------|
| **Navigation header** | Small circular avatar (32×32 or 40×40 px) in the top navigation bar, next to the user's name. Clickable → opens profile dropdown menu. |
| **Profile page** | Large circular photo (120×120 or 160×160 px) at the top of the "My Profile" page. |
| **User management table (Admin)** | Small thumbnail (32×32 px) in the first column of the employee list table. |
| **Employee detail view (Admin)** | Medium photo (80×80 px) in the employee profile header. |
| **Recruiter summary tables** | Small thumbnail next to recruiter names in Reporting Manager's team dashboard tables. |
| **Attendance logs** | Small thumbnail next to employee names in attendance log tables. |
| **Audit trail** | Small thumbnail next to the user who performed the action. |
| **Notification center** | Small thumbnail next to notification sender name. |
| **Default avatar** | If no photo is set: a generated placeholder — either initials-based (first letter of first name + first letter of last name on a colored background) or a generic silhouette icon. |

**CDN caching:**
- Profile photos served via Cloudinary's CDN with cache headers (long cache TTL, e.g., 1 year).
- When a photo changes, the new URL (with a different UUID filename) naturally busts the cache — old URL stops resolving, new URL is fresh.

---

### 30.7 Database Fields for Profile

These fields supplement the existing User model in Section 17:

**User model extensions:**

| Field | Type | Description |
|-------|------|-------------|
| `profilePhotoUrl` | String, nullable | Cloudinary URL of the current profile photo. `null` if no photo set. Updated on upload, replaced on change, set to `null` on removal. |
| `profilePhotoStorageKey` | String, nullable | Cloudinary `publicId` / storage key for the current photo. Used for deletion from Cloudinary. Updated alongside `profilePhotoUrl`. |
| `mobileNumber` | String, nullable | User's mobile/phone number. Editable by the user from their profile page. |
| `address` | Text, nullable | User's current residential address. Editable by the user from their profile page. Max 500 characters. |

---

## 31. APPENDIX — FIELD REFERENCE TABLES

### Recruiter Form Fields (33)

| # | Field | Input Type | Notes |
|---|-------|-----------|-------|
| 1 | Sr. No | Display only | Global in DB, per-recruiter in UI |
| 2 | Date Sourced / Profile Received | Date | — |
| 3 | Candidate Name | Text | — |
| 4 | Contact No | Phone | Validated |
| 5 | State | Searchable dropdown | — |
| 6 | Location | Searchable dropdown | Zone-dependent |
| 7 | Profile | Searchable dropdown | Zone-dependent |
| 8 | Years of Experience | Number | — |
| 9 | Current CTC | Number (₹) | — |
| 10 | Current Designation | Text | — |
| 11 | Current Organization | Text | — |
| 12 | Email ID | Email | Validated |
| 13 | Higher Qualification | Dropdown/Text | — |
| 14 | Expected CTC | Number (₹) | — |
| 15 | Diploma Part / Full | Dropdown | Part, Full |
| 16 | Graduation % | Number (%) | — |
| 17 | Graduation Year | Year | — |
| 18 | 12th Passing Year | Year | — |
| 19 | 12th % | Number (%) | — |
| 20 | 10th Passing Year | Year | — |
| 21 | 10th % | Number (%) | — |
| 22 | Date of Birth | Date | — |
| 23 | Age | Auto-calculated | From DOB, read-only |
| 24 | Notice Period | Dropdown/Text | Immediate, 15d, 30d, 60d, 90d |
| 25 | Remarks | Textarea | Free text |
| 26 | Is CTC informed and okay? | Yes/No | Zone-conditional: Set A only (West, Central). Hidden in Set B (East, North, South). Stored as null for Set B records. |
| 27 | Is off-roll nature of job okay with candidate? | Yes/No | Zone-conditional: Set A only (West, Central). Hidden in Set B (East, North, South). Stored as null for Set B records. |
| 28 | Is the on-roll opportunity explained with 18 months clause? | Yes/No | Zone-conditional: Set A only (West, Central). Hidden in Set B (East, North, South). Stored as null for Set B records. |
| 29 | Do have two wheeler and two wheeler Licence? | Yes/No | Zone-conditional: Set A only (West, Central). Hidden in Set B (East, North, South). Stored as null for Set B records. |
| 30 | Communication skills rate (scale of 10) | Number (1-10) | Slider or input. Zone-conditional: Set A only (West, Central). Hidden in Set B (East, North, South). Stored as null for Set B records. |
| 31 | Recruiter Name | Auto-set | Read-only |
| 32 | Reporting Manager | Auto-set | Read-only |
| 33 | Status | Dropdown | Complete / Pending |

### Admin-Only Additional Fields (15)

| # | Field | Input Type | Notes |
|---|-------|-----------|-------|
| 34 | Company | Relational dropdown | Searchable + create new |
| 35 | Service Provider | Relational dropdown | Filtered by Company + create new |
| 36 | HR Manager | Relational dropdown | Filtered by Company + create new |
| 37 | Location (Admin) | Text/Dropdown | — |
| 38 | State (Admin) | Text/Dropdown | — |
| 39 | Date of Joining | Date | — |
| 40 | Invoice Date | Date | — |
| 41 | Invoice Number | Auto-generated | See Section 14 for logic |
| 42 | Invoice Amount Total | Number (₹) | — |
| 43 | GST Amount | Number (₹) | — |
| 44 | Amount Received | Number (₹) | — |
| 45 | TDS Amount | Number (₹) | — |
| 46 | Payment Status — Status / Date | Dropdown + Date | Composite field |
| 47 | CV Shared On Date | Date | — |
| 48 | Feedback from HR | Dropdown | Rejected / Hold / Profile Closed |

---

## 32. COMPLETE PAGE DIRECTORY

> **Every page/screen to be created in the OMG Teams platform**, organized by scope. This is the exhaustive master list derived from the entire specification. No page should exist that is not listed here, and no listed page should be omitted during implementation.

### 32.1 Auth & Public Pages (Unauthenticated)

| # | Page | Route (suggested) | Description | Reference |
|---|------|-------------------|-------------|-----------|
| 1 | **Login Page** | `/login` | 3-tab login interface (Recruiter / Reporting Manager / Admin). Recruiter tab default. Employee ID + password for Recruiter/RM, email + password for Admin. Turnstile captcha. No forgot password. No registration. No public content. | Section 4 |
| 2 | **404 Not Found Page** | `/*` (catch-all) | Custom-styled 404 page for invalid routes. "Page not found" message with link back to dashboard or login. | Section 24.19.5 |
| 3 | **Maintenance Mode Page** | `/maintenance` | "Platform is under maintenance" screen shown to all users except Admin during deployments. Estimated downtime display. | Section 24.18 |
| 4 | **Offline Fallback Page** | `/offline.html` | Static HTML page served by service worker when user is offline and no cached version exists. Platform logo, "You're offline" message, "Retry" button. Pure HTML + inline CSS — no framework dependencies. | Section 24.19.13 |

### 32.2 Common Pages (All Authenticated Roles — Admin, Recruiter, Reporting Manager)

| # | Page | Route (suggested) | Description | Reference |
|---|------|-------------------|-------------|-----------|
| 4 | **My Profile Page** | `/profile` | View personal info (name, email, Employee ID, role, assigned RMs). Edit mobile number and address. Profile photo upload/change/remove with image manipulation (crop, rotate, scale, reposition, fixed ratio). | Section 30 |
| 5 | **My Attendance Page** | `/attendance` | Own attendance log table (Punch In, Punch Out, Working Hours, Status, Late By). Monthly summary (present, half-day, late, absent counts, total/avg hours). Color-coded calendar view. Read-only. | Section 27.7 |
| 6 | **My Leaves Page** | `/leaves` | Apply for leave (form: date range, type, reason, document). View own requests with statuses (Pending/Approved/Rejected/Cancelled). Cancel pending requests. Leave balance per type with progress bars. Personal leave calendar. | Section 28.4 |
| 7 | **My Documents Page** | `/documents` | Upload required documents (Aadhaar, PAN, Resume, Bank Details, Offer Letter/Agreement). View status badges per document (Not Uploaded/Pending/Verified/Rejected). Re-upload documents. Overall KYC progress bar. | Section 29.2 |
| 8 | **Notifications Page** | `/notifications` | Full-page notification list. All notifications with unread highlight. Filter by category. Mark as read. Clear individual or all. Paginated. Complements the dropdown/drawer notification panel in the header. | Section 11.2 |
| 9 | **Help / FAQ Page** | `/help` | FAQ-style Q&A page accessible from sidebar (all roles). Organized by role: "For Recruiters," "For Reporting Managers," "For Admins." Searchable. Admin can edit help content. | Section 23.18 |
| 10 | **Global Search Results Page** | `/search?q=...` | Full search results page navigated to from the "See all results" link in the global search dropdown. All matches across all entity types. Paginated. Filtered by entity type. | Section 23.10 |

### 32.3 Recruiter Pages

| # | Page | Route (suggested) | Description | Reference |
|---|------|-------------------|-------------|-----------|
| 11 | **Recruiter Dashboard** | `/dashboard` | Personal performance dashboard: candidates sourced today/week/month, completion rate, pending count, target progress (if targets set), today's attendance & working hours with live counter, monthly attendance rate, leave balance overview, quick stats cards, recent activity. | Section 23.4.1 |
| 12 | **Add Report (Report Submission Form)** | `/reports/new` | Zone selection step → 33-field candidate report form with zone-conditional dropdowns. Auto-save/draft every 30 seconds. Duplicate detection (phone/email) on submit. Resume draft if exists. Admin-configurable dropdown values. | Sections 5.1, 5.2, 5.3, 5.4, 8 |
| 13 | **My Reports (Own Candidate Data)** | `/reports` | Data table of own submitted candidate reports. Per-recruiter serial numbers. Filters, sorting, search, quick filters, pagination, virtualization. Quick export (XLSX/CSV). View candidate detail. Pipeline stage (read-only, set by Admin). | Sections 5.6, 12 |

### 32.4 Reporting Manager Pages

| # | Page | Route (suggested) | Description | Reference |
|---|------|-------------------|-------------|-----------|
| 14 | **RM Dashboard (Team Dashboard)** | `/dashboard` | Team performance: total candidates (team) today, active recruiters, team completion rate, top performer. Per-recruiter bar chart, daily trend, individual overlays. Own attendance/working hours with live counter. Own leave overview. Team attendance snapshot. Team present/absent/late/on-leave today. | Section 23.4.2 |
| 15 | **My Recruiters Page** | `/my-recruiters` | View-only page: all assigned recruiters with profile photo, name, email, status, live online/offline dot, last active, candidates today/month, attendance today, completion rate, target progress, KYC status. Click row → read-only detail view. No add/remove capability. | Section 7 |
| 16 | **Assigned Recruiters Data View** | `/reports` | Data table of all candidate reports from assigned recruiters. Read-only. Filters, sorting, search, pagination, quick export. | Section 7 |
| 17 | **Team Attendance View** | `/team/attendance` | Attendance data for assigned recruiters (punch times, working hours, status). Team attendance summary cards. Read-only. | Section 27.8 |
| 18 | **Team Leave View** | `/team/leaves` | Leave requests from assigned recruiters (Pending/Approved/Rejected). Team leave calendar with date-wise view. Read-only — cannot approve/reject. | Section 28.5 |

### 32.5 Admin Pages

| # | Page | Route (suggested) | Description | Reference |
|---|------|-------------------|-------------|-----------|
| 19 | **Admin Dashboard** | `/admin/dashboard` | At-a-glance operational summary: attendance cards (Present/Absent/Late/Leave/Half-Day Today), recruitment KPI cards (Candidates Sourced Today/Month, Pending Reports, Conversion Rate, Outstanding Amount), Today's Logins panel, monthly attendance %, pending leave requests alert, pending KYC verifications alert, global search bar. Date-wise tabs. | Section 6.2 |
| 20 | **Employees Page** | `/admin/employees` | Consolidated employee list table with 15+ columns (Name, Employee ID, Role, Status, RM(s), Candidates Sourced, Completion Rate, Attendance Rate, Late Count, Leave Balance, Target Achievement, Device Status, Live Status, Last Active, KYC Status). Filtering, search by name/email/Employee ID. Per-employee detail view with 6 tabs: Profile, Performance, Attendance, Leave, Documents, Reports. Generate/schedule employee reports. | Section 6.4 |
| 21 | **User Management Page** | `/admin/users` | Create Recruiter/RM accounts (with Employee ID auto-generation — OMG-XXXX). Success modal with credentials + copy icons. Delete, suspend, reactivate accounts. Assign/remove RMs. Reset passwords. Device management (reset/force-switch). Session management (view/revoke). | Section 6.3 |
| 22 | **Candidate Reports Data Table** | `/admin/reports` | All candidate reports from all recruiters. Admin form superset (48 fields). Date-wise tabs (Today/Yesterday/custom/all). Data viewing modes. Report downloads. | Sections 6.1, 6.2 |
| 23 | **Candidate Detail / Edit Page** | `/admin/reports/:id` | 4-tab interface (All / Candidate / Recruitment / MIS). All 48 fields editable. Data-aware save button (deactivated by default, activates only on genuine change, deactivates on revert — deep field-by-field comparison). Tab persistence, URL state, cross-tab sync, keyboard shortcuts. | Section 6.1.1 |
| 24 | **Reports Management Page** | `/admin/reports-management` | 4-section page: Generate & Download (20+ report types, filters, scoping), Schedule Email Reports (daily/monthly/yearly), Report History (re-download, metadata), Active Scheduled Reports Info. | Section 20 |
| 25 | **Analytics & Statistics Page** | `/admin/analytics` | Enterprise-grade dashboard: 10 KPI cards, recruitment funnel, 13 chart types (line, bar, pie, donut, treemap, heatmap, area, histogram, box plot, leaderboard, gauge), employee overview analytics, real-time live metrics (WebSocket/SSE), platform health monitoring (API/DB/Redis/BullMQ/email/storage). Cross-filtering, drill-down, chart export. | Section 21 |
| 26 | **Attendance Management Page** | `/admin/attendance` | Full attendance logs for all employees. Filter by date/employee/role/status. Edit punch-in/out times. Mark employees as On Leave. Attendance summary cards. Monthly/weekly reports. Calendar view per employee. | Section 27.6 |
| 27 | **Leave Management Page** | `/admin/leaves` | All leave requests across all employees. One-click approve, reject with reason. Bulk approve/reject. Leave balance management (allotments, manual adjustments, carry-forward). Leave request history with filtering. Team-wide leave calendar with conflict detection. Leave policy configuration. | Section 28.3 |
| 28 | **Document Verification Panel** | `/admin/documents` | All uploaded documents with pending verification count badge. Per-employee document view. Verified/Pending toggle per document. One-click verify. Reject with reason. Batch verification. Status changeable in any direction (Verified ↔ Pending ↔ Rejected). KYC completion status overview. | Section 29.5 |
| 29 | **Offer Letter Generation Page** | `/admin/offer-letters` or modal | Two-variant generation: Template (Static+Dynamic) or Tiptap Rich Text Editor. Preview & edit dynamic fields. Character/line limit validation in Tiptap. Paste with formatting. Generate PDF. Download. Generation history. Re-generate. Bulk generation. | Section 29.4 |
| 30 | **Company / SP / HR Management Page** | `/admin/companies` | CRUD management for Companies, Service Providers, and HR Managers. Create, edit, delete (soft delete) these relational entities. View all companies with nested SPs and HRs. Search and filter. Inline creation also available from candidate report forms — but this page is the dedicated management view for editing, deleting, and bulk operations. | Section 9 |
| 31 | **Audit Log Page** | `/admin/audit-log` | All CRUD actions across all entities logged with: user, action, entity, old → new values, timestamp. Filter by user, action type, entity type, date range. Search by entity ID. Export to XLSX. | Section 23.1 |
| 32 | **Trash / Recently Deleted Page** | `/admin/trash` | All soft-deleted records across all entity types. Restore or permanently delete. Bulk restore/permanent delete. 90-day auto-purge. Filter by entity type and deletion date. | Section 23.7 |
| 33 | **Duplicate Management Page** | `/admin/duplicates` | Flagged duplicate candidate records (matched by phone/email). View duplicate groups. Merge, dismiss, or resolve duplicates. Duplicate history. | Section 23.3 |
| 34 | **Admin Settings / Configuration Page** | `/admin/settings` | Platform-wide settings: zone-to-form-set mappings, attendance thresholds, leave policies, document types, invoice prefix, session timeout, auto-archive thresholds, midnight reset config, notification preferences. | Section 23.12 |
| 35 | **Dropdown Management / Master Data Page** | `/admin/master-data` | Admin-configurable dropdown options for all form fields: State, Location, Profile, Qualification, Notice Period, Diploma options. Add, edit, remove, reorder values. Zone-set-specific values. No code changes needed. | Section 23.19 |
| 36 | **Holiday Calendar Management Page** | `/admin/holidays` | Add, edit, delete holidays. Set holiday type (National/Regional/Custom). Set recurring holidays. Holiday calendar view. | Section 27.9 |
| 37 | **Email Templates Management Page** | `/admin/email-templates` | Customizable email subjects and bodies for all system-generated emails. Variable placeholders. HTML editor for email body. Template preview. Per-template category. | Section 23.13 |
| 38 | **Targets Management Page** | `/admin/targets` | Set daily/weekly/monthly candidate sourcing targets per recruiter (individual or global default). View target achievement. Edit/deactivate targets. Target change history. | Section 23.9 |
| 39 | **Session Management Page** | `/admin/sessions` | View all active sessions for all employees. Session metadata (geolocation, timestamps, device info). Revoke individual sessions. Revoke all sessions for a user. Force-logout. | Section 4, Section 22.9 |
| 40 | **CSV/XLSX Import Page** | `/admin/import` | Bulk data import via CSV/XLSX file upload. Column mapping. Validation preview. Import progress. Error report. | Section 23.6 |

### 32.6 Global UI Components (Not Standalone Pages — Present Across Pages)

| # | Component | Location | Description | Reference |
|---|-----------|----------|-------------|-----------|
| G1 | **Sidebar Navigation** | All authenticated pages | Role-based menu items. Collapsible. Active state indicator. | Section 18 |
| G2 | **Top Header / Navigation Bar** | All authenticated pages | Profile avatar with dropdown, notification bell with unread badge, global search bar (Admin), live status dot (own). | Section 18 |
| G3 | **Notification Dropdown/Drawer** | Header (all roles) | Recent notifications panel, unread highlight, Mark All as Read, Clear All, link to full Notifications Page. | Section 11.2 |
| G4 | **Global Search Bar** | Header (Admin only) | Platform-wide search across all entities. Results grouped by entity type. | Section 23.10 |
| G5 | **Onboarding Tour Overlay** | First login (Recruiter/RM) | Guided walkthrough highlighting key features. Contextual tooltips. Dismissible. Does not block usage. | Section 23.18 |
| G6 | **Profile Photo Upload Modal** | My Profile, User Management | Drag-and-drop upload with image manipulation (crop, rotate, scale, reposition, fixed 1:1 ratio, flip, live preview, reset). | Section 30.2 |
| G7 | **Custom Confirmation Dialog** | All destructive actions | Custom-styled modal (not browser native). Clear title, body, consequence. Cancel + destructive button. No auto-dismiss. Escape = cancel. Enter ≠ confirm. Loading state. | Section 30.4 |
| G8 | **Account Creation Success Modal** | User Management (Admin) | Employee info, Employee ID with copy icon, password with copy icon. Shown only on successful account creation. | Section 6.3.2 |
| G9 | **Admin Password Verification Dialog** | Employee detail (Admin) | Admin enters own password to view/copy employee password. 5-minute verification cache. | Section 6.3.3 |
| G10 | **Print View** | Candidate profiles, reports, attendance | Print-optimized CSS layouts. `Ctrl+P` / `Cmd+P` support. | Section 23.17 |
| G11 | **Toast Notification System** | All pages (bottom-right) | Robust toast/snackbar system for all user feedback: success, error, warning, info, loading, promise types. Auto-dismiss, hover pause, swipe dismiss, deduplication, action buttons (Undo/Retry/View), persistent toasts for critical errors. | Section 24.19.11 |
| G12 | **Spinner Component** | Buttons, cards, tables, pages | Reusable circular loading spinner. 3 sizes (sm/md/lg). Primary brand color. White variant for dark backgrounds. CSS-only animation. Accessible. | Section 24.19.7 |
| G13 | **Skeleton Loading System** | All data-fetching pages | Shimmer/pulse placeholder UI matching page structure. Primitives: SkeletonLine, SkeletonCircle, SkeletonRect, SkeletonButton. Page-specific skeletons for: dashboard, data table, employee detail, form, card grid, calendar, sidebar. | Section 24.19.8 |
| G14 | **Offline Connectivity Banner** | All pages (top banner) | Banner shown when user loses internet connection while on a cached page: "You're offline. Some features may be unavailable." Disappears automatically when connectivity is restored. | Section 24.19.1 |

### 32.7 Page Count Summary

| Category | Count |
|----------|:-----:|
| Auth & Public | 4 |
| Common (All Roles) | 7 |
| Recruiter-Specific | 3 |
| Reporting Manager-Specific | 5 |
| Admin-Specific | 22 |
| **Total Unique Pages** | **41** |
| Global UI Components | 14 |

---

## 33. COMPLETE DATABASE MODEL DIRECTORY

> **Every Prisma model / database entity to be created**, consolidated from the entire specification. This is the exhaustive master list. No model should exist that is not listed here, and no listed model should be omitted during implementation. Detailed field definitions are in the referenced sections.

### 33.1 User & Authentication (6 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 1 | **User** | Core user entity — id, employeeId (OMG-XXXX, unique, nullable for Admin), email, passwordHash, role (ADMIN/REPORTING_MANAGER/RECRUITER), firstName, lastName, profilePhotoUrl, profilePhotoStorageKey, mobileNumber, address, deviceId, deviceLockedAt, status (ACTIVE/SUSPENDED/DELETED), createdAt, updatedAt, deletedAt, deletedBy. | Section 17 |
| 2 | **Session** | Active user sessions — id, userId, token, deviceId, ipAddress, geoLocation, userAgent, createdAt, lastActiveAt, revokedAt. Redis-backed with DB audit. | Section 17 |
| 3 | **RecruiterManagerAssignment** | Many-to-many RM ↔ Recruiter assignments — recruiterId, managerId, assignedAt, removedAt. Preserves assignment history. | Section 17 |
| 4 | **UserDevice** | Device tracking history — id, userId, deviceId, userAgent, platform, screenSize, lastSeen, isActive, createdAt. | Section 22.11 |
| 5 | **LoginHistory** | Login attempt audit log — id, userId, attemptedDeviceId, ip, userAgent, success, failureReason, loginMethod (PASSWORD/BACKUP_CODE), createdAt. | Section 22.16 |
| 6 | **BackupCode** | Emergency device lock bypass codes — id, userId, codeHash (bcrypt), isUsed, usedAt, createdAt. 10 codes per user. | Section 23.16 |

### 33.2 Business Entities (3 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 7 | **Company** | External client companies — id, name, createdAt, updatedAt, deletedAt, deletedBy. Top-level entity in Company → SP/HR hierarchy. | Section 9, 17 |
| 8 | **ServiceProvider** | Service providers under a Company — id, name, companyId (FK → Company), createdAt, updatedAt, deletedAt, deletedBy. | Section 9, 17 |
| 9 | **HRManager** | HR managers under a Company — id, name, companyId (FK → Company), email, phone, createdAt, updatedAt, deletedAt, deletedBy. | Section 9, 17 |

### 33.3 Candidate & Recruitment (7 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 10 | **CandidateReport** | Core candidate record — id, globalSerialNumber, recruiterId, zone, 33 recruiter fields + 15 admin-only fields (nullable), candidateStage, isDuplicate, duplicateGroupId, createdAt, updatedAt, deletedAt, deletedBy. | Section 17 |
| 11 | **CandidateReportDraft** | Auto-save drafts for in-progress report forms — id, recruiterId, zone, formData (JSONB), lastSavedAt, createdAt. Deleted on successful submission. | Section 23.8 |
| 12 | **CandidateStageHistory** | Pipeline stage transition history — id, candidateReportId, fromStage, toStage, changedByUserId, changedAt, notes. Tracks every stage change for audit and funnel analytics. | Section 23.11 |
| 13 | **Invoice** | Invoice for placed candidate — id, candidateReportId, invoiceNumber (unique), invoiceDate, invoiceAmountTotal, gstAmount, amountReceived, tdsAmount, paymentStatus, paymentDate. | Section 14, 17 |
| 14 | **DuplicateGroup** | Group of duplicate candidate records — id, detectedAt, status (PENDING/RESOLVED/DISMISSED), resolvedAt, resolvedByUserId. | Section 23.3 |
| 15 | **DuplicateGroupMember** | Members of a duplicate group — id, duplicateGroupId (FK), candidateReportId (FK). | Section 23.3 |

### 33.4 Notifications (2 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 16 | **Notification** | In-app notifications — id, userId, type (8 categories), title, message, actionUrl, metadata (JSONB), isRead, isCleared, readAt, clearedAt, createdAt, expiresAt. | Section 11.8 |
| 17 | **NotificationPreference** | Per-user notification settings — id, userId, category, isEnabled, emailEnabled, soundEnabled, browserPushEnabled, updatedAt. | Section 11.8 |

### 33.5 Reports & Scheduling (4 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 18 | **GeneratedReport** | Every generated report file — id, reportType, reportName, source (ON_PAGE/SCHEDULED), filters (JSONB), generatedAt, fileSize, cloudUrl, cloudStorageKey, expiresAt, isExpired, createdByUserId. | Section 20.6 |
| 19 | **ScheduledReportConfig** | Scheduled email report definitions — id, reportType, filters (JSONB), frequency (DAILY/MONTHLY/YEARLY), timing, isActive, createdAt, updatedAt. | Section 20.6 |
| 20 | **ScheduledReportRecipient** | Recipients per scheduled report — id, scheduledReportConfigId (FK), email, addedAt, removedAt. | Section 20.6 |
| 21 | **ReportDeliveryLog** | Email delivery tracking — id, generatedReportId (FK), scheduledReportConfigId (FK, nullable), recipientEmail, sentAt, deliveryStatus (SUCCESS/FAILED/PENDING), failureReason. | Section 20.6 |

### 33.6 Attendance (3 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 22 | **AttendanceRecord** | Daily attendance per employee — id, userId, date, punchInTime, punchOutTime, leaveLoginAt (nullable), grossWorkingMinutes, netWorkingMinutes, overtimeMinutes, status (9 statuses), isLate, lateByMinutes, midnightResetApplied, remarks, createdAt, updatedAt. | Section 27.14 |
| 23 | **Holiday** | Platform-wide holidays — id, date, name, type (NATIONAL/REGIONAL/CUSTOM), isRecurring, createdBy, createdAt. | Section 27.14 |
| 24 | **AttendanceConfig** | Attendance settings (key-value) — expected login time, grace period, absent threshold, half-day threshold, break deduction, end-of-day cutoff, midnight reset time/enabled, working days, etc. | Section 27.13 |

### 33.7 Leave Management (5 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 25 | **LeaveType** | Leave type definitions — id, name, code, description, isPaid, isActive, requiresDocument, requiresDocumentAfterDays, maxConsecutiveDays, advanceNoticeDays, createdAt, updatedAt. | Section 28.12 |
| 26 | **LeaveRequest** | Employee leave requests — id, userId, leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod, numberOfDays, reason, supportingDocumentUrl, emergencyContact, status (5 statuses), rejectionReason, revocationReason, actionedBy, actionedAt, createdAt, updatedAt. | Section 28.12 |
| 27 | **LeaveBalance** | Per-employee per-type per-year balance — id, userId, leaveTypeId, year, totalAllotted, carriedForward, manualAdjustment, used, remaining, updatedAt. | Section 28.12 |
| 28 | **LeaveBalanceHistory** | Balance change audit trail — id, leaveBalanceId, changeType, changeAmount, balanceBefore, balanceAfter, reason, changedBy, leaveRequestId, createdAt. | Section 28.12 |
| 29 | **LeavePolicyConfig** | Leave policy settings (key-value) — allotments per type, carry-forward rules, advance notice, max consecutive, document requirements, negative balance toggle. | Section 28.7 |

### 33.8 Documents & KYC (4 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 30 | **DocumentType** | Document type definitions — id, name, code, acceptedFormats, isRequired, description, isActive, sortOrder, createdAt, updatedAt. | Section 29.10 |
| 31 | **EmployeeDocument** | Employee uploaded documents — id, userId, documentTypeId, fileUrl, fileName, fileSize, mimeType, fileHash (SHA-256), storageKey, status (4 statuses), verifiedBy, verifiedAt, rejectionReason, expiryDate, adminNotes, version, uploadedAt, createdAt, updatedAt. | Section 29.10 |
| 32 | **EmployeeDocumentHistory** | Document status change history — id, employeeDocumentId, action, oldStatus, newStatus, reason, fileUrl, actionBy, createdAt. | Section 29.10 |
| 33 | **OfferLetter** | Admin-generated offer letters — id, userId, referenceNumber (unique), variant (TEMPLATE/TIPTAP_EDITOR), templateVersion, dynamicFields (JSONB), editorContent (HTML, nullable), generatedFileUrl, generatedFileHash (SHA-256), generatedBy, generatedAt, isArchived, createdAt. | Section 29.10 |

### 33.9 Targets & Performance (1 model)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 34 | **RecruiterTarget** | Recruiter sourcing targets — id, recruiterId, targetType (DAILY/WEEKLY/MONTHLY), targetValue, effectiveFrom, effectiveTo, isActive, createdBy, createdAt, updatedAt. | Section 23.9 |

### 33.10 Audit & Analytics (3 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 35 | **AuditLog** | All CRUD actions platform-wide — id, userId, userRole, action, entityType, entityId, changes (JSONB), ipAddress, userAgent, timestamp. | Section 23.1 |
| 36 | **AnalyticsSnapshot** | Pre-computed analytics aggregations — id, snapshotType, periodStart, periodEnd, data (JSONB), computedAt. | Section 21.9 |
| 37 | **PlatformHealthLog** | Platform health metrics — id, metricName, metricValue (JSONB), recordedAt. API latency, DB connections, Redis memory, queue depth, error rates. | Section 21.9 |

### 33.11 Platform Configuration (3 models)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 38 | **AdminSettings** / **PlatformSetting** | Platform-wide key-value settings — id, category, key (unique), value (JSONB), updatedAt, updatedBy. Zone mappings, thresholds, policies, feature flags. | Section 23.12 |
| 39 | **DropdownOption** | Admin-configurable dropdown values — id, category (STATE/LOCATION/PROFILE/QUALIFICATION/NOTICE_PERIOD/etc.), value, label, zoneSet (SET_A/SET_B/ALL, nullable), sortOrder, isActive, createdAt, updatedAt. | Section 23.19 |
| 40 | **EmailTemplate** | Customizable email templates — id, templateKey (unique), subject (with variable placeholders), bodyHtml (with variable placeholders), updatedAt, updatedBy. | Section 23.13 |

### 33.12 Legacy / Attendance-Scoped Leave (1 model)

| # | Model | Description | Reference |
|---|-------|-------------|-----------|
| 41 | **LeaveRecord** | Basic leave records within attendance context — id, userId, date, leaveType, markedBy (Admin), remarks, createdAt. Supplements LeaveRequest for Admin-marked leave days. | Section 27.14 |

### 33.13 Model Count Summary

| Category | Count |
|----------|:-----:|
| User & Authentication | 6 |
| Business Entities | 3 |
| Candidate & Recruitment | 7 |
| Notifications | 2 |
| Reports & Scheduling | 4 |
| Attendance | 3 |
| Leave Management | 5 |
| Documents & KYC | 4 |
| Targets & Performance | 1 |
| Audit & Analytics | 3 |
| Platform Configuration | 3 |
| Legacy / Attendance-Scoped | 1 |
| **Total Database Models** | **42** |

---

## END OF SPECIFICATION

**Platform name:** OMG Teams — Internal Recruitment, Employee & Workforce Management Platform (by Opportunity Makers Group).
**Platform URLs:** Frontend: `https://teams.opportunitymakers.in` | Backend: `https://api.opportunitymakers.in`.
**Total fields per candidate record:** 48 (33 recruiter-accessible + 15 admin-only).
**Total zones:** 5 (North, South, East, West, Central — mapped to 2 form sets: Set A = West/Central with all 33 fields, Set B = East/North/South with 28 fields — fields 26–30 hidden).
**Total user roles:** 3 (Admin × 1, Reporting Managers × N, Recruiters × N).
**Total pages:** 41 unique pages + 14 global UI components (Section 32).
**Total database models:** 42 Prisma models (Section 33).
**Implementation phases:** 7 phases, 91 items sequentially numbered (Section 19).
**Login system:** Tab-based login page (Recruiter default | RM | Admin). Recruiters/RMs login with Employee ID (OMG-XXXX) + password. Admin logins with email + password. No forgot password. No self-registration. No public landing page. Turnstile captcha on all tabs.
**Employee ID:** Auto-generated unique identifier with format `OMG-XXXX` (Opportunity Makers Group prefix). Immutable, never reused. Used as login credential for Recruiters/RMs. Generated on account creation with success modal showing Employee ID + password with copy icons.
**Session management:** Cookie persists across browser close (NOT session-only). Auto-logout at midnight only (via BullMQ cron job that destroys all employee sessions — Section 27.1.3). 30-minute idle timeout (configurable). Admin sessions exempt from midnight reset.
**Admin password verification:** Employee passwords in detail page are hidden/masked. View/copy requires Admin's own password verification with 5-minute cache.
**Candidate detail/edit:** 4-tab interface (All / Candidate / Recruitment / MIS) with data-aware save button (deactivated by default, activates on genuine change, deactivates on revert — deep field-by-field comparison).
**Report distribution:** Daily (all types) + Monthly (all types, individually) + Yearly (configurable).
**Report download:** On-the-fly XLSX from admin panel — also saved to cloud for re-download from history.
**Email reports:** Cloud-stored (Cloudinary/R2) with configurable auto-cleanup (default 30 days).
**Admin Reports Management Page:** Dedicated page with 4 sections — Generate & Download, Schedule Email Reports, Report History (with re-download), Active Scheduled Reports Info.
**Report types:** 20+ types (Daily Recruitment batch/individual, Work Profile, Candidate, Recruitment, Candidate MIS, HR Feedback, Company-specific, Service Provider-specific, HR-specific, Zone-wise, Status-based, Payment & Invoice, Attendance, Leave, Employee Performance — All Employees / All Recruiters / All Reporting Managers / Individual, and extensible).
**Employees Page (Admin):** Consolidated employee overview with performance, attendance, leave, target data per employee. Generate and download employee reports directly from the page. Schedule employee-specific email reports. Per-employee detail view with Profile, Performance, Attendance, Leave, Documents, and Reports tabs. Employee analytics on Admin Analytics page: summary cards, performance comparison charts, productivity trends, attendance heatmap, leave utilization, workforce distribution.
**Admin Analytics Page:** Enterprise-grade dashboard with 10 KPI cards, 13 chart types (funnel, line, bar, pie, donut, treemap, heatmap, area, histogram, box plot, leaderboard, gauge), real-time live metrics (WebSocket/SSE), platform health monitoring (API, DB, Redis, BullMQ, email, storage), cross-filtering, drill-down, chart export.
**Device Lock System:** Single-device lock + persistent device binding for Recruiters/Reporting Managers — 3-layer architecture (frontend fingerprint + database lock + Redis session enforcement), request middleware validation, admin device reset/force-switch, device tracking history table, login history audit log, suspicious activity detection. IP-based tracking strictly forbidden.
**Additional Platform Features:** Audit/activity log (all CRUD actions tracked), bulk operations (edit/delete/status/assign), candidate duplicate detection (phone/email matching), recruiter & reporting manager personal dashboards, data archiving strategy (12-month threshold), bulk CSV/XLSX import, soft delete with restore (trash view, 90-day auto-purge), form auto-save/draft system (30-second intervals), recruiter targets/goals (daily/weekly/monthly KPIs set by admin), global search (platform-wide across all entities with dedicated results page), candidate pipeline stages (Sourced → Screened → CV Shared → Interview → Selected → Joined → Invoiced → Closed), Company/SP/HR Management Page.
**Design System:** Color system built from Primary #DAA025 (Amber Gold) + Secondary #001845 (Deep Navy) — 9 complete palettes (primary 50–900, secondary 50–900, accent, semantic, background, text, border, chart, contextual). Typography: Plus Jakarta Sans (200–800 weights, 8 size scale). CSS custom properties with light/dark mode support. Tailwind CSS integration.
**Development Standards:** Environment config (.env per environment with Zod validation), standardized error handling (Express global handler + Next.js error.tsx/global-error.tsx + error code taxonomy), structured JSON logging (Winston/Pino with log rotation), testing strategy (unit + integration + E2E, 80%+ coverage), CI/CD pipeline (GitHub Actions — lint → test → build → deploy), Docker containerization (all services + Docker Compose), API documentation (Swagger/OpenAPI auto-generated), database backup & disaster recovery (daily pg_dump, hourly WAL, Redis RDB+AOF), application-level rate limiting (per user/role/endpoint via Redis), WebSocket/SSE real-time layer (Socket.io with Redis adapter), file upload infrastructure (validation + malware scanning + CDN), health check endpoints (/health + /ready), database connection pooling (Prisma pool config + Neon/Supabase pooler).
**Frontend Infrastructure (Next.js App Router):** PWA (installable, service worker sw.js, offline fallback, app shell caching, update detection toast), robots.ts (disallow all — internal platform), sitemap.ts (empty), manifest.ts (web app manifest), not-found.tsx (custom 404), loading.tsx (route loading with spinner), error.tsx (route-level error boundary with Sentry), global-error.tsx (root-level last-resort error boundary), middleware.ts (auth + role + maintenance check). Robust toast notification system (6 types: success/error/warning/info/loading/promise, deduplication, action buttons, persistent toasts). Comprehensive skeleton loading system (shimmer/pulse with page-specific skeletons). Reusable spinner component (3 sizes, brand colors).
**Security Hardening:** Account lockout after 5 failed attempts (15-min cooldown + admin notification), password complexity requirements (8+ chars, uppercase/lowercase/digit/special, common password rejection), session idle timeout (30-min configurable, absolute lifetime until midnight via cron), data encryption at rest (PostgreSQL + Redis + backups + cloud storage), PII data handling policy (data masking for non-admin views, retention policy, GDPR/DPDP compliance).
**Deployment & Infrastructure:** Frontend on Vercel (teams.opportunitymakers.in), backend on Render (api.opportunitymakers.in), PostgreSQL on Neon/Supabase, Redis on Redis Cloud. Auto SSL via Vercel/Render (Let's Encrypt fallback for self-hosting). External monitoring via UptimeRobot + Grafana + PagerDuty-style alerting.
**Attendance Management System:** Robust attendance tracking for Recruiters and Reporting Managers — automatic Punch In (login) / Punch Out (logout) with timestamps, automatic working hours calculation (Punch Out − Punch In), approved leave day working timer suppression (login recorded as leaveLoginAt for audit only, working hours = 0), midnight session reset cron job (BullMQ, destroys all employee sessions daily, forces fresh login, Admin exempt), configurable late login alert (default 10:00 AM + 15-min grace), automatic half-day flag (< 4 hours), 9 attendance statuses (Present Full/Half, Late, Absent, Incomplete, On Leave, Holiday, Weekend, Overtime), Admin attendance dashboard with full logs filtered by date/employee, employee self-view with calendar, Reporting Manager team view, holiday calendar, 12 configurable settings (including midnightResetTime, midnightResetEnabled), and database entities with leaveLoginAt and midnightResetApplied fields.
**Leave Application & Management System:** Full leave request/approval workflow — employees (Recruiters + Reporting Managers) submit leave requests with date range, reason, and optional supporting documents. Leave types: Casual Leave, Sick Leave, Earned Leave, Comp Off, Half-Day, Unpaid Leave, and Admin-configurable custom types. Admin one-click approve/reject with bulk actions. Auto leave balance counter (deducted on approval, restored on revocation). Working timer suppressed on approved leave days even if employee logs in. In-app notifications to Admin (on submission), to employee (on approval/rejection), and to Reporting Manager (on team leaves). Leave policies engine (16 configurable rules). 5 leave report types. 4 database entities with full balance history audit trail.
**Document Upload & KYC Verification System:** 5 mandatory document types (Aadhaar Card, PAN Card, Resume, Bank Details, Offer Letter/Agreement) with Admin-configurable extensibility. Offer letter generation with TWO variants: (1) Static template + dynamic fields, (2) Static header/footer + Tiptap rich text editor body with all features (bold, italic, alignment, underline, lists, text color, highlight, strikethrough, cases, font size, font family, tables, images, links, find/replace, source code view, and more). Character/line limit validation in Tiptap (default 5,000 chars / 80 lines). Copy-paste preserves exact formatting from source. Shared header layout: OMG logo (left), "Offer Letter" title (center), email/location/contact/website (right). Signatory: "Shalini Singh|HR Manager" (bottom-left). Reference PDF analyzed (Section 29.4.1.4). 7 dynamic fields identified (employee name, position title, date, salary, joining date, probation period, notice period).
**User Profile Page & Profile Photo Management:** Profile page for all roles with editable mobile number and address. Full image manipulation. Cloudinary storage with cleanup. Custom confirmation dialogs.
**Live Status Tracker & Last Active System:** Firebase RTDB + Firestore + Socket.io. Online/idle/offline dots. Role-scoped visibility.
**Reporting Manager "My Recruiters" Page:** View-only. Live status. No add/remove control.

---

*This specification is comprehensive and implementation-ready. Every requirement from the original brief is preserved and structured for clarity. No detail has been removed — only organization, disambiguation, and implementation guidance have been added.*
