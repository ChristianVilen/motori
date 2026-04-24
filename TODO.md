# Codebase Review — Security, SEO, Accessibility

Audit date: 2026-04-24

## Critical

- [x] **CSRF protection on POST server functions** — Cookie-based sessions but no CSRF token on custom server functions (listing CRUD, profile save, account delete). Add custom header validation middleware.
- [x] **tsquery injection in `toTsQuery`** — `to_tsquery` interprets operator syntax from user input. Switch to `plainto_tsquery` or `websearch_to_tsquery`. (`src/lib/search.ts`)

## High — Security

- [x] **Missing `Strict-Transport-Security` header** — Add HSTS to `src/lib/security-headers.ts`.
- [x] **CSP `unsafe-inline` for scripts in production** — Investigate nonce-based CSP for TanStack Start SSR hydration. (`src/lib/security-headers.ts`)

## High — SEO

- [x] **No per-page `<title>` or `<meta description>`** — Listing detail, browse, auth, profile pages all inherit the generic root title. Add `head()` to each route.
- [x] **No `robots.txt`** — Add to `public/` with disallow for `/admin`, `/omat`, `/profiili/asetukset`.
- [ ] **No `sitemap.xml`** — Generate dynamic sitemap of active listings for search engine discovery.
- [ ] **No `<link rel="canonical">` or `og:url`** — Missing on all pages. Causes duplicate content indexing and broken social sharing.

## High — Accessibility

- [ ] **Login modal lacks focus trapping** — `aria-modal="true"` is set but Tab escapes the modal. (`src/components/auth/login-modal.tsx`)
- [ ] **Filter drawer lacks focus trapping** — Same issue. (`src/components/listings/filter-drawer.tsx`)
- [ ] **No `aria-live` regions for dynamic content** — Form errors, search results, load-more updates are not announced to screen readers.
- [ ] **No skip navigation link** — Keyboard users must tab through entire nav on every page. WCAG 2.4.1. (`src/routes/__root.tsx`)
- [ ] **Color contrast failures** — `text-white/40` on `#1a1a2e` ≈ 3.2:1, fails WCAG AA (4.5:1 required). Hero stats labels, search placeholder, filter chips.

## Medium

- [ ] **View count increment is unauthenticated/unbounded** — No dedup or rate limit on `view_count` bump. (`src/routes/ilmoitukset/$listingId.tsx`)
- [ ] **Harden `dangerouslySetInnerHTML` locale injection** — Add `.replace(/</g, '\\u003c')` as defense-in-depth. (`src/routes/__root.tsx`)
- [ ] **No `prefers-reduced-motion` handling** — Card hover, image zoom, hero ping animation ignore motion preferences.
- [ ] **Filter toggle buttons lack `aria-pressed`** — Type/license toggles don't communicate state to assistive tech. (`src/components/listings/filter-sidebar.tsx`, `filter-drawer.tsx`)
- [ ] **Image upload input needs explicit `aria-label`** — Implicit label wrapping works but is fragile. (`src/components/listings/listing-form.tsx`)

## Low

- [ ] **Admin pages use hardcoded English** — Intentional for now, track for future i18n.
- [ ] **`getNeighborRegionCount` accepts any string** — Validate against known regions. (`src/lib/listings-queries.ts`)
- [ ] **Add `loading="lazy"` to listing card images** — Below-fold grid images should lazy load. (`src/components/listings/listing-card.tsx`)
- [ ] **Gallery thumbnail buttons lack `aria-label`** — Screen readers can't distinguish thumbnails. (`src/routes/ilmoitukset/$listingId.tsx`)
- [ ] **Add `dir="ltr"` to `<html>`** — Explicit direction for i18n readiness. (`src/routes/__root.tsx`)
- [ ] **Homepage renders duplicate footer** — Both `index.tsx` and `__root.tsx` render footers.
