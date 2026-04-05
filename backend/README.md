# OMG Teams — Backend API

Express.js 5 REST API server for the OMG Teams platform.

## Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start database services
docker compose -f ../docker-compose.yml up -d postgres redis

# Run database migrations
npx prisma migrate dev

# Start development server (with hot reload)
npm run dev
```

The server starts on `http://localhost:4000` by default.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode (tsx watch) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run start` | Run compiled production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run tests |
| `npx prisma studio` | Open database GUI |
| `npx prisma migrate dev` | Create/run migrations |
| `npx prisma generate` | Regenerate Prisma client |

## Architecture

```
src/
├── config/           # Service configs & initialization
│   ├── database.ts   # PostgreSQL (Prisma + pg pool)
│   ├── redis.ts      # Redis (ioredis)
│   ├── storage.ts    # R2 + Cloudinary
│   ├── firebase.ts   # Firebase Admin SDK
│   ├── sentry.ts     # Sentry error tracking
│   ├── otel.ts       # OpenTelemetry tracing
│   ├── queue.ts      # BullMQ queue factory
│   ├── smtp.ts       # Nodemailer transporter
│   ├── virustotal.ts # VirusTotal API
│   ├── service-init.ts   # Service lifecycle manager
│   ├── service-status.ts # Service health tracker
│   ├── env.ts        # Environment validation (70+ vars)
│   ├── metrics.ts    # Prometheus metrics
│   ├── session.ts    # Session store (Redis-backed)
│   └── passport.ts   # JWT authentication strategy
├── controllers/      # HTTP request handlers
├── middleware/        # Express middleware
│   ├── auth.ts       # JWT authentication + Redis cache
│   ├── upload.ts     # Multer + magic bytes + virus scan + quota
│   ├── waf.ts        # Web Application Firewall
│   ├── csrf.ts       # CSRF double-submit cookie
│   └── role-rate-limit.ts  # Per-role rate limiting
├── routes/           # Route definitions
├── services/         # Business logic layer
├── jobs/             # BullMQ workers (9 workers)
│   ├── email.worker.ts
│   ├── storage.worker.ts
│   ├── notification.worker.ts
│   ├── midnight-reset.worker.ts
│   ├── scheduled-report.worker.ts
│   ├── archive.worker.ts
│   ├── absent-detection.worker.ts
│   ├── session-expiry.worker.ts
│   └── backup.worker.ts
├── utils/            # Helpers (analytics, turnstile, webauthn, encryption)
├── validators/       # Zod input schemas
├── templates/        # Email templates (Handlebars)
├── socket.ts         # Socket.IO server
├── app.ts            # Express app factory
├── server.ts         # HTTP server + graceful shutdown
└── index.ts          # Entry point + bootstrap
```

## Service Registry (12 Services)

All external services are registered in the service-init system with lifecycle management:

| Service | Config File | Critical | Startup Check |
|---------|-------------|:--------:|---------------|
| PostgreSQL | `database.ts` | Yes | `SELECT 1` query |
| Redis | `redis.ts` | No | `PING` command |
| Cloudflare R2 | `storage.ts` | No | Client init |
| Cloudinary | `storage.ts` | No | `api.ping()` |
| Firebase | `firebase.ts` | No | Admin SDK init |
| Sentry | `sentry.ts` | No | SDK init |
| OpenTelemetry | `otel.ts` | No | SDK start |
| BullMQ | `queue.ts` | No | Queue job counts |
| SMTP | `smtp.ts` | No | `transporter.verify()` |
| VirusTotal | `virustotal.ts` | No | API key validation |
| Socket.IO | `socket.ts` | No | Server creation |
| Web Push | `push.service.ts` | No | VAPID config |

## Health Endpoints

```
GET /health         # Full status report with per-service state
GET /health/ready   # Kubernetes readiness (all critical services up)
GET /health/live    # Kubernetes liveness (no failed services)
GET /metrics        # Prometheus metrics
GET /admin/queues   # Bull Board dashboard (admin auth required)
```

## Database

- **ORM**: Prisma 6 with PostgreSQL adapter
- **Schema**: `prisma/schema.prisma` (33+ models)
- **Migrations**: `prisma/migrations/`
- **Connection**: Pooled via `pg.Pool` + Prisma PrismaPg adapter

## Environment Variables

See `.env.example` for the complete list with descriptions. Key categories:

- **Database**: `DATABASE_URL`, `DATABASE_DIRECT_URL`, pool settings
- **Redis**: `REDIS_URL` or individual host/port/password
- **Auth**: `JWT_SECRET`, `SESSION_SECRET`, lockout settings
- **Storage**: R2 keys + Cloudinary keys
- **Email**: SMTP host/port/credentials
- **Firebase**: Service account JSON
- **Observability**: Sentry DSN, OTEL endpoint
- **Security**: CORS origin, Turnstile key, VAPID keys, encryption key
