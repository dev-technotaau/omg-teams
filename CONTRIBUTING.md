# Contributing to OMG Teams

Thank you for your interest in contributing to OMG Teams! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Branch Strategy](#branch-strategy)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch from `main`
4. Make your changes
5. Submit a pull request

## Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** 16+
- **Redis** 7+
- **npm** (comes with Node.js)
- **Docker** (optional, for containerized development)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/dev-technotaau/omg-teams.git
cd omg-teams

# Install all dependencies (root + backend + frontend)
make install
# or
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit both .env files with your configuration

# Start Docker services (PostgreSQL + Redis)
docker compose up -d postgres redis

# Run database migrations
cd backend && npx prisma migrate dev && cd ..

# Start development servers
make dev
# or
npm run dev
```

This starts both the backend (Express, port 4000) and frontend (Next.js, port 3000) concurrently.

### Docker Development

```bash
# Start everything with Docker
docker compose up -d

# View logs
docker compose logs -f backend frontend
```

## Project Structure

```
omg-teams/
├── backend/                  # Express.js API server
│   ├── src/
│   │   ├── config/           # Service configs (database, redis, storage, etc.)
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/        # Express middleware (auth, upload, WAF, etc.)
│   │   ├── routes/           # Route definitions
│   │   ├── services/         # Business logic layer
│   │   ├── jobs/             # BullMQ workers and queues
│   │   ├── utils/            # Utility functions
│   │   ├── validators/       # Zod schemas
│   │   └── templates/        # Email templates
│   ├── prisma/               # Database schema and migrations
│   └── tests/                # Backend tests
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── (protected)/  # Authenticated routes
│   │   │   │   ├── admin/    # Admin pages
│   │   │   │   ├── reports/  # Recruiter reports
│   │   │   │   ├── team/     # RM team management
│   │   │   │   └── ...       # Other role pages
│   │   │   └── (auth)/       # Auth pages (login, OTP)
│   │   ├── components/       # React components
│   │   │   ├── ui/           # Design system components
│   │   │   └── layout/       # Layout components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API client functions
│   │   ├── store/            # State management (Zustand)
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utility functions
│   │   └── validators/       # Zod schemas (shared)
│   └── public/               # Static assets
├── infra/                    # Infrastructure configs (Terraform, etc.)
├── docs/                     # Documentation
├── docker-compose.yml        # Development Docker setup
├── docker-compose.production.yml  # Production Docker setup
├── Makefile                  # Development commands
└── package.json              # Root workspace config
```

## Development Workflow

### Available Commands

```bash
# Development
make dev                # Start both backend + frontend
make dev-backend        # Start backend only
make dev-frontend       # Start frontend only

# Building
make build              # Build both
make build-backend      # Build backend only
make build-frontend     # Build frontend only

# Code Quality
make lint               # Lint both
make lint-fix           # Auto-fix lint issues
make format             # Format code with Prettier
make typecheck          # TypeScript type checking
make validate           # Run typecheck + lint + tests

# Testing
make test               # Run all tests

# Cleanup
make clean              # Clean build artifacts
```

### Backend Development

```bash
cd backend

# Run in development mode (with hot reload)
npm run dev

# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name descriptive_name

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Frontend Development

```bash
cd frontend

# Run in development mode
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

## Coding Standards

### General

- **TypeScript** is required for all code. No `any` types unless absolutely necessary.
- **Strict mode** is enabled. All type errors must be resolved.
- Follow existing patterns in the codebase.

### Backend

- **Controllers** handle HTTP request/response only. Business logic goes in **services**.
- **Zod** for all input validation.
- Use the **service-init** pattern for external service registration.
- All database queries go through **Prisma**.
- Use **BullMQ** for background jobs (never do heavy work in request handlers).
- Cache with **Redis** using the `cache.getOrSet()` pattern.

### Frontend

- Use the **UI component library** (`@/components/ui/`) for all UI elements. Never use raw HTML elements when a custom component exists.
- **Server components** by default. Add `"use client"` only when needed.
- Use **Zustand** for client state, **React Query** patterns for server state.
- Follow the existing **page structure** pattern: PageHeader, filters, DataTable/content.
- All forms use **Zod** validation.

### File Naming

- Components: `PascalCase.tsx` (e.g., `DataTable.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-filter-presets.ts`)
- Services: `kebab-case.service.ts` (e.g., `user.service.ts`)
- Utils: `kebab-case.ts` (e.g., `export-table.ts`)

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/). Commits are enforced via `commitlint` + `husky`.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, dependencies |
| `ci` | CI/CD changes |
| `revert` | Revert a previous commit |

### Examples

```
feat(attendance): add punch-in/out time editing
fix(auth): resolve session cookie SameSite issue
docs(readme): update deployment instructions
chore(deps): upgrade Next.js to 15.x
```

## Pull Request Process

1. **Create a feature branch** from `main` (see [Branch Strategy](#branch-strategy))
2. **Write your code** following the coding standards
3. **Run validation** before pushing: `make validate`
4. **Push your branch** and open a PR against `main`
5. **Fill out the PR template** with summary, test plan, and screenshots if applicable
6. **Request review** from at least one maintainer
7. **Address review feedback** promptly
8. **Squash and merge** once approved

### PR Requirements

- All CI checks must pass (typecheck, lint, tests)
- At least 1 approval from a maintainer
- No unresolved conversations
- Branch must be up to date with `main`

## Branch Strategy

```
main                    # Production-ready code
├── feat/feature-name   # New features
├── fix/bug-description # Bug fixes
├── chore/task-name     # Maintenance tasks
└── docs/topic          # Documentation updates
```

## Testing

### Backend Tests

```bash
cd backend
npm run test            # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

### Frontend Tests

```bash
cd frontend
npm run test            # Run all tests
```

### Writing Tests

- Place test files next to the source file or in a `__tests__` directory
- Name test files `*.test.ts` or `*.spec.ts`
- Test business logic in services, not controllers
- Use factories/fixtures for test data

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description** of the bug
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshots** (if applicable)
6. **Environment** (OS, Node version, browser)

### Feature Requests

When requesting features:

1. **Description** of the feature
2. **Use case** — why is this needed?
3. **Proposed solution** (if any)
4. **Alternatives considered**

---

Thank you for contributing to OMG Teams!
