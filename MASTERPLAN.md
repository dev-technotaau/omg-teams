# OMG Teams — Spec Implementation Masterplan

## What This Document Is

This is the **single source of truth** for implementing the entire OMG Teams Platform Specification (`OMG-Teams-Platform-Specification.md` — 33 sections, ~6800 lines). Every line, every word, every requirement from that spec must be read, audited, and implemented. Nothing is optional. Nothing gets skipped.

---

## User's Mandate (Verbatim Intent)

> Read and implement **every single item, every single spec, line by line, word by word** from the 7000-line specification document. Nothing should be left behind — no referenced sections, no sub-sections, no gap (whether critical, high, moderate, or low). Everything mentioned in the spec must be fully implemented across the full stack, properly integrated, wired, and configured. If anything extra is implemented beyond what the spec requires, that's acceptable — but nothing should be less than what the spec demands. After all implementation, cross-check against Section 19 to verify completeness.

---

## How Each Phase Works (The 7-Step Protocol)

Every phase follows this exact sequence. No shortcuts. No skipping steps.

### Step 1 — Read the Spec Section
- Read the assigned spec section(s) **200 lines at a time max**
- Read every word — don't skim, don't summarize prematurely
- Note every requirement, every field, every behavior, every edge case

### Step 2 — Read Referenced Sections
- Every section references other sections (e.g., "see Section 22", "see Section 24.1")
- Read ALL referenced sections/sub-sections relevant to the current phase
- This ensures no cross-cutting requirement is missed

### Step 3 — Audit Existing Implementation
- Read the actual code files that correspond to this section
- Compare code against spec **word-for-word**
- Never assume existing code is correct — verify everything

### Step 4 — Write Gap Checklist
- Create a detailed checklist of every gap, every missing feature, every partial implementation, every mis-implementation
- Each gap gets its own checkbox — no grouping multiple items under one checkbox
- Gaps include: missing features, missing fields, wrong behavior, missing validation, missing UI elements, missing API endpoints, missing database fields, missing integrations

### Step 5 — Implement All Gaps
- Implement every single gap from the checklist
- Full-stack: backend (Prisma schema, services, controllers, routes, middleware, jobs) + frontend (pages, components, hooks, stores, types, API calls)
- Properly integrated, wired, and configured — not just stub code

### Step 6 — Type-Check
- Run `npx tsc --noEmit` on both backend and frontend
- Fix all TypeScript errors before proceeding
- Zero errors tolerance

### Step 7 — Update SPEC_PROGRESS.md
- Mark the phase as complete with date
- Record what was implemented
- Record any items deferred (with reason)

---

## Phase Directory (39 Phases)

### Section-to-Phase Mapping

| Phase | Spec Section(s) | Title | Lines | Line Range |
|-------|-----------------|-------|-------|------------|
| 1 | §1 + §2 | Project Overview + Entity Hierarchy | ~139 | 45–183 |
| 2 | §3 | User Roles & Access Control | ~217 | 184–400 |
| 3 | §4 | Authentication & Session Management | ~105 | 401–505 |
| 4 | §5 | Recruiter Module | ~93 | 506–598 |
| 5 | §6.1–6.1.1 | Admin Form + Tabbed Detail View | ~178 | 599–776 |
| 6 | §6.2–6.4 | Admin Dashboard + User/Employee Mgmt | ~214 | 776–989 |
| 7 | §7 + §8 | Reporting Manager Module + Zone Logic | ~138 | 990–1127 |
| 8 | §9 + §10 | Relational Dropdowns + Report Gen | ~113 | 1128–1240 |
| 9 | §11 | Notification System | ~232 | 1241–1472 |
| 10 | §12 + §13 + §14 | Data Viewing + Photo System + Invoice | ~82 | 1473–1554 |
| 11 | §15 + §16 | Tech Stack + Security Layer | ~117 | 1555–1671 |
| 12 | §17 | Database Schema Guidelines | ~84 | 1672–1755 |
| 13 | §18 | UI/UX Requirements | ~304 | 1756–2059 |
| 14 | §20 | Admin Reports Management Page | ~181 | 2178–2358 |
| 15 | §21 | Admin Analytics & Statistics Page | ~288 | 2359–2646 |
| 16 | §22.1–22.7 | Device Lock — Fingerprint + Binding + Login + Session | ~200 | 2647–2870 |
| 17 | §22.8–22.16 | Device Lock — Middleware + Admin Controls + DB | ~183 | 2871–3052 |
| 18 | §23.1–23.4 | Audit Log + Bulk Ops + Dedup + Dashboards | ~224 | 3053–3276 |
| 19 | §23.5–23.8 | Archiving + CSV Import + Soft Delete + Drafts | ~117 | 3277–3393 |
| 20 | §23.9–23.12 | Targets + Global Search + Pipeline + Settings | ~137 | 3394–3530 |
| 21 | §23.13–23.16 | Email Templates + Export + Presence + Backup Codes | ~264 | 3531–3794 |
| 22 | §23.17–23.19 | Print View + Onboarding + Dropdown Options | ~91 | 3795–3885 |
| 23 | §24.1–24.5 | Env Config + Error Handling + Logging + Testing + CI/CD | ~138 | 3886–4023 |
| 24 | §24.6–24.9 | Docker + API Docs + DB Backup + Rate Limiting | ~102 | 4024–4125 |
| 25 | §24.10–24.13 | WebSocket + File Upload + Health Check + DB Pool | ~138 | 4126–4263 |
| 26 | §24.14–24.17 | Sentry + DB Indexing + Perf Budgets + Browser Compat | ~169 | 4264–4432 |
| 27 | §24.18–24.19 (first half) | Maintenance Mode + PWA + Infra Files (24.19.1–24.19.7) | ~170 | 4433–4602 |
| 28 | §24.19 (second half) | Skeleton Loading + Toasts + More Infra (24.19.8–24.19.13) | ~164 | 4603–4766 |
| 29 | §25 + §26 | Security Hardening + Deployment & Infra | ~208 | 4767–4974 |
| 30 | §27.1–27.7 | Attendance — Core Workflow + Hours + Late + Half-Day | ~210 | 4975–5184 |
| 31 | §27.8–27.14 | Attendance — RM View + Holiday + Reports + Config + DB | ~128 | 5185–5312 |
| 32 | §28.1–28.6 | Leave — Types + Submission + Admin Dashboard + Notifications | ~244 | 5313–5556 |
| 33 | §28.7–28.12 | Leave — Policies + Integration + Reports + Calendar + DB | ~101 | 5557–5657 |
| 34 | §29.1–29.3 | Documents — Types + Upload Interface + Cloud Storage | ~76 | 5658–5741 |
| 35 | §29.4 | Offer Letter & Agreement Generation (Admin) | ~364 | 5742–6105 |
| 36 | §29.5–29.10 | Documents — Verification + KYC + Notifications + DB | ~130 | 6106–6235 |
| 37 | §30 | User Profile Page & Profile Photo Management | ~232 | 6236–6467 |
| 38 | §31 + §32 + §33 | Appendix + Page Directory + DB Model Directory | ~329 | 6468–6796 |
| 39 | §19 + Full Cross-Check | Final Verification Against Implementation Order | ~118 | 2060–2177 |

**Total: 39 phases covering all 33 sections + final cross-check**

---

## Phase Details

### Phase 1 — Project Overview + Entity Hierarchy (§1 + §2)
**Spec lines:** 45–183 (~139 lines)
**What to audit:**
- Platform name, business model, platform purpose correctly reflected in codebase
- All entity hierarchies exist in Prisma schema (Company → SP → HR, User → Attendance → Leave → Documents → etc.)
- All relationship rules enforced (single Admin, Recruiter ↔ RM assignment, one AttendanceRecord per user per day, etc.)
- Platform-level entities exist (Holiday, LeaveType, DocumentType, AuditLog, AdminSettings, DropdownOptions, etc.)
**Referenced sections:** §4, §22, §27, §28, §29, §23.1, §23.8, §23.3, §23.11, §23.9, §11, §20, §23.12, §23.19, §23.15, §23.16, §27.9, §28.1, §29.1

### Phase 2 — User Roles & Access Control (§3)
**Spec lines:** 184–400 (~217 lines)
**What to audit:**
- §3.1 Admin capabilities (all listed permissions)
- §3.2 Reporting Manager capabilities and restrictions
- §3.3 Recruiter capabilities and restrictions
- Role-based middleware enforcing all access rules
- Every Admin-only, RM-only, Recruiter-only feature correctly gated

### Phase 3 — Authentication & Session Management (§4)
**Spec lines:** 401–505 (~105 lines)
**What to audit:**
- JWT + BFF cookie flow
- Login page UI (all fields, Turnstile captcha, device lock info)
- Complete login flow sequence
- Complete logout flow sequence (including punch-out)
- Session management (Redis, expiry, revocation)
**Referenced sections:** §22, §25.1, §25.2, §25.3, §27.1

### Phase 4 — Recruiter Module (§5)
**Spec lines:** 506–598 (~93 lines)
**What to audit:**
- §5.1 Report submission form (all 33 fields)
- §5.2 All recruiter form fields with exact types and validations
- §5.3 Form auto-save & draft system
- §5.4 Duplicate detection (phone + email)
- §5.5 Candidate pipeline stages
- §5.6 Recruiter data visibility rules
**Referenced sections:** §8, §9, §23.3, §23.8, §23.11

### Phase 5 — Admin Form + Tabbed Detail View (§6.1–6.1.1)
**Spec lines:** 599–776 (~178 lines)
**What to audit:**
- §6.1 Admin form (superset with 15 admin-only fields)
- §6.1.1 Admin candidate detail/edit view — ALL tabs in tabbed interface
- Every admin-only field listed
**Referenced sections:** §5.2, §14, §31

### Phase 6 — Admin Dashboard + User/Employee Management (§6.2–6.4)
**Spec lines:** 776–989 (~214 lines)
**What to audit:**
- §6.2 Admin dashboard features (all cards, stats, quick actions)
- §6.3 User management (create, suspend, reactivate, delete, assign RM, device reset, password reset)
- §6.4 Employees page (consolidated view, all columns, filters, actions)
**Referenced sections:** §22, §23.9, §27, §28, §29

### Phase 7 — Reporting Manager Module + Zone Logic (§7 + §8)
**Spec lines:** 990–1127 (~138 lines)
**What to audit:**
- §7 RM data access rules, features, "My Recruiters" page
- §8 Zone configuration (5 zones), zone-to-form mapping, conditional field visibility
**Referenced sections:** §5, §6, §3.2

### Phase 8 — Relational Dropdowns + Report Generation (§9 + §10)
**Spec lines:** 1128–1240 (~113 lines)
**What to audit:**
- §9 Company/SP/HR architecture, dropdown behavior, sync requirements
- §10 Report types (20+), format (XLSX), email distribution, cloud storage, admin downloads
**Referenced sections:** §20, §23.14

### Phase 9 — Notification System (§11)
**Spec lines:** 1241–1472 (~232 lines)
**What to audit:**
- §11.1 Real-time delivery via Socket.io
- §11.2 Notification UI (dropdown panel + full page)
- §11.3 Notification types & categories
- §11.4 ALL notification triggers by role (Admin, RM, Recruiter)
- §11.5 Per-user notification preferences
- §11.6 Persistence & storage
- §11.7 Unread badge behavior
- §11.8 Database entities
**Referenced sections:** §24.10

### Phase 10 — Data Viewing + Photo System + Invoice (§12 + §13 + §14)
**Spec lines:** 1473–1554 (~82 lines)
**What to audit:**
- §12 Pagination, virtualization, filtering, sorting, searching, view controls
- §13 Profile photo functionality, implementation
- §14 Invoice number auto-generation logic (field #41)
**Referenced sections:** §30, §23.14

### Phase 11 — Tech Stack + Security Layer (§15 + §16)
**Spec lines:** 1555–1671 (~117 lines)
**What to audit:**
- §15 All tech stack items (frontend, backend, DB, cache, cloud, email, nginx, real-time, Sentry)
- §16 Auth, session security, web security (CSP, CORS, etc.), data security
**Referenced sections:** §24, §25

### Phase 12 — Database Schema Guidelines (§17)
**Spec lines:** 1672–1755 (~84 lines)
**What to audit:**
- All core Prisma models listed
- Key schema constraints (soft delete, timestamps, UUID, enums, indexes)
- Compare actual schema.prisma against every model and constraint listed
**Referenced sections:** §33

### Phase 13 — UI/UX Requirements (§18)
**Spec lines:** 1756–2059 (~304 lines — read in 2 batches)
**What to audit:**
- Quality standard (enterprise/SaaS grade)
- Design principles (all listed)
- Complete color system (Primary #DAA025, Secondary #001845, all 9 palettes, semantic colors, backgrounds, text, borders)
- Typography (Plus Jakarta Sans, all size/weight specs)
- ALL UI components required (every single one listed)
**Referenced sections:** None major

### Phase 14 — Admin Reports Management Page (§20)
**Spec lines:** 2178–2358 (~181 lines)
**What to audit:**
- §20.1 Page layout (4 sections)
- §20.2 Generate & Download Reports section
- §20.3 Schedule Email Reports section
- §20.4 Report History section
- §20.5 Active Scheduled Reports Info section
- §20.6 Database entities
**Referenced sections:** §10

### Phase 15 — Admin Analytics & Statistics Page (§21)
**Spec lines:** 2359–2646 (~288 lines — read in 2 batches)
**What to audit:**
- §21.1 Page layout & design philosophy
- §21.2 KPI summary cards (top row)
- §21.3 Recruitment pipeline funnel
- §21.4 ALL charts & visualizations
- §21.5 Real-time statistics
- §21.6 Platform health & system monitoring
- §21.7 Interaction & drill-down capabilities
- §21.8 Analytics data layer
- §21.9 Database entities
**Referenced sections:** §10, §27, §28

### Phase 16 — Device Lock: Fingerprint + Binding + Login + Session (§22.1–22.7)
**Spec lines:** 2647–2870 (~224 lines)
**What to audit:**
- §22.1 Functional requirements
- §22.2 Architecture (3 mandatory layers)
- §22.3 Layer 1 — Device fingerprint (frontend)
- §22.4 Layer 2 — Persistent device binding (DB)
- §22.5 Layer 3 — Login logic (critical enforcement)
- §22.6 Logout behavior (critical rules)
- §22.7 Session management (Redis + JWT hybrid)
**Referenced sections:** §4, §25.3

### Phase 17 — Device Lock: Middleware + Admin Controls + DB (§22.8–22.16)
**Spec lines:** 2871–3052 (~183 lines)
**What to audit:**
- §22.8 Request validation middleware
- §22.9 Admin device controls
- §22.10 IP-based tracking (forbidden)
- §22.11 Device tracking table
- §22.12 Additional features
- §22.13 Security considerations
- §22.14 Final best practice combination
- §22.15 Implementation expectations
- §22.16 Database entities
**Referenced sections:** §4, §6.3

### Phase 18 — Audit Log + Bulk Ops + Dedup + Dashboards (§23.1–23.4)
**Spec lines:** 3053–3276 (~224 lines)
**What to audit:**
- §23.1 Audit/activity log system (what's logged, fields, storage, UI)
- §23.2 Bulk operations (edit, delete, status update, assign)
- §23.3 Candidate duplicate detection (phone + email dedup, merge logic)
- §23.4 Recruiter & RM dashboards (all cards, stats, charts)
**Referenced sections:** §5.4, §6.2, §7

### Phase 19 — Archiving + CSV Import + Soft Delete + Drafts (§23.5–23.8)
**Spec lines:** 3277–3393 (~117 lines)
**What to audit:**
- §23.5 Data archiving strategy (age thresholds, archive process)
- §23.6 Data import (CSV/XLSX upload, validation, error handling)
- §23.7 Soft delete with restore (all entities, trash view)
- §23.8 Form auto-save / draft system (auto-save interval, restore, cleanup)
**Referenced sections:** §5.3

### Phase 20 — Targets + Global Search + Pipeline + Settings (§23.9–23.12)
**Spec lines:** 3394–3530 (~137 lines)
**What to audit:**
- §23.9 Recruiter targets/goals (admin sets, daily/weekly/monthly, dashboard tracking)
- §23.10 Global search (platform-wide, search results page)
- §23.11 Candidate status workflow / pipeline stages
- §23.12 Admin settings/configuration page (all setting categories)
**Referenced sections:** §5.5, §6.2

### Phase 21 — Email Templates + Export + Presence + Backup Codes (§23.13–23.16)
**Spec lines:** 3531–3794 (~264 lines)
**What to audit:**
- §23.13 Email templates (customizable subjects, bodies, branding, template management)
- §23.14 Export from data tables (XLSX/CSV, column selection, filters)
- §23.15 User activity indicators — live status tracker & last active system (Firebase RTDB + Firestore)
- §23.16 Backup codes for device lock (generation, usage, admin view)
**Referenced sections:** §10, §22, §24.10

### Phase 22 — Print View + Onboarding + Dropdown Options (§23.17–23.19)
**Spec lines:** 3795–3885 (~91 lines)
**What to audit:**
- §23.17 Print view (print CSS, candidate profiles, reports, attendance)
- §23.18 Onboarding / in-app help system (first-login tour, tooltips, FAQ)
- §23.19 Admin configurable dropdown options (master data management)
**Referenced sections:** §6.1

### Phase 23 — Env Config + Error Handling + Logging + Testing + CI/CD (§24.1–24.5)
**Spec lines:** 3886–4023 (~138 lines)
**What to audit:**
- §24.1 Environment configuration (.env, dev/staging/prod)
- §24.2 Error handling strategy (Express handler, Next.js boundaries, API error format)
- §24.3 Logging strategy (Winston/Pino, JSON logs, levels)
- §24.4 Testing strategy (unit + integration + E2E)
- §24.5 CI/CD pipeline (GitHub Actions)
**Referenced sections:** §15

### Phase 24 — Docker + API Docs + DB Backup + Rate Limiting (§24.6–24.9)
**Spec lines:** 4024–4125 (~102 lines)
**What to audit:**
- §24.6 Docker / containerization
- §24.7 API documentation (Swagger/OpenAPI)
- §24.8 Database backup & disaster recovery
- §24.9 API rate limiting (per user/role/endpoint)
**Referenced sections:** §15, §16

### Phase 25 — WebSocket + File Upload + Health Check + DB Pool (§24.10–24.13)
**Spec lines:** 4126–4263 (~138 lines)
**What to audit:**
- §24.10 WebSocket / SSE setup (Socket.io for notifications & presence)
- §24.11 File upload infrastructure (validation, scanning, CDN)
- §24.12 Health check endpoints (/health, /ready)
- §24.13 Database connection pooling
**Referenced sections:** §11, §13, §29

### Phase 26 — Sentry + DB Indexing + Perf Budgets + Browser Compat (§24.14–24.17)
**Spec lines:** 4264–4432 (~169 lines)
**What to audit:**
- §24.14 Error tracking (Sentry client + server)
- §24.15 Database indexing strategy (composite, partial, GIN, full-text)
- §24.16 Performance budgets / SLAs (API p95, FCP, TTI)
- §24.17 Browser compatibility (Chrome 90+, Firefox 90+, Edge 90+, Safari 15+)
**Referenced sections:** §15

### Phase 27 — Maintenance Mode + PWA + Infra Files Part 1 (§24.18–24.19.7)
**Spec lines:** 4433–4602 (~170 lines)
**What to audit:**
- §24.18 Maintenance mode (toggle, bypass, UI)
- §24.19.1 PWA setup (service worker, manifest, offline)
- §24.19.2 Install prompt
- §24.19.3 not-found.tsx (custom 404)
- §24.19.4 error.tsx (route error boundary)
- §24.19.5 global-error.tsx (root error boundary)
- §24.19.6 loading.tsx (route loading)
- §24.19.7 Spinner component
**Referenced sections:** §18

### Phase 28 — Skeleton Loading + Toasts + More Infra (§24.19.8–24.19.13)
**Spec lines:** 4603–4766 (~164 lines)
**What to audit:**
- §24.19.8 Skeleton loading system (shimmer/pulse, page-specific)
- §24.19.9 robots.ts
- §24.19.10 sitemap.ts
- §24.19.11 Toast notification system (all types, dedup, actions)
- §24.19.12 Update detection toast
- §24.19.13 middleware.ts (auth + role + maintenance check)
**Referenced sections:** §18

### Phase 29 — Security Hardening + Deployment (§25 + §26)
**Spec lines:** 4767–4974 (~208 lines)
**What to audit:**
- §25.1 Account lockout on failed login
- §25.2 Password complexity requirements
- §25.3 Session idle timeout
- §25.4 Data encryption at rest
- §25.5 PII data handling policy
- §26.1 Hosting/deployment targets
- §26.2 Domain & SSL certificate management
- §26.3 Monitoring & alerting
**Referenced sections:** §4, §16, §22

### Phase 30 — Attendance Core (§27.1–27.7)
**Spec lines:** 4975–5184 (~210 lines)
**What to audit:**
- §27.1 Core attendance workflow (punch in/out via login/logout, one record per day)
- §27.2 Automatic working hours calculation
- §27.3 Late login alert system
- §27.4 Half-day auto-detection
- §27.5 Attendance status classification
- §27.6 Admin attendance dashboard (all columns, filters, actions)
- §27.7 Employee attendance self-view
**Referenced sections:** §4, §25.3, §28

### Phase 31 — Attendance: RM View + Holiday + Reports + Config + DB (§27.8–27.14)
**Spec lines:** 5185–5312 (~128 lines)
**What to audit:**
- §27.8 Attendance in RM view
- §27.9 Holiday & weekend configuration
- §27.10 Leave management (basic — integration with attendance)
- §27.11 Attendance reports & analytics
- §27.12 Attendance notifications
- §27.13 Attendance configuration (admin settings — all thresholds)
- §27.14 Database entities for attendance
**Referenced sections:** §28, §11

### Phase 32 — Leave: Types + Submission + Admin Dashboard + Notifications (§28.1–28.6)
**Spec lines:** 5313–5556 (~244 lines)
**What to audit:**
- §28.1 Leave types (all types with configs)
- §28.2 Leave request submission (employee side — form, validation, calendar picker)
- §28.3 Admin leave management dashboard (all tabs, filters, actions)
- §28.4 Employee leave view (self-service — balance cards, request history, calendar)
- §28.5 Reporting Manager leave view
- §28.6 Leave notifications (all triggers)
**Referenced sections:** §11, §27

### Phase 33 — Leave: Policies + Integration + Reports + Calendar + DB (§28.7–28.12)
**Spec lines:** 5557–5657 (~101 lines)
**What to audit:**
- §28.7 Leave policies & rules engine (advance notice, max consecutive, overlap prevention)
- §28.8 Leave & attendance integration
- §28.9 Leave reports
- §28.10 Leave calendar (team-wide / admin view)
- §28.11 Employee leave request cancellation
- §28.12 Database entities for leave management
**Referenced sections:** §27, §20

### Phase 34 — Documents: Types + Upload Interface + Cloud Storage (§29.1–29.3)
**Spec lines:** 5658–5741 (~84 lines)
**What to audit:**
- §29.1 Required document types (Aadhaar, PAN, Resume, Bank Details, Offer Letter)
- §29.2 Employee document upload interface (drag-and-drop, preview, status indicators)
- §29.3 Cloud storage & security (Cloudinary, access control, URL signing)
**Referenced sections:** §13, §24.11

### Phase 35 — Offer Letter & Agreement Generation (§29.4)
**Spec lines:** 5742–6105 (~364 lines — read in 2 batches)
**What to audit:**
- Complete offer letter generation system (Admin)
- Two variants: static template + Tiptap rich text editor
- Template variables, PDF generation, versioning
- Agreement generation (separate from offer letter)
- Auto-verification of platform-generated documents
- All UI, API, and database aspects
**Referenced sections:** §6.3, §29.1

### Phase 36 — Documents: Verification + KYC + Notifications + DB (§29.5–29.10)
**Spec lines:** 6106–6235 (~130 lines)
**What to audit:**
- §29.5 Admin document verification panel
- §29.6 Employee document status visibility
- §29.7 Document / KYC notifications
- §29.8 KYC status tracking (admin overview)
- §29.9 Additional document features
- §29.10 Database entities for document management
**Referenced sections:** §11, §6.4

### Phase 37 — User Profile Page & Profile Photo Management (§30)
**Spec lines:** 6236–6467 (~232 lines)
**What to audit:**
- §30.1 Profile page (all roles — layout, sections, info displayed)
- §30.2 Profile photo upload system (drag-and-drop, crop, rotate, scale, fixed ratio)
- §30.3 Cloudinary cleanup & DB URL synchronization
- §30.4 Custom confirmation dialogs
- §30.5 Admin photo management
- §30.6 Profile photo display across the platform
- §30.7 Database fields for profile
**Referenced sections:** §13, §24.11

### Phase 38 — Appendix + Page Directory + DB Model Directory (§31 + §32 + §33)
**Spec lines:** 6468–6796 (~329 lines — read in 2 batches)
**What to audit:**
- §31 Field reference tables (Recruiter 33 fields, Admin 15 additional fields) — verify every field exists in schema + forms
- §32 Complete page directory — verify every page exists in the frontend
  - §32.1 Auth & public pages
  - §32.2 Common pages (all roles)
  - §32.3 Recruiter pages
  - §32.4 RM pages
  - §32.5 Admin pages
  - §32.6 Global UI components
  - §32.7 Page count summary
- §33 Complete database model directory — verify every model exists in Prisma schema
  - §33.1–33.13 All model groups
  - §33.13 Model count summary

### Phase 39 — Final Cross-Check Against §19 (Implementation Order)
**Spec lines:** 2060–2177 (~118 lines)
**What to do:**
- Read §19 (Implementation Order & Phasing) — all 91 items across 7 phases
- Cross-check EVERY SINGLE ITEM (items 1–91) against what was implemented
- For each item, verify: Does it exist? Is it complete? Is it properly wired?
- Create a final checklist of any remaining gaps
- Implement any remaining gaps
- Final type-check on both backend and frontend
- Mark SPEC_PROGRESS.md as COMPLETE

---

## Key Rules (Non-Negotiable)

### Reading Rules
1. **Never implement without reading the spec section first** — always Step 1 before Step 5
2. **Read 200 lines at a time max** — prevents skimming and missed requirements
3. **Read ALL referenced sections** — if §5 says "see Section 23.3", read §23.3 during Phase 4
4. **Read every word** — a single missed word can mean a missed feature

### Auditing Rules
5. **Never assume code is correct** — always audit existing code against spec word-for-word
6. **Check both frontend AND backend** — a feature isn't done if only one side is implemented
7. **Check wiring** — a service method that's never called from a route is not "implemented"
8. **Check types** — a missing TypeScript type means the feature isn't properly typed

### Implementation Rules
9. **Each gap item gets its own checkbox** — never mark "done" until verified
10. **Implement ALL gaps regardless of priority** — critical, high, moderate, low — ALL of them
11. **Full-stack implementation** — schema + service + controller + route + frontend page + component + hook + type
12. **Properly integrated** — not just stub code, actually wired and functional
13. **No item, no specification, no line, not a single word should be left behind**

### Session Rules
14. **One phase per conversation session** — don't try to do two phases in one session
15. **One section per session** (unless sections are small enough to combine as specified in phase table)
16. **At session start, read SPEC_PROGRESS.md** to know where we left off
17. **At session end, update SPEC_PROGRESS.md** with what was completed

### Quality Rules
18. **Type-check after every batch of changes** — `npx tsc --noEmit` on both backend and frontend
19. **Zero TypeScript errors tolerance** — fix all errors before proceeding to next phase
20. **Zero ESLint errors tolerance** — fix all lint errors before proceeding
21. **If something extra is implemented beyond spec, that's fine** — but nothing less than spec

### Progress Rules
22. **SPEC_PROGRESS.md is the single source of truth** for what's been done
23. **Never skip a phase** — phases must be done in order (1 → 2 → 3 → ... → 39)
24. **If a phase has zero gaps, still mark it complete** — confirmation that existing code matches spec
25. **Deferred items must have a reason** — and must be picked up before Phase 39

---

## How to Start a New Session

```
1. Read this MASTERPLAN.md (you're doing it now)
2. Read SPEC_PROGRESS.md to find the current phase
3. Follow the 7-Step Protocol for that phase
4. Update SPEC_PROGRESS.md when done
5. Tell the user: "Phase X complete. Next session: Phase Y."
```

---

## File Locations

| File | Purpose |
|------|---------|
| `OMG-Teams-Platform-Specification.md` | The spec (source of truth for requirements) |
| `MASTERPLAN.md` | This file (source of truth for the plan) |
| `SPEC_PROGRESS.md` | Progress tracking (source of truth for what's done) |
| `backend/prisma/schema.prisma` | Database schema |
| `backend/src/` | Backend source code |
| `frontend/src/` | Frontend source code |

---

## Estimated Scope

- **Spec document:** ~6800 lines across 33 sections
- **Phases:** 39 (including final cross-check)
- **Sessions:** ~39 (one per phase)
- **Implementation scope:** Full-stack (Prisma + Express + Next.js + Redis + Socket.io + Firebase + Cloudinary + BullMQ)

Every line read. Every word honored. Every gap filled. No exceptions.
