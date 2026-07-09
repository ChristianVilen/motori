# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- IMPORTANT: Whenever making any changes, always ensure CLAUDE.md stays up to date.
- Whenever you come up with an idea for how to improve CLAUDE.md, alert the human user and confirm if they want to add it
- When you correct me on the same thing twice, suggest a CLAUDE.md rule that would prevent it.
- If you spot anything in CLAUDE. md that's outdated or contradictory or useless, flag it to the human user for removal.

## Project

Motori is a P2P motorcycle rental noticeboard for Finland. Lean MVP — prefer minimal, direct solutions over abstractions and premature generalisation. UI copy is Finnish.

## Monorepo layout

pnpm workspace: `apps/*` are deployable apps, `packages/*` are shared libraries. Packages never import from apps.

- `apps/motori` — the app (routes, components, app-specific lib code, migrations)
- `apps/talli` — the motorcycle-owner companion app at talli.motori.fi (garage, maintenance log, reminders, digest). Runs on port 3001, owns the `talli` Postgres schema with its own migration table, mounts no auth routes (SSO via motori).
- `packages/db` (`@motori/db`) — `createDb`/`createMigrator` + BetterAuth table types
- `packages/server` (`@motori/server`) — server-only subpath exports: csrf, rate-limit, security-headers, nonce, log (incl. OpenObserve stream), email, email-wrapper, image-storage, password-strength, the `createAuth` factory, session
- `packages/ui` (`@motori/ui`) — `theme.css` design tokens + button/input/select/textarea + `cn`

## Commands

Always use `pnpm` (not npm/bun — lockfile is pnpm-lock.yaml).

- `pnpm dev` — one command (`scripts/dev.sh`) that brings up the dev stack (Postgres via docker compose) **and** runs every app under `apps/*` in parallel (`motori` at http://localhost:3000, `talli` at http://localhost:3001). **Ctrl+C stops everything**, containers included (a trap runs `docker compose down`). `pnpm dev:down` is a manual teardown if ever needed. To run a single app without the others: `pnpm --filter motori dev` (or `--filter talli`).
- `pnpm build` / `pnpm start` — dispatch to `pnpm --filter ${DEPLOY_APP:-motori} build|start` (root `package.json`). Defaults to the `motori` app so the Dokku Procfile/buildpack doesn't need to change; a future second app sets `DEPLOY_APP` on its own Dokku app config. Also regenerates `routeTree.gen.ts`.
- `pnpm typecheck` — fans out to every workspace package via `pnpm -r typecheck`
- `pnpm lint` / `pnpm lint:fix` — Biome, run repo-wide from the root (tabs, 100-col, strict rules incl. `noExplicitAny`, `noConsole` warn, `noNonNullAssertion`)
- `pnpm test` — fans out to every workspace package via `pnpm -r test` (Vitest). Run a single file inside the app: `pnpm --filter motori test -- path/to/file.test.ts`
- `pnpm test:e2e` / `pnpm test:e2e:ui` — dispatches to the `motori` app's Playwright config. Config auto-starts the dev server with `DISABLE_EMAIL_VERIFICATION=true`. `pnpm test:e2e:talli` runs talli's e2e suite.

Per-app scripts run via `pnpm --filter talli <script>` (`dev`, `build`, `db:migrate`, `test`, `test:e2e`), same as `--filter motori`.

### Database

Postgres 17 via `docker-compose up -d db` (port 5433, user/pass/db = `motori`). Copy `.env.example` → `.env`.

- `pnpm db:migrate` — dispatches to `pnpm --filter ${DEPLOY_APP:-motori} db:migrate`, which runs migrations in `apps/motori/src/lib/db/migrations/` (numbered `NNN_*.ts`, Kysely migrator from `@motori/db`)
- `pnpm db:seed` — dev seed (10 listings, single login user, wipe-and-reseed)
- `pnpm db:codegen` — regenerates `apps/motori/src/lib/db/schema.generated.ts` from live DB via `kysely-codegen`

After schema changes: add a new migration file, run `db:migrate`, then `db:codegen`.

`talli` shares motori's Postgres but owns only the `talli` schema and its own migration table — its migrator (`apps/talli/src/lib/db/migrate.ts`) passes `migrationTableSchema: "talli"` to `createMigrator` (`packages/db/src/migrator.ts`). It must never migrate against `public`, which belongs to `motori` (BetterAuth tables). talli's tables carry cross-schema FKs to `public."user"` by design (read-only joins; never mutate the auth tables from talli). Run talli's migrations with `DEPLOY_APP=talli pnpm db:migrate` or `pnpm --filter talli db:migrate`.

## Architecture

**Stack:** TanStack Start (SSR + file-based routing) + React 19 + Kysely (Postgres) + BetterAuth + Tailwind v4 + Hetzner Object Storage (S3-compatible, `hel1` region, via `@aws-sdk/client-s3`) + sharp (server-side image optimisation).

### Routing

File-based under `apps/motori/src/routes/`. `routeTree.gen.ts` is auto-generated — never edit. `__root.tsx` owns the HTML shell, nav, fonts, and 404 component. Dynamic segments use `$param` (e.g. `listings/$listingId.tsx`); the trailing-underscore variant `$listingId_.edit.tsx` is a sibling route, not nested.

Hydration signal: `__root.tsx` sets `data-hydrated="true"` on `<html>` after mount — e2e tests must wait for this before interacting, otherwise clicks fire before React attaches handlers and forms do native submits.

### SSR / client boundary

TanStack Start ships `apps/motori/src/start.ts`, `apps/motori/src/router.tsx`, and the route tree to **both** server and client bundles. `.server(...)` strips the _callback_ but **not module-top-level code or imports**.

- Never put `node:*` imports or `new`-constructed node primitives at module top level in any file the client can reach. Vite stubs `node:async_hooks` / `node:crypto` etc. to `{}` on the client, so `new AsyncLocalStorage()` becomes `new undefined()` and crashes hydration.
- If a server-only value (e.g. a per-request nonce) needs to flow into a shared module, lazy-import it inside the `.server` callback and expose it via a server-only side channel — guard registration with `if (typeof window === "undefined")`. See `packages/server/src/nonce.ts` for the pattern.
- Verify with `pnpm build` and `grep -l AsyncLocalStorage apps/motori/.output/public/assets/*.js` (or whatever node-only symbol you're worried about). The client chunks must not contain it.
- `pnpm dev` is not a substitute. Vite serves source modules differently in dev — a file that crashes the production client bundle can run fine under HMR.
- These rules apply equally to `@motori/server`: it's a set of standalone subpath exports (`./csrf`, `./log`, `./log/middleware`, …), never a barrel `index.ts` re-exporting everything. A barrel would let one node-only export (e.g. the pino/AsyncLocalStorage log module) drag the rest into any client trace that imports anything from the package.

**`build.rollupOptions.external` for `pg`.** `apps/motori/src/lib/auth.ts` imports `db` at module level (required by BetterAuth's Kysely adapter), and `session.ts` imports `auth` — so every route that checks the session transitively pulls `pg` into the client bundle trace. `apps/motori/vite.config.ts` marks `pg`, `pg-pool`, `pg-connection-string`, `pgpass`, and `split2` as external to suppress client-bundle warnings. This is safe because these packages are never valid client code. A future refactor of `auth.ts` to a lazy pattern (see GitHub issue) would eliminate the need for this config.

**CSP and inline scripts.** CSP is set in `packages/server/src/security-headers.ts`. Prod uses `script-src 'self' 'nonce-XXX'`; dev keeps `'unsafe-inline' 'unsafe-eval'` for Vite HMR + Zod v4. The per-request nonce is generated by `nonceMiddleware` (`packages/server/src/nonce.ts`, must run before `securityHeadersMiddleware`) and injected into TanStack's emitted scripts via `createRouter({ ssr: { nonce } })`. Every additional inline `<script>` in `__root.tsx` must read the nonce from `router.options.ssr?.nonce`. Smoke-test changes with `pnpm build && node apps/motori/.output/server/index.mjs` and check DevTools for CSP violations — dev's `unsafe-inline` fallback hides prod-only breakage.

**Route head metadata.** Entries in `head().meta[]` are already rendered as `<meta>` — don't pass `tagName: "meta"`, it leaks as a DOM attribute and triggers React's "unknown prop" warning. Use `tagName` only for non-meta tags that need to live in `<head>` (e.g. `link`).

### Database layer (`apps/motori/src/lib/db/`)

`@motori/db` (`packages/db/`) provides the reusable pieces — `createDb` (Kysely + `pg` pool factory) and `createMigrator` — plus the BetterAuth table type definitions. The app-specific schema stays in the app:

- `schema.ts` — hand-written Kysely table interfaces and the `Database` union. This is the source of truth for queries (not `schema.generated.ts`, which is a codegen snapshot for inspection).
- BetterAuth tables use **camelCase** columns (externally dictated). App tables use **snake_case**.
- `updated_at` DB defaults fire only on INSERT — every UPDATE must explicitly set `updated_at: new Date()` in application code. Exception: fire-and-forget increments (e.g. `view_count`) where bumping `updated_at` would pollute sort order or sitemap `lastmod`.
- Money is stored as EUR **cents** (integer).
- `listing.search_vector` is a `tsvector` maintained by a DB trigger; never write to it from app code.
- `Generated<T>` columns (e.g. booleans with DB defaults, `view_count`) must be omitted on insert to use the default.

### Auth

BetterAuth with Kysely adapter. The config itself is a factory, `createAuth` (`packages/server/src/auth.ts`), parameterised over `db` and the two email-sending callbacks; the app wires it up in `apps/motori/src/lib/auth.ts` (passes `db` and Resend-backed senders) and `apps/motori/src/lib/auth-client.ts` (client). Auth routes mounted under `apps/motori/src/routes/api/auth/`. Email verification can be disabled via `DISABLE_EMAIL_VERIFICATION=true` (used by Playwright).

The session cookie is scoped to `.motori.fi` in prod (`crossSubDomainCookies` in `createAuth`, disabled on localhost where subdomains don't apply) so the `talli.motori.fi` app shares the login (SSO). `trustedOrigins` includes `talli.motori.fi` / `localhost:3001` alongside the primary origin. talli mounts no auth routes of its own — it links to motori for sign-in/sign-up and relies on the shared cookie.

### Security

Every POST `createServerFn` must include, in order:

1. `csrfMiddleware()` — validates the `Origin` header against `APP_ORIGIN ?? BETTER_AUTH_URL` (see `packages/server/src/csrf.ts`). `APP_ORIGIN` lets a non-auth-hosting app validate against its own origin instead of the one BetterAuth uses.
2. `rateLimitMiddleware(max, windowSec, prefix)` — per-IP fixed-window limiter (see `packages/server/src/rate-limit.ts`).
3. `requireVerifiedEmail()` where the action requires a verified account.

Enum/union inputs from the client (status, role, type, etc.) must be runtime-validated in the `inputValidator` — TypeScript types are erased at runtime and provide no protection against crafted requests.

Image URLs stored in listings must be validated against `STORAGE_PUBLIC_URL` when the env var is configured.

### SEO / canonical URLs

`SITE_URL` in `apps/motori/src/lib/constants.ts` is derived from `BETTER_AUTH_URL` — no separate env var. All canonical links, `og:url`, and sitemap entries use this constant.

### Storage

Hetzner Object Storage (S3-compatible, `hel1`). The project has two buckets, sharing one set of project-wide access keys: **`motori-images`** — the app's `STORAGE_BUCKET`, which must have **public read** access so objects are served directly via `STORAGE_PUBLIC_URL`; and **`motori-backups`** — **private**, holding the encrypted nightly Postgres backups (see `DEPLOY.md` §8). Never store non-public data in `motori-images`. Env vars: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL`.

Image uploads go through `POST /api/images/upload` — the server receives the file, optimises it with sharp (1600px main WebP + 400px thumbnail WebP), and stores both via `optimizeAndUpload()` from `@motori/server/image-storage` (`packages/server/src/image-storage.ts`). When `STORAGE_ENDPOINT` is set, `HetznerStorage` is used; otherwise `LocalStorage` saves to `/uploads/` for dev. Image URLs are validated against `STORAGE_PUBLIC_URL` (or `/api/uploads/` in dev) in `isValidImageUrl()`.

### Logging

The pino core lives in `packages/server/src/log/` (`pino.ts` root logger + OpenObserve sink, `context.ts` AsyncLocalStorage-based `withLogContext`, `middleware.ts` for `loggingMiddleware`), exposed via the `@motori/server/log`, `@motori/server/log/pino`, `@motori/server/log/context`, `@motori/server/log/middleware` subpath exports. The app wraps it with its own typed logger at `apps/motori/src/lib/log/index.ts`, pairing `createLog()` with the app's event catalog in `apps/motori/src/lib/log/events.ts`.

Structured logging via pino with AsyncLocalStorage context (`withLogContext`) — request-scoped bindings flow through without passing a logger. Use `log.info/warn/error/debug` for free-form, `log.event(name, fields)` for the typed event catalog in `events.ts`. Do not `console.log` (Biome warns). `loggingMiddleware` (registered in `apps/motori/src/start.ts`) binds `requestId`/`method`/`path` per request and logs each request's `status`+`durationMs` (>1000ms at `warn`). `getRequestId()` reads the current request's id from the log context; it's rendered on 500 pages (`__root.tsx` errorComponent) so bug reports can be correlated.

Logs optionally ship to a self-hosted **OpenObserve** instance: when `OPENOBSERVE_URL` is set, `createRootLogger` (`packages/server/src/log/pino.ts`) adds an in-process `pino.multistream` sink (`packages/server/src/log/openobserve-stream.ts`) that batches records and POSTs them to OO's native JSON ingest, alongside the unchanged stdout sink. The sink is best-effort — if OO is down the app is unaffected and Dokku stdout remains the durable log source. PII redaction applies to the OO sink too (it runs in the pino core before any stream). Deploy/runbook: `DEPLOY.md` §11. Traces (Phase 2) and metrics (Phase 3) are tracked as GitHub issues.

## GitHub

Use the `gh` CLI for all GitHub interactions — never open the web UI for things `gh` can do.

**Issues** are the feature backlog and bug tracker. Labels: `bug`, `enhancement`, `p1`, `p2`, `auth`, `i18n`, `deferred`. Common commands:

- `gh issue list` — browse open issues
- `gh issue list -l p1` — filter by label
- `gh issue create --title "..." --label enhancement,p2` — open a new issue
- `gh issue view <number>` — read an issue with full body

**CI** runs on every PR and push to `main` (`.github/workflows/ci.yml`). Four parallel jobs: `lint`, `format`, `typecheck`, `test` (unit). Plus an `e2e` job sharded 2-way that spins up a Postgres 17 service container, runs migrations, builds, then runs Playwright against Chromium and WebKit. E2e failures upload a `playwright-report` artifact (7-day retention). CI uses `.env.ci` (not `.env.example`) — keep that file in sync when adding required env vars.

## Conventions

- Minimal comments. Only write a comment when the WHY is non-obvious (hidden constraint, subtle invariant, workaround). The existing `schema.ts` and `__root.tsx` show the style.
- No premature abstraction; three similar lines beats a helper.
- Production deploy runbook: `DEPLOY.md`. Design specs and implementation plans produced via the superpowers skills go under `docs/superpowers/` (specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`).
- Commits: no `Co-Authored-By` lines.
- Issues and feature tracking: GitHub Issues on this repo (labels: `bug`, `enhancement`, `p1`, `p2`, `auth`, `i18n`). Use `gh issue list` to browse, `gh issue create` to add new ones.
- Dont consider your work done, until all tests, format, lint and build pass

### talli domain rules

- Domain term is `vehicle` (schema table, column names), **not** bike/motorcycle. `vehicle_type` defaults to `'motorcycle'`; cars come later.
- No katsastus: motorcycles are exempt from periodic inspection in Finland, so there is no inspection reminder. Date-reminder presets are **vakuutus** (insurance) and **ajoneuvovero** (vehicle tax) only.
- UI copy is Finnish (same as motori).
