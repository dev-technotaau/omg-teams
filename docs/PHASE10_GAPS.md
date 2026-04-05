# Phase 10 — Additional Features Part 2 (§23.11–23.19) Gap Checklist

## Compliant Items (already working)
1. ✅ §23.11 Candidate Pipeline Stages — CandidateStage enum, CandidateStageHistory model, pipeline.service.ts
2. ✅ §23.12 Admin Settings — PlatformSetting model, settings service, admin settings page (7 categories, 20+ settings)
3. ✅ §23.13 Email Templates — EmailTemplate model, 8 templates, admin editor page, variable system
4. ✅ §23.14 Quick Export — DataTable has onExport prop, export-table.ts utility (XLSX/CSV)
5. ✅ §23.16 Backup Codes — BackupCode model, generation/verify service, LoginMethod enum
6. ✅ §23.17 Print View — @media print CSS in globals.css, data-print attributes
7. ✅ §23.18 Onboarding — driver.js tour component, Help/FAQ page with role-based sections
8. ✅ §23.19 Admin Configurable Dropdowns — DropdownOption model, service with Redis cache, master-data admin page

## Gaps to Implement

| # | Gap | Severity | File(s) |
|---|-----|----------|---------|
| 1 | §23.15 Live Status/Presence — Firebase configured but no presence tracking service, no Socket.IO presence events, no online/offline/idle dots in UI | HIGH | backend + frontend |
| 2 | §23.17 Print buttons missing — @media print CSS exists but no "Print" buttons on candidate detail, invoice, or data table pages | MEDIUM | frontend pages |
| 3 | §23.14 Quick export not wired on most pages — DataTable has onExport prop but most pages don't pass it | MEDIUM | admin pages |
