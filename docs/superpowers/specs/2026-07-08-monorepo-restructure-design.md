# Monorepo restructure — design

Date: 2026-07-08
Status: approved design, awaiting implementation plan
Companion spec: [2026-07-08-talli-mvp-design.md](2026-07-08-talli-mvp-design.md)

## Goal

Restructure the repo into a pnpm workspace monorepo so a second app, talli.motori.fi, can live beside motori.fi and share code, conventions, and the deploy pipeline. This project ships alone, before any talli code, with one deliberate behavior change (session cookie scope, see below) and no other user-visible change to motori.fi.

## Why now

talli.motori.fi (motorcycle owner companion app, see companion spec) was decided as a separate Dokku app on the same VPS, sharing accounts (SSO), the Postgres service, and the visual identity with motori.fi. Sharing that much through copy-paste would drift immediately. The restructure is done first, as its own project, so packaging decisions are shaped by a real second consumer instead of guesses.

## Decisions already made

| Decision | Choice |
|---|---|
| Accounts | Shared BetterAuth, SSO via cookie scoped to `.motori.fi` |
| Database | One Postgres service; motori owns `public` schema, talli owns `talli` schema |
| Repo shape | Full monorepo: `apps/` + `packages/` |
| Dokku build | Keep Heroku Node buildpack; dispatch on a `DEPLOY_APP` env var per Dokku app |
| Dev workflow | `pnpm dev` starts Postgres and both apps |

## Target layout

```
motori/                        (repo root, name unchanged)
├─ apps/
│  ├─ motori/                  src/, public/, vite.config.ts, playwright.config.ts,
│  │                           e2e/, package.json — the current app, moved
│  └─ talli/                   created in the talli MVP project, not here
├─ packages/
│  ├─ db/                      @motori/db
│  ├─ server/                  @motori/server
│  └─ ui/                      @motori/ui
├─ biome.json                  single root config
├─ tsconfig.base.json          apps and packages extend it by relative path
├─ Procfile                    generic, dispatches on $DEPLOY_APP
├─ app.json                    shared healthcheck config: startup check on /api/health,
│                              which both apps implement
├─ docker-compose.yml          one dev Postgres for both apps
├─ pnpm-workspace.yaml         gains the packages: [apps/*, packages/*] section
└─ .github/workflows/ci.yml
```

Deliberately not created: a `packages/auth` (auth folds into `@motori/server`, it is one dependency cluster with csrf/rate-limit/session) and a `packages/config` (root `tsconfig.base.json` and `biome.json` cover it). Split later only if a package grows fat.

## Packages

### @motori/db

- pg pool factory and Kysely instance factory (an app passes its schema config)
- migrator runner helper (wraps Kysely `Migrator`, parameterized by migration folder and migration table schema)
- BetterAuth table interfaces (`user`, `session`, `account`, `verification` — the camelCase tables both apps must see)
- Owner of nothing app-specific: motori's own table interfaces stay in `apps/motori`

### @motori/server

Server-side infrastructure both apps need:

- BetterAuth config factory plus session helpers (current `auth.ts`, `session.ts`). `trustedOrigins` must include `https://talli.motori.fi` so the shared cookie is accepted cross-subdomain.
- `csrf.ts`, `rate-limit.ts`, `require-verified-email.ts`. csrf currently validates `Origin` against `BETTER_AUTH_URL`; the shared version is parameterized so each app validates against its own canonical origin (talli's POSTs come from talli.motori.fi, not motori.fi).
- `security-headers.ts`, `nonce.ts`
- `log/` (pino + AsyncLocalStorage context, event catalog split so each app can extend it)
- email (Resend wrapper, `email-wrapper.ts`; app-specific templates stay in the apps)
- `image-storage.ts` (Hetzner/local storage drivers)

The SSR/client boundary rules from CLAUDE.md apply to this package: no `node:*` imports at module top level in anything a client bundle can reach.

### @motori/ui

- Tailwind theme preset and fonts
- shared components (`components/ui` primitives, toasts)
- `cn.ts`

What stays in `apps/motori`: routes, listings/bookings/messages/reviews domain code, motori's schema interfaces and migrations, e2e tests, i18n resources.

## Database and migrations

One Dokku Postgres service (`motori`), linked to both Dokku apps.

- motori owns the `public` schema including the BetterAuth tables. Its migrations move to `apps/motori` unchanged.
- talli will own a `talli` schema with its own migration folder and its own Kysely migration table (`migrationTableSchema: 'talli'`). Each app's release phase migrates only its own schema. The migration lock tables are separate, so concurrent deploys of the two apps cannot race each other.
- Hard rule: talli never migrates `public`. Cross-schema foreign keys (e.g. `talli.vehicle.user_id → public."user".id`) are allowed and used.
- `db:codegen` runs per app against its own schema.

## Deploy

- New Dokku app `talli` on the same VPS: `dokku apps:create talli`, `dokku postgres:link motori talli`, `dokku domains:add talli talli.motori.fi`, ports and nginx settings mirroring motori. The existing `*.motori.fi` Cloudflare origin cert already covers the subdomain.
- Both Dokku apps receive the full repo on push. Dispatch happens through one env var, in the root package.json scripts — the Procfile stays byte-identical (`web: pnpm start`, `release: pnpm db:migrate`), which keeps the pipeline working before, during, and after the cutover:

```
# root package.json
"build":      "pnpm --filter ${DEPLOY_APP:-motori} build",
"start":      "pnpm --filter ${DEPLOY_APP:-motori} start",
"db:migrate": "pnpm --filter ${DEPLOY_APP:-motori} db:migrate"

# one-time
dokku config:set motori DEPLOY_APP=motori
dokku config:set talli  DEPLOY_APP=talli
```

The `:-motori` default means everything also works locally and before the Dokku config exists.

- GHA deploy job pushes to both Dokku remotes after CI passes. Both apps redeploy on every merge to main. That is idempotent and acceptable at this scale; path-filtered deploys are a later optimization.
- Trade-off accepted: each app's build installs the whole workspace, so slugs are bigger and builds somewhat slower than a pruned Docker image. If this ever hurts, the escape hatch is per-app Dockerfiles (`dokku builder-dockerfile:set`), which was considered and deferred.
- Not viable and rejected: `dokku builder:set build-dir apps/<name>` — it excludes `packages/` and the root lockfile from the build context, which breaks workspace resolution.

## CI

Same jobs (lint, format, typecheck, test, e2e, build), run from the root across the workspace. No path filtering initially; every PR runs everything. The e2e job keeps motori's Playwright setup, now rooted at `apps/motori`; talli adds its own Playwright project in the MVP project. `.env.ci` stays in sync per app.

## Dev workflow

- `pnpm dev` at the root brings up the compose Postgres and runs both Vite dev servers concurrently: motori at :3000, talli at :3001, prefixed log output. Ctrl+C tears everything down, containers included (same trap pattern as today's `scripts/dev.sh`).
- Until `apps/talli` exists, `pnpm dev` runs just motori.
- Single-app runs remain available via `pnpm --filter motori dev`.
- The dev Postgres gets the `talli` schema created by talli's migrations; nothing needed in this project.

## The one behavior change: SSO cookie

SSO requires the BetterAuth session cookie to be scoped to `.motori.fi` (BetterAuth `crossSubDomainCookies`). This ships as the final step of this project so motori is SSO-ready before talli exists. Existing sessions survive (the cookie is re-set on the next request). This is the one item to explicitly smoke-test in prod: log in, verify the cookie domain, verify existing sessions still work.

## Acceptance

- Full CI green on the restructured repo.
- motori.fi deploys through the existing pipeline and serves identically (manual prod smoke test: front page, login, one listing flow).
- Session cookie is scoped to `.motori.fi` and existing sessions still work.
- `apps/talli` does not exist yet; the restructure merges alone.
- CLAUDE.md, DEPLOY.md, and the justfile are updated to match the new layout.

## Out of scope

- Any talli feature work (companion spec).
- Path-filtered CI or deploys.
- Dockerfile builds.
- Splitting `@motori/server` further.
