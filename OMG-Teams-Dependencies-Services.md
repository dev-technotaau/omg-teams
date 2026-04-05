# OMG Teams — Complete Dependencies, Dev-Dependencies & Services Reference

> **Comprehensive, production-ready list** of every dependency, dev-dependency, and external service required for the OMG Teams platform. Derived from deep analysis of the full 6,796-line platform specification (33 sections). Nothing has been omitted.

---

## TABLE OF CONTENTS

1. [Frontend Dependencies (Next.js)](#1-frontend-dependencies-nextjs)
2. [Frontend Dev-Dependencies](#2-frontend-dev-dependencies)
3. [Backend Dependencies (Express)](#3-backend-dependencies-express)
4. [Backend Dev-Dependencies](#4-backend-dev-dependencies)
5. [Root / Monorepo Dependencies](#5-root--monorepo-dependencies)
6. [External Services & Platforms](#6-external-services--platforms)
7. [Summary Counts](#7-summary-counts)

---

## 1. FRONTEND DEPENDENCIES (Next.js)

### 1.1 Core Framework

| Package     | Version (suggested) | Purpose                                                            | Spec Reference |
| ----------- | :-----------------: | ------------------------------------------------------------------ | -------------- |
| `next`      | `^14.x` or `^15.x`  | React meta-framework (App Router, SSR/SSG, middleware, API routes) | Section 15     |
| `react`     | `^18.x` or `^19.x`  | UI library                                                         | Section 15     |
| `react-dom` | `^18.x` or `^19.x`  | React DOM renderer                                                 | Section 15     |

### 1.2 Styling & Design System

| Package                              | Purpose                                                           | Spec Reference          |
| ------------------------------------ | ----------------------------------------------------------------- | ----------------------- |
| `tailwindcss`                        | Utility-first CSS framework                                       | Section 15, 18          |
| `@tailwindcss/typography`            | Prose styling for rich text content (Tiptap output rendering)     | Section 29.4            |
| `tailwind-merge`                     | Merge conflicting Tailwind classes without duplication            | Section 18              |
| `clsx` or `class-variance-authority` | Conditional class name composition for component variants         | Section 18              |
| `@next/font` or `next/font`          | Optimized font loading for Plus Jakarta Sans (built into Next.js) | Section 18 (Typography) |

### 1.3 UI Component Library

| Package             | Purpose                                                                                                                                                         | Spec Reference |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `@radix-ui/react-*` | Headless, accessible UI primitives (Dialog, Dropdown, Popover, Tabs, Toggle, Tooltip, Select, Checkbox, Radio, Switch, Avatar, Progress, Separator, ScrollArea) | Section 18     |
| `lucide-react`      | Icon library (consistent, tree-shakeable SVG icons)                                                                                                             | Section 18     |

### 1.4 State Management & Data Fetching

| Package                 | Purpose                                                                         | Spec Reference |
| ----------------------- | ------------------------------------------------------------------------------- | -------------- |
| `@tanstack/react-query` | Server state management, caching, background refetch, optimistic updates        | Section 18, 12 |
| `zustand`               | Lightweight client-side state management (UI state, modal state, filter state)  | Section 18     |
| `axios`                 | HTTP client for API calls (interceptors for error handling, auth token refresh) | Section 24.2   |

### 1.5 Forms & Validation

| Package               | Purpose                                                                       | Spec Reference         |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| `react-hook-form`     | Performant form management (33-field recruiter form, 48-field admin form)     | Section 5, 6           |
| `@hookform/resolvers` | Resolver bridge for Zod validation with react-hook-form                       | Section 5, 6           |
| `zod`                 | Schema validation (shared with backend — form validation, env var validation) | Section 16, 24.1, 24.2 |

### 1.6 Rich Text Editor (Offer Letter — Tiptap)

| Package                                 | Purpose                                                                           | Spec Reference   |
| --------------------------------------- | --------------------------------------------------------------------------------- | ---------------- |
| `@tiptap/react`                         | React bindings for Tiptap editor                                                  | Section 29.4.1.3 |
| `@tiptap/starter-kit`                   | Core Tiptap extensions (bold, italic, lists, headings, blockquote, code, history) | Section 29.4.1.3 |
| `@tiptap/extension-underline`           | Underline formatting                                                              | Section 29.4.1.3 |
| `@tiptap/extension-text-align`          | Text alignment (left, center, right, justify)                                     | Section 29.4.1.3 |
| `@tiptap/extension-color`               | Text color                                                                        | Section 29.4.1.3 |
| `@tiptap/extension-text-style`          | Text style (required by color and font extensions)                                | Section 29.4.1.3 |
| `@tiptap/extension-highlight`           | Text highlight/background color                                                   | Section 29.4.1.3 |
| `@tiptap/extension-font-family`         | Font family selection                                                             | Section 29.4.1.3 |
| `@tiptap/extension-font-size` or custom | Font size selection                                                               | Section 29.4.1.3 |
| `@tiptap/extension-subscript`           | Subscript text                                                                    | Section 29.4.1.3 |
| `@tiptap/extension-superscript`         | Superscript text                                                                  | Section 29.4.1.3 |
| `@tiptap/extension-table`               | Table insertion and editing                                                       | Section 29.4.1.3 |
| `@tiptap/extension-table-row`           | Table row support                                                                 | Section 29.4.1.3 |
| `@tiptap/extension-table-cell`          | Table cell support                                                                | Section 29.4.1.3 |
| `@tiptap/extension-table-header`        | Table header cell support                                                         | Section 29.4.1.3 |
| `@tiptap/extension-image`               | Image insertion                                                                   | Section 29.4.1.3 |
| `@tiptap/extension-link`                | Hyperlink insertion                                                               | Section 29.4.1.3 |
| `@tiptap/extension-placeholder`         | Placeholder text for empty editor                                                 | Section 29.4.1.3 |
| `@tiptap/extension-character-count`     | Character/line count for limit validation                                         | Section 29.4.1.3 |
| `@tiptap/extension-horizontal-rule`     | Horizontal divider/rule                                                           | Section 29.4.1.3 |

### 1.7 Data Table & Virtualization

| Package                   | Purpose                                                                                | Spec Reference |
| ------------------------- | -------------------------------------------------------------------------------------- | -------------- |
| `@tanstack/react-table`   | Headless data table (sorting, filtering, pagination, row selection, column visibility) | Section 12     |
| `@tanstack/react-virtual` | Virtualized rendering for 50+ row tables                                               | Section 12.2   |

### 1.8 Charts & Data Visualization

| Package    | Purpose                                                                 | Spec Reference |
| ---------- | ----------------------------------------------------------------------- | -------------- |
| `recharts` | Primary charting library (line, bar, pie, donut, area, funnel, treemap) | Section 21     |

### 1.9 Date & Time

| Package            | Purpose                                                                              | Spec Reference |
| ------------------ | ------------------------------------------------------------------------------------ | -------------- |
| `date-fns`         | Date utility library (formatting, parsing, comparison — lightweight, tree-shakeable) | Section 18     |
| `react-day-picker` | Date picker and date range picker component                                          | Section 18     |

### 1.10 File Upload & Image Manipulation

| Package           | Purpose                                                     | Spec Reference     |
| ----------------- | ----------------------------------------------------------- | ------------------ |
| `react-dropzone`  | Drag-and-drop file upload zone (documents, profile photos)  | Section 29.2, 30.2 |
| `react-easy-crop` | Image cropping with fixed aspect ratio, zoom, rotation, pan | Section 30.2.3     |

### 1.11 Notifications & Toasts

| Package            | Purpose                                                                                         | Spec Reference           |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------ |
| `sonner`           | Production-grade toast/snackbar notifications (success, error, warning, info, loading, promise) | Section 24.19.11         |
| `socket.io-client` | WebSocket client for real-time notifications and presence                                       | Section 11, 23.15, 24.10 |

### 1.12 Firebase (Client-Side)

| Package    | Purpose                                                                             | Spec Reference    |
| ---------- | ----------------------------------------------------------------------------------- | ----------------- |
| `firebase` | Firebase JS SDK (Realtime Database for presence, Firestore for last active queries) | Section 15, 23.15 |

### 1.13 Onboarding & Tours

| Package                        | Purpose                                                     | Spec Reference |
| ------------------------------ | ----------------------------------------------------------- | -------------- |
| `driver.js` or `react-joyride` | First-login onboarding tour with spotlight/tooltip overlays | Section 23.18  |

### 1.14 Dark Mode

| Package       | Purpose                                                                                                                                                | Spec Reference   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `next-themes` | Dark mode toggle/persistence for Next.js (system preference detection, localStorage persistence, `data-theme` attribute on `<html>`, flicker-free SSR) | Section 18, 21.1 |

### 1.15 Animations & Transitions

| Package         | Purpose                                                                                                                                                                                                 | Spec Reference       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `framer-motion` | Production-grade animations — page transitions, toast slide-in/out, modal open/close, skeleton shimmer, sidebar collapse, dropdown open, notification panel slide, card hover effects, loading fade-out | Section 18, 24.19.11 |

### 1.16 Drag & Drop

| Package              | Purpose                                                                                                                                                      | Spec Reference       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `@dnd-kit/core`      | Drag-and-drop core — candidate pipeline kanban board (drag cards between stages), dropdown option reordering (Admin master data), and any drag-sortable list | Section 23.11, 23.19 |
| `@dnd-kit/sortable`  | Sortable preset for @dnd-kit — drag-to-reorder lists and kanban columns                                                                                      | Section 23.11, 23.19 |
| `@dnd-kit/utilities` | Utility functions for @dnd-kit (CSS transform, keyboard coordinates)                                                                                         | Section 23.11, 23.19 |

### 1.17 HTML Sanitization

| Package                               | Purpose                                                                                                                                                                                          | Spec Reference   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `dompurify` or `isomorphic-dompurify` | Sanitize pasted HTML in Tiptap editor — strip dangerous elements (scripts, iframes, event handlers) while preserving safe formatting tags. Also sanitize any user-provided HTML before rendering | Section 29.4.1.3 |

### 1.18 Global Search / Command Palette

| Package | Purpose                                                                                                                      | Spec Reference |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `cmdk`  | Command palette / global search component (Cmd+K trigger, fuzzy search, grouped results by entity type, keyboard navigation) | Section 23.10  |

### 1.19 Keyboard Shortcuts

| Package              | Purpose                                                                                                                                                                | Spec Reference              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `react-hotkeys-hook` | Keyboard shortcut management — Ctrl+S (save), Ctrl+K / Cmd+K (global search), Ctrl+P (print), Ctrl+Z/Y (undo/redo), Escape (close modals), arrow keys (tab navigation) | Section 6.1.1, 23.10, 23.17 |

### 1.20 URL State Management

| Package | Purpose                                                                                                                                                               | Spec Reference |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `nuqs`  | URL search params state management for Next.js App Router — tab state (`?tab=mis`), filter persistence in URL, shareable filtered views, browser back/forward support | Section 6.1.1  |

### 1.21 Notification Sound

| Package     | Purpose                                                                                         | Spec Reference     |
| ----------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| `use-sound` | Play subtle notification sounds when new notifications arrive (configurable by user preference) | Section 11.2, 11.5 |

### 1.22 Analytics & Performance

| Package                  | Purpose                                                                                         | Spec Reference |
| ------------------------ | ----------------------------------------------------------------------------------------------- | -------------- |
| `@vercel/analytics`      | Vercel Web Analytics — page views, unique visitors, referrers (zero-config with Vercel hosting) | Section 26.1   |
| `@vercel/speed-insights` | Vercel Speed Insights — Core Web Vitals (LCP, FID, CLS), real user monitoring                   | Section 24.16  |

### 1.23 Error Tracking (Client-Side)

| Package          | Purpose                                                                | Spec Reference |
| ---------------- | ---------------------------------------------------------------------- | -------------- |
| `@sentry/nextjs` | Client + server error tracking, performance monitoring, session replay | Section 24.14  |

### 1.24 PWA

| Package                                | Purpose                                                         | Spec Reference            |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| `next-pwa` or `workbox-webpack-plugin` | Service worker generation, pre-caching, PWA support for Next.js | Section 24.19.1, 24.19.12 |

### 1.25 Chart Export

| Package         | Purpose                                                                 | Spec Reference |
| --------------- | ----------------------------------------------------------------------- | -------------- |
| `html-to-image` | Export chart containers as PNG images (each chart has an export button) | Section 21.7   |

### 1.26 Utilities

| Package          | Purpose                                                                                                                                                                                            | Spec Reference       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `uuid`           | Generate UUIDs for device fingerprint (deviceId)                                                                                                                                                   | Section 22.3         |
| `lodash-es`      | Tree-shakeable utility functions — `debounce` (search), `isEqual` (deep comparison for data-aware save), `cloneDeep` (original state snapshot), `chunk` (pagination), `throttle` (scroll handlers) | Section 6.1.1, 12.3  |
| `file-saver`     | Client-side file download trigger (XLSX export, PDF download, credentials download)                                                                                                                | Section 23.14, 6.3.2 |
| `xlsx` (SheetJS) | Client-side XLSX generation for quick export from data tables                                                                                                                                      | Section 23.14        |
| `papaparse`      | CSV parsing for CSV export and CSV import preview/validation                                                                                                                                       | Section 23.6, 23.14  |
| `mime`           | MIME type utilities — map file extensions to MIME types for upload validation                                                                                                                      | Section 24.11        |

---

## 2. FRONTEND DEV-DEPENDENCIES

### 2.1 TypeScript

| Package            | Purpose                    |
| ------------------ | -------------------------- |
| `typescript`       | TypeScript compiler        |
| `@types/react`     | React type definitions     |
| `@types/react-dom` | React DOM type definitions |
| `@types/node`      | Node.js type definitions   |
| `@types/lodash`    | Lodash type definitions    |
| `@types/uuid`      | UUID type definitions      |
| `@types/dompurify` | DOMPurify type definitions |

### 2.2 Linting & Formatting

| Package                            | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `eslint`                           | JavaScript/TypeScript linter                     |
| `eslint-config-next`               | Next.js ESLint config                            |
| `@typescript-eslint/eslint-plugin` | TypeScript ESLint rules                          |
| `@typescript-eslint/parser`        | TypeScript parser for ESLint                     |
| `eslint-plugin-react`              | React-specific linting rules                     |
| `eslint-plugin-react-hooks`        | React Hooks linting rules                        |
| `eslint-plugin-import`             | Import order and validation rules                |
| `eslint-plugin-jsx-a11y`           | Accessibility linting for JSX (WCAG 2.1 AA)      |
| `eslint-plugin-tailwindcss`        | Tailwind CSS class ordering and validity rules   |
| `prettier`                         | Code formatter                                   |
| `eslint-config-prettier`           | Disable ESLint rules that conflict with Prettier |
| `eslint-plugin-prettier`           | Run Prettier as an ESLint rule                   |
| `prettier-plugin-tailwindcss`      | Auto-sort Tailwind classes in Prettier           |

### 2.3 Testing

| Package                            | Purpose                                             | Spec Reference |
| ---------------------------------- | --------------------------------------------------- | -------------- |
| `vitest` or `jest`                 | Unit test runner                                    | Section 24.4   |
| `@testing-library/react`           | React component testing utilities                   | Section 24.4   |
| `@testing-library/jest-dom`        | Custom matchers for DOM assertions                  | Section 24.4   |
| `@testing-library/user-event`      | Simulate user interactions in tests                 | Section 24.4   |
| `playwright` or `@playwright/test` | E2E browser testing                                 | Section 24.4   |
| `msw` (Mock Service Worker)        | API mocking for tests (intercept fetch/axios calls) | Section 24.4   |

### 2.4 Dev Tools (Development Only)

| Package                          | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `@tanstack/react-query-devtools` | React Query devtools panel (inspect queries, cache state, refetch)    |
| `@hookform/devtools`             | React Hook Form devtools (inspect form state, errors, touched fields) |

### 2.5 Build & Config

| Package        | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `postcss`      | CSS processing pipeline (required by Tailwind)       |
| `autoprefixer` | Auto-prefix CSS for browser compatibility            |
| `tailwindcss`  | (also listed as dependency — Tailwind CLI for build) |

---

## 3. BACKEND DEPENDENCIES (Express)

### 3.1 Core Framework

| Package                | Purpose                                                                       | Spec Reference |
| ---------------------- | ----------------------------------------------------------------------------- | -------------- |
| `express`              | HTTP framework                                                                | Section 15     |
| `cors`                 | CORS middleware (allow only `teams.opportunitymakers.in`)                     | Section 16     |
| `helmet`               | Security headers (CSP, HSTS, X-Frame-Options, etc.)                           | Section 16     |
| `hpp`                  | HTTP parameter pollution protection (prevents duplicate query params attacks) | Section 16     |
| `compression`          | Gzip/Brotli response compression                                              | Section 24     |
| `cookie-parser`        | Parse cookies from requests (BFF session cookie)                              | Section 4      |
| `express-async-errors` | Async error catching for Express route handlers                               | Section 24.2   |

### 3.2 Authentication & Security

| Package              | Purpose                                                                                     | Spec Reference     |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------ |
| `jsonwebtoken`       | JWT creation, signing, verification                                                         | Section 4          |
| `bcrypt` or `argon2` | Password hashing and salting                                                                | Section 4          |
| `uuid`               | UUID generation (server-side IDs, filenames, reference numbers)                             | Section 22, 24.11  |
| `crypto` (built-in)  | SHA-256 hashing (document fingerprinting), HMAC (signed URLs), AES-256-GCM (PII encryption) | Section 25.4, 29.3 |

### 3.3 Database & ORM

| Package                    | Purpose                                                                                             | Spec Reference |
| -------------------------- | --------------------------------------------------------------------------------------------------- | -------------- |
| `@prisma/client`           | Prisma ORM client (42 models, PostgreSQL)                                                           | Section 15, 17 |
| `prisma`                   | Prisma CLI (migrations, schema management, studio) — also dev-dependency                            | Section 15, 17 |
| `@neondatabase/serverless` | Neon serverless PostgreSQL driver (required for serverless connection pooling with Prisma on Neon)  | Section 26.1   |
| `@prisma/adapter-neon`     | Prisma adapter for Neon serverless driver (enables Prisma to use Neon's WebSocket-based connection) | Section 26.1   |

### 3.4 Redis & Session Management

| Package           | Purpose                                                                  | Spec Reference |
| ----------------- | ------------------------------------------------------------------------ | -------------- |
| `ioredis`         | Redis client (sessions, caching, rate limiting counters, BullMQ backend) | Section 15, 4  |
| `connect-redis`   | Redis session store for express-session                                  | Section 4      |
| `express-session` | Session middleware (Redis-backed, HTTPS-only cookies)                    | Section 4      |

### 3.5 Job Queue

| Package                      | Purpose                                                                                                                                                                                      | Spec Reference     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `bullmq`                     | Job queue for background tasks (report generation, email sending, midnight session reset, cloud cleanup, orphaned image cleanup, auto-archive)                                               | Section 15, 27.1.3 |
| `@bull-board/express`        | BullMQ dashboard UI — web-based admin panel to monitor job queues, view failed/completed/delayed jobs, retry failed jobs, view job data/logs. Mounted at `/admin/queues` (behind admin auth) | Section 24         |
| `@bull-board/api`            | Bull Board API layer (required by @bull-board/express)                                                                                                                                       | Section 24         |
| `@bull-board/adapter-bullmq` | BullMQ adapter for Bull Board (connects BullMQ queues to the dashboard UI)                                                                                                                   | Section 24         |

### 3.6 Real-Time Communication

| Package                    | Purpose                                                                                   | Spec Reference               |
| -------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| `socket.io`                | WebSocket server for real-time notifications, presence broadcasts, analytics live updates | Section 15, 11, 23.15, 24.10 |
| `@socket.io/redis-adapter` | Redis adapter for Socket.io (multi-instance scaling)                                      | Section 24.10                |

### 3.7 Firebase (Server-Side Admin)

| Package          | Purpose                                                                                                 | Spec Reference    |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ----------------- |
| `firebase-admin` | Firebase Admin SDK (server-side Realtime Database writes, Firestore queries, security rule enforcement) | Section 15, 23.15 |

### 3.8 Email

| Package               | Purpose                                                                                                                  | Spec Reference   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `nodemailer`          | SMTP email sending (reports, leave notifications, document alerts, KYC reminders, account notifications, lockout alerts) | Section 15, 10.3 |
| `handlebars` or `ejs` | Email template rendering (variable replacement in HTML email bodies)                                                     | Section 23.13    |

### 3.9 File Upload & Processing

| Package                   | Purpose                                                                                                                                                                                                                          | Spec Reference      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `multer` or `busboy`      | Multipart file upload parsing (documents, profile photos)                                                                                                                                                                        | Section 24.11       |
| `sharp`                   | Image processing (resize, compress, EXIF stripping, format conversion for profile photos)                                                                                                                                        | Section 24.11, 30.2 |
| `file-type`               | Detect file type by magic bytes (not extension — security)                                                                                                                                                                       | Section 24.11       |
| `mime-types`              | MIME type lookup and extension mapping for file upload validation and Content-Type headers                                                                                                                                       | Section 24.11       |
| `clamscan` or `clamav.js` | Virus/malware scanning for uploaded files                                                                                                                                                                                        | Section 24.11       |
| `sanitize-html`           | Sanitize Tiptap rich text editor HTML content before storing in database — strip dangerous elements (scripts, iframes, onclick handlers) while preserving safe formatting. Also sanitize any user HTML input across the platform | Section 29.4.1.3    |

### 3.10 OCR & Text Extraction

| Package        | Purpose                                                                                                                                                                                    | Spec Reference |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `tesseract.js` | OCR (Optical Character Recognition) for extracting text from scanned offer letter images/PDFs during auto-verification. Extracts reference numbers, employee names from uploaded documents | Section 29.4.4 |
| `pdf-parse`    | Extract text content from PDF files (for offer letter auto-verification — reference number matching, content fingerprinting)                                                               | Section 29.4.4 |

### 3.11 Cloud Storage

| Package                         | Purpose                                                                                                                  | Spec Reference |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `cloudinary`                    | Cloudinary SDK (profile photo upload, document storage, report file storage, CDN URLs, image deletion)                   | Section 15, 30 |
| `@aws-sdk/client-s3`            | AWS S3-compatible SDK for Cloudflare R2 (if R2 chosen over Cloudinary for reports/documents — R2 uses S3-compatible API) | Section 15     |
| `@aws-sdk/s3-request-presigner` | Generate pre-signed URLs for secure document access (15-min expiry)                                                      | Section 29.3   |

### 3.11 PDF Generation

| Package                                | Purpose                                                                                 | Spec Reference |
| -------------------------------------- | --------------------------------------------------------------------------------------- | -------------- |
| `puppeteer` or `puppeteer-core`        | HTML-to-PDF rendering for offer letter generation (both variants — template and Tiptap) | Section 29.4.3 |
| `chromium` (via `@sparticuz/chromium`) | Headless Chrome binary for serverless/containerized Puppeteer                           | Section 29.4.3 |

### 3.12 Spreadsheet Generation

| Package   | Purpose                                                                   | Spec Reference |
| --------- | ------------------------------------------------------------------------- | -------------- |
| `exceljs` | Server-side XLSX generation (20+ report types, quick export, bulk export) | Section 10, 20 |

### 3.13 Validation

| Package | Purpose                                                                                       | Spec Reference   |
| ------- | --------------------------------------------------------------------------------------------- | ---------------- |
| `zod`   | Runtime schema validation (API request bodies, query params, env vars) — shared with frontend | Section 16, 24.2 |

### 3.14 Logging

| Package                               | Purpose                                                                             | Spec Reference |
| ------------------------------------- | ----------------------------------------------------------------------------------- | -------------- |
| `pino`                                | Structured JSON logging (high performance, production-grade)                        | Section 24.3   |
| `pino-pretty`                         | Dev-only pretty-printed log output                                                  | Section 24.3   |
| `pino-http`                           | HTTP request/response logging middleware for Express                                | Section 24.3   |
| `pino-roll` or `rotating-file-stream` | Log file rotation — daily rotation, 30-day retention, gzip compression of old files | Section 24.3   |

### 3.15 Rate Limiting

| Package                 | Purpose                                                   | Spec Reference |
| ----------------------- | --------------------------------------------------------- | -------------- |
| `rate-limiter-flexible` | Redis-based rate limiting (per user/role/endpoint limits) | Section 24.9   |

### 3.16 API Documentation

| Package                             | Purpose                                                             | Spec Reference |
| ----------------------------------- | ------------------------------------------------------------------- | -------------- |
| `swagger-jsdoc` or `zod-to-openapi` | Auto-generate OpenAPI 3.0 spec from route definitions + Zod schemas | Section 24.7   |
| `swagger-ui-express`                | Serve Swagger UI at `/api/docs` (dev/staging only)                  | Section 24.7   |

### 3.17 Error Tracking (Server-Side)

| Package        | Purpose                                            | Spec Reference |
| -------------- | -------------------------------------------------- | -------------- |
| `@sentry/node` | Server-side error tracking, performance monitoring | Section 24.14  |

### 3.18 Utilities

| Package               | Purpose                                                                                                                                              | Spec Reference       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `dayjs` or `date-fns` | Date manipulation server-side (attendance calculations, leave date ranges, report date filtering)                                                    | Section 27, 28       |
| `lodash`              | Server utility functions (deep merge for settings, chunk for bulk operations)                                                                        | Section 23.2         |
| `nanoid`              | Short unique ID generation (invoice numbers, offer letter reference numbers)                                                                         | Section 14           |
| `dotenv`              | Load environment variables from `.env` files                                                                                                         | Section 24.1         |
| `ms`                  | Convert time strings to milliseconds ("30m" → 1800000 for session TTL)                                                                               | Section 25.3         |
| `@slack/webhook`      | Send monitoring/alerting notifications to Slack channels (UptimeRobot alerts, BullMQ job failures, critical system events, deployment notifications) | Section 26.3         |
| `cron-parser`         | Parse and validate cron expressions (for scheduled report configs, midnight reset timing)                                                            | Section 27.1.3, 20.3 |

### 3.19 Captcha Verification

| Package                              | Purpose                                                | Spec Reference |
| ------------------------------------ | ------------------------------------------------------ | -------------- |
| `turnstile-node` or manual HTTP call | Verify Cloudflare Turnstile captcha tokens server-side | Section 4      |

---

## 4. BACKEND DEV-DEPENDENCIES

### 4.1 TypeScript

| Package                  | Purpose                          |
| ------------------------ | -------------------------------- |
| `typescript`             | TypeScript compiler              |
| `@types/express`         | Express type definitions         |
| `@types/cors`            | CORS type definitions            |
| `@types/cookie-parser`   | cookie-parser type definitions   |
| `@types/express-session` | express-session type definitions |
| `@types/jsonwebtoken`    | JWT type definitions             |
| `@types/bcrypt`          | bcrypt type definitions          |
| `@types/multer`          | multer type definitions          |
| `@types/lodash`          | lodash type definitions          |
| `@types/node`            | Node.js type definitions         |
| `@types/uuid`            | UUID type definitions            |
| `@types/nodemailer`      | Nodemailer type definitions      |
| `@types/hpp`             | hpp type definitions             |
| `@types/sanitize-html`   | sanitize-html type definitions   |
| `@types/mime-types`      | mime-types type definitions      |

### 4.2 Development Tools

| Package            | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `tsx` or `ts-node` | Run TypeScript directly in development (no compile step)    |
| `nodemon`          | Auto-restart server on file changes during development      |
| `concurrently`     | Run multiple scripts concurrently (Express + BullMQ worker) |
| `cross-env`        | Cross-platform environment variable setting                 |

### 4.3 Linting & Formatting

| Package                            | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `eslint`                           | JavaScript/TypeScript linter                     |
| `@typescript-eslint/eslint-plugin` | TypeScript ESLint rules                          |
| `@typescript-eslint/parser`        | TypeScript parser for ESLint                     |
| `eslint-plugin-import`             | Import order validation                          |
| `prettier`                         | Code formatter                                   |
| `eslint-config-prettier`           | Disable ESLint rules that conflict with Prettier |

### 4.4 Testing

| Package            | Purpose                                         | Spec Reference |
| ------------------ | ----------------------------------------------- | -------------- |
| `vitest` or `jest` | Unit + integration test runner                  | Section 24.4   |
| `supertest`        | HTTP assertion library for API endpoint testing | Section 24.4   |
| `@types/supertest` | Supertest type definitions                      | Section 24.4   |

### 4.5 Database

| Package  | Purpose                                      |
| -------- | -------------------------------------------- |
| `prisma` | Prisma CLI (generate, migrate, studio, seed) |

---

## 5. ROOT / MONOREPO DEPENDENCIES

These are workspace-level tools used across both frontend and backend.

| Package                                          | Purpose                                            | Spec Reference |
| ------------------------------------------------ | -------------------------------------------------- | -------------- |
| `husky`                                          | Git hooks (pre-commit, pre-push)                   | Section 24.5   |
| `lint-staged`                                    | Run linters on staged files only (pre-commit hook) | Section 24.5   |
| `commitlint` + `@commitlint/config-conventional` | Enforce conventional commit messages               | Section 24.5   |
| `docker` + `docker-compose`                      | Containerization (not npm — installed system-wide) | Section 24.6   |

---

## 6. EXTERNAL SERVICES & PLATFORMS

### 6.1 Hosting & Deployment

| Service    | Purpose                                                                                                                                      | Tier                       | Spec Reference |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------- |
| **Vercel** | Frontend hosting (Next.js native). Auto-deploys, edge network, preview deployments, auto SSL, custom domain (`teams.opportunitymakers.in`).  | Pro (recommended for team) | Section 26.1   |
| **Render** | Backend hosting (Express/Node.js). Auto-deploys, health checks, zero-downtime deploys, auto SSL, custom domain (`api.opportunitymakers.in`). | Starter or Standard        | Section 26.1   |
| **GitHub** | Git repository hosting, GitHub Actions for CI/CD (lint → test → build → deploy).                                                             | Team                       | Section 24.5   |

### 6.2 Database

| Service                               | Purpose                                                                                                                                              | Tier | Spec Reference   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------- |
| **Neon** or **Supabase** (PostgreSQL) | Managed serverless PostgreSQL. Auto-scaling, branching (Neon), built-in connection pooling, automated backups, encryption at rest. 42 Prisma models. | Pro  | Section 15, 26.1 |

### 6.3 Caching & Session Store

| Service                         | Purpose                                                                                                                                                                                       | Tier              | Spec Reference   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------- |
| **Redis Cloud** (by Redis Labs) | Managed Redis. Session storage, caching, BullMQ job queue backend, rate limiting counters, login attempt counters, maintenance mode flag. Persistence, encryption at rest, high availability. | Essentials or Pro | Section 15, 26.1 |

### 6.4 Cloud Storage

| Service           | Purpose                                                                                                                                                        | Tier          | Spec Reference |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------- |
| **Cloudflare R2** | Object storage for generated reports, employee documents (KYC), offer letter PDFs. S3-compatible API. No egress fees. Auto-cleanup job for expired reports.    | Pay-as-you-go | Section 15     |
| **Cloudinary**    | Profile photo storage with CDN, image transformation (resize, format conversion), automatic CDN caching. May also be used for document storage if R2 not used. | Pro           | Section 15, 30 |

### 6.5 Real-Time & Presence

| Service                        | Purpose                                                                                                                                         | Tier                  | Spec Reference    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------- |
| **Firebase Realtime Database** | Live online/offline presence detection for employees. `.info/connected` listener + `onDisconnect()` handler. Stores real-time connection state. | Blaze (pay-as-you-go) | Section 15, 23.15 |
| **Firebase Firestore**         | Persistent presence queries and last active timestamp storage. Structured queries for Admin/RM presence views. Complements Realtime Database.   | Blaze (pay-as-you-go) | Section 15, 23.15 |
| **Firebase Authentication**    | NOT used — platform has its own JWT-based auth. Firebase is used ONLY for Realtime Database and Firestore.                                      | —                     | Section 4         |

### 6.6 Email (SMTP)

| Service                                                                                         | Purpose                                                                                                                                                                                           | Tier            | Spec Reference   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------- |
| **SMTP Provider** (e.g., **SendGrid**, **AWS SES**, **Mailgun**, **Resend**, or **Gmail SMTP**) | Transactional email delivery via Nodemailer. Report distribution (daily/monthly/yearly), leave notifications, document verification alerts, KYC reminders, account notifications, lockout alerts. | Based on volume | Section 15, 10.3 |

### 6.7 Error Tracking & Monitoring

| Service                                     | Purpose                                                                                                                                                                                  | Tier              | Spec Reference |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------- |
| **Sentry**                                  | Client-side + server-side error tracking. Unhandled exceptions, stack traces, breadcrumbs, user context, error grouping, performance monitoring, session replay.                         | Team              | Section 24.14  |
| **UptimeRobot** (or BetterUptime / Pingdom) | External uptime monitoring. Monitors `teams.opportunitymakers.in` (frontend) and `api.opportunitymakers.in/health` (backend). 1-minute check interval. Alert on 3+ consecutive failures. | Pro               | Section 26.3   |
| **Grafana** (optional)                      | Metrics dashboard + alerting. Response times, error rates, request counts. Alert on error rate > 5%, p95 > 2s.                                                                           | Cloud Free or OSS | Section 26.3   |

### 6.8 Security & CDN

| Service                  | Purpose                                                                                                                                                                        | Tier              | Spec Reference   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------- |
| **Cloudflare**           | DNS provider, DDoS protection, WAF (Web Application Firewall), CDN caching, Turnstile captcha. Domain DNS pointed through Cloudflare for both frontend and backend subdomains. | Pro (recommended) | Section 16, 26.2 |
| **Cloudflare Turnstile** | Bot protection captcha on the login page (all 3 tabs). Free, privacy-friendly alternative to reCAPTCHA.                                                                        | Free              | Section 4        |

### 6.9 CI/CD

| Service                                         | Purpose                                                                                                                                                    | Spec Reference |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **GitHub Actions**                              | CI/CD pipeline. Workflows: lint → test → build → deploy (staging on push to `staging`, production on push to `main`). Matrix testing for Node.js versions. | Section 24.5   |
| **Docker Hub** or **GitHub Container Registry** | Docker image registry for containerized builds (if self-hosting or using Docker-based deployment).                                                         | Section 24.6   |

### 6.10 Font Hosting

| Service          | Purpose                                                                                                               | Spec Reference          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Google Fonts** | Host "Plus Jakarta Sans" font (variable weights 200–800 + italic). Alternative: self-host from `/fonts/` for privacy. | Section 18 (Typography) |

### 6.11 Malware Scanning

| Service / Tool | Purpose                                                                                                                                                        | Spec Reference |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **ClamAV**     | Open-source antivirus engine for scanning uploaded files (documents, profile photos). Runs as a daemon or via `clamscan` CLI. Can be containerized via Docker. | Section 24.11  |

### 6.12 Alert Channels

| Service                | Purpose                                                                                                                                                                                                                                                | Spec Reference |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| **Slack** (or Discord) | Monitoring alert delivery channel. Webhook integration receives alerts from UptimeRobot, Sentry, Grafana, and BullMQ job failures. Dedicated channels: `#omg-teams-alerts` (critical), `#omg-teams-deployments` (CI/CD), `#omg-teams-errors` (Sentry). | Section 26.3   |

### 6.13 Incident Management (Optional but Recommended)

| Service                                          | Purpose                                                                                                                                       | Spec Reference |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **PagerDuty** or **OpsGenie** or **Incident.io** | Incident management with on-call rotation, escalation policies, auto-escalate unacknowledged alerts. Integrates with UptimeRobot and Grafana. | Section 26.3   |

---

## 7. SUMMARY COUNTS

### 7.1 Dependencies

| Category                  |    Count     |
| ------------------------- | :----------: |
| Frontend dependencies     | ~70 packages |
| Frontend dev-dependencies | ~28 packages |
| Backend dependencies      | ~45 packages |
| Backend dev-dependencies  | ~23 packages |
| Root/monorepo tools       | ~4 packages  |
| **Total npm packages**    |   **~170**   |

### 7.2 External Services

| Category                    |                 Count                  |
| --------------------------- | :------------------------------------: |
| Hosting & Deployment        |       3 (Vercel, Render, GitHub)       |
| Database                    |    1 (Neon or Supabase PostgreSQL)     |
| Caching & Sessions          |            1 (Redis Cloud)             |
| Cloud Storage               |     2 (Cloudflare R2, Cloudinary)      |
| Real-Time & Presence        | 2 (Firebase RTDB, Firebase Firestore)  |
| Email (SMTP)                | 1 (SendGrid / SES / Mailgun / Resend)  |
| Error Tracking & Monitoring |    3 (Sentry, UptimeRobot, Grafana)    |
| Security & CDN              |  2 (Cloudflare, Cloudflare Turnstile)  |
| CI/CD                       | 2 (GitHub Actions, Container Registry) |
| Font Hosting                |            1 (Google Fonts)            |
| Malware Scanning            |               1 (ClamAV)               |
| Alert Channels              |          1 (Slack / Discord)           |
| Incident Management         |        1 (PagerDuty / OpsGenie)        |
| **Total External Services** |                **~21**                 |

---

_This document is derived from the OMG Teams Platform Specification (33 sections, 6,796 lines). Every dependency and service listed here maps to a specific requirement in the specification. No dependency is arbitrary — each serves a documented purpose._
