# Phase 12 — Leave Management (§28) Gap Checklist

## Gap 1: Leave request submission validations
**Spec**: §28.2.2 — Overlap check, advance notice, max consecutive days, holiday/weekend exclusion, duplicate prevention
**Current**: Only balance check exists; no overlap/duplicate/advance notice/holiday exclusion logic
**Fix**: Add overlap check, holiday/weekend day exclusion from count, advance notice validation in `submitLeaveRequest()`
**Status**: [ ] Not started

## Gap 2: Revoke previously approved leave
**Spec**: §28.3.1, §28.5 — Admin can revoke approved leave, restore balance, revert attendance to ABSENT
**Current**: No revoke endpoint or service function exists
**Fix**: Add `revokeLeave(requestId, adminId, reason)` service function + controller handler + route; restore balance; revert ON_LEAVE attendance records
**Status**: [ ] Not started

## Gap 3: Approved leave → ON_LEAVE attendance records
**Spec**: §28.8 — When admin approves leave, create ON_LEAVE AttendanceRecords for each leave day
**Current**: `approveLeave()` deducts balance but doesn't create attendance records
**Fix**: After approval, loop through each leave day (excluding weekends/holidays) and upsert AttendanceRecord with status ON_LEAVE
**Status**: [ ] Not started

## Gap 4: Leave balance management (admin)
**Spec**: §28.3.3 — Set annual balance, adjust balance manually, view all balances
**Current**: LeaveBalance model exists but no admin endpoints for management
**Fix**: Add admin endpoints: GET /leaves/balances (all employees), POST /leaves/balances/adjust (credit/debit with reason), POST /leaves/balances/set-annual (bulk set). Record changes in LeaveBalanceHistory.
**Status**: [ ] Not started

## Gap 5: Missing leave notification triggers
**Spec**: §28.6 — Cancel→admin, revoke→employee, low balance warning, balance exhausted→admin, RM notification on team approval
**Current**: Only submit→admin, approve→employee, reject→employee exist
**Fix**: Add `onLeaveCancelled()`, `onLeaveRevoked()`, `onLeaveBalanceLow()`, `onLeaveBalanceExhausted()`, `onTeamLeaveApproved()` triggers
**Status**: [ ] Not started

## Gap 6: Admin leave page filters & balance tab
**Spec**: §28.3 — Date range filter, employee filter, leave type filter; balance management table with allotted/used/remaining per employee
**Current**: Admin page only has status filter tabs; no balance management view
**Fix**: Add date range, employee search, leave type filter dropdowns; add "Balances" tab showing per-employee leave balance table with adjust action
**Status**: [ ] Not started
