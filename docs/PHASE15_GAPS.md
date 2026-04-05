# Phase 15 — Dev Standards & Deployment (§15,17,19,24,26,31-33) Gap Checklist

## Gap 1: Maintenance mode backend middleware
**Spec**: §24.18 — Admin can toggle maintenance mode; all non-admin requests return 503
**Current**: Frontend maintenance page exists but no backend middleware to enforce it
**Fix**: Add maintenance middleware that checks Redis flag `platform:maintenance_mode`; return 503 for non-admin; add admin endpoint to toggle
**Status**: [ ] Not started

## Gap 2: PWA service worker configuration
**Spec**: §24.19 — PWA with service worker, offline fallback, install prompt
**Current**: manifest.ts and offline.html exist; next-pwa installed but not configured in next.config.ts
**Fix**: Configure next-pwa in next.config.ts with service worker generation and offline fallback
**Status**: [ ] Not started

## Gap 3: Frontend Dockerfile
**Spec**: §24.6 — Docker containerization for all services
**Current**: Backend Dockerfile exists; no frontend Dockerfile
**Fix**: Add a multi-stage Next.js Dockerfile for the frontend
**Status**: [ ] Not started
