# Structured Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade structured logging (pino + AsyncLocalStorage + TanStack Start request middleware + PII redaction + business events) to the Vuokramoto app.

**Architecture:** A new `src/lib/log/` module owns everything pino-related. A request middleware opens a per-request `AsyncLocalStorage` scope holding a pino child logger with `{ requestId, userId?, method, path }` bindings. Every `log.*` call reads context from the storage, so call sites stay clean. JSON-on-stdout in production (with `redact` paths hiding PII); `pino-pretty` in development.

**Tech Stack:** pino, pino-pretty, vitest, `AsyncLocalStorage` (Node built-in), TanStack Start `createMiddleware` / `createStart`.

**Reference spec:** `docs/superpowers/specs/2026-04-17-structured-logging-design.md`

---

## File Structure

**Create:**
- `src/lib/log/pino.ts` — pino factory, redact paths, format config
- `src/lib/log/context.ts` — `AsyncLocalStorage<Logger>` + `getLogger`, `withLogContext`
- `src/lib/log/events.ts` — typed event-name catalog
- `src/lib/log/index.ts` — public API (`log.*`, `withLogContext`)
- `src/lib/log/middleware.ts` — TanStack Start request middleware
- `src/lib/log/pino.test.ts` — redaction test
- `src/lib/log/context.test.ts` — context propagation test
- `src/lib/log/events.test.ts` — event helper test
- `src/start.ts` — TanStack Start instance registering the middleware
- `vitest.config.ts` — vitest config (node env, path alias)

**Modify:**
- `package.json` — add deps and `test` script
- `src/lib/db/migrate.ts` — replace `console.*`
- `src/lib/db/codegen.ts` — replace `console.*`
- `src/lib/email.ts` — replace `console.*`
- `src/routes/listings/new.tsx` — add `log.event(EVENTS.listing.created, ...)`
- `src/routes/listings/$listingId_.edit.tsx` — add `log.event(EVENTS.listing.updated, ...)`
- `src/lib/storage.ts` — add `log.event(EVENTS.image.uploaded / image.upload_failed, ...)`

**Responsibility rule:** only files under `src/lib/log/` may import `pino` directly. Everything else imports from `~/lib/log`.

---

## Task 1: Install dependencies and set up vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [x] **Step 1: Install runtime deps (pino) and dev deps (pino-pretty, vitest)**

Run:
```bash
pnpm add pino
pnpm add -D pino-pretty vitest
```

Expected: `package.json` has `"pino": "^9.x.x"` under `dependencies` and `"pino-pretty": "^11.x.x"` + `"vitest": "^3.x.x"` under `devDependencies`. Exact minor versions from registry are fine.

- [x] **Step 2: Add `test` script to `package.json`**

In `package.json`, under `scripts`, add a `test` entry next to the existing `test:e2e`:

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "start": "node .output/server/index.mjs",
  "db:migrate": "tsx --env-file=.env src/lib/db/migrate.ts",
  "db:codegen": "tsx --env-file=.env src/lib/db/codegen.ts",
  "typecheck": "tsc --noEmit",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write .",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `vitest.config.ts` at the project root:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"~": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		exclude: ["e2e/**", "node_modules/**", ".output/**"],
	},
});
```

Keeping vitest's `include` limited to `src/**/*.test.ts` prevents it from picking up Playwright tests under `e2e/`.

- [ ] **Step 4: Verify the test runner works with no tests**

Run:
```bash
pnpm test
```

Expected: vitest starts, reports `No test files found`, exits 0 (or 1 — either is fine, as long as vitest itself ran without error). The goal here is just to confirm the config is valid.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add pino, pino-pretty, vitest"
```

---

## Task 2: Build the pino factory with redaction (TDD)

**Files:**
- Create: `src/lib/log/pino.ts`
- Test: `src/lib/log/pino.test.ts`

- [ ] **Step 1: Write the failing redaction test**

Create `src/lib/log/pino.test.ts`:

```ts
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createRootLogger } from "./pino";

function memoryStream() {
	const lines: string[] = [];
	const stream = new Writable({
		write(chunk, _enc, cb) {
			lines.push(chunk.toString());
			cb();
		},
	});
	return { stream, lines };
}

function parseLastLine(lines: string[]): Record<string, unknown> {
	const last = lines.at(-1);
	if (!last) throw new Error("no log line emitted");
	return JSON.parse(last);
}

describe("pino factory (production redaction)", () => {
	it("redacts configured PII paths and keeps others", () => {
		const { stream, lines } = memoryStream();
		const logger = createRootLogger({ isProd: true, level: "trace" }, stream);

		logger.info(
			{
				userId: "u_1",
				user: { email: "a@b.fi", password: "secret" },
				req: { headers: { authorization: "Bearer x", cookie: "s=1" } },
				listingId: "L1",
			},
			"hello",
		);

		const entry = parseLastLine(lines);
		expect(entry.msg).toBe("hello");
		expect(entry.userId).toBe("u_1");
		expect(entry.listingId).toBe("L1");
		expect((entry.user as Record<string, unknown>).email).toBe("[REDACTED]");
		expect((entry.user as Record<string, unknown>).password).toBe("[REDACTED]");
		expect(((entry.req as any).headers as any).authorization).toBe("[REDACTED]");
		expect(((entry.req as any).headers as any).cookie).toBe("[REDACTED]");
	});

	it("does not redact in non-prod", () => {
		const { stream, lines } = memoryStream();
		const logger = createRootLogger(
			{ isProd: false, level: "trace", pretty: false },
			stream,
		);

		logger.info({ user: { email: "a@b.fi" } }, "hello");

		const entry = parseLastLine(lines);
		expect((entry.user as Record<string, unknown>).email).toBe("a@b.fi");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/lib/log/pino.test.ts
```

Expected: FAIL — `Cannot find module './pino'` (or similar).

- [ ] **Step 3: Implement `src/lib/log/pino.ts`**

Create `src/lib/log/pino.ts`:

```ts
import type { Writable } from "node:stream";
import pino, { type Logger, type LoggerOptions } from "pino";

export const REDACT_PATHS = [
	'req.headers.authorization',
	'req.headers.cookie',
	'req.headers["set-cookie"]',
	'res.headers["set-cookie"]',
	"*.email",
	"*.phone",
	"*.password",
	"*.passwordHash",
	"*.token",
	"*.sessionToken",
	"*.ip",
];

export interface RootLoggerOptions {
	isProd?: boolean;
	level?: LoggerOptions["level"];
	/** Forces pino-pretty on or off. Defaults to `!isProd`. */
	pretty?: boolean;
}

/**
 * Build the root pino instance. Accepts an optional destination stream so tests
 * can capture output without touching process.stdout.
 */
export function createRootLogger(
	opts: RootLoggerOptions = {},
	destination?: Writable,
): Logger {
	const isProd = opts.isProd ?? process.env.NODE_ENV === "production";
	const level = opts.level ?? process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");
	const pretty = opts.pretty ?? !isProd;

	const pinoOptions: LoggerOptions = {
		level,
		timestamp: pino.stdTimeFunctions.isoTime,
		redact: isProd ? { paths: REDACT_PATHS, censor: "[REDACTED]" } : undefined,
	};

	// pino's `transport` spawns a worker and cannot be combined with a custom
	// destination stream. Only enable pretty when no stream was injected.
	if (pretty && !destination) {
		pinoOptions.transport = {
			target: "pino-pretty",
			options: {
				colorize: true,
				singleLine: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
				messageFormat: "{requestId} {msg}",
			},
		};
	}

	return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}

export const rootLogger = createRootLogger();
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test src/lib/log/pino.test.ts
```

Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/log/pino.ts src/lib/log/pino.test.ts
git commit -m "feat(log): pino factory with PII redaction"
```

---

## Task 3: Build the AsyncLocalStorage context (TDD)

**Files:**
- Create: `src/lib/log/context.ts`
- Test: `src/lib/log/context.test.ts`

- [ ] **Step 1: Write the failing context-propagation test**

Create `src/lib/log/context.test.ts`:

```ts
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { getLogger, withLogContext, __setRootLoggerForTest } from "./context";
import { createRootLogger } from "./pino";

function memoryStream() {
	const lines: string[] = [];
	const stream = new Writable({
		write(chunk, _enc, cb) {
			lines.push(chunk.toString());
			cb();
		},
	});
	return { stream, lines };
}

describe("log context", () => {
	it("merges bindings from withLogContext into emitted lines", async () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream));

		await withLogContext({ requestId: "r1", userId: "u1" }, async () => {
			getLogger().info({ event: "x" }, "inside");
		});
		getLogger().info({ event: "y" }, "outside");

		const inside = JSON.parse(lines[0]);
		const outside = JSON.parse(lines[1]);

		expect(inside.requestId).toBe("r1");
		expect(inside.userId).toBe("u1");
		expect(inside.msg).toBe("inside");

		expect(outside.requestId).toBeUndefined();
		expect(outside.userId).toBeUndefined();
		expect(outside.msg).toBe("outside");
	});

	it("nested withLogContext composes bindings", async () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream));

		await withLogContext({ requestId: "r1" }, async () => {
			await withLogContext({ userId: "u1" }, async () => {
				getLogger().info("nested");
			});
		});

		const line = JSON.parse(lines[0]);
		expect(line.requestId).toBe("r1");
		expect(line.userId).toBe("u1");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/lib/log/context.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/log/context.ts`**

Create `src/lib/log/context.ts`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";
import { rootLogger as defaultRoot } from "./pino";

const storage = new AsyncLocalStorage<Logger>();
let rootLogger: Logger = defaultRoot;

export function getLogger(): Logger {
	return storage.getStore() ?? rootLogger;
}

export function withLogContext<T>(
	bindings: Record<string, unknown>,
	fn: () => Promise<T> | T,
): Promise<T> {
	const child = getLogger().child(bindings);
	return Promise.resolve(storage.run(child, fn));
}

/** Test-only: swap the root logger so tests can capture output. */
export function __setRootLoggerForTest(logger: Logger): void {
	rootLogger = logger;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test src/lib/log/context.test.ts
```

Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/log/context.ts src/lib/log/context.test.ts
git commit -m "feat(log): AsyncLocalStorage-backed log context"
```

---

## Task 4: Build the event catalog and the `log` API (TDD)

**Files:**
- Create: `src/lib/log/events.ts`
- Create: `src/lib/log/index.ts`
- Test: `src/lib/log/events.test.ts`

- [ ] **Step 1: Write the failing event-helper test**

Create `src/lib/log/events.test.ts`:

```ts
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { __setRootLoggerForTest } from "./context";
import { EVENTS } from "./events";
import { log } from "./index";
import { createRootLogger } from "./pino";

function memoryStream() {
	const lines: string[] = [];
	const stream = new Writable({
		write(chunk, _enc, cb) {
			lines.push(chunk.toString());
			cb();
		},
	});
	return { stream, lines };
}

describe("log.event", () => {
	it("emits info with event name as msg and an `event` field", () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream));

		log.event(EVENTS.listing.created, { listingId: "L1" });

		const entry = JSON.parse(lines[0]);
		expect(entry.level).toBe(30); // pino 'info'
		expect(entry.msg).toBe("listing.created");
		expect(entry.event).toBe("listing.created");
		expect(entry.listingId).toBe("L1");
	});

	it("log.info accepts msg-only and msg+fields", () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream));

		log.info("plain");
		log.info("with fields", { foo: "bar" });

		expect(JSON.parse(lines[0]).msg).toBe("plain");
		const second = JSON.parse(lines[1]);
		expect(second.msg).toBe("with fields");
		expect(second.foo).toBe("bar");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/lib/log/events.test.ts
```

Expected: FAIL — `./events` and `./index` not found.

- [ ] **Step 3: Implement `src/lib/log/events.ts`**

Create `src/lib/log/events.ts`:

```ts
export const EVENTS = {
	auth: {
		login_success: "auth.login.success",
		login_failure: "auth.login.failure",
		signup: "auth.signup",
		logout: "auth.logout",
	},
	listing: {
		created: "listing.created",
		updated: "listing.updated",
		deleted: "listing.deleted",
		contact_revealed: "listing.contact_revealed",
	},
	image: {
		uploaded: "image.uploaded",
		upload_failed: "image.upload_failed",
	},
	email: {
		sent: "email.sent",
		failed: "email.failed",
	},
} as const;

export type EventName =
	| (typeof EVENTS.auth)[keyof typeof EVENTS.auth]
	| (typeof EVENTS.listing)[keyof typeof EVENTS.listing]
	| (typeof EVENTS.image)[keyof typeof EVENTS.image]
	| (typeof EVENTS.email)[keyof typeof EVENTS.email];
```

- [ ] **Step 4: Implement `src/lib/log/index.ts`**

Create `src/lib/log/index.ts`:

```ts
import type { Logger } from "pino";
import { getLogger } from "./context";
import type { EventName } from "./events";

type Fields = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Fields): void {
	const logger = getLogger();
	if (fields) logger[level](fields, msg);
	else logger[level](msg);
}

export const log = {
	debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
	info: (msg: string, fields?: Fields) => emit("info", msg, fields),
	warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
	error: (msg: string, fields?: Fields) => emit("error", msg, fields),
	event: (name: EventName, fields?: Fields) =>
		emit("info", name, { event: name, ...fields }),
	child: (bindings: Fields): Logger => getLogger().child(bindings),
};

export { withLogContext } from "./context";
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
pnpm test src/lib/log/events.test.ts
```

Expected: PASS — 2 tests green.

- [ ] **Step 6: Run the full test suite**

Run:
```bash
pnpm test
```

Expected: all 6 tests (2 pino + 2 context + 2 events) pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/log/events.ts src/lib/log/index.ts src/lib/log/events.test.ts
git commit -m "feat(log): public log API and event catalog"
```

---

## Task 5: Build the request middleware

**Files:**
- Create: `src/lib/log/middleware.ts`

- [ ] **Step 1: Implement `src/lib/log/middleware.ts`**

Create `src/lib/log/middleware.ts`:

```ts
import { createMiddleware } from "@tanstack/react-start";
import { auth } from "~/lib/auth";
import { withLogContext } from "./context";
import { log } from "./index";

export const loggingMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
		const url = new URL(request.url);
		const method = request.method;
		const path = url.pathname;
		const incomingId = request.headers.get("x-request-id");
		const requestId = incomingId ?? crypto.randomUUID();

		let userId: string | undefined;
		try {
			const session = await auth.api.getSession({ headers: request.headers });
			userId = session?.user?.id;
		} catch {
			// Session resolution is best-effort. Missing/invalid session just
			// means the log line omits userId.
		}

		const bindings: Record<string, unknown> = { requestId, method, path };
		if (userId) bindings.userId = userId;

		const start = Date.now();
		return withLogContext(bindings, async () => {
			try {
				const result = await next();
				const durationMs = Date.now() - start;
				const status = result.response.status;
				const fields = { status, durationMs };
				if (durationMs > 1000) log.warn("request", fields);
				else log.info("request", fields);
				result.response.headers.set("x-request-id", requestId);
				return result;
			} catch (err) {
				const durationMs = Date.now() - start;
				log.error("request failed", { err, durationMs });
				throw err;
			}
		});
	},
);
```

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: PASS (no type errors). If the `auth` import path differs from what `src/lib/session.ts` uses, match its style (`from "~/lib/auth"`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/log/middleware.ts
git commit -m "feat(log): request middleware with AsyncLocalStorage scope"
```

---

## Task 6: Register the middleware via `src/start.ts`

**Files:**
- Create: `src/start.ts`

TanStack Start's Vite plugin auto-discovers `src/start.{ts,tsx,js,jsx}` (see `resolveStartEntryPlan` in `@tanstack/start-plugin-core/planning.ts`). A default export of `createStart(...)` registers global request middleware for every page and server-function request.

- [ ] **Step 1: Create `src/start.ts`**

```ts
import { createStart } from "@tanstack/react-start";
import { loggingMiddleware } from "~/lib/log/middleware";

export default createStart(() => ({
	requestMiddleware: [loggingMiddleware],
}));
```

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Start the dev server and verify pretty logs appear**

Run:
```bash
pnpm dev
```

In another terminal, hit the homepage:
```bash
curl -s -o /dev/null -w "%{http_code} reqid=%header{x-request-id}\n" http://localhost:3000/
```

Expected in the dev server terminal: a single-line pino-pretty entry containing `request`, the request's `requestId`, `method=GET`, `path=/`, a numeric `status`, and `durationMs`. The `curl` invocation should print an HTTP code and a non-empty `reqid=...`.

Stop the dev server (Ctrl+C) when satisfied.

- [ ] **Step 4: Commit**

```bash
git add src/start.ts
git commit -m "feat(log): register request middleware globally"
```

---

## Task 7: Replace `console.*` in DB scripts

**Files:**
- Modify: `src/lib/db/migrate.ts`
- Modify: `src/lib/db/codegen.ts`

- [ ] **Step 1: Update `src/lib/db/migrate.ts`**

Replace the file with:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileMigrationProvider, Migrator } from "kysely";
import { log, withLogContext } from "~/lib/log";
import { db } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await withLogContext({ script: "migrate" }, async () => {
	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: path.join(__dirname, "migrations"),
		}),
	});

	const { error, results } = await migrator.migrateToLatest();

	for (const result of results ?? []) {
		if (result.status === "Success") {
			log.info("migration executed", { migrationName: result.migrationName });
		} else if (result.status === "Error") {
			log.error("migration failed", { migrationName: result.migrationName });
		}
	}

	if (error) {
		log.error("migration run failed", { err: error });
		await db.destroy();
		process.exit(1);
	}

	if (!results?.length) {
		log.info("no pending migrations");
	}

	await db.destroy();
});
```

Note: the `biome-ignore-all` comment is removed since we no longer call `console.*`.

- [ ] **Step 2: Update `src/lib/db/codegen.ts`**

Replace the file with:

```ts
// src/lib/db/codegen.ts
// Wrapper so kysely-codegen picks up DATABASE_URL from .env
// Run via: pnpm db:codegen
import { execSync } from "node:child_process";
import { log, withLogContext } from "~/lib/log";

await withLogContext({ script: "codegen" }, async () => {
	const url = process.env.DATABASE_URL;
	if (!url) {
		log.error("DATABASE_URL is not set");
		process.exit(1);
	}

	execSync(`kysely-codegen --url="${url}" --out-file=src/lib/db/schema.generated.ts`, {
		stdio: "inherit",
	});
});
```

- [ ] **Step 3: Run the migrate script end-to-end**

Run:
```bash
pnpm db:migrate
```

Expected: either JSON (prod) or pretty (dev, which is the default) log lines appear with `script: "migrate"` binding present. The script exits 0 on success. No `console.log` output is emitted from this file.

- [ ] **Step 4: Run the typecheck and linter**

Run:
```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/migrate.ts src/lib/db/codegen.ts
git commit -m "refactor(log): use structured logger in db scripts"
```

---

## Task 8: Replace `console.*` in email mock logger

**Files:**
- Modify: `src/lib/email.ts`

The existing `logMockEmail` draws a boxed preview in the terminal for local dev. Rather than preserve that ASCII box via the structured logger (boxes don't make sense in JSON), replace it with a single structured log line plus `log.event(EVENTS.email.sent, ...)`.

- [ ] **Step 1: Rewrite `src/lib/email.ts`**

Replace the file with:

```ts
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

export interface EmailPayload {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

function hashRecipient(to: string): string {
	// Truncate local part: `alice@example.com` -> `a***@example.com`.
	// Not a cryptographic hash — the spec calls for a reversible-to-eyes form
	// that omits the full local part. That's enough to distinguish recipients
	// in logs without leaking the full address.
	const [local, domain] = to.split("@");
	if (!local || !domain) return "***";
	return `${local.slice(0, 1)}***@${domain}`;
}

function logMockEmail(payload: EmailPayload): void {
	const urls = [...payload.html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(
		(m) => m[0],
	);

	log.info("mock email", {
		to: payload.to, // redacted in prod via `*.email` ... but this path is dev-only
		subject: payload.subject,
		urls,
		textPreview: payload.text?.split("\n").slice(0, 6).join("\n"),
	});
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
	// Drop-in Resend: uncomment when RESEND_API_KEY is set
	// if (process.env.RESEND_API_KEY) {
	//   const { Resend } = await import("resend");
	//   const resend = new Resend(process.env.RESEND_API_KEY);
	//   try {
	//     await resend.emails.send({
	//       from: "Vuokramoto <noreply@vuokramoto.fi>",
	//       to: payload.to,
	//       subject: payload.subject,
	//       html: payload.html,
	//       text: payload.text,
	//     });
	//     log.event(EVENTS.email.sent, { template: payload.subject, toHash: hashRecipient(payload.to) });
	//     return;
	//   } catch (err) {
	//     log.event(EVENTS.email.failed, { template: payload.subject, reason: (err as Error).message });
	//     throw err;
	//   }
	// }
	logMockEmail(payload);
	log.event(EVENTS.email.sent, {
		template: payload.subject,
		toHash: hashRecipient(payload.to),
		provider: "mock",
	});
}
```

Note: `logMockEmail` deliberately logs `to` in the clear. This is fine for dev (no redaction) and in prod would be handled by `*.email` in the redact paths — but the mock logger is only expected to run in dev. When the Resend branch is enabled, the payload never reaches the mock logger, so no raw email ends up in prod logs.

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
pnpm typecheck && pnpm lint
```

Expected: PASS. Note: the `biome-ignore-all` header is removed along with the `console.*` calls.

- [ ] **Step 3: Verify with the login flow (optional sanity)**

Run:
```bash
pnpm dev
```

Then trigger an email-sending action from the UI (e.g. register a new account). Confirm the dev terminal shows:
- A `mock email` info line.
- An `email.sent` info line with `event: "email.sent"`, `toHash`, `template`.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email.ts
git commit -m "refactor(log): structured logging for mock email sender"
```

---

## Task 9: Business events at listing mutations

**Files:**
- Modify: `src/routes/listings/new.tsx`
- Modify: `src/routes/listings/$listingId_.edit.tsx`

For each file below, locate the Kysely mutation (the `.insertInto` / `.updateTable` call) and add a `log.event(...)` line immediately after the successful DB write, using the `listingId` that was inserted/updated. Use the returned row if the mutation uses `.returningAll()` or `.returning(["id"])`; otherwise use the `id` argument the handler already has.

**Note on `listing.contact_revealed`:** the event is in the catalog but is **not added in this task**. The current architecture sends owner contact info (`ownerEmail`, `phone`) inside the initial `getListing` server-function response (`src/routes/listings/$listingId.tsx`), and the "reveal" is a client-side toggle. There is no server-side reveal handler to hook. Adding this event meaningfully requires either (a) extracting contact fetching into its own server function called on click, or (b) accepting that "viewed listing detail while signed in" is the closest available signal. Both are out of scope here — see Deferred section.

- [ ] **Step 1: `src/routes/listings/new.tsx` — `listing.created`**

At the top of the file, add:

```ts
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
```

Find the block around line 22 that performs `.insertInto("listing")...`. Capture the inserted row (add `.returning(["id"])` and `.executeTakeFirstOrThrow()` if not already present), then emit the event immediately after. Concretely, if the existing code looks like:

```ts
await db
  .insertInto("listing")
  .values({ ... })
  .executeTakeFirstOrThrow();
```

Change it to:

```ts
const inserted = await db
  .insertInto("listing")
  .values({ ... })
  .returning(["id"])
  .executeTakeFirstOrThrow();

log.event(EVENTS.listing.created, { listingId: inserted.id });
```

If the insert already returns the id, just add the `log.event(...)` call after the existing line using the already-bound variable.

- [ ] **Step 2: `src/routes/listings/$listingId_.edit.tsx` — `listing.updated`**

At the top of the file, add:

```ts
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
```

The handler already knows the `id` of the listing being edited and the form `data`. After the `.updateTable("listing")...execute()` call at line ~70, add:

```ts
log.event(EVENTS.listing.updated, {
	listingId: data.id,
	fields: Object.keys(data).filter((k) => k !== "id"),
});
```

- [ ] **Step 3: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Manual sanity check**

Run:
```bash
pnpm dev
```

- Create a listing → dev terminal shows `listing.created` with `listingId`.
- Edit that listing → dev terminal shows `listing.updated` with `listingId` and `fields`.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/routes/listings/new.tsx src/routes/listings/$listingId_.edit.tsx
git commit -m "feat(log): listing business events"
```

---

## Task 10: Business events at image upload

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add event logging to `getImageUploadUrl`**

At the top of `src/lib/storage.ts`, add:

```ts
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
```

The `getImageUploadUrl` server function returns a presigned URL. The actual upload (browser → Hetzner) happens client-side, so we log the **grant of an upload URL**, not the upload itself. Wrap the existing handler body in a try/catch:

```ts
export const getImageUploadUrl = createServerFn({ method: "POST" })
	.inputValidator((data: { filename: string; contentType: string }) => {
		if (!ALLOWED_TYPES.includes(data.contentType)) {
			throw new Error("Vain JPEG, PNG ja WebP tiedostot ovat sallittuja");
		}
		return data;
	})
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään ladataksesi kuvia");
		}
		if (!process.env.STORAGE_ENDPOINT) {
			log.event(EVENTS.image.upload_failed, { reason: "storage-not-configured" });
			throw new Error("Kuvatallennusta ei ole konfiguroitu");
		}

		try {
			const ext = data.filename.split(".").pop() ?? "jpg";
			const key = `listings/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
			const uploadUrl = await generatePresignedUploadUrl(key, data.contentType);
			const publicUrl = getPublicUrl(key);
			log.event(EVENTS.image.uploaded, { key, contentType: data.contentType });
			return { uploadUrl, publicUrl };
		} catch (err) {
			log.event(EVENTS.image.upload_failed, {
				reason: (err as Error).message,
			});
			throw err;
		}
	});
```

Note: this logs the *grant*, not the actual client-side PUT. That's the signal we have from the server. A future step could add a "confirm upload" server function that logs the real completion.

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Manual sanity check**

Run:
```bash
pnpm dev
```

Create or edit a listing and upload an image. Dev terminal should show `image.uploaded` with `key` (a `listings/<userId>/...` string) and `contentType`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat(log): image upload events"
```

---

## Task 11: Final verification

**Files:** none modified.

- [ ] **Step 1: Run the full test suite**

Run:
```bash
pnpm test
```

Expected: all 6 unit tests pass (pino redaction x2, context propagation x2, event helper x2).

- [ ] **Step 2: Run typecheck and lint**

Run:
```bash
pnpm typecheck && pnpm lint
```

Expected: PASS for both.

- [ ] **Step 3: Run Playwright e2e to confirm no request-path regression**

Run:
```bash
pnpm test:e2e
```

Expected: all e2e scenarios still pass. Logging is infrastructure that sits in front of every request, so a broken middleware would surface as e2e failures.

- [ ] **Step 4: Production-format spot check**

Run:
```bash
NODE_ENV=production LOG_LEVEL=info pnpm dev
```

In another terminal:
```bash
curl -s -o /dev/null http://localhost:3000/
```

Expected dev-server output: a **single JSON line** (not colored pretty output) for `request`, containing `requestId`, `method`, `path`, `status`, `durationMs`, ISO 8601 `time`. Any `cookie` or `set-cookie` values should appear as `"[REDACTED]"`.

Stop the dev server.

- [ ] **Step 5: Confirm no stray `console.*` left in app code**

Run:
```bash
pnpm lint
```

Biome's `lint/suspicious/noConsole` rule will flag any remaining `console.*` calls that aren't inside a file with a `biome-ignore` header. The three files that previously had those headers (`migrate.ts`, `codegen.ts`, `email.ts`) should no longer need them.

If the lint passes, logging rollout is complete.

---

## Deferred (intentionally out of scope)

Per the spec, the following are **not** implemented here and will be added later:

- Auth events (`auth.login.success` / `auth.login.failure` / `auth.signup` / `auth.logout`). These require a BetterAuth plugin or `hooks` configuration to intercept auth lifecycle events — meaningful work in its own right and better scoped as a follow-up. The event names are already in `EVENTS.auth` so call sites can be added without a catalog change.
- `listing.deleted` — the app currently has no delete flow. When one lands, add the event there.
- `listing.contact_revealed` — the current architecture has no server-side reveal. Adding this event requires either splitting contact info into its own server function (called when the user clicks "reveal") or accepting "viewed listing detail while signed in" as a proxy. Pick a direction in a follow-up before adding the call site. The event name is already in `EVENTS.listing`.
- DB query logging (Kysely plugin) — deferred per spec.
- Log aggregator / shipper choice (Better Stack, Axiom, Loki). JSON-on-stdout is a forward-compatible contract.
