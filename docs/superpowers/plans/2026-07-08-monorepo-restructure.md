# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo into a pnpm workspace monorepo (`apps/motori` + `packages/db|server|ui`) so talli.motori.fi can be built beside motori.fi, shipping alone with zero user-visible change except the SSO cookie scope.

**Architecture:** Move the whole app into `apps/motori` first (everything stays green), then extract three source-only workspace packages one at a time, each behind its own commit and full verification. Deploy keeps the Heroku Node buildpack; root scripts dispatch on `${DEPLOY_APP:-motori}` so the existing Procfile keeps working before and after the Dokku config change.

**Tech Stack:** pnpm workspaces, TanStack Start, Kysely, BetterAuth, Biome, Vitest, Playwright, Dokku (Heroku Node buildpack).

**Spec:** `docs/superpowers/specs/2026-07-08-monorepo-restructure-design.md`

**Ground rules for every task:**
- Packages are source-only: `exports` point at `.ts` files, no build step. Vite/tsx compile them.
- Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before every commit (the repo convention: work isn't done until format, lint, tests, and build pass).
- macOS sed: use `sed -i ''`. Verify every sed with a grep afterwards — a sed that matches nothing is a silent failure.
- Never edit `routeTree.gen.ts` (generated) or `schema.generated.ts` (codegen snapshot).
- Commits: no Co-Authored-By lines.

---

### Task 1: Branch and workspace scaffolding

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Branch off main**

```bash
git checkout main
git pull
git checkout -b monorepo-restructure
```

- [ ] **Step 2: Declare workspace packages**

`pnpm-workspace.yaml` currently only holds build settings. Add the `packages` key at the top, keep everything else:

```yaml
packages:
  - apps/*
  - packages/*
onlyBuiltDependencies:
  - sharp
allowBuilds:
  esbuild: false
enableScripts: true
savePrefix: ''
minimumReleaseAge: 1440
```

- [ ] **Step 3: Create the shared tsconfig base**

Create `tsconfig.base.json` (current `tsconfig.json` minus `paths`, which is app-specific):

```json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"moduleResolution": "Bundler",
		"module": "ESNext",
		"target": "ES2022",
		"skipLibCheck": true,
		"strictNullChecks": true
	}
}
```

Do NOT delete the root `tsconfig.json` yet — the app still lives at the root until Task 2.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml tsconfig.base.json
git commit -m "chore: declare pnpm workspace packages and shared tsconfig base"
```

---

### Task 2: Move the app to apps/motori

The big mechanical move. Nothing is extracted yet; the app must be exactly as green afterwards as before.

**Files:**
- Move: `src/`, `public/`, `e2e/`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `components.json`, `.env.example`, `.env.ci` → `apps/motori/`
- Create: `apps/motori/package.json`
- Modify: root `package.json`, `biome.json`, `.gitignore`, `scripts/dev.sh`
- Unchanged on purpose: `Procfile`, `app.json`, `docker-compose.yml`, `justfile`, `infra/`, `secrets/`

- [ ] **Step 1: git mv the app**

```bash
mkdir -p apps/motori
git mv src public e2e vite.config.ts vitest.config.ts playwright.config.ts tsconfig.json components.json .env.example .env.ci apps/motori/
```

- [ ] **Step 2: Move your local .env (untracked, manual)**

```bash
mv .env apps/motori/.env 2>/dev/null || true
```

- [ ] **Step 3: Write apps/motori/package.json**

All current runtime deps/devDeps move here except `@biomejs/biome` (root-only). Scripts lose the `bash scripts/dev.sh` indirection (`dev` is plain `vite dev`; orchestration stays at root):

```json
{
	"name": "motori",
	"private": true,
	"type": "module",
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"start": "node --env-file-if-exists=.env .output/server/index.mjs",
		"db:migrate": "tsx --env-file-if-exists=.env src/lib/db/migrate.ts",
		"db:seed": "tsx --env-file-if-exists=.env src/lib/db/seed.ts",
		"db:codegen": "tsx --env-file-if-exists=.env src/lib/db/codegen.ts",
		"notify:expiry": "tsx --env-file-if-exists=.env src/lib/notify-expiry.ts",
		"purge:sessions": "tsx --env-file-if-exists=.env src/lib/purge-sessions.ts",
		"typecheck": "tsc --noEmit",
		"test": "vitest run",
		"test:e2e": "playwright test",
		"test:e2e:ui": "playwright test --ui"
	},
	"dependencies": {},
	"devDependencies": {}
}
```

Copy the `dependencies` and `devDependencies` blocks verbatim from the current root `package.json`, minus `@biomejs/biome` (all exact versions, the repo pins with `savePrefix: ''`).

- [ ] **Step 4: Rewrite the root package.json**

The root keeps the workspace-wide scripts, engines, packageManager, and Biome. The name must change — pnpm can't have two packages named `motori`:

```json
{
	"name": "motori-workspace",
	"private": true,
	"packageManager": "pnpm@10.33.0",
	"engines": {
		"node": "24.x",
		"pnpm": "10.33.0"
	},
	"type": "module",
	"scripts": {
		"dev": "bash scripts/dev.sh",
		"dev:down": "docker compose down",
		"build": "pnpm --filter ${DEPLOY_APP:-motori} build",
		"start": "pnpm --filter ${DEPLOY_APP:-motori} start",
		"db:migrate": "pnpm --filter ${DEPLOY_APP:-motori} db:migrate",
		"db:seed": "pnpm --filter motori db:seed",
		"db:codegen": "pnpm --filter motori db:codegen",
		"notify:expiry": "pnpm --filter motori notify:expiry",
		"purge:sessions": "pnpm --filter motori purge:sessions",
		"typecheck": "pnpm -r typecheck",
		"lint": "biome check .",
		"lint:fix": "biome check --write .",
		"format": "biome format .",
		"format:fix": "biome format --write .",
		"test": "pnpm -r test",
		"test:e2e": "pnpm --filter motori test:e2e",
		"test:e2e:ui": "pnpm --filter motori test:e2e:ui"
	},
	"devDependencies": {
		"@biomejs/biome": "2.4.11"
	}
}
```

Why `${DEPLOY_APP:-motori}`: the Procfile (`web: pnpm start`, `release: pnpm db:migrate`) and buildpack (`pnpm run build`) run these root scripts on Dokku. The env var selects the app per Dokku app; the default keeps everything working locally and before the Dokku config exists. POSIX expansion — works under both `sh` (Dokku) and pnpm's shell.

- [ ] **Step 5: Point apps/motori/tsconfig.json at the base**

Replace `apps/motori/tsconfig.json` content with:

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"paths": {
			"~/*": ["./src/*"]
		}
	}
}
```

The `~` alias in `vite.config.ts` and `vitest.config.ts` uses `import.meta.dirname` — already correct after the move, no edit needed.

- [ ] **Step 6: Fix biome.json and .gitignore path patterns**

In `biome.json` `files.includes`, the root-relative ignores must become recursive:

```json
"!!**/routeTree.gen.ts",
"!!**/.claude",
"!!**/dist",
"!!**/.output",
"!!**/e2e/.auth",
"!!**/e2e/.test-results",
"!!**/playwright-report"
```

In `.gitignore`, prefix the same kind of entries with `**/` where they're root-anchored (check with `cat .gitignore`; typical entries: `.output`, `playwright-report`, `e2e/.auth`, `e2e/.test-results`, `.env`). Verify nothing tracked becomes ignored: `git status` should show only expected changes.

- [ ] **Step 7: Update scripts/dev.sh to run all apps**

Per the spec, `pnpm dev` starts Postgres and every app (today that's just motori; talli joins automatically later):

```bash
#!/usr/bin/env bash
# `pnpm dev` entrypoint: bring up the dev stack (Postgres) and run the dev
# server of every app in apps/* in the foreground, with prefixed output.
# Ctrl+C stops the dev servers AND tears the containers down.
set -euo pipefail

cleanup() {
	trap - EXIT INT TERM
	echo
	echo "→ stopping dev stack (docker compose down)…"
	docker compose down
}
trap cleanup EXIT INT TERM

docker compose up -d
pnpm --parallel --filter './apps/*' dev
```

- [ ] **Step 8: Reinstall and verify everything**

```bash
pnpm install
git add pnpm-lock.yaml
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: lockfile reshuffles to workspace layout; all four commands pass. `pnpm build` must produce `apps/motori/.output/`.

- [ ] **Step 9: Verify the client bundle is still node-free**

```bash
grep -l AsyncLocalStorage apps/motori/.output/public/assets/*.js || echo CLEAN
```

Expected: `CLEAN`.

- [ ] **Step 10: Run e2e locally**

```bash
docker compose up -d
pnpm --filter motori db:migrate
pnpm test:e2e
```

Expected: all Playwright projects pass (webServer builds+starts from `apps/motori`).

- [ ] **Step 11: Smoke-test pnpm dev**

Run `pnpm dev`, confirm motori serves at http://localhost:3000, Ctrl+C stops the containers (`docker ps` shows no `db`).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: move app to apps/motori as pnpm workspace member"
```

---

### Task 3: Extract @motori/db

Shared Kysely/pg plumbing plus the BetterAuth table interfaces both apps must see.

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`, `packages/db/src/client.ts`, `packages/db/src/migrator.ts`, `packages/db/src/betterauth-tables.ts`
- Modify: `apps/motori/src/lib/db/index.ts`, `apps/motori/src/lib/db/schema.ts`, `apps/motori/src/lib/db/migrate.ts`, `apps/motori/package.json`

- [ ] **Step 1: Scaffold the package**

`packages/db/package.json`:

```json
{
	"name": "@motori/db",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts"
	},
	"scripts": {
		"typecheck": "tsc --noEmit"
	},
	"dependencies": {
		"kysely": "0.28.17",
		"pg": "8.20.0"
	},
	"devDependencies": {
		"@types/pg": "8.20.0",
		"typescript": "6.0.2"
	}
}
```

`packages/db/tsconfig.json`:

```json
{
	"extends": "../../tsconfig.base.json",
	"include": ["src"]
}
```

- [ ] **Step 2: Move the client factory**

`packages/db/src/client.ts` — generalize the current `apps/motori/src/lib/db/index.ts` into a factory (keep the browser guard comment and behavior exactly):

```ts
import { Kysely, PostgresDialect } from "kysely";

// pg uses Buffer (Node-only). Guard the import so this file is safe to
// evaluate in client bundles — the await import("pg") branch is dead code
// for browser builds (Rollup replaces typeof window with "object").
export async function createDb<DB>(): Promise<Kysely<DB>> {
	if (typeof window !== "undefined") {
		return null as unknown as Kysely<DB>;
	}
	const { default: pg } = await import("pg");
	return new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({
				connectionString: process.env.DATABASE_URL,
				max: 20,
				idleTimeoutMillis: 30_000,
				connectionTimeoutMillis: 5_000,
			}),
		}),
	});
}
```

`apps/motori/src/lib/db/index.ts` becomes:

```ts
import { createDb } from "@motori/db";
import type { Kysely } from "kysely";
import type { Database } from "./schema";

export const db: Kysely<Database> = await createDb<Database>();
```

- [ ] **Step 3: Move the BetterAuth table interfaces**

Cut `UserTable`, `SessionTable`, `AccountTable`, `VerificationTable` (lines ~8–57 of `apps/motori/src/lib/db/schema.ts`) into `packages/db/src/betterauth-tables.ts` verbatim, including their comments. In `schema.ts`, replace them with:

```ts
import type {
	AccountTable,
	SessionTable,
	UserTable,
	VerificationTable,
} from "@motori/db";

export type { AccountTable, SessionTable, UserTable, VerificationTable };
```

Keep the `DbUser`/`DbSession`/`DbAccount`/`DbVerification` `Selectable<...>` aliases in `schema.ts` (they're app-side convenience types) and keep the `Database` union referencing the imported interfaces. Nothing else in `schema.ts` moves.

- [ ] **Step 4: Add the migrator helper**

`packages/db/src/migrator.ts` — parameterized for the talli schema later (`migrationTableSchema`):

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { FileMigrationProvider, type Kysely, Migrator } from "kysely";

export function createMigrator(opts: {
	// biome-ignore lint/suspicious/noExplicitAny: Migrator is schema-agnostic
	db: Kysely<any>;
	migrationFolder: string;
	migrationTableSchema?: string;
}): Migrator {
	return new Migrator({
		db: opts.db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: opts.migrationFolder,
		}),
		...(opts.migrationTableSchema ? { migrationTableSchema: opts.migrationTableSchema } : {}),
	});
}
```

Update `apps/motori/src/lib/db/migrate.ts` to use it — replace the inline `new Migrator({...})` block with:

```ts
const migrator = createMigrator({
	db,
	migrationFolder: path.join(__dirname, "migrations"),
});
```

adding `import { createMigrator } from "@motori/db";` and dropping the now-unused `FileMigrationProvider`/`Migrator`/`fs` imports.

- [ ] **Step 5: Barrel and wire up**

`packages/db/src/index.ts`:

```ts
export * from "./betterauth-tables";
export { createDb } from "./client";
export { createMigrator } from "./migrator";
```

```bash
pnpm --filter motori add '@motori/db@workspace:*'
pnpm install
```

- [ ] **Step 6: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
grep -l AsyncLocalStorage apps/motori/.output/public/assets/*.js || echo CLEAN
docker compose up -d && pnpm --filter motori db:migrate
```

Expected: all pass, `CLEAN`, migrate reports "no pending migrations".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: extract @motori/db workspace package"
```

---

### Task 4: Extract @motori/server — request infra (log, csrf, rate-limit, headers, nonce)

@motori/server uses **subpath exports only** (no barrel). Reason: a barrel re-exporting node-touching modules (pino, sharp deps, resend) would drag them into any client bundle trace that imports one shared helper — the exact failure mode the CLAUDE.md SSR rules exist to prevent. Subpaths keep today's module boundaries byte-for-byte.

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`, `packages/server/vitest.config.ts`
- Move: `apps/motori/src/lib/{csrf.ts,rate-limit.ts,rate-limit.test.ts,security-headers.ts,nonce.ts}` and `apps/motori/src/lib/log/{context.ts,context.test.ts,pino.ts,pino.test.ts,middleware.ts}` → `packages/server/src/`
- Create: `packages/server/src/log/index.ts` (createLog factory)
- Modify: `apps/motori/src/lib/log/index.ts` (becomes thin app wrapper), all import sites via sed

- [ ] **Step 1: Scaffold the package**

`packages/server/package.json`:

```json
{
	"name": "@motori/server",
	"private": true,
	"type": "module",
	"exports": {
		"./csrf": "./src/csrf.ts",
		"./rate-limit": "./src/rate-limit.ts",
		"./security-headers": "./src/security-headers.ts",
		"./nonce": "./src/nonce.ts",
		"./log": "./src/log/index.ts",
		"./log/middleware": "./src/log/middleware.ts",
		"./log/context": "./src/log/context.ts"
	},
	"scripts": {
		"typecheck": "tsc --noEmit",
		"test": "vitest run"
	},
	"dependencies": {
		"@tanstack/react-start": "1.167.32",
		"pino": "10.3.1"
	},
	"devDependencies": {
		"pino-pretty": "13.1.3",
		"typescript": "6.0.2",
		"vitest": "4.1.4"
	}
}
```

`packages/server/tsconfig.json` mirrors `packages/db/tsconfig.json`. `packages/server/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
```

- [ ] **Step 2: Move the files**

```bash
mkdir -p packages/server/src/log
git mv apps/motori/src/lib/csrf.ts packages/server/src/csrf.ts
git mv apps/motori/src/lib/rate-limit.ts packages/server/src/rate-limit.ts
git mv apps/motori/src/lib/rate-limit.test.ts packages/server/src/rate-limit.test.ts
git mv apps/motori/src/lib/security-headers.ts packages/server/src/security-headers.ts
git mv apps/motori/src/lib/nonce.ts packages/server/src/nonce.ts
git mv apps/motori/src/lib/log/context.ts packages/server/src/log/context.ts
git mv apps/motori/src/lib/log/context.test.ts packages/server/src/log/context.test.ts
git mv apps/motori/src/lib/log/pino.ts packages/server/src/log/pino.ts
git mv apps/motori/src/lib/log/pino.test.ts packages/server/src/log/pino.test.ts
git mv apps/motori/src/lib/log/middleware.ts packages/server/src/log/middleware.ts
```

Then fix intra-package imports: any `~/lib/...` import inside the moved files must become relative (`./nonce`, `./log/context`, …). Find them:

```bash
grep -rn '~/' packages/server/src
```

Rewrite each hit by hand (there are few). If a moved file imports something that did NOT move (e.g. middleware importing an app module), stop and reassess — that import must either move too or be injected as a parameter; don't create a package→app dependency.

- [ ] **Step 3: Parameterize csrf by app origin**

In `packages/server/src/csrf.ts`, replace the `expected` line so each app can declare its own canonical origin (talli will set `APP_ORIGIN=https://talli.motori.fi`; motori sets nothing and falls back to `BETTER_AUTH_URL` — zero behavior change):

```ts
const expected = new URL(
	process.env.APP_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
).origin;
```

Keep the file's explanatory comments; add one line to them: `// APP_ORIGIN lets a non-auth-hosting app (talli) validate against its own origin.`

- [ ] **Step 4: Split the typed event catalog out of the log API**

`packages/server/src/log/index.ts` — the generic factory (the app keeps its typed event catalog):

```ts
import type { Logger } from "pino";
import { getLogger } from "./context";

type Fields = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Fields): void {
	const logger = getLogger();
	if (fields) {
		logger[level](fields, msg);
	} else {
		logger[level](msg);
	}
}

// Each app instantiates with its own event-name union so log.event stays typed
// against that app's catalog.
export function createLog<EventName extends string>() {
	return {
		debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
		info: (msg: string, fields?: Fields) => emit("info", msg, fields),
		warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
		error: (msg: string, fields?: Fields) => emit("error", msg, fields),
		event: (name: EventName, fields?: Fields) => emit("info", name, { ...fields, event: name }),
		child: (bindings: Fields): Logger => getLogger().child(bindings),
	};
}

export { withLogContext } from "./context";
```

`apps/motori/src/lib/log/index.ts` becomes the thin typed wrapper (events.ts and events.test.ts stay in the app untouched):

```ts
import { createLog } from "@motori/server/log";
import type { EventName } from "./events";

export const log = createLog<EventName>();
export { withLogContext } from "@motori/server/log";
```

- [ ] **Step 5: Rewrite import sites across the app**

```bash
cd apps/motori
grep -rl '~/lib/csrf' src | xargs sed -i '' 's|~/lib/csrf|@motori/server/csrf|g'
grep -rl '~/lib/rate-limit' src | xargs sed -i '' 's|~/lib/rate-limit|@motori/server/rate-limit|g'
grep -rl '~/lib/security-headers' src | xargs sed -i '' 's|~/lib/security-headers|@motori/server/security-headers|g'
grep -rl '~/lib/nonce' src | xargs sed -i '' 's|~/lib/nonce|@motori/server/nonce|g'
grep -rl '~/lib/log/middleware' src | xargs sed -i '' 's|~/lib/log/middleware|@motori/server/log/middleware|g'
cd ../..
```

`~/lib/log` (the app wrapper) intentionally stays — do NOT sed it. Verify no dangling references:

```bash
grep -rn '~/lib/csrf\|~/lib/rate-limit\|~/lib/security-headers\|~/lib/nonce' apps/motori/src && echo DANGLING || echo OK
```

Expected: `OK`.

- [ ] **Step 6: Wire up and verify**

```bash
pnpm --filter motori add '@motori/server@workspace:*'
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
grep -l AsyncLocalStorage apps/motori/.output/public/assets/*.js || echo CLEAN
```

Expected: `pnpm test` now also runs the package's vitest (rate-limit, log context/pino tests) — same total test count as before the move. Bundle check prints `CLEAN` (log/context uses AsyncLocalStorage; the nonce side-channel guard pattern must survive the move).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: extract request infra into @motori/server"
```

---

### Task 5: Extract @motori/server — auth factory, email, storage

**Files:**
- Move: `apps/motori/src/lib/{email.ts,email-wrapper.ts,email-wrapper.test.ts,image-storage.ts,password-strength.ts}` → `packages/server/src/`
- Create: `packages/server/src/auth.ts` (createAuth factory), `packages/server/src/session.ts` (createGetSession factory)
- Modify: `apps/motori/src/lib/auth.ts` (becomes wiring), `apps/motori/src/lib/session.ts`, `apps/motori/src/lib/require-verified-email.ts`, `packages/server/package.json`, import sites

- [ ] **Step 1: Move email, storage, password-strength**

```bash
git mv apps/motori/src/lib/email.ts packages/server/src/email.ts
git mv apps/motori/src/lib/email-wrapper.ts packages/server/src/email-wrapper.ts
git mv apps/motori/src/lib/email-wrapper.test.ts packages/server/src/email-wrapper.test.ts
git mv apps/motori/src/lib/image-storage.ts packages/server/src/image-storage.ts
git mv apps/motori/src/lib/password-strength.ts packages/server/src/password-strength.ts
```

Fix intra-package `~/lib/...` imports in the moved files to relative paths (`grep -rn '~/' packages/server/src`). If `email.ts` imports the app's typed `log`, switch it to `createLog<string>()` from `./log/index` or plain `getLogger()` — the package must not import the app. If any moved file imports something app-specific that can't move (e.g. i18n), stop and inject it as a parameter instead.

Replace the `exports` map in `packages/server/package.json` with the complete final map:

```json
"exports": {
	"./csrf": "./src/csrf.ts",
	"./rate-limit": "./src/rate-limit.ts",
	"./security-headers": "./src/security-headers.ts",
	"./nonce": "./src/nonce.ts",
	"./log": "./src/log/index.ts",
	"./log/middleware": "./src/log/middleware.ts",
	"./log/context": "./src/log/context.ts",
	"./email": "./src/email.ts",
	"./email-wrapper": "./src/email-wrapper.ts",
	"./image-storage": "./src/image-storage.ts",
	"./password-strength": "./src/password-strength.ts",
	"./auth": "./src/auth.ts",
	"./session": "./src/session.ts"
}
```

(add `"./require-verified-email": "./src/require-verified-email.ts"` only if Step 4 moves it) and:

```bash
pnpm --filter @motori/server add resend@6.12.2 '@aws-sdk/client-s3@3.1030.0' better-auth@1.6.11 '@better-auth/kysely-adapter@1.6.3' kysely@0.28.17
```

- [ ] **Step 2: Write the createAuth factory**

`packages/server/src/auth.ts`. This is the current `apps/motori/src/lib/auth.ts` with the app-specific email senders injected and the db passed in. The two `sendResetPassword`/`sendVerificationEmail` closures (profile-language lookup, i18n, templates) stay in the app:

```ts
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { admin } from "better-auth/plugins";
import type { Kysely } from "kysely";
import { passwordStrength } from "./password-strength";

type SendEmail = (args: { user: { id: string; email: string }; url: string }) => Promise<void>;

export function createAuth<DB>(opts: {
	db: Kysely<DB>;
	sendResetPassword: SendEmail;
	sendVerificationEmail: SendEmail;
}) {
	const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
	const talliOrigin =
		new URL(baseURL).hostname === "localhost"
			? "http://localhost:3001"
			: "https://talli.motori.fi";
	return betterAuth({
		database: kyselyAdapter(opts.db, {
			type: "postgres",
		}),
		baseURL,
		trustedOrigins: [baseURL, talliOrigin],
		secret: process.env.BETTER_AUTH_SECRET,
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days
			updateAge: 60 * 60 * 24, // refresh expiry every 24 h of activity
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			password: {
				async hash(password: string) {
					if (passwordStrength(password).score <= 1) {
						throw new Error("PASSWORD_TOO_WEAK");
					}
					return hashPassword(password);
				},
				verify: verifyPassword,
			},
			sendResetPassword: async ({ user, url }) => opts.sendResetPassword({ user, url }),
			customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
				...coreFields,
				role: "user",
				banned: false,
				banReason: null,
				banExpires: null,
				...additionalFields,
				id,
			}),
		},
		plugins: [admin()],
		rateLimit: {
			enabled: process.env.NODE_ENV === "production",
			window: 60,
			max: 100,
			customRules: {
				"/sign-in/email": { window: 60, max: 5 },
				"/sign-up/email": { window: 60, max: 5 },
			},
		},
		advanced: {
			ipAddress: {
				ipAddressHeaders: ["x-forwarded-for"],
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			expiresIn: 86400, // 24 hours
			sendVerificationEmail: async ({ user, url }) => opts.sendVerificationEmail({ user, url }),
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
```

Note: compare against the live `auth.ts` at execution time — if config drifted since this plan was written, the factory carries the live config verbatim; only `db` and the two senders become parameters.

- [ ] **Step 3: Rewrite the app's auth.ts as wiring**

`apps/motori/src/lib/auth.ts`:

```ts
import { createAuth } from "@motori/server/auth";
import { wrapEmail } from "@motori/server/email-wrapper";
import { sendEmail } from "@motori/server/email";
import { db } from "~/lib/db/index";
import { getEmailT } from "~/lib/i18n/email";

async function langFor(userId: string): Promise<"fi" | "en"> {
	const profile = await db
		.selectFrom("profile")
		.select("language")
		.where("user_id", "=", userId)
		.executeTakeFirst();
	return (profile?.language as "fi" | "en" | undefined) ?? "fi";
}

export const auth = createAuth({
	db,
	sendResetPassword: async ({ user, url }) => {
		const t = getEmailT(await langFor(user.id));
		void sendEmail({
			to: user.email,
			subject: t("passwordReset.subject"),
			html: wrapEmail(
				`
				<p>${t("passwordReset.greeting")}</p>
				<p>${t("passwordReset.body")}</p>
				<p><a href="${url.replace(/&/g, "&amp;")}">${url.replace(/&/g, "&amp;")}</a></p>
				<p>${t("passwordReset.expiry")}</p>
			`,
				await langFor(user.id),
			),
			text: `${t("passwordReset.body")}\n${url}\n\n${t("passwordReset.expiry")}`,
		}).catch(() => {});
	},
	sendVerificationEmail: async ({ user, url }) => {
		const lang = await langFor(user.id);
		const t = getEmailT(lang);
		void sendEmail({
			to: user.email,
			subject: t("verification.subject"),
			html: wrapEmail(
				`
				<p>${t("verification.greeting")}</p>
				<p>${t("verification.body")}</p>
				<p><a href="${url.replace(/&/g, "&amp;")}">${url.replace(/&/g, "&amp;")}</a></p>
				<p>${t("verification.expiry")}</p>
			`,
				lang,
			),
			text: `${t("verification.body")}\n${url}\n\n${t("verification.expiry")}`,
		}).catch(() => {});
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
```

(Fix the duplicated `langFor` call in sendResetPassword to a single `const lang = await langFor(user.id)` like the verification sender — match the pattern, don't fetch twice. Check `getEmailT`'s exact language type from `~/lib/i18n/email` and use it instead of the inline union if it exports one.)

- [ ] **Step 4: Session + require-verified-email as factories**

`packages/server/src/session.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Auth } from "./auth";

export function createGetSession(auth: Auth) {
	return createServerFn().handler(async () => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		return session;
	});
}
```

`apps/motori/src/lib/session.ts`:

```ts
import { createGetSession } from "@motori/server/session";
import { auth } from "~/lib/auth";

export const getSession = createGetSession(auth);
```

`require-verified-email.ts`: read it first. If it imports `~/lib/auth`, apply the same factory pattern (move the logic to `packages/server/src/require-verified-email.ts` as `createRequireVerifiedEmail(auth)`, keep a one-line app wrapper at `apps/motori/src/lib/require-verified-email.ts` so import sites don't change). If it only imports `getSession`, it stays in the app untouched.

- [ ] **Step 5: Rewrite import sites**

```bash
cd apps/motori
grep -rl '~/lib/email-wrapper' src | xargs sed -i '' 's|~/lib/email-wrapper|@motori/server/email-wrapper|g'
grep -rl '~/lib/email"' src | xargs sed -i '' 's|~/lib/email"|@motori/server/email"|g'
grep -rl '~/lib/image-storage' src | xargs sed -i '' 's|~/lib/image-storage|@motori/server/image-storage|g'
grep -rl '~/lib/password-strength' src | xargs sed -i '' 's|~/lib/password-strength|@motori/server/password-strength|g'
cd ../..
```

Caution on the email sed: `~/lib/email-templates` and `~/lib/i18n/email` must NOT be rewritten — hence the closing-quote anchor. Verify:

```bash
grep -rn '~/lib/email"\|~/lib/email-wrapper\|~/lib/image-storage\|~/lib/password-strength' apps/motori/src && echo DANGLING || echo OK
grep -rn 'email-templates\|i18n/email' apps/motori/src | grep '@motori' && echo BROKEN || echo OK
```

- [ ] **Step 6: Verify**

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
grep -l AsyncLocalStorage apps/motori/.output/public/assets/*.js || echo CLEAN
```

Then a real auth smoke test against the production build (BetterAuth config is the riskiest change in the whole project):

```bash
docker compose up -d && pnpm --filter motori db:migrate && pnpm --filter motori db:seed
pnpm --filter motori start &
# log in with the seed user via the UI at http://localhost:3000/kirjaudu, then Ctrl+C the server
```

Also run e2e: `pnpm test:e2e` (covers signup/login flows).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: extract auth factory, email, and storage into @motori/server"
```

---

### Task 6: Extract @motori/ui

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/theme.css`
- Move: `apps/motori/src/components/ui/{button,input,select,textarea,mobile-fullscreen-modal}.tsx`, `apps/motori/src/lib/cn.ts` → `packages/ui/src/`
- Modify: `apps/motori/src/styles/app.css`, import sites

- [ ] **Step 1: Scaffold**

`packages/ui/package.json` (add `@radix-ui/*`/`lucide-react`/`class-variance-authority` only if the moved components actually import them — check with grep, copy exact versions from the app):

```json
{
	"name": "@motori/ui",
	"private": true,
	"type": "module",
	"exports": {
		"./cn": "./src/cn.ts",
		"./button": "./src/button.tsx",
		"./input": "./src/input.tsx",
		"./select": "./src/select.tsx",
		"./textarea": "./src/textarea.tsx",
		"./mobile-fullscreen-modal": "./src/mobile-fullscreen-modal.tsx",
		"./theme.css": "./src/theme.css"
	},
	"scripts": {
		"typecheck": "tsc --noEmit"
	},
	"dependencies": {
		"clsx": "2.1.1",
		"tailwind-merge": "3.5.0"
	},
	"devDependencies": {
		"@types/react": "19.2.14",
		"react": "19.2.5",
		"typescript": "6.0.2"
	}
}
```

`packages/ui/tsconfig.json` mirrors the other packages.

- [ ] **Step 2: Move files and split the theme**

```bash
mkdir -p packages/ui/src
git mv apps/motori/src/lib/cn.ts packages/ui/src/cn.ts
git mv apps/motori/src/components/ui/button.tsx packages/ui/src/button.tsx
git mv apps/motori/src/components/ui/input.tsx packages/ui/src/input.tsx
git mv apps/motori/src/components/ui/select.tsx packages/ui/src/select.tsx
git mv apps/motori/src/components/ui/textarea.tsx packages/ui/src/textarea.tsx
git mv apps/motori/src/components/ui/mobile-fullscreen-modal.tsx packages/ui/src/mobile-fullscreen-modal.tsx
```

Fix intra-package imports (`~/lib/cn` → `./cn` inside the moved components).

Theme: open `apps/motori/src/styles/app.css`. Move the design tokens — the `@theme { ... }` block(s) and any `:root` custom-property blocks that define colors/fonts/radii — into `packages/ui/src/theme.css`. App-specific styles (page-level CSS, leaflet tweaks, etc.) stay in `app.css`, which now starts with:

```css
@import "@motori/ui/theme.css";
```

after the `@import "tailwindcss"` line (order matters: tailwind first, then theme). Font `@fontsource` imports: if they live in `app.css` or `__root.tsx`, leave them in the app for now — moving font packages is churn with no consumer yet; talli adds the same three imports later. Flag this in the commit message as a known duplication-to-be.

- [ ] **Step 3: Rewrite import sites**

```bash
cd apps/motori
grep -rl '~/components/ui/button' src | xargs sed -i '' 's|~/components/ui/button|@motori/ui/button|g'
grep -rl '~/components/ui/input' src | xargs sed -i '' 's|~/components/ui/input|@motori/ui/input|g'
grep -rl '~/components/ui/select' src | xargs sed -i '' 's|~/components/ui/select|@motori/ui/select|g'
grep -rl '~/components/ui/textarea' src | xargs sed -i '' 's|~/components/ui/textarea|@motori/ui/textarea|g'
grep -rl '~/components/ui/mobile-fullscreen-modal' src | xargs sed -i '' 's|~/components/ui/mobile-fullscreen-modal|@motori/ui/mobile-fullscreen-modal|g'
grep -rl '~/lib/cn' src | xargs sed -i '' 's|~/lib/cn|@motori/ui/cn|g'
cd ../..
grep -rn '~/components/ui/\|~/lib/cn' apps/motori/src && echo DANGLING || echo OK
```

Also update `apps/motori/components.json` (shadcn config) aliases if it points at `~/components/ui` — new components generated by shadcn should land in the package or the app deliberately, not by stale config. Set its ui alias to the app path and add new shared primitives to the package by hand.

Tailwind content scanning: Tailwind v4 with `@tailwindcss/vite` scans the module graph, but verify utility classes used only inside `packages/ui` survive: build and spot-check a button's classes in the served HTML. If classes are missing, add `@source "../../packages/ui/src";` to `app.css`.

- [ ] **Step 4: Wire, verify, commit**

```bash
pnpm --filter motori add '@motori/ui@workspace:*'
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e
```

Visual smoke: `pnpm dev`, open http://localhost:3000, confirm fonts, buttons, selects render identically (compare against production motori.fi side by side).

```bash
git add -A
git commit -m "refactor: extract @motori/ui with theme tokens and primitives"
```

---

### Task 7: CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update paths in the build and e2e jobs**

In the `build` job, replace `cp .env.ci .env` with:

```yaml
      - run: cp apps/motori/.env.ci apps/motori/.env
```

In the `e2e` job, same `cp` replacement, plus the run steps become:

```yaml
      - run: pnpm --filter motori db:migrate
      - run: pnpm --filter motori build
      - run: pnpm --filter motori test:e2e --shard=${{ matrix.shard }}
```

and the failure artifact path:

```yaml
          path: apps/motori/playwright-report/
```

`lint`, `format`, `typecheck`, `test` jobs need no changes — the root scripts now fan out over the workspace. The `deploy` job is untouched (same push, root Procfile dispatches).

- [ ] **Step 2: Commit, push, open PR, watch CI**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: point workflow at apps/motori paths"
git push -u origin monorepo-restructure
gh pr create --title "refactor: monorepo restructure (apps/ + packages/)" --body "Implements docs/superpowers/specs/2026-07-08-monorepo-restructure-design.md. Zero behavior change except SSO cookie scope (separate commit). Deploy requires DEPLOY_APP=motori set on Dokku before merge (defaults keep it working either way)."
gh pr checks --watch
```

Expected: all seven jobs green. Fix anything red before proceeding — do not stack the cookie change on a red pipeline.

---

### Task 8: SSO cookie scope

The one intended behavior change; its own commit so it's independently revertable.

**Files:**
- Modify: `packages/server/src/auth.ts`

- [ ] **Step 1: Enable cross-subdomain cookies**

In `createAuth`, extend the `advanced` block. Derive the domain from `BETTER_AUTH_URL` so localhost and any future staging host stay unaffected:

```ts
	const hostname = new URL(baseURL).hostname;
	const cookieDomain = hostname === "localhost" ? undefined : `.${hostname.replace(/^www\./, "")}`;
```

```ts
		advanced: {
			ipAddress: {
				ipAddressHeaders: ["x-forwarded-for"],
			},
			...(cookieDomain
				? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
				: {}),
		},
```

- [ ] **Step 2: Verify locally**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Run the production build locally (`pnpm --filter motori start`), log in, and check in DevTools that the session cookie has NO Domain attribute (localhost path). The `.motori.fi` scoping is prod-only behavior, verified after deploy.

- [ ] **Step 3: Commit and push**

```bash
git add packages/server/src/auth.ts
git commit -m "feat(auth): scope session cookie to .motori.fi for cross-subdomain SSO"
git push
```

---

### Task 9: Docs, Dokku config, merge, prod verification

**Files:**
- Modify: `AGENTS.md` (CLAUDE.md is a symlink to it), `DEPLOY.md`, `README.md`

- [ ] **Step 1: Update AGENTS.md**

Update: commands section (`pnpm dev` runs all apps; `pnpm --filter motori ...` for one app), repo layout (apps/ + packages/, what lives in `@motori/db`/`server`/`ui`), the "every POST server fn" security section import paths, migration rules (each app migrates only its own schema; talli's future `talli` schema noted), and the SSR/client-boundary section (rules now also apply to `packages/server`). Keep the existing tone and brevity.

- [ ] **Step 2: Update DEPLOY.md and README.md**

DEPLOY.md: add the `DEPLOY_APP` dispatch explanation to the Deploy section, and a note that root scripts default to `motori` so the app works even before the config is set. README: update the quickstart paths if any reference `src/`. justfile: skim for path assumptions (`grep -n 'src\|\.output' justfile`) — expected result is no changes needed since it only shells to the VPS, but confirm.

- [ ] **Step 3: Set the Dokku env var (before merge)**

```bash
ssh root@motori "dokku config:set --no-restart motori DEPLOY_APP=motori"
```

Harmless while `main` is still pre-restructure (nothing reads it), required-by-convention after.

- [ ] **Step 4: Final verification and merge**

```bash
pnpm lint && pnpm format && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
git add -A && git commit -m "docs: update AGENTS.md and DEPLOY.md for monorepo layout"
git push
gh pr checks --watch
```

All green → merge the PR (ask the user to approve the merge — this deploys to production).

- [ ] **Step 5: Production smoke test**

After the GHA deploy completes:

```bash
just logs   # watch release phase run migrations ("no pending migrations") and web boot
```

Then manually: front page loads, log in (existing account — session must survive), open a listing, check DevTools that the session cookie now has `Domain=.motori.fi`, `just status` shows the app healthy. If login breaks: `git revert` the cookie commit, push, redeploy.

---

## Explicitly out of scope (talli MVP plan handles these)

`apps/talli` creation, the `talli` Postgres schema and Dokku app, second deploy push in GHA, per-app `.env.ci` for talli, moving `makes.ts` or anything else talli might want later.
