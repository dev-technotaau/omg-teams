# OMG Teams — Frontend

Next.js 15 (App Router) frontend for the OMG Teams platform.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

The app starts on `http://localhost:3000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run tests |

## Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Public auth pages
│   │   ├── login/                # Login + OTP verification
│   │   └── ...
│   ├── (protected)/              # Authenticated routes (layout with sidebar)
│   │   ├── admin/                # Admin pages (20+)
│   │   │   ├── users/            # User management
│   │   │   ├── employees/        # Employee management
│   │   │   ├── reports/          # Candidate reports
│   │   │   ├── companies/        # Company/SP/HR management
│   │   │   ├── attendance/       # Attendance dashboard
│   │   │   ├── leaves/           # Leave management
│   │   │   ├── documents/        # Document verification
│   │   │   ├── offer-letters/    # Offer letter generation
│   │   │   ├── analytics/        # Analytics dashboard
│   │   │   ├── targets/          # Recruiter targets
│   │   │   ├── holidays/         # Holiday calendar
│   │   │   ├── sessions/         # Session management
│   │   │   ├── audit-log/        # Audit trail
│   │   │   ├── trash/            # Deleted items
│   │   │   ├── archive/          # Archived records
│   │   │   ├── duplicates/       # Duplicate detection
│   │   │   ├── settings/         # Platform settings
│   │   │   ├── email-templates/  # Email customization
│   │   │   ├── webhooks/         # Webhook config
│   │   │   ├── master-data/      # Dropdown management
│   │   │   ├── import/           # Data import
│   │   │   ├── reports-management/ # Scheduled reports
│   │   │   └── queues/           # Job queue dashboard
│   │   ├── reports/              # Recruiter report submission
│   │   ├── team/                 # RM team views
│   │   ├── dashboard/            # Role-based dashboard
│   │   ├── profile/              # User profile + passkeys
│   │   ├── attendance/           # Personal attendance
│   │   ├── leaves/               # Leave requests
│   │   ├── documents/            # Document uploads
│   │   ├── notifications/        # Notification center
│   │   ├── settings/             # User preferences
│   │   ├── search/               # Global search
│   │   └── help/                 # Help & FAQ
│   └── api/auth/                 # BFF auth endpoints
├── components/
│   ├── ui/                       # Design system (35+ components)
│   │   ├── data-table.tsx        # DataTable with 15+ features
│   │   ├── calendar-date-picker.tsx  # Custom calendar picker
│   │   ├── time-picker.tsx       # Custom time picker
│   │   ├── search-input.tsx      # Search with history + suggestions
│   │   ├── modal.tsx             # Dialog modal
│   │   ├── drawer.tsx            # Slide-over panel
│   │   ├── command-palette.tsx   # Ctrl+K command palette
│   │   ├── filter-presets-bar.tsx # Saved filter presets
│   │   ├── sparkline.tsx         # Mini SVG charts
│   │   ├── inline-edit-cell.tsx  # Click-to-edit cell
│   │   └── ...                   # 25+ more components
│   └── layout/                   # Shell, sidebar, header
├── hooks/                        # Custom React hooks
│   ├── use-filter-presets.ts     # localStorage filter presets
│   ├── use-presence.ts           # Firebase presence tracking
│   ├── use-unsaved-changes.ts    # Navigation guard
│   └── ...
├── services/                     # API client functions
├── store/                        # Zustand state stores
├── types/                        # TypeScript type definitions
├── utils/                        # Client utilities
├── validators/                   # Shared Zod schemas
├── constants/                    # App constants
├── lib/                          # Core utilities (API client, cn)
└── proxy.ts                      # BFF proxy + CSP middleware
```

## UI Component Library (35+ Components)

All UI elements use custom components — zero native browser elements for interactive controls.

| Category | Components |
|----------|-----------|
| **Data Display** | DataTable, Badge, Avatar, Card, Sparkline, Tooltip, StatsCard |
| **Forms** | Input, Textarea, Select, Checkbox, Switch, RadioGroup, FileUpload, CalendarDatePicker, TimePicker, InlineEditCell |
| **Feedback** | Alert, Progress, Spinner, ConfirmDialog, PromptDialog, EmptyState |
| **Navigation** | Tabs, Breadcrumbs, Pagination, CommandPalette |
| **Overlay** | Modal, Drawer, DropdownMenu |
| **Layout** | PageHeader, SearchInput, FilterPresetsBar, DateRangePicker |

### DataTable Features

The core DataTable component powers all data pages:

- Server-side sorting and pagination
- Row selection with bulk actions
- Column visibility toggle
- Row density toggle (compact / default / spacious)
- Table / Card view toggle
- Pinned / bookmarked rows
- Detail panel slide-over
- Keyboard navigation (j/k, Enter, Space, /, Esc)
- Collapsible group-by sections
- Quick filter buttons
- XLSX export
- Sticky header
- Virtualization (50+ rows)

### Custom Date/Time Pickers

- **CalendarDatePicker**: Full calendar popover with day/month/year views, presets, min/max, clear
- **TimePicker**: Spinner mode + quick-select grid, 12/24hr, AM/PM, seconds

All native `<input type="date/time">` replaced project-wide.

## Authentication

The frontend uses a **BFF (Backend for Frontend)** pattern:

- Auth tokens stored in HttpOnly cookies (never in JS)
- `api/auth/` routes handle login, logout, refresh
- Access + refresh token rotation
- Session indicator cookie (SameSite: Lax) for external link navigation

## Environment Variables

See `.env.example` for the complete list. Key variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_FB_PIXEL_ID=
```

## Content Security Policy

CSP is dynamically built per-request in `proxy.ts` with nonce-based script policy. Includes allowlists for:

- Google Tag Manager, Google Analytics
- Facebook Pixel
- Firebase RTDB + WebSocket
- Vercel Analytics
- OAuth avatar domains (Google, GitHub)
