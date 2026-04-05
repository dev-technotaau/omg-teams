# Phase 11 — Attendance Management (§27) Gap Checklist

## Gap 1: Wire punchIn/punchOut to auth login/logout flow
**Spec**: §27.1.1, §27.1.2 — Punch in is automatic on login, punch out on logout/session expiry
**Current**: `punchIn()` and `punchOut()` functions exist in attendance.service.ts but are NEVER called from auth flow
**Fix**: Call `punchIn(userId)` in auth.service.ts `login()` after successful auth, call `punchOut(userId)` in `logout()` before session destroy
**Status**: [ ] Not started

## Gap 2: Add punchInEditedBy / punchOutEditedBy fields
**Spec**: §27.14 — AttendanceRecord should track who edited punch times
**Current**: Fields missing from Prisma schema
**Fix**: Add `punchInEditedBy` and `punchOutEditedBy` FK fields to AttendanceRecord model; pass editor userId in `editAttendance()` service
**Status**: [ ] Not started

## Gap 3: Overtime calculation in punchOut
**Spec**: §27.2 — `Overtime = Net Working Hours − Standard Day Length` (only if positive)
**Current**: `punchOut()` calculates gross/net minutes but overtimeMinutes is never set
**Fix**: Read `standardDayMinutes` config (default 480), calculate `overtimeMinutes = max(0, netMinutes - standardDayMinutes)`, persist in update
**Status**: [ ] Not started

## Gap 4: Midnight reset finalization
**Spec**: §27.1.3 — Midnight reset must finalize working hours and set final status
**Current**: midnight-reset.worker.ts auto-punches out at 23:59:59 but doesn't recalculate working hours or determine PRESENT_FULL/PRESENT_HALF/INCOMPLETE
**Fix**: After setting punchOutTime, calculate gross/net/overtime minutes and determine final status based on thresholds
**Status**: [ ] Not started

## Gap 5: Absent detection cron
**Spec**: §27.3, §27.5 — If no login by absentThresholdTime (default 12PM), mark as ABSENT
**Current**: No absent detection logic exists
**Fix**: Add a BullMQ job running daily at configurable absent threshold time; query users with no AttendanceRecord for today; create ABSENT records; fire `onAbsent()` notification
**Status**: [ ] Not started

## Gap 6: Missing notification triggers
**Spec**: §27.12 — Notifications for absent, incomplete, excessive late
**Current**: Only `onLateLogin()` exists
**Fix**: Add `onAbsentDetected()`, `onIncompleteAttendance()`, `onExcessiveLateCount()` to notification-triggers.ts; wire into respective flows
**Status**: [ ] Not started

## Gap 7: Admin dashboard enhancements
**Spec**: §27.6 — Summary cards (Half Day, Avg Hours), table columns (Date, Gross Hours, Overtime), filters (role, status, quick date filters)
**Current**: Missing Half Day/AvgHours cards, Date/GrossHours/Overtime columns, role/status/quick filters
**Fix**: Enhance admin attendance page with missing cards, columns, and filter dropdowns
**Status**: [ ] Not started

## Gap 8: Attendance config admin endpoints
**Spec**: §27.13 — All settings configurable by Admin without code changes
**Current**: AttendanceConfig table exists but no admin endpoints to read/update
**Fix**: Add GET/PUT endpoints for attendance config; wire to admin settings page
**Status**: [ ] Not started
