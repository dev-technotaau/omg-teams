# OMG Teams — Static Assets Requirements

> **This document lists EVERY static asset required across the entire full-stack platform.**
> All missing files must be created/exported from brand source files before production deployment.

---

## Status Legend

- **EXISTS** — File is present and functional
- **MISSING** — File is referenced in code but does not exist yet — **MUST be created**
- **UNUSED** — File exists but is not referenced in code (can be removed)

---

## 1. FAVICON

| File | Location | Format | Size | Status | Referenced In |
|------|----------|--------|------|--------|---------------|
| `favicon.ico` | `frontend/src/app/favicon.ico` | ICO | 26 KB | **EXISTS** | `manifest.ts`, `proxy.ts`, Next.js auto-serves |

**Notes:** This is served by Next.js from the `app/` directory (not `public/`). Multi-resolution ICO containing 16x16, 32x32, 48x48.

---

## 2. PWA ICONS (Progressive Web App)

All icons must be PNG format, exported from the **OMG Teams logo** at exact pixel dimensions.
Icons with `maskable` purpose need a **safe zone** — the logo should occupy the inner 80% of the canvas with padding around edges for OS cropping.

| File | Location | Dimensions | Purpose | Status | Referenced In |
|------|----------|------------|---------|--------|---------------|
| `icon-72x72.png` | `frontend/public/icons/` | 72 x 72 px | Android small icon | **MISSING** | `manifest.ts` |
| `icon-96x96.png` | `frontend/public/icons/` | 96 x 96 px | Android standard icon | **MISSING** | `manifest.ts` |
| `icon-128x128.png` | `frontend/public/icons/` | 128 x 128 px | Chrome Web Store | **MISSING** | `manifest.ts` |
| `icon-144x144.png` | `frontend/public/icons/` | 144 x 144 px | Windows tile icon | **MISSING** | `manifest.ts` |
| `icon-152x152.png` | `frontend/public/icons/` | 152 x 152 px | iOS home screen (iPad) | **MISSING** | `manifest.ts` |
| `icon-192x192.png` | `frontend/public/icons/` | 192 x 192 px | Android home screen (maskable) | **MISSING** | `manifest.ts` |
| `icon-384x384.png` | `frontend/public/icons/` | 384 x 384 px | Android splash (high-res) | **MISSING** | `manifest.ts` |
| `icon-512x512.png` | `frontend/public/icons/` | 512 x 512 px | PWA install & splash (maskable) | **MISSING** | `manifest.ts` |

**How to generate:**
1. Start with the OMG Teams logo in SVG or high-res PNG (at least 1024x1024).
2. Export at each size above with transparent background.
3. For maskable icons (192x192, 512x512): add 20% safe zone padding around the logo so the logo occupies ~80% of the center. Use [maskable.app](https://maskable.app/editor) to test.
4. Place all files in `frontend/public/icons/`.

---

## 3. PLATFORM LOGO (Single File — Used Everywhere)

| File | Location | Format | Dimensions | Status | Referenced In |
|------|----------|--------|------------|--------|---------------|
| `logo.png` | `frontend/public/icons/` | PNG | 2560 x 672 px (landscape) | **EXISTS** | Sidebar, Header (mobile), Email templates, Offer letter PDF |

**ONE file used in ALL 4 places — no duplicates:**

| Usage | File Path | How It Renders |
|---|---|---|
| **Sidebar navigation** | `/icons/logo.png` | `h-10 w-auto object-contain` — auto-scales to sidebar width. "O" badge fallback when collapsed. |
| **Header (mobile)** | `/icons/logo.png` | `h-8 w-auto` — visible only on mobile (`lg:hidden`) when sidebar is not shown. |
| **Email templates** | `${FRONTEND_URL}/icons/logo.png` | `<img>` at `max-width:280px; height:auto`. Outlook falls back to text. |
| **Offer letter PDF** | `${FRONTEND_URL}/icons/logo.png` | Fetched via HTTP, cached in memory. PDFKit renders at `width: 200`, height auto-proportional. |

**Notes:**
- Full wide landscape logo containing: circular OMG emblem + "OPPORTUNITY MAKERS GROUP" text + "You dream it, we make it." tagline.
- **PNG with transparent background** preferred.
- All 4 usages auto-scale from the same high-res source — no fixed dimensions hardcoded.
- If the file is missing, each usage has a graceful text fallback.

---

## 4. OPEN GRAPH / SOCIAL META IMAGES (Optional but Recommended)

These images appear when the platform URL is shared on social media, Slack, Teams, etc.

| File | Location | Format | Dimensions | Status | Purpose |
|------|----------|--------|------------|--------|---------|
| `og-image.png` | `frontend/public/` | PNG | 1200 x 630 px | **MISSING** | Open Graph image for social sharing |
| `og-image-square.png` | `frontend/public/` | PNG | 512 x 512 px | **MISSING** | Square fallback for some platforms |

**Notes:**
- Currently no `og:image` metadata is defined in `layout.tsx`. To enable, add to metadata:
  ```typescript
  openGraph: {
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  }
  ```
- Design should include: OMG Teams logo, platform name, tagline, brand colors (#DAA025 gold, #001845 navy).
- Since this is an internal platform, these are low priority but nice-to-have for Slack link previews.

---

## 5. APPLE TOUCH ICON

| File | Location | Format | Status | Purpose |
|------|----------|--------|--------|---------|
| `apple-icon.png` | `frontend/src/app/` | PNG | **EXISTS** | iOS home screen icon (Safari) |

**Notes:**
- Placed in `src/app/` (NOT `public/`) — this is the **Next.js App Router convention**. Next.js auto-generates the `<link rel="apple-touch-icon">` meta tag from this file.
- iOS Safari uses this when users "Add to Home Screen".

---

## 6. OFFLINE PAGE ASSETS

| Asset | Location | Format | Status | Notes |
|-------|----------|--------|--------|-------|
| Airplane SVG | Inline in `offline.html` | SVG (embedded) | **EXISTS** | No external file needed |
| Retry icon SVG | Inline in `offline.html` | SVG (embedded) | **EXISTS** | No external file needed |

**Notes:** The offline fallback page (`frontend/public/offline.html`) has all icons embedded inline as SVG markup. No external asset files are required.

---

## 7. PDF GENERATION ASSETS (Backend)

Uses `logo.png` from Section 3 above — no separate file needed. See Section 3 for details.

---

## 8. FONTS

| Font | Source | Format | Status | Referenced In |
|------|--------|--------|--------|---------------|
| Plus Jakarta Sans | Google Fonts (remote) | WOFF2 (auto) | **EXISTS** | `layout.tsx:6-10` |
| JetBrains Mono | Google Fonts (remote) | WOFF2 (auto) | **EXISTS** | `layout.tsx:12-16` |

**Notes:**
- Both fonts are loaded remotely via `next/font/google` — no local font files needed.
- CSP allows `fonts.googleapis.com` and `fonts.gstatic.com` for font loading.
- `display: "swap"` ensures text is visible during font load.
- CSS variables: `--font-plus-jakarta` (body), `--font-jetbrains-mono` (code/mono).
- No `.woff`, `.woff2`, `.ttf`, or `.otf` files are stored locally.

---

## 9. EXISTING FILES — UNUSED (Can Be Removed)

These files exist in `frontend/public/` but are **NOT referenced** anywhere in the application code. They are Next.js boilerplate placeholder files.

| File | Location | Size | Status |
|------|----------|------|--------|
| `file.svg` | `frontend/public/` | 391 B | **UNUSED** — boilerplate, safe to delete |
| `globe.svg` | `frontend/public/` | 1,035 B | **UNUSED** — boilerplate, safe to delete |
| `next.svg` | `frontend/public/` | 1,375 B | **UNUSED** — boilerplate, safe to delete |
| `vercel.svg` | `frontend/public/` | 128 B | **UNUSED** — boilerplate, safe to delete |
| `window.svg` | `frontend/public/` | 385 B | **UNUSED** — boilerplate, safe to delete |

---

## 10. REMOTE / CLOUD-HOSTED ASSETS

These are NOT in the `public/` directory — they are stored on external services and referenced via URLs.

| Asset Type | Storage Provider | Config | Referenced In |
|-----------|-----------------|--------|---------------|
| User profile photos | Cloudinary / R2 | `CLOUDINARY_URL`, `R2_*` env vars | `upload.controller.ts`, Avatar component |
| Employee documents (KYC, etc.) | Cloudinary / R2 | Same as above | `document.routes.ts`, `upload.controller.ts` |
| Generated report files (XLSX) | R2 | `R2_BUCKET`, `R2_PUBLIC_URL` | `scheduled-report.worker.ts` |
| Google OAuth avatars | `lh3.googleusercontent.com` | `next.config.ts` remotePatterns | Auth flow |
| GitHub OAuth avatars | `avatars.githubusercontent.com` | `next.config.ts` remotePatterns | Auth flow |

**`next.config.ts` Image Domain Whitelist:**
```
https://*.cloudinary.com
https://*.r2.cloudflarestorage.com
https://lh3.googleusercontent.com
https://avatars.githubusercontent.com
```

---

## 11. BRAND DESIGN TOKENS (for asset creation reference)

When creating the missing assets, use these brand values:

| Token | Value | Usage |
|-------|-------|-------|
| **Primary Color (Amber Gold)** | `#DAA025` | Logo accent, highlights |
| **Secondary Color (Deep Navy)** | `#001845` | Logo background, dark elements |
| **Background Light** | `#F8FAFC` | PWA background_color |
| **Font** | Plus Jakarta Sans | Text in images if needed |
| **Company Name** | Opportunity Makers Group | Full name |
| **Platform Name** | OMG Teams | Short name |
| **Tagline** | "You dream it, we make it." | For email/social images |

---

## COMPLETE CHECKLIST — ALL MISSING ASSETS

### Must-Have (Required for Production)

- [x] `frontend/public/icons/icon-72x72.png` (72x72 PNG) **EXISTS**
- [x] `frontend/public/icons/icon-96x96.png` (96x96 PNG) **EXISTS**
- [x] `frontend/public/icons/icon-128x128.png` (128x128 PNG) **EXISTS**
- [x] `frontend/public/icons/icon-144x144.png` (144x144 PNG) **EXISTS**
- [x] `frontend/public/icons/icon-152x152.png` (152x152 PNG) **EXISTS**
- [x] `frontend/public/icons/icon-192x192.png` (192x192 PNG, maskable) **EXISTS**
- [x] `frontend/public/icons/icon-384x384.png` (384x384 PNG) **EXISTS**
- [x] `frontend/public/icons/icon-512x512.png` (512x512 PNG, maskable) **EXISTS**
- [x] `frontend/public/icons/logo.png` (2560x672 PNG — single logo file for sidebar, header, emails, PDFs) **EXISTS**

### Also Present

- [x] `frontend/src/app/apple-icon.png` — iOS apple-touch-icon (auto-served by Next.js App Router convention) **EXISTS**
- [x] `frontend/public/og-image.png` — Open Graph social sharing image (wired in layout.tsx metadata) **EXISTS**
- [x] `frontend/public/og-image-square.png` — Square social fallback **EXISTS**

### Cleanup (Safe to Delete)

- [ ] Delete `frontend/public/file.svg` (unused boilerplate)
- [ ] Delete `frontend/public/globe.svg` (unused boilerplate)
- [ ] Delete `frontend/public/next.svg` (unused boilerplate)
- [ ] Delete `frontend/public/vercel.svg` (unused boilerplate)
- [ ] Delete `frontend/public/window.svg` (unused boilerplate)

---

## EXPECTED FINAL DIRECTORY STRUCTURE

```
frontend/public/
├── ASSETS_README.md          ← This file
├── og-image.png              ← EXISTS (social sharing)
├── og-image-square.png       ← EXISTS (social fallback)
├── offline.html              ← EXISTS (PWA offline fallback)
├── web-app-manifest-192x192.png  ← EXISTS (source icon, used to generate PWA icons)
├── web-app-manifest-512x512.png  ← EXISTS (source icon, used to generate PWA icons)
└── icons/
    ├── logo.png              ← EXISTS (2560x672 — single logo for sidebar, header, emails, PDFs)
    ├── icon-72x72.png        ← EXISTS (generated)
    ├── icon-96x96.png        ← EXISTS (generated)
    ├── icon-128x128.png      ← EXISTS (generated)
    ├── icon-144x144.png      ← EXISTS (generated)
    ├── icon-152x152.png      ← EXISTS (generated)
    ├── icon-192x192.png      ← EXISTS (generated, maskable)
    ├── icon-384x384.png      ← EXISTS (generated)
    └── icon-512x512.png      ← EXISTS (generated, maskable)

frontend/src/app/
├── favicon.ico               ← EXISTS (26 KB, multi-resolution)
└── apple-icon.png            ← EXISTS (iOS home screen, auto-served by Next.js)

backend/
└── (no local static assets — logo fetched from frontend via FRONTEND_URL)
```

---

*Last updated: 2026-04-04*
