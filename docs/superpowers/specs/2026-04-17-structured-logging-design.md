# Structured Logging — Design

**Date:** 2026-04-17
**Status:** Approved (brainstorming)
**Scope:** Add production-grade structured logging to the Vuokramoto TanStack Start app.

## Goals

1. **Production debugging.** When something breaks in prod, we can trace what happened for a specific request or user.
2. **Observability readiness.** Logs are structured JSON on stdout so any aggregator (Better Stack, Axiom, Loki, etc.) can be plugged in later without app-code changes.

Non-goals (for this change):

- Picking a log aggregator / shipper.
- Metrics and tracing (OpenTelemetry).
- Request-body or response-body logging.
- A background-job / queue runtime.

## Constraints

- **GDPR.** The app serves Finnish users and stores personal data. Logs must not leak PII in production.
- **Lean MVP.** One library, one module, minimal configuration. No log-aggregator infrastructure yet.
- **Docker on Hetzner.** Logs go to stdout; Docker captures them. Destination is deliberately deferred.

## Architecture

New module at `src/lib/log/`:

```
src/lib/log/
  index.ts       # public API — everything outside imports from here
  pino.ts        # pino instance factory: level, format, redact
  context.ts     # AsyncLocalStorage + getLogger / withLogContext
  middleware.ts  # TanStack Start server middleware
  events.ts      # typed catalog of business-event names
```

**Isolation rule:** nothing outside `src/lib/log/` imports `pino` directly. Consumers only touch the public `log.*` API. This keeps the library choice swappable and makes call sites uniform.

### Public API

```ts
import { log, withLogContext } from '~/lib/log'
import { EVENTS } from '~/lib/log/events'

log.debug(msg, fields?)
log.info(msg, fields?)
log.warn(msg, fields?)
log.error(msg, fields?)

log.event(EVENTS.listing.created, { listingId })
log.child(bindings)

await withLogContext({ script: 'migrate' }, async () => { /* ... */ })
```

## Request-scoped context (the spine)

Context flows via Node's `AsyncLocalStorage`. The store holds a pino child logger with per-request bindings, so `log.*` call sites never need to pass context explicitly.

### Request middleware

A TanStack Start server middleware runs at the start of every request:

1. Determine `requestId`: prefer the incoming `x-request-id` header (so an upstream Caddy/proxy request ID is preserved); otherwise `crypto.randomUUID()`.
2. Resolve `userId` from the BetterAuth session. Best-effort — if there's no session, the `userId` binding is simply absent.
3. Build bindings `{ requestId, userId?, method, path }` and create a pino child logger.
4. Enter the `AsyncLocalStorage` scope with that child logger; run the downstream handler inside it.
5. On response, emit one `info` line: message `"request"`, fields `{ status, durationMs }`. If `durationMs > 1000`, emit at `warn` level instead.
6. On thrown error, emit `error` with `{ err }` (pino's default err serializer), then re-throw so TanStack Start's error boundary still handles it.
7. Echo `x-request-id` on the response so users reporting issues can quote it.

### Non-HTTP contexts

- **Migrations / codegen** (`src/lib/db/migrate.ts`, `src/lib/db/codegen.ts`): entry point is wrapped in `withLogContext({ script: 'migrate' }, async () => { ... })`. Every log line inside carries `script: 'migrate'`.
- **Email sending** (`src/lib/email.ts`): invoked from within a request, so it inherits request context automatically.
- **Fallback:** if nothing is on the `AsyncLocalStorage`, `getLogger()` returns the root logger (no bindings). Stray module-load-time `log.*` calls still work; they just lack request context.

## Format, levels, environment

Two environment switches drive everything:

| Env | Format | Default level | Redaction |
|---|---|---|---|
| `NODE_ENV=production` | JSON on stdout, one line per event, ISO 8601 timestamps | `info` | **on** |
| anything else | `pino-pretty`: colored, single-line, `requestId` shown as a short prefix | `debug` | **off** |

- `LOG_LEVEL` env var overrides the default level. Accepts `trace | debug | info | warn | error | fatal`.
- Timestamps: `pino.stdTimeFunctions.isoTime` — grep-friendly by eye.
- Error serialization: pino default `err` serializer (`message`, `stack`, `code`, custom properties).

Standard fields present on every line (when applicable):

```
{ level, time, msg, requestId?, userId?, method?, path? }
```

## PII redaction

Redaction is centralized in `src/lib/log/pino.ts` as an explicit `redact` path list. Redacted values are replaced with `"[REDACTED]"` (pino default).

**Production redact paths (starting list):**

```
req.headers.authorization
req.headers.cookie
req.headers["set-cookie"]
res.headers["set-cookie"]
*.email
*.phone
*.password
*.passwordHash
*.token
*.sessionToken
*.ip
```

Notes:

- `*.email` catches `user.email`, `actor.email`, etc. When an email is genuinely needed in a log line (e.g. failed-login forensics), pass a truncated/hashed form (`e***@domain.fi`) through the event helper — never the raw address.
- IPs are redacted by default. If IP-based abuse tracking is added later, it goes through a narrow, deliberate code path — not a blanket unredact.
- Dev has no redaction so local debugging is unhindered.

**Not redacted (by design):** `userId`, `listingId`, `requestId`, HTTP method/path/status, durations. These are opaque identifiers or non-personal metadata.

## Business events

`log.event(name, fields?)` emits a normal `info` line with a dotted event name and a consistent shape:

```ts
log.event(EVENTS.listing.created, { listingId })
// → { level: 'info', msg: 'listing.created', event: 'listing.created', listingId, requestId, userId, ... }
```

Event names live in `src/lib/log/events.ts` as a typed `const` object so typos are caught at build time and the vocabulary is discoverable.

**Starting catalog:**

- `auth.login.success`
- `auth.login.failure` — `{ reason: 'no-user' | 'invalid-credentials' | 'provider-error' }`
- `auth.signup`
- `auth.logout`
- `listing.created` — `{ listingId }`
- `listing.updated` — `{ listingId, fields: string[] }`
- `listing.deleted` — `{ listingId }`
- `listing.contact_revealed` — `{ listingId, viewerUserId? }`
- `image.uploaded` — `{ listingId, key, bytes }`
- `image.upload_failed` — `{ listingId, reason }`
- `email.sent` — `{ template, toHash }` (hashed recipient, not raw email)
- `email.failed` — `{ template, reason }`

New events are added to the catalog as the app grows.

## Testing

A unit-test setup is added since the repo currently only has Playwright e2e. Minimal addition: `vitest`, a single `vitest.config.ts`, and a `pnpm test` script.

**Unit tests** (`src/lib/log/*.test.ts`):

- **Redaction:** given a payload with `email`, `password`, `ip`, the serialized JSON has `"[REDACTED]"` at those paths and only those paths.
- **Context propagation:** inside `withLogContext({ requestId: 'r1' }, fn)`, `log.info` emits a line with `requestId: 'r1'`; outside the scope, it doesn't.
- **Event helper:** `log.event(EVENTS.listing.created, { listingId: 'L1' })` emits `{ event: 'listing.created', listingId: 'L1', msg: 'listing.created' }`.

Output capture uses pino's built-in stream injection (`pino(opts, stream)`) with an in-memory stream — not `process.stdout` mocking.

**Manual verification:**

- `pnpm dev`, hit a few routes, confirm pretty output with `requestId` prefix.
- `NODE_ENV=production pnpm dev` temporarily, confirm single-line JSON and PII redaction.

**E2E:** no new Playwright cases. Logging is infrastructure; the existing e2e exercises the request path and would surface middleware regressions indirectly.

## Rollout order

1. Add `pino` + `pino-pretty`; build `src/lib/log/`.
2. Add `vitest`; write unit tests for redact and context.
3. Wire the middleware into the TanStack Start server.
4. Replace existing `console.*` in `src/lib/db/migrate.ts`, `src/lib/db/codegen.ts`, and `src/lib/email.ts`.
5. Add the first batch of `log.event` calls at the obvious sites: auth callback, listing create/update/delete, contact reveal, email send.

## Open questions deferred to later

- Log aggregator choice (Better Stack / Axiom / Loki / etc.). JSON-on-stdout is the universal contract; swap this in without touching app code.
- Metrics and tracing (OpenTelemetry). The existing `requestId` on every log line is a trivial bridge to a later tracer.
- Background jobs. When introduced, each job entry point wraps its handler with `withLogContext({ job: '...' })`.
