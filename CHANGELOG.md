# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-04-05

### Added

#### Core Platform
- Complete monorepo setup (root + backend + frontend workspaces)
- Docker Compose development environment (PostgreSQL 16, Redis 7, Redis Commander)
- Production Docker Compose with health checks
- Makefile with development commands
- Husky + commitlint for conventional commits
- Prettier + ESLint configuration

#### Authentication & Security
- JWT + BFF cookie-based authentication with access/refresh token rotation
- OTP verification (email-based) for sensitive operations
- Single-device lock with persistent device binding (fingerprinting)
- Account lockout after failed login attempts with admin unlock
- Password strength enforcement with visual indicator
- Backup codes for emergency device login
- Session management with admin revoke capabilities (individual/user/all)
- CSRF protection (double-submit cookie pattern)
- Cloudflare Turnstile CAPTCHA integration
- WebAuthn/Passkey support for passwordless auth
- WAF middleware (header injection, path traversal, XSS detection)
- CSP headers with nonce-based policy (GTM, GA4, Facebook Pixel, Firebase)
- HSTS, X-Frame-Options, X-Content-Type-Options headers
- SameSite cookie policy (Strict for auth, Lax for session indicator)
- Per-user upload rate limiting via Redis
- Role-based rate limiting

#### Recruitment Operations
- Zone-based candidate report form (North/South/East/West/Central)
- Multi-step form with auto-save drafts
- Candidate pipeline stages with colored status indicators
- Duplicate candidate detection with merge/dismiss workflow
- Company / Service Provider / HR Manager relational dropdowns
- Invoice number auto-generation
- Candidate report CRUD with admin enrichment
- Bulk operations (stage update, payment status, company assign, reassign)

#### Employee Management
- User account lifecycle (create, suspend, reactivate, delete)
- Role-based access control (Admin, Reporting Manager, Recruiter)
- Employee profile management (photo, contact, address)
- Device binding management (reset, force switch, history)
- KYC document upload and admin verification workflow
- Offer letter generation (template + rich text editor variants)
- Configurable signatory (name, title, signature image)
- PDF generation with embedded signature
- Employee performance targets (daily/weekly/monthly)
- Live presence tracking (online/idle/offline via Firebase RTDB)

#### Attendance Management
- Automatic punch in/out via login/logout detection
- Working hours calculation (gross, net, overtime)
- Late login detection with configurable thresholds
- Half-day detection
- Holiday calendar (national/regional/custom with recurring support)
- Admin attendance dashboard with edit capabilities
- Team attendance view for Reporting Managers
- Quick date filters (Today, Yesterday, This Week, This Month)

#### Leave Management
- Leave request submission with approval workflow
- Leave types (Casual, Sick, Earned, Comp Off, etc.)
- Leave balance tracking with auto-deduction
- Admin balance adjustment
- Leave revocation with balance restoration
- Team leave calendar for Reporting Managers
- Bulk approve/reject

#### Document & KYC
- Document type configuration (admin-managed)
- File upload with magic byte validation
- VirusTotal virus scanning integration
- Admin verification workflow (verify/reject with reasons)
- Batch verify/reject
- Signed URL delivery (R2 presigned + Cloudinary authenticated)
- Download tokens for email-link based access

#### Reporting & Analytics
- 20+ report types with on-demand generation
- Scheduled report generation (daily/weekly/monthly via BullMQ)
- Email distribution with delivery tracking
- XLSX export across all data pages
- Analytics dashboard with KPI cards, charts, funnels
- Recruiter leaderboard and performance metrics
- Company revenue breakdown
- Attendance heatmap
- Platform health monitoring

#### Notification System
- Real-time in-app notifications via Socket.IO
- Redis-adapted Socket.IO for multi-instance support
- Web Push notifications (FCM + VAPID fallback)
- Notification preferences per user
- Notification panel (dropdown + full page)
- Mark as read/unread, clear, bulk operations
- Quiet hours configuration

#### Admin Features
- Platform settings management
- Email template customization with variable system
- Audit log with expandable change details
- Trash / soft-delete with 90-day auto-purge
- Archive system for aged records
- Master data management (configurable dropdowns)
- Webhook configuration
- Queue dashboard (Bull Board)
- Maintenance mode with countdown timer
- Import system with validation preview

#### UI/UX
- Custom design system with 30+ reusable components
- CalendarDatePicker with day/month/year views, presets, min/max
- TimePicker with spinner + quick-select modes
- DataTable with sorting, pagination, selection, bulk actions, export
- Column visibility toggle
- Row density toggle (compact/default/spacious)
- Pinned/bookmarked rows
- Detail panel slide-over (click row to preview)
- Keyboard navigation (j/k navigate, Enter open, Space select)
- Card view toggle on all data pages
- Summary stat cards on all admin pages
- SearchInput with history, live suggestions, keyboard nav
- Saved filter presets (localStorage-backed)
- Collapsible group-by sections
- Inline edit cells (click-to-edit)
- Sparkline charts for trend visualization
- Custom tooltips on all icon buttons
- Dark mode support
- Responsive design (mobile + desktop)
- Skeleton loading states
- Empty states with illustrations
- Command palette (Ctrl+K)
- Breadcrumb navigation

#### Infrastructure
- Service initialization system with dependency ordering (Kahn's algorithm)
- Service status tracking with startup/shutdown reports
- Health check endpoints (/health, /health/ready, /health/live)
- Prometheus metrics endpoint (/metrics)
- OpenTelemetry distributed tracing (Honeycomb/Jaeger/Tempo)
- Sentry error tracking
- Structured logging with Pino
- Redis caching layer (auth profile, attendance config, dashboard stats, etc.)
- BullMQ job queue system with 9 workers
- Graceful shutdown with service-ordered teardown

#### Storage & Files
- Cloudflare R2 (S3-compatible) for documents and backups
- Cloudinary for images with authenticated delivery
- Signed URL generation for secure file access
- HMAC-signed download tokens for email links
- Per-user daily upload quota (Redis-tracked)
- Magic byte validation (blocking mode)
- Content-Disposition: attachment on all downloads

### Security
- All uploads virus-scanned via VirusTotal API
- DOMPurify sanitization on all dangerouslySetInnerHTML
- Zod validation on all API inputs
- Parameterized queries via Prisma (SQL injection prevention)
- File access audit logging
- IP leak prevention (X-Request-IP only in dev)
- JWT cache with expiration checking

---

[1.0.0]: https://github.com/dev-technotaau/omg-teams/releases/tag/v1.0.0
