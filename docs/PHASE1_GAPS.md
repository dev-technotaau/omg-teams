# Phase 1 — Foundation & Auth: Gap Checklist

**Spec sections audited**: §4 (Auth), §22 (Device Lock), §16 (Security), §25 (Security Hardening)

## What EXISTS and is spec-compliant ✅

- [x] Login flow: Employee ID for Recruiter/RM, email for Admin
- [x] Login page: 3-tab UI (Recruiter default, RM, Admin)
- [x] No "Forgot Password" or "Sign Up" on login page
- [x] Turnstile captcha on login (frontend + backend verification)
- [x] Password storage: bcrypt hashing
- [x] Device binding on first login (non-Admin only)
- [x] Device mismatch blocking with clear error
- [x] Logout preserves deviceId (never cleared)
- [x] Redis session storage with single-session enforcement
- [x] Session TTL: min(idle timeout, midnight)
- [x] Session refresh on every authenticated request
- [x] Midnight session reset cron job (BullMQ)
- [x] Account lockout after N failed attempts (Redis counter)
- [x] Password complexity validation (min 8, max 128, upper/lower/digit/special)
- [x] Common password blocklist (23 entries)
- [x] Personal info rejection in passwords
- [x] JWT with BFF HttpOnly cookies (access + refresh tokens)
- [x] JWT payload includes sub, role, deviceId, sessionId
- [x] LoginHistory table: logs every attempt (success/failure + reason + deviceId + IP + userAgent)
- [x] UserDevice table: tracks device binding history
- [x] Admin session management: list, revoke single, revoke all for user
- [x] Admin-only password reset (no self-service)
- [x] Helmet + CSP headers
- [x] CORS with configurable origin
- [x] WAF middleware (scanner blocking, SQLi/XSS detection)
- [x] CSRF double-submit cookie pattern
- [x] Input sanitization (xss-clean, HPP)
- [x] Global rate limiting (express-rate-limit)

## GAPS — Must Implement 🔴

### Gap 1: Device validation middleware on every request (§22.8)
**Spec says**: Every authenticated API request MUST validate `token.deviceId === user.deviceId`. Catches stale tokens after admin device reset.
**Current state**: `requireAuth` verifies JWT + session but does NOT check deviceId against DB.
**Fix**: Add device validation in `requireAuth` middleware — compare `session.deviceId` with `user.deviceId` from DB.

### Gap 2: Backup code system for device lock bypass (§22.5, §23.16)
**Spec says**: User can provide a backup code to bypass device lock and bind a new device. One-time codes.
**Current state**: `BackupCode` model exists in Prisma schema but NO service/controller implements generation or verification.
**Fix**: Create `backup-code.service.ts` — generate codes (admin action), verify code during login as device lock bypass.

### Gap 3: Login-specific rate limiting (§16, §24.9)
**Spec says**: Login: 5 attempts/min/IP. Separate from global rate limit.
**Current state**: `AUTH_RATE_LIMIT_*` env vars defined but NOT applied as middleware on `/auth/login` route.
**Fix**: Create and apply a login-specific rate limiter on `POST /auth/login`.

### Gap 4: Inactivity warning modal — 5 minutes before timeout (§25.3)
**Spec says**: Client-side: 5 minutes before session timeout, show modal "Your session will expire in 5 minutes due to inactivity. Click to stay logged in." Activity detection: mouse, keyboard, scroll.
**Current state**: No frontend inactivity tracking or warning UI.
**Fix**: Create `useSessionTimeout` hook with activity detection and warning modal.

### Gap 5: PII data masking for non-admin views (§25.5)
**Spec says**: RM sees phone as `****-**-1234`, email as `jak***@gmail.com`. Recruiters see own data in full, not others'.
**Current state**: No masking logic anywhere.
**Fix**: Create `pii-masking.service.ts` utility + apply in API response serialization.

### Gap 6: Admin lockout notification (§25.1)
**Spec says**: When account is locked out, send in-app notification to Admin with user details.
**Current state**: Comment `// TODO: Send notification to Admin about locked account` in auth.service.ts:107.
**Fix**: Call notification service when account is locked.

### Gap 7: DeviceId also stored in HTTP-only cookie (§22.3)
**Spec says**: Store deviceId in both localStorage AND HTTP-only cookie for redundancy.
**Current state**: deviceId only in localStorage (frontend/src/lib/device-id.ts).
**Fix**: Set deviceId as HTTP-only cookie on login, read from cookie as fallback if localStorage cleared.

### Gap 8: Admin device management UI features (§22.9)
**Spec says**: User management table: "Device" column (Bound/Unbound). Per-user detail: device info card. One-click "Reset Device" button. "Force Logout" and "Force Switch Device" buttons.
**Current state**: Admin users page exists but need to verify device management UI completeness.
**Fix**: Audit and add missing device management UI elements.

### Gap 9: Suspicious activity detection (§22.12)
**Spec says**: Flag and notify Admin when: repeated failed logins from different devices, login attempts after device reset, rapid device switching.
**Current state**: Login history is logged but no automated detection/alerting.
**Fix**: Add suspicious activity detection logic triggered during login flow.

### Gap 10: Lockout cooldown default mismatch (§25.1)
**Spec says**: Cooldown period is **15 minutes** (configurable).
**Current state**: `ACCOUNT_LOCK_DURATION_MINUTES` defaults to **30 minutes** (env.ts:97).
**Fix**: Change default to 15 minutes.

### Gap 11: Session persistence across browser close (§4)
**Spec says**: Cookie has explicit expiry (not session-only cookie). Session persists across browser close until midnight.
**Current state**: Need to verify cookie maxAge is set properly (not session cookie).
**Fix**: Verify and fix cookie expiry if needed.

### Gap 12: loginMethod field in LoginHistory (§22.16)
**Spec says**: LoginHistory should track `loginMethod` (PASSWORD or BACKUP_CODE).
**Current state**: `loginMethod` field exists in schema but `logLoginAttempt` doesn't set it.
**Fix**: Pass loginMethod to login history logging.

## Summary

| Category | Count |
|----------|-------|
| Compliant | 27 |
| Gaps | 12 |
