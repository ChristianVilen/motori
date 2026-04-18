# Localization — Design

**Date:** 2026-04-18
**Status:** Approved (pending user review of written spec)

## Goal

Introduce a type-safe, SSR-correct localization layer to Vuokramoto. Finnish only today, but structured so English (and others) can be added without a rewrite. Optimize for Finnish SEO from day one.

## Decisions (locked during brainstorm)

| Decision | Choice |
|---|---|
| Languages today | Finnish only; code structured for expansion |
| Scope of translation | UI strings only; user-generated content stays as-typed |
| Library | `react-i18next` + `i18next`; type-safety via module augmentation |
| Locale detection | URL path. `/` = `fi` (default, no prefix); future `/en/...` = `en` |
| URL shape | Finnish path segments now (e.g. `/ilmoitukset`); English via prefix + path-mapping layer when EN ships |
| SEO | `hreflang` (`fi`, `x-default`) + `<html lang>` + `og:locale` emitted from day one |
| `/api/*` | Stays English always — not part of localized routing |

## Architecture

### Module layout

```
src/lib/i18n/
  index.ts              # re-exports: useTranslation, Trans, t helpers
  server.ts             # createI18n(locale) — per-request instance
  client.ts             # browser singleton, hydrates from window.__I18N__
  format.ts             # formatEur(cents), formatDate(date, opts)
  react-i18next.d.ts    # module augmentation → typed keys
  resources/
    index.ts            # { fi: { common, home, listings, auth, profile } } as const
    fi/
      common.ts         # nav, buttons, generic errors, 404
      home.ts           # landing page copy
      listings.ts       # browse, detail, create, edit
      auth.ts           # login, register, verify, complete-profile
      profile.ts        # dashboard, settings
```

- Each namespace is a plain TS file: `export default { ... } as const;`.
- `resources/index.ts` aggregates with `as const`, giving literal types end-to-end.

### Type-safety

```ts
// src/lib/i18n/react-i18next.d.ts
import type { resources } from "./resources";

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: typeof resources.fi;
  }
}
```

`useTranslation('listings')` returns a `t()` whose keys are autocompleted and typo-checked. Unknown keys are a TS error.

### SSR + client lifecycle

- **Server (`src/lib/i18n/server.ts`)** exports `createI18n(locale)` which calls `i18next.createInstance()`, preloads the requested locale's namespaces, and returns the instance. Per-request instance → no cross-request state leaks.
- **Client (`src/lib/i18n/client.ts`)** bootstraps a module-scope singleton from the SSR-injected `window.__I18N__` payload (language + resources). Subsequent navigations call `i18n.changeLanguage()` if the locale changes.
- **Provider:** `<I18nextProvider i18n={i18n}>` wraps `<RouterProvider>` in `__root.tsx`.

### Locale detection

- In `__root.tsx`'s `beforeLoad`, parse `location.pathname`. If it starts with `/en/`, `locale = 'en'`; otherwise `locale = 'fi'`.
- Store `locale` on the router context so every route, loader, and server function reads the same value.
- No Accept-Language sniffing — opt-in via explicit URL. Prevents the classic "Google sees mixed languages on one URL" SEO problem.

### SEO integration

Emitted from `__root.tsx`'s `<head>` on every request:

- `<html lang={locale}>`
- `<link rel="alternate" hreflang="fi" href="{origin}{fiPath}">`
- `<link rel="alternate" hreflang="x-default" href="{origin}{fiPath}">`
- Future: `<link rel="alternate" hreflang="en" href="{origin}/en{enPath}">` once EN catalog exists. Driven off `supportedLngs` — no manual plumbing.
- `<meta property="og:locale" content="fi_FI">` (or `en_US` later).

### Route renames (Finnish file-based routes)

Route files/directories under `src/routes/` are renamed to their Finnish equivalents. Proposed map (final names confirmed during implementation):

| Current | Renamed |
|---|---|
| `routes/listings/` | `routes/ilmoitukset/` |
| `routes/listings/index.tsx` | `routes/ilmoitukset/index.tsx` |
| `routes/listings/new.tsx` | `routes/ilmoitukset/uusi.tsx` |
| `routes/listings/$listingId.tsx` | `routes/ilmoitukset/$listingId.tsx` |
| `routes/listings/$listingId_.edit.tsx` | `routes/ilmoitukset/$listingId_.muokkaa.tsx` |
| `routes/profile/index.tsx` | `routes/profiili/index.tsx` |
| `routes/auth/login.tsx` | `routes/kirjaudu.tsx` |
| `routes/auth/register.tsx` | `routes/rekisteroidy.tsx` |
| `routes/auth/verify-email.tsx` | `routes/vahvista-sahkoposti.tsx` |
| `routes/auth/complete-profile.tsx` | `routes/taydenna-profiili.tsx` |
| `routes/api/**` | **unchanged** — APIs stay English |

All `Link` usages, `redirect()` targets, BetterAuth redirect URLs, and Playwright selectors that hit these paths are updated in the same pass.

### Formatting helpers (`format.ts`)

Thin wrappers over `Intl.*`, using the active locale:

- `formatEur(cents: number) → string` — `"45,00 €"` in `fi-FI`.
- `formatDate(d: Date, opts?: Intl.DateTimeFormatOptions) → string`.

Replaces any existing ad-hoc formatting in components.

## Migration scope

### In scope

1. Add `i18next` + `react-i18next` deps; create `src/lib/i18n/` module per layout above.
2. Wire per-request `createI18n` on server, hydrate client singleton, mount `<I18nextProvider>` in `__root.tsx`.
3. Locale detection in root `beforeLoad`; expose on router context.
4. Rename route files/dirs to Finnish per the table above; update all internal links, redirects, and e2e tests.
5. Extract every hardcoded Finnish string from `src/routes/**` and `src/components/**` into the catalog; replace with `t()`.
6. Emit `hreflang`, `<html lang>`, and `og:locale` in `__root.tsx` head.
7. Introduce `formatEur` / `formatDate`; replace ad-hoc formatting.
8. Update affected Playwright tests (URL changes; visible Finnish text unchanged).

### Explicitly out of scope (tracked in `BACKLOG.md`)

- Language switcher UI component.
- English catalog (`resources/en/*`) and `/en/*` routes.
- Path-mapping layer for localized URLs across locales (defer to when EN ships — likely a `{ fi: { listings: 'ilmoitukset' }, en: { listings: 'listings' } }` manifest + server rewrite + `localizedPath()` link helper).
- Translation of user-generated content (listing titles, descriptions, city names typed by owners).
- Pluralization, ICU messages, gender rules.
- Translation management tooling (Lokalise, Crowdin, etc.).
- Server-side redirects from old English route paths to new Finnish paths. (Site isn't live publicly — no existing inbound links to preserve. If this changes before launch, add a redirect pass.)

## Risks / call-outs

- **BetterAuth redirect URLs** — login/callback/verify redirects reference `/auth/*` today. These must be updated atomically with the route rename and OAuth provider console settings reviewed.
- **`routeTree.gen.ts`** regenerates automatically on dev/build, but stale cached builds can confuse. Delete and regenerate during the rename.
- **Hardcoded links** — grep for `/listings`, `/profile`, `/auth/` across the codebase (excluding `/api/`) before declaring the rename done.
- **SSR hydration mismatch** — the server-injected resources must exactly match what the client loads. Keep the resource set small and serialize only the active locale's namespaces.

## Verification

- `pnpm typecheck` — passes; any typo in a `t()` key is a TS error.
- `pnpm lint` — passes.
- `pnpm test` — passes.
- `pnpm test:e2e` — all flows green against renamed URLs.
- Manual: view source on `/`, confirm `<html lang="fi">`, `hreflang` links present, `og:locale` present.
- Manual: no visible English UI strings remaining (nav, buttons, forms, errors, 404).
