# OMG Teams

**Internal Recruitment, Employee & Workforce Management Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D)](https://redis.io/)

---

## Overview

OMG Teams is a full-stack enterprise platform built for recruitment agencies to manage their entire workflow — from daily candidate sourcing by recruiters, through managerial oversight, to admin-level invoicing, analytics, and report generation.

Beyond recruitment, it serves as a comprehensive **workforce management system** covering attendance tracking, leave management, document/KYC verification, employee targets, live presence monitoring, device-level security, and complete employee lifecycle administration.

### Key Functional Domains

| Domain                     | Description                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Recruitment Operations** | Candidate sourcing, screening, pipeline tracking, zone-based forms, duplicate detection, company management, invoicing |
| **Employee Management**    | Account lifecycle, profiles, role assignments, device binding, KYC verification, targets, offer letters                |
| **Attendance Management**  | Auto punch in/out, working hours, late detection, half-day tracking, holiday calendar                                  |
| **Leave Management**       | Leave requests with approval workflow, balance tracking, leave types, team calendars                                   |
| **Document & KYC**         | Employee document uploads, admin verification, offer letter generation, signed URL delivery                            |
| **Reporting & Analytics**  | 20+ report types, scheduled generation, email distribution, enterprise analytics dashboard                             |
| **Notifications**          | Real-time in-app (Socket.IO), web push (FCM + VAPID), notification preferences, quiet hours                            |
| **Security**               | Single-device lock, JWT auth, session management, WAF, CSRF, rate limiting, virus scanning                             |

---

## Tech Stack

### Backend

| Technology         | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| **Express.js 5**   | HTTP server and REST API                           |
| **TypeScript 5**   | Type-safe development                              |
| **Prisma 6**       | ORM and database toolkit                           |
| **PostgreSQL 16**  | Primary database                                   |
| **Redis 7**        | Caching, sessions, job queues, rate limiting       |
| **BullMQ**         | Background job processing (9 workers)              |
| **Socket.IO**      | Real-time events (WebSocket)                       |
| **Nodemailer**     | Transactional email (SMTP)                         |
| **Zod**            | Input validation                                   |
| **Pino**           | Structured logging                                 |
| **Sentry**         | Error tracking                                     |
| **OpenTelemetry**  | Distributed tracing                                |
| **Prometheus**     | Metrics collection                                 |
| **Firebase Admin** | Presence tracking (RTDB), push notifications (FCM) |
| **Cloudflare R2**  | Object storage (S3-compatible)                     |
| **Cloudinary**     | Image/media CDN                                    |
| **VirusTotal**     | File virus scanning                                |
| **Passport.js**    | JWT authentication strategy                        |
| **PDFKit**         | PDF generation                                     |
| **Sharp**          | Image processing                                   |
| **Handlebars**     | Email templates                                    |

### Frontend

| Technology           | Purpose                      |
| -------------------- | ---------------------------- |
| **Next.js 15**       | React framework (App Router) |
| **TypeScript 5**     | Type-safe development        |
| **Tailwind CSS 4**   | Utility-first styling        |
| **Zustand**          | Client state management      |
| **Lucide React**     | Icon library                 |
| **Sonner**           | Toast notifications          |
| **TanStack Virtual** | List virtualization          |
| **Tiptap**           | Rich text editor             |
| **DOMPurify**        | HTML sanitization            |
| **Firebase**         | Realtime presence tracking   |
| **Chart.js**         | Analytics charts             |

### Infrastructure

| Technology         | Purpose                         |
| ------------------ | ------------------------------- |
| **Docker**         | Containerization                |
| **Docker Compose** | Multi-service orchestration     |
| **Husky**          | Git hooks                       |
| **commitlint**     | Conventional commit enforcement |
| **Prettier**       | Code formatting                 |
| **ESLint**         | Linting                         |

---

## Architecture

```
                    ┌─────────────────┐
                    │   Next.js BFF   │
                    │   (Frontend)    │
                    │   Port 3000     │
                    └────────┬────────┘
                             │ HTTP (same-origin cookies)
                    ┌────────▼────────┐
                    │   Express API   │
                    │   (Backend)     │
                    │   Port 4000     │
                    └──┬──┬──┬──┬──┬──┘
                       │  │  │  │  │
          ┌────────────┘  │  │  │  └────────────┐
          │               │  │  │               │
   ┌──────▼──────┐ ┌─────▼──▼──▼─────┐ ┌───────▼───────┐
   │ PostgreSQL  │ │     Redis       │ │  Cloudflare   │
   │  (Primary   │ │  (Cache, Queue, │ │     R2        │
   │   Database) │ │   Sessions)     │ │  (Storage)    │
   └─────────────┘ └─────────────────┘ └───────────────┘
                       │         │
              ┌────────┘         └────────┐
              │                           │
       ┌──────▼──────┐           ┌────────▼────────┐
       │   BullMQ    │           │   Socket.IO     │
       │  (9 Workers)│           │  (Real-time)    │
       └─────────────┘           └─────────────────┘

   External Services:
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Firebase │ │Cloudinary│ │  Sentry  │ │VirusTotal│
   │ (RTDB +  │ │ (Images) │ │ (Errors) │ │ (Scan)   │
   │  FCM)    │ │          │ │          │ │          │
   └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Service Registry

The backend uses a service initialization system with dependency ordering. All 12 services are tracked:

| Service          | Type           | Critical | Health Checked |
| ---------------- | -------------- | :------: | :------------: |
| PostgreSQL       | Database       |   Yes    |      Yes       |
| Redis            | Cache/Queue    |    No    |      Yes       |
| Cloudflare R2    | Storage        |    No    |      Yes       |
| Cloudinary       | CDN            |    No    |      Yes       |
| Firebase         | Realtime/Push  |    No    |      Yes       |
| Sentry           | Error Tracking |    No    |      Yes       |
| OpenTelemetry    | Tracing        |    No    |      Yes       |
| BullMQ           | Job Queue      |    No    |      Yes       |
| SMTP             | Email          |    No    |      Yes       |
| VirusTotal       | File Scanning  |    No    |      Yes       |
| Socket.IO        | WebSocket      |    No    |      Yes       |
| Web Push (VAPID) | Notifications  |    No    |      Yes       |

---

## User Roles

| Role                  | Access Level                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**             | Full platform control. Manages users, companies, analytics, reports, settings, attendance, leaves, documents. Single admin per instance. |
| **Reporting Manager** | Oversees assigned recruiters. Views team attendance, leaves, reports. Approves/rejects leave requests.                                   |
| **Recruiter**         | Submits daily candidate reports. Views own attendance, leaves, profile. Manages documents.                                               |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** 16+
- **Redis** 7+
- **Docker** (recommended for database services)

### Installation

```bash
# Clone the repository
git clone https://github.com/dev-technotaau/omg-teams.git
cd omg-teams

# Install all dependencies
make install
# or: npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### Environment Configuration

#### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/omg_teams
DATABASE_DIRECT_URL=postgresql://postgres:postgres@localhost:5432/omg_teams

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# Storage (optional)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Firebase (optional)
FIREBASE_SERVICE_ACCOUNT=
FIREBASE_DATABASE_URL=

# Observability (optional)
SENTRY_DSN=
OTEL_ENABLED=false
```

#### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
```

### Database Setup

```bash
# Start PostgreSQL and Redis via Docker
docker compose up -d postgres redis

# Run database migrations
cd backend
npx prisma migrate dev

# Seed initial data (optional)
npx prisma db seed
```

### Running

```bash
# Start both backend + frontend in development mode
make dev

# Or start individually
make dev-backend    # Express on :4000
make dev-frontend   # Next.js on :3000
```

### Docker (Full Stack)

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.production.yml up -d
```

---

## Project Structure

```
omg-teams/
├── backend/                      # Express.js API
│   ├── src/
│   │   ├── config/               # Service configs & initialization
│   │   │   ├── database.ts       # PostgreSQL (Prisma)
│   │   │   ├── redis.ts          # Redis (ioredis)
│   │   │   ├── storage.ts        # R2 + Cloudinary
│   │   │   ├── firebase.ts       # Firebase Admin SDK
│   │   │   ├── sentry.ts         # Sentry error tracking
│   │   │   ├── otel.ts           # OpenTelemetry tracing
│   │   │   ├── queue.ts          # BullMQ queue factory
│   │   │   ├── smtp.ts           # Nodemailer transporter
│   │   │   ├── virustotal.ts     # VirusTotal API
│   │   │   ├── service-init.ts   # Service lifecycle manager
│   │   │   ├── service-status.ts # Service health tracker
│   │   │   ├── env.ts            # Environment validation
│   │   │   ├── metrics.ts        # Prometheus metrics
│   │   │   ├── session.ts        # Session store (Redis)
│   │   │   └── passport.ts       # JWT strategy
│   │   ├── controllers/          # Request handlers
│   │   ├── middleware/           # Auth, upload, WAF, CSRF, rate-limit
│   │   ├── routes/              # Route definitions
│   │   ├── services/            # Business logic
│   │   ├── jobs/                # BullMQ workers
│   │   │   ├── email.worker.ts
│   │   │   ├── storage.worker.ts
│   │   │   ├── notification.worker.ts
│   │   │   ├── midnight-reset.worker.ts
│   │   │   ├── scheduled-report.worker.ts
│   │   │   ├── archive.worker.ts
│   │   │   ├── absent-detection.worker.ts
│   │   │   ├── session-expiry.worker.ts
│   │   │   └── backup.worker.ts
│   │   ├── utils/               # Helpers (analytics, turnstile, webauthn)
│   │   ├── validators/          # Zod schemas
│   │   ├── templates/           # Email templates (Handlebars)
│   │   ├── socket.ts            # Socket.IO server
│   │   ├── app.ts               # Express app factory
│   │   ├── server.ts            # HTTP server + graceful shutdown
│   │   └── index.ts             # Entry point + bootstrap
│   └── prisma/
│       ├── schema.prisma         # Database schema (33+ models)
│       └── migrations/           # Migration history
├── frontend/                     # Next.js 15 (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # Login, OTP verification
│   │   │   ├── (protected)/
│   │   │   │   ├── admin/        # 20+ admin pages
│   │   │   │   ├── reports/      # Recruiter report pages
│   │   │   │   ├── team/         # RM team management
│   │   │   │   ├── dashboard/    # Role-based dashboard
│   │   │   │   ├── profile/      # User profile + passkeys
│   │   │   │   ├── attendance/   # Personal attendance
│   │   │   │   ├── leaves/       # Leave requests
│   │   │   │   ├── documents/    # Document uploads
│   │   │   │   ├── notifications/# Notification center
│   │   │   │   └── settings/     # User preferences
│   │   │   └── api/auth/         # BFF auth endpoints
│   │   ├── components/
│   │   │   ├── ui/               # 35+ design system components
│   │   │   └── layout/           # Shell, sidebar, header
│   │   ├── hooks/                # Custom hooks (presence, presets, etc.)
│   │   ├── services/             # API client layer
│   │   ├── store/                # Zustand stores
│   │   ├── types/                # Shared TypeScript types
│   │   ├── utils/                # Client utilities
│   │   ├── validators/           # Shared Zod schemas
│   │   ├── constants/            # App constants
│   │   └── lib/                  # Core utilities (api client, utils)
│   └── public/                   # Static assets, icons
├── infra/                        # Terraform / deployment configs
├── docs/                         # Additional documentation
├── docker-compose.yml            # Dev environment
├── docker-compose.production.yml # Production environment
├── Makefile                      # Dev commands
└── package.json                  # Root workspace
```

---

## Features

### UI Component Library (35+ Components)

The frontend includes a comprehensive custom design system:

| Category         | Components                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Data Display** | DataTable, Badge, Avatar, Card, Sparkline, Tooltip, StatsCard                                                     |
| **Forms**        | Input, Textarea, Select, Checkbox, Switch, RadioGroup, FileUpload, CalendarDatePicker, TimePicker, InlineEditCell |
| **Feedback**     | Alert, Progress, Spinner, ConfirmDialog, PromptDialog, EmptyState                                                 |
| **Navigation**   | Tabs, Breadcrumbs, Pagination, CommandPalette                                                                     |
| **Overlay**      | Modal, Drawer, DropdownMenu                                                                                       |
| **Layout**       | PageHeader, SearchInput, FilterPresetsBar, DateRangePicker                                                        |

### DataTable Features

The DataTable component powers all admin data pages with:

- Sorting (multi-column, server-side)
- Pagination (with page size selector)
- Row selection + bulk actions
- Column visibility toggle
- Row density toggle (compact/default/spacious)
- Table/Card view toggle
- Pinned/bookmarked rows
- Detail panel slide-over (click row to preview)
- Keyboard navigation (j/k, Enter, Space, /, Esc)
- Collapsible group-by sections
- Quick filter buttons
- XLSX export
- Sticky header
- Virtualization (50+ rows)

### Security Features

- JWT authentication with BFF cookie pattern (HttpOnly, Secure, SameSite)
- Access + Refresh token rotation
- Single-device lock with persistent device binding
- Account lockout with configurable thresholds
- Admin password verification for sensitive operations
- WebAuthn/Passkey support
- Session management with forced logout/revoke
- CSRF double-submit cookie protection
- WAF middleware (XSS, header injection, path traversal)
- Content Security Policy with nonce
- Rate limiting (per-role + global)
- File upload virus scanning (VirusTotal)
- Magic byte validation (blocking mode)
- Signed URLs for all file access
- Per-user daily upload quotas
- DOMPurify sanitization on rendered HTML
- Field-level encryption for sensitive data

### Background Jobs (9 Workers)

| Worker            | Schedule     | Purpose                                  |
| ----------------- | ------------ | ---------------------------------------- |
| Email             | On-demand    | Transactional and bulk email delivery    |
| Storage           | On-demand    | Image processing, file cleanup, uploads  |
| Notification      | On-demand    | Push notifications, webhook delivery     |
| Midnight Reset    | Daily 00:00  | Attendance/leave daily resets            |
| Scheduled Reports | Configurable | Report generation and email distribution |
| Archive           | Monthly      | Move aged records to archive tables      |
| Absent Detection  | Daily        | Flag absent employees                    |
| Session Expiry    | Hourly       | Clean up expired sessions                |
| Backup            | Configurable | Database backup to R2                    |

---

## API Endpoints

### Health Checks

```
GET /health         # Full status report (200 if alive, 503 if degraded)
GET /health/ready   # Kubernetes readiness probe
GET /health/live    # Kubernetes liveness probe
GET /metrics        # Prometheus metrics
```

### Core API Groups

| Group             | Base Path              | Description                                  |
| ----------------- | ---------------------- | -------------------------------------------- |
| Auth              | `/auth/*`              | Login, logout, OTP, refresh, device binding  |
| Users             | `/users/*`             | CRUD, suspend, reactivate, device management |
| Candidate Reports | `/candidate-reports/*` | CRUD, pipeline, bulk operations              |
| Companies         | `/companies/*`         | Company/SP/HR management                     |
| Attendance        | `/attendance/*`        | Records, config, manual edits                |
| Leaves            | `/leaves/*`            | Requests, approvals, balances, types         |
| Documents         | `/documents/*`         | Upload, verify, reject, types                |
| Offer Letters     | `/offer-letters/*`     | Generate, preview, archive                   |
| Notifications     | `/notifications/*`     | List, mark read, preferences                 |
| Reports           | `/reports/*`           | Generate, schedule, download                 |
| Analytics         | `/analytics/*`         | Dashboard stats, snapshots                   |
| Settings          | `/settings/*`          | Platform configuration                       |
| Audit Logs        | `/audit-logs/*`        | Activity trail                               |
| Trash             | `/trash/*`             | Soft-delete management                       |
| Archive           | `/archive/*`           | Aged record management                       |
| Files             | `/files/*`             | Signed URLs, download tokens                 |
| Admin Sessions    | `/admin/sessions/*`    | Session management                           |
| Duplicates        | `/duplicates/*`        | Duplicate detection/merge                    |
| Targets           | `/targets/*`           | Recruiter performance targets                |
| Holidays          | `/holidays/*`          | Holiday calendar management                  |
| Webhooks          | `/webhooks/*`          | Webhook configuration                        |
| Master Data       | `/master-data/*`       | Dropdown options management                  |

---

## Deployment

### Production Requirements

- **Node.js** >= 18
- **PostgreSQL** 16+ (with connection pooling recommended)
- **Redis** 7+ (persistent storage recommended)
- **Domain** with SSL/TLS certificate
- **Storage**: Cloudflare R2 or S3-compatible bucket
- **CDN**: Cloudinary account (for images)

### Environment Variables

See `backend/.env.example` and `frontend/.env.example` for the complete list of environment variables. All variables are documented with descriptions and default values.

### Docker Production

```bash
docker compose -f docker-compose.production.yml up -d
```

### Health Monitoring

The backend exposes Kubernetes-compatible health endpoints:

- `/health/live` — Liveness probe (no failed services)
- `/health/ready` — Readiness probe (all critical services connected)
- `/health` — Full status report with per-service state and latency

### Startup Report

On boot, the backend prints a formatted service status report:

```
  ══════════════════════════════════════════════════
              SERVICE STATUS REPORT
  ══════════════════════════════════════════════════
   Service              State              Type       Latency
  ──────────────────────────────────────────────────
   postgres             ● CONNECTED        critical   45ms
   redis                ● CONNECTED        optional   3ms
   cloudflare-r2        ● CONNECTED        optional   120ms
   cloudinary           ● CONNECTED        optional   89ms
   firebase             ● CONNECTED        optional   156ms
   sentry               ● CONNECTED        optional   23ms
   opentelemetry        ● CONNECTED        optional   12ms
   bullmq               ● CONNECTED        optional   5ms
   smtp                 ● CONNECTED        optional   230ms
   virustotal           ● CONNECTED        optional   180ms
   socketio             ● CONNECTED        optional   --
   webpush-vapid        ● CONNECTED        optional   --
  ──────────────────────────────────────────────────
   Running: 12/12
  ──────────────────────────────────────────────────
   Status: ● READY
  ══════════════════════════════════════════════════
```

---

## Development

### Commands

```bash
make dev              # Start both servers
make build            # Build both
make lint             # Lint both
make typecheck        # Type-check both
make validate         # typecheck + lint + test
make test             # Run all tests
make clean            # Clean build artifacts
```

### Database

```bash
cd backend
npx prisma migrate dev --name migration_name  # Create migration
npx prisma generate                            # Regenerate client
npx prisma studio                              # Database GUI
npx prisma db seed                             # Seed data
```

### Code Quality

- **TypeScript** strict mode across both packages
- **ESLint** with recommended rules
- **Prettier** for consistent formatting
- **Conventional Commits** enforced via commitlint + husky
- **Pre-commit hooks** run lint-staged

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, coding standards, and PR process.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

Built with care by [TechnoTaau Team](https://github.com/dev-technotaau)
