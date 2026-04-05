# Phase 7 — Notification System (§11) Gap Checklist

## Compliant Items (already working)
1. ✅ Notification + NotificationPreference Prisma models with all fields
2. ✅ NotificationCategory enum (8 types)
3. ✅ Backend notification service (create, list, markRead, markAllRead, clear, clearAll)
4. ✅ Backend notification preference service (get, update, updateAll, shouldNotify)
5. ✅ All notification REST routes (CRUD + preferences)
6. ✅ Socket.io events (notification:new, notification:count)
7. ✅ Frontend notifications page (paginated, filters, mark read, clear)
8. ✅ Frontend bell icon dropdown with badge in header
9. ✅ Frontend notification preferences settings page (per-category toggles)
10. ✅ NotificationBadge + NotificationItem UI components
11. ✅ Auth context socket listener for real-time count updates
12. ✅ Account security triggers (lockout, backup code, suspicious login)

## Gaps to Implement

| # | Gap | Severity | File(s) |
|---|-----|----------|---------|
| 1 | Leave notifications missing — no triggers on create/approve/reject/revoke | HIGH | leave.service.ts or leave controller |
| 2 | Document/KYC notifications missing — no triggers on upload/verify/reject | HIGH | document service/controller |
| 3 | Attendance notifications missing — no triggers on late login, absence, half-day | HIGH | attendance service |
| 4 | Report notifications missing — no triggers on generation, scheduled delivery | MEDIUM | report.controller.ts, worker |
| 5 | Target notifications missing — no triggers on achievement/update | MEDIUM | target service |
| 6 | Frontend toast on notification:new socket event | MEDIUM | auth context or layout |
| 7 | Mark individual as unread (spec requires toggle) | LOW | notification service + page |
