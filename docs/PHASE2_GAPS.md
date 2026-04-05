# Phase 2 — Core Recruitment: Recruiter Module: Gap Checklist

**Spec sections audited**: §5 (Recruiter Module), §8 (Zone-Based Form), §14 (Invoice Auto-Gen)

## What EXISTS and is spec-compliant ✅

- [x] Zone selection as first step before form renders
- [x] Zone-to-Form mapping (Set A: West/Central = 33 fields, Set B: East/North/South = 28 fields)
- [x] Zone-conditional field visibility (fields 26-30 hidden for Set B)
- [x] Zone-conditional field storage (null for Set B zones in DB)
- [x] 30 of 33 form fields present
- [x] Recruiter Name auto-populated from logged-in user (display-only)
- [x] Status dropdown (Complete/Pending)
- [x] Backend create endpoint with Zod validation
- [x] Backend zone-conditional null storage
- [x] Global serial number auto-generation (Prisma autoincrement)
- [x] Invoice service with format HF-YYYYMMDD-NNN
- [x] Invoice tracks last used number
- [x] Duplicate detection (phone + email check)
- [x] Auto-save every 30 seconds
- [x] Save Draft button
- [x] Resume draft on form mount
- [x] One draft per recruiter (upsert logic)
- [x] Admin-configurable dropdown service (State, Location, Profile, etc.)
- [x] Dropdown supports zone-set scoping (SET_A / SET_B / ALL)
- [x] Candidate pipeline stages in schema (SOURCED → CLOSED)

## GAPS — Must Implement 🔴

### Gap 1: Age auto-calculation from DOB (§5.2 field #23)
**Spec says**: Age is auto-calculated from Date of Birth, displayed as read-only.
**Current state**: DOB input exists but no age calculation or display.
**Fix**: Add useEffect that calculates age from DOB and displays in a read-only field.

### Gap 2: Reporting Manager auto-set from admin assignment (§5.2 field #32)
**Spec says**: Reporting Manager is auto-set from admin assignment, displayed read-only.
**Current state**: Hardcoded text "Assigned by Admin" — not fetched from actual assignment.
**Fix**: Fetch from user's `assignedManagers` relation and display actual manager name.

### Gap 3: beforeunload save handler (§5.3 / §23.8)
**Spec says**: Auto-save on browser beforeunload event to prevent data loss.
**Current state**: Auto-save on interval and blur, but NO beforeunload handler.
**Fix**: Add `window.addEventListener("beforeunload", saveDraft)`.

### Gap 4: Invoice number concurrency safety (§14)
**Spec says**: Must handle concurrent requests safely (database sequences or atomic operations).
**Current state**: Non-atomic read-then-increment — race condition risk.
**Fix**: Use Prisma `$transaction` with serializable isolation or database advisory lock.

### Gap 5: Duplicate detection shows details (§5.4 / §23.3)
**Spec says**: Show warning with details of existing record (who submitted it, when, for which company).
**Current state**: Shows only duplicate count, not details.
**Fix**: Display candidate name, contact, email, recruiter name, date in the confirm dialog.

### Gap 6: Frontend form uses dropdown service (§5.2 / §23.19)
**Spec says**: State, Location, Profile, Qualification, Notice Period, Diploma dropdowns are populated from admin-configurable options.
**Current state**: These are hardcoded text inputs, not using the dropdown service.
**Fix**: Replace text inputs with searchable Select components that fetch from dropdown.service.

### Gap 7: Backend required field validation (§5.2)
**Spec says**: Key fields like candidateName, contactNo, emailId, zone should be required.
**Current state**: All fields are optional in backend Zod schema (`z.string().trim().optional()`).
**Fix**: Make core fields required in backend validation.

### Gap 8: Recruiter sees own sequential Sr. No (§5.2 field #1, §5.6)
**Spec says**: In UI, each recruiter sees their OWN sequential serial numbers (1, 2, 3...) even though DB stores global serials. 
**Current state**: List view may show global serial or index. Need to verify and fix.
**Fix**: Add recruiter-scoped row numbering in the candidate list frontend.

## Summary

| Category | Count |
|----------|-------|
| Compliant | 20 |
| Gaps | 8 |
