# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vuokramoto is a P2P motorcycle rental noticeboard for Finland. Lean MVP — prefer minimal, direct solutions over abstractions and premature generalisation. UI copy is Finnish.

## Commands

Always use `pnpm` (not npm/bun — lockfile is pnpm-lock.yaml).

- `pnpm dev` — Vite dev server at http://localhost:3000
- `pnpm build` / `pnpm start` — production build and node server
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` / `pnpm lint:fix` — Biome (tabs, 100-col, strict rules incl. `noExplicitAny`, `noConsole` warn, `noNonNullAssertion`)
- `pnpm test` — Vitest (unit). Run a single file: `pnpm vitest run path/to/file.test.ts`
- `pnpm test:e2e` / `pnpm test:e2e:ui` — Playwright. Config auto-starts dev server with `DISABLE_EMAIL_VERIFICATION=true`.

### Database

Postgres 17 via `docker-compose up -d db` (port 5433, user/pass/db = `vuokramoto`). Copy `.env.example` → `.env`.

- `pnpm db:migrate` — runs migrations in `src/lib/db/migrations/` (numbered `NNN_*.ts`, Kysely migrator)
- `pnpm db:seed` — dev seed (10 listings, single login user, wipe-and-reseed)
- `pnpm db:codegen` — regenerates `src/lib/db/schema.generated.ts` from live DB via `kysely-codegen`

After schema changes: add a new migration file, run `db:migrate`, then `db:codegen`.

## Architecture

**Stack:** TanStack Start (SSR + file-based routing) + React 19 + Kysely (Postgres) + BetterAuth + Tailwind v4 + Hetzner Object Storage (S3-compatible, `hel1` region, via `@aws-sdk/client-s3`).

### Routing

File-based under `src/routes/`. `routeTree.gen.ts` is auto-generated — never edit. `__root.tsx` owns the HTML shell, nav, fonts, and 404 component. Dynamic segments use `$param` (e.g. `listings/$listingId.tsx`); the trailing-underscore variant `$listingId_.edit.tsx` is a sibling route, not nested.

Hydration signal: `__root.tsx` sets `data-hydrated="true"` on `<html>` after mount — e2e tests must wait for this before interacting, otherwise clicks fire before React attaches handlers and forms do native submits.

### Database layer (`src/lib/db/`)

- `schema.ts` — hand-written Kysely table interfaces and the `Database` union. This is the source of truth for queries (not `schema.generated.ts`, which is a codegen snapshot for inspection).
- BetterAuth tables use **camelCase** columns (externally dictated). App tables use **snake_case**.
- `updated_at` DB defaults fire only on INSERT — every UPDATE must explicitly set `updated_at: new Date()` in application code. Exception: fire-and-forget increments (e.g. `view_count`) where bumping `updated_at` would pollute sort order or sitemap `lastmod`.
- Money is stored as EUR **cents** (integer).
- `listing.search_vector` is a `tsvector` maintained by a DB trigger; never write to it from app code.
- `Generated<T>` columns (e.g. booleans with DB defaults, `view_count`) must be omitted on insert to use the default.

### Auth

BetterAuth with Kysely adapter. `src/lib/auth.ts` (server) and `src/lib/auth-client.ts` (client). Auth routes mounted under `src/routes/api/auth/`. Email verification can be disabled via `DISABLE_EMAIL_VERIFICATION=true` (used by Playwright).

### Security

Every POST `createServerFn` must include `csrfMiddleware()` as its first middleware entry (see `src/lib/csrf.ts`). It validates the `Origin` header against `BETTER_AUTH_URL`. Omitting it leaves the function open to cross-site request forgery.

### SEO / canonical URLs

`SITE_URL` in `src/lib/constants.ts` is derived from `BETTER_AUTH_URL` — no separate env var. All canonical links, `og:url`, and sitemap entries use this constant.

### Storage

Hetzner Object Storage (S3-compatible). Env vars: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL`. Configured in `src/lib/storage.ts`.

### Logging (`src/lib/log/`)

Structured logging via pino with AsyncLocalStorage context (`withLogContext`) — request-scoped bindings flow through without passing a logger. Use `log.info/warn/error/debug` for free-form, `log.event(name, fields)` for the typed event catalog in `events.ts`. Do not `console.log` (Biome warns).

## GitHub

Use the `gh` CLI for all GitHub interactions — never open the web UI for things `gh` can do.

**Issues** are the feature backlog and bug tracker. Labels: `bug`, `enhancement`, `p1`, `p2`, `auth`, `i18n`, `deferred`. Common commands:
- `gh issue list` — browse open issues
- `gh issue list -l p1` — filter by label
- `gh issue create --title "..." --label enhancement,p2` — open a new issue
- `gh issue view <number>` — read an issue with full body

**CI** runs on every PR and push to `main` (`.github/workflows/ci.yml`). Four parallel jobs: `lint`, `format`, `typecheck`, `test` (unit). Plus an `e2e` job sharded 2-way that spins up a Postgres 17 service container, runs migrations, builds, then runs Playwright against Chromium and WebKit. E2e failures upload a `playwright-report` artifact (7-day retention). CI uses `.env.ci` (not `.env.example`) — keep that file in sync when adding required env vars.

**Dependabot** auto-merges patch/minor dependency bumps (`dependabot-auto-merge.yml`) when CI passes.

## Conventions

- Minimal comments. Only write a comment when the WHY is non-obvious (hidden constraint, subtle invariant, workaround). The existing `schema.ts` and `__root.tsx` show the style.
- No premature abstraction; three similar lines beats a helper.
- Project reference (tech stack, data model, architecture, design) lives in `PROJECT.md` at repo root. Design specs and implementation plans produced via the superpowers skills go under `docs/superpowers/` (specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`).
- Commits: no `Co-Authored-By` lines.
- Issues and feature tracking: GitHub Issues on this repo (labels: `bug`, `enhancement`, `p1`, `p2`, `auth`, `i18n`). Use `gh issue list` to browse, `gh issue create` to add new ones. `PROJECT.md` is reference material only — not a task list.
