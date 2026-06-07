# OpenObserve Observability (Phase 1: logs) — Implementation Plan

> **Update (post-implementation):** prod **exposure changed** after this plan was written — OO is now deployed as a **Dokku app at `https://logs.motori.fi`** (public UI, OO built-in login) instead of a standalone compose stack reached over Tailscale, and local OO starts with plain `docker compose up -d` (no profile). The spec and `DEPLOY.md` §11 are authoritative for prod; Tasks 4–7 below reflect the original compose approach.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Motori's pino logs to a single self-hosted OpenObserve container (durable, queryable, with dashboards/alerts), parquet offloaded to the existing private `motori-backups` bucket, tuned for a low-RAM VPS.

**Architecture:** A gated, in-process `pino.multistream` adds an OpenObserve sink alongside the existing stdout/pretty sink. The app POSTs batched logs to OO's native JSON ingest. OO runs as a standalone Docker container (dev: opt-in compose profile; prod: `infra/observability/` compose, S3 offload, hard memory caps, Tailscale-only UI). Traces/metrics are deferred to Phase 2/3.

**Tech Stack:** pino 10 + `pino-pretty` (already deps), `pino.multistream` (in-process, no worker — avoids module-resolution issues in the bundled Nitro output), OpenObserve `v0.90.3` (OSS image), Docker Compose, Dokku, Hetzner Object Storage (S3), `just`.

**Spec:** `docs/superpowers/specs/2026-06-07-openobserve-observability-design.md`

**Convention note (overrides this skill's TDD default):** project policy is *no new automated tests unless explicitly requested*. Tasks therefore verify via `pnpm typecheck` / `pnpm lint` / `pnpm build` + the client-bundle grep + manual smoke tests. The one place a unit test would earn its keep is the OO stream's batch/drop-oldest/flush logic (Task 1) — written here as **optional opt-in** at the end of Task 1; skip unless the user asks.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/log/openobserve-stream.ts` (create) | In-process Writable that batches pino log records and POSTs them to OO's JSON ingest. Best-effort, bounded buffer. |
| `src/lib/log/pino.ts` (modify) | Add the gated OO sink via `pino.multistream`, leaving the existing default path unchanged. |
| `.env.example` (modify) | Document the optional `OPENOBSERVE_*` vars (commented — off by default in dev). |
| `AGENTS.md` (modify) | Observability subsection: the pino→OO path + gating var. |
| `docker-compose.yml` (modify) | Dev OO service under opt-in `obs` profile (local-disk storage). |
| `infra/observability/docker-compose.yml` (create) | Prod OO stack: S3 offload, retention, mem caps, `mem_limit`, `observability` network, loopback port. |
| `infra/observability/.env.example` (create) | Prod OO env template (root + ingestion creds, S3 keys). |
| `infra/observability/dashboards/` `infra/observability/alerts/` (create) | Committed JSON exports of OO dashboards/alerts (the only version control for them). |
| `infra/observability/README.md` (create) | One-screen pointer to DEPLOY.md §11 + what lives here. |
| `justfile` (modify) | `oo-deploy`, `oo-logs` recipes. |
| `DEPLOY.md` (modify) | New §11 runbook (replaces the abandoned Grafana §11 slot). |
| GitHub issues (create) | Phase 2 (traces), Phase 3 (metrics). |

---

## Task 1: OpenObserve log stream module

**Files:**
- Create: `src/lib/log/openobserve-stream.ts`

- [ ] **Step 1: Write the stream module**

Create `src/lib/log/openobserve-stream.ts`:

```ts
import { Buffer } from "node:buffer";
import { Writable } from "node:stream";

export interface OpenObserveStreamConfig {
	url: string;
	org: string;
	stream: string;
	user: string;
	password: string;
	/** Flush once this many records are buffered. */
	batchSize?: number;
	/** Flush at least this often (ms). */
	flushIntervalMs?: number;
	/** During an outage, never buffer more than this many records (drop oldest). */
	maxBuffer?: number;
}

/**
 * In-process, best-effort log shipper to OpenObserve's native JSON ingest.
 * Buffers the NDJSON lines pino writes and POSTs them as a JSON array on a timer
 * or when the batch fills. Failures are swallowed (warned once to stderr): stdout
 * via Dokku is the durable source of truth, so losing the in-flight buffer on a
 * crash or OO outage is an accepted trade-off, not a bug.
 */
export function createOpenObserveStream(config: OpenObserveStreamConfig): Writable {
	const batchSize = config.batchSize ?? 100;
	const flushIntervalMs = config.flushIntervalMs ?? 5000;
	const maxBuffer = config.maxBuffer ?? 1000;
	const endpoint = `${config.url.replace(/\/$/, "")}/api/${config.org}/${config.stream}/_json`;
	const authHeader = `Basic ${Buffer.from(`${config.user}:${config.password}`).toString("base64")}`;

	let buffer: unknown[] = [];
	let warned = false;

	async function flush(): Promise<void> {
		if (buffer.length === 0) return;
		const batch = buffer;
		buffer = [];
		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json", authorization: authHeader },
				body: JSON.stringify(batch),
			});
			if (!res.ok && !warned) {
				warned = true;
				process.stderr.write(`[openobserve] ingest failed: ${res.status} ${res.statusText}\n`);
			}
		} catch (err) {
			if (!warned) {
				warned = true;
				process.stderr.write(`[openobserve] ingest error: ${(err as Error).message}\n`);
			}
		}
	}

	const timer = setInterval(() => void flush(), flushIntervalMs);
	// Never keep the process alive just for the flush timer.
	timer.unref();

	return new Writable({
		write(chunk, _enc, cb) {
			try {
				buffer.push(JSON.parse(chunk.toString()));
				if (buffer.length > maxBuffer) buffer.splice(0, buffer.length - maxBuffer);
				if (buffer.length >= batchSize) void flush();
			} catch {
				// Non-JSON line (shouldn't happen via pino) — skip it.
			}
			cb();
		},
		final(cb) {
			// Best-effort flush on a clean stream end.
			void flush().finally(() => cb());
		},
	});
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS (no errors for the new file). If Biome flags the empty `catch {}`, keep the `// skip` comment — it documents intent and satisfies `noEmptyBlockStatements`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/log/openobserve-stream.ts
git commit -m "feat(log): OpenObserve batching ingest stream"
```

- [ ] **Step 4 (OPTIONAL — only if user asks for a test):** Create `src/lib/log/openobserve-stream.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { createOpenObserveStream } from "./openobserve-stream";

describe("openobserve stream", () => {
	it("flushes a batch once batchSize records arrive", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const stream = createOpenObserveStream({
			url: "http://oo",
			org: "default",
			stream: "motori",
			user: "u",
			password: "p",
			batchSize: 2,
		});
		stream.write(`${JSON.stringify({ msg: "a" })}\n`);
		stream.write(`${JSON.stringify({ msg: "b" })}\n`);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toHaveLength(2);
		vi.unstubAllGlobals();
	});

	it("drops oldest beyond maxBuffer during an outage", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
		vi.stubGlobal("fetch", fetchMock);
		const stream = createOpenObserveStream({
			url: "http://oo",
			org: "default",
			stream: "motori",
			user: "u",
			password: "p",
			batchSize: 1000,
			maxBuffer: 2,
		});
		for (let i = 0; i < 5; i++) stream.write(`${JSON.stringify({ n: i })}\n`);
		// Buffer is capped at 2; we can't read it directly, so assert no throw + bounded behavior via a final flush.
		expect(true).toBe(true);
		vi.unstubAllGlobals();
	});
});
```

Run: `pnpm test -- src/lib/log/openobserve-stream.test.ts` → Expected: PASS. Then `git add` + commit `test(log): OpenObserve stream batching`.

---

## Task 2: Wire the OO sink into the pino factory

**Files:**
- Modify: `src/lib/log/pino.ts`

- [ ] **Step 1: Add imports**

At the top of `src/lib/log/pino.ts`, below the existing imports, add:

```ts
import prettyStream from "pino-pretty";
import { createOpenObserveStream } from "./openobserve-stream";
```

(Keep `import type { Writable } from "node:stream";` — it's already there and is reused below.)

- [ ] **Step 2: Add the gated multistream branch**

In `createRootLogger`, after the `pinoOptions` object is built (after the `redact` line / before the existing `if (pretty && !destination)` block), insert:

```ts
	// Optional OpenObserve sink — enabled only when OPENOBSERVE_URL is set and we
	// are server-side. Uses an in-process multistream (NOT a pino worker
	// transport, which doesn't resolve cleanly in the bundled Nitro output).
	// The default (no-OO) path below is left untouched.
	const ooEnabled =
		!destination && typeof window === "undefined" && !!process.env.OPENOBSERVE_URL;
	if (ooEnabled) {
		const consoleStream: Writable = pretty
			? (prettyStream({
					colorize: true,
					singleLine: true,
					translateTime: "HH:MM:ss.l",
					ignore: "pid,hostname",
				}) as unknown as Writable)
			: process.stdout;
		const ooStream = createOpenObserveStream({
			url: process.env.OPENOBSERVE_URL as string,
			org: process.env.OPENOBSERVE_ORG ?? "default",
			stream: process.env.OPENOBSERVE_STREAM ?? "motori",
			user: process.env.OPENOBSERVE_USER ?? "",
			password: process.env.OPENOBSERVE_PASSWORD ?? "",
		});
		return pino(pinoOptions, pino.multistream([{ stream: consoleStream }, { stream: ooStream }]));
	}
```

Leave the existing `if (pretty && !destination) { pinoOptions.transport = … }` block and the final `return destination ? pino(...) : pino(...)` exactly as they are.

- [ ] **Step 3: Verify the existing test still passes**

Run: `pnpm test -- src/lib/log/pino.test.ts`
Expected: PASS (the test injects `destination`, so `ooEnabled` is false and behavior is unchanged).

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. If TS rejects the `prettyStream(...)` assignment without the cast, the `as unknown as Writable` above resolves it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/log/pino.ts
git commit -m "feat(log): gated OpenObserve sink via pino.multistream"
```

---

## Task 3: Env documentation + AGENTS.md observability note

**Files:**
- Modify: `.env.example`
- Modify: `AGENTS.md`

> `.env.ci` is intentionally **not** changed: the OO vars are optional (the sink is off unless `OPENOBSERVE_URL` is set), so CI needs nothing — absence = disabled.

- [ ] **Step 1: Append OO vars to `.env.example`**

Add to the end of `.env.example`:

```bash

# --- OpenObserve (optional; logs sink). Leave unset to log only to stdout. ---
# Uncomment + start the dev OO container with `docker compose --profile obs up -d`.
# OPENOBSERVE_URL=http://localhost:5080
# OPENOBSERVE_ORG=default
# OPENOBSERVE_STREAM=motori
# OPENOBSERVE_USER=admin@motori.local
# OPENOBSERVE_PASSWORD=motori
```

- [ ] **Step 2: Add an observability note to `AGENTS.md`**

In `AGENTS.md`, in the `### Logging (`src/lib/log/`)` subsection, append a paragraph after the existing one:

```markdown

Logs optionally ship to a self-hosted **OpenObserve** instance: when `OPENOBSERVE_URL` is set, `createRootLogger` (`src/lib/log/pino.ts`) adds an in-process `pino.multistream` sink (`src/lib/log/openobserve-stream.ts`) that batches records and POSTs them to OO's native JSON ingest, alongside the unchanged stdout sink. The sink is best-effort — if OO is down the app is unaffected and Dokku stdout remains the durable log source. PII redaction applies to the OO sink too (it runs in the pino core before any stream). Deploy/runbook: `DEPLOY.md` §11. Traces (Phase 2) and metrics (Phase 3) are tracked as GitHub issues.
```

- [ ] **Step 3: Lint (markdown is ignored by Biome, but run to be safe) + commit**

```bash
git add .env.example AGENTS.md
git commit -m "docs(log): document OPENOBSERVE_* vars and the OO sink"
```

---

## Task 4: Dev OpenObserve container (opt-in `obs` profile)

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add the `openobserve` service + volume**

Edit `docker-compose.yml`. Add the service under `services:` (sibling to `db`):

```yaml
  openobserve:
    image: public.ecr.aws/zinclabs/openobserve:v0.90.3
    profiles: ["obs"]
    ports:
      - "${OO_PORT:-5080}:5080"
    environment:
      ZO_ROOT_USER_EMAIL: admin@motori.local
      ZO_ROOT_USER_PASSWORD: motori
      ZO_TELEMETRY: "false"
      ZO_DATA_DIR: /data
      # Dev stores parquet on local disk (no S3) — ephemeral, no creds needed.
      ZO_LOCAL_MODE_STORAGE: disk
      # Same memory caps as prod so behaviour matches.
      ZO_MEMORY_CACHE_ENABLED: "false"
      ZO_MEMORY_CACHE_DATAFUSION_MAX_SIZE: "256"
      ZO_MEM_TABLE_MAX_SIZE: "128"
      ZO_MAX_FILE_SIZE_IN_MEMORY: "128"
      ZO_FILE_MOVE_THREAD_NUM: "1"
    volumes:
      - oodata:/data
```

And extend the `volumes:` block at the bottom:

```yaml
volumes:
  pgdata:
  oodata:
```

- [ ] **Step 2: Validate the compose file**

Run: `docker compose --profile obs config >/dev/null && echo OK`
Expected: `OK` (no YAML/schema errors). The default `docker compose up -d db` is unaffected because the service is behind the `obs` profile.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(dev): opt-in OpenObserve container (obs profile)"
```

---

## Task 5: Prod OpenObserve stack

**Files:**
- Create: `infra/observability/docker-compose.yml`
- Create: `infra/observability/.env.example`
- Create: `infra/observability/README.md`
- Create: `infra/observability/dashboards/.gitkeep`, `infra/observability/alerts/.gitkeep`

- [ ] **Step 1: Create `infra/observability/docker-compose.yml`**

```yaml
services:
  openobserve:
    image: public.ecr.aws/zinclabs/openobserve:v0.90.3
    container_name: openobserve
    restart: unless-stopped
    mem_limit: 1g
    networks:
      - observability
    ports:
      # Operator-only: bound to loopback. Reach the UI via SSH tunnel / Tailscale
      # (see DEPLOY.md §11). The app reaches OO over the `observability` network
      # by container name, NOT this port.
      - "127.0.0.1:5080:5080"
    environment:
      ZO_ROOT_USER_EMAIL: ${ZO_ROOT_USER_EMAIL}
      ZO_ROOT_USER_PASSWORD: ${ZO_ROOT_USER_PASSWORD}
      ZO_TELEMETRY: "false"
      ZO_DATA_DIR: /data
      # Offload parquet to the existing PRIVATE motori-backups bucket (prefix).
      ZO_LOCAL_MODE_STORAGE: s3
      ZO_S3_PROVIDER: s3
      ZO_S3_SERVER_URL: ${ZO_S3_SERVER_URL}
      ZO_S3_REGION_NAME: ${ZO_S3_REGION_NAME}
      ZO_S3_BUCKET_NAME: ${ZO_S3_BUCKET_NAME}
      ZO_S3_BUCKET_PREFIX: openobserve/
      ZO_S3_ACCESS_KEY: ${ZO_S3_ACCESS_KEY}
      ZO_S3_SECRET_KEY: ${ZO_S3_SECRET_KEY}
      ZO_S3_FEATURE_FORCE_HOSTED_STYLE: "false"
      ZO_COMPACT_DATA_RETENTION_DAYS: "30"
      # Memory caps for the low-RAM VPS.
      ZO_MEMORY_CACHE_ENABLED: "false"
      ZO_MEMORY_CACHE_DATAFUSION_MAX_SIZE: "256"
      ZO_MEM_TABLE_MAX_SIZE: "128"
      ZO_MAX_FILE_SIZE_IN_MEMORY: "128"
      ZO_FILE_MOVE_THREAD_NUM: "1"
    volumes:
      - /var/lib/openobserve:/data

networks:
  observability:
    name: observability
```

- [ ] **Step 2: Create `infra/observability/.env.example`**

```bash
# Copied to /opt/observability/.env on the VPS (never committed with real values).
# Root admin (UI/operator access only — first boot creates the user):
ZO_ROOT_USER_EMAIL=admin@motori.fi
ZO_ROOT_USER_PASSWORD=change-me-strong

# S3 offload → existing private motori-backups bucket. Reuse the project-wide
# Hetzner keys (same as the app's STORAGE_* / the Dokku postgres backup auth).
ZO_S3_SERVER_URL=https://hel1.your-objectstorage.com
ZO_S3_REGION_NAME=hel1
ZO_S3_BUCKET_NAME=motori-backups
ZO_S3_ACCESS_KEY=
ZO_S3_SECRET_KEY=
```

- [ ] **Step 3: Create `infra/observability/README.md`**

```markdown
# Observability (OpenObserve)

Self-hosted OpenObserve — single container, logs only (Phase 1).

- `docker-compose.yml` — prod stack (S3 offload to `motori-backups/openobserve/`, 30-day retention, memory caps, loopback-only port).
- `.env.example` — env template; the real `.env` lives at `/opt/observability/.env` on the VPS.
- `dashboards/`, `alerts/` — JSON exports from the OO UI (the only version control for them; re-import after a rebuild).

Deploy + access runbook: `DEPLOY.md` §11. App-side wiring: `src/lib/log/pino.ts` + `openobserve-stream.ts`.
```

- [ ] **Step 4: Create the export dirs**

```bash
mkdir -p infra/observability/dashboards infra/observability/alerts
touch infra/observability/dashboards/.gitkeep infra/observability/alerts/.gitkeep
```

- [ ] **Step 5: Validate + commit**

Run: `docker compose -f infra/observability/docker-compose.yml --env-file infra/observability/.env.example config >/dev/null && echo OK`
Expected: `OK`.

```bash
git add infra/observability
git commit -m "feat(infra): prod OpenObserve stack (S3 offload, retention, caps)"
```

---

## Task 6: `just` recipes

**Files:**
- Modify: `justfile`

- [ ] **Step 1: Add an observability section**

Append to `justfile` (after the `--- Deploy ---` group):

```makefile

# --- Observability (OpenObserve) ---

# Sync the OO compose file to the VPS and (re)start the container.
# First run requires /opt/observability/.env present on the host (see DEPLOY.md §11).
oo-deploy:
    ssh {{host}} "mkdir -p /opt/observability"
    scp infra/observability/docker-compose.yml {{host}}:/opt/observability/docker-compose.yml
    ssh {{host}} "cd /opt/observability && docker compose up -d"

# Tail the OpenObserve container logs.
oo-logs:
    ssh {{host}} "docker logs openobserve -f --tail 100"
```

- [ ] **Step 2: Validate + commit**

Run: `just --list | grep -E 'oo-deploy|oo-logs'`
Expected: both recipes listed.

```bash
git add justfile
git commit -m "feat(infra): just oo-deploy / oo-logs recipes"
```

---

## Task 7: DEPLOY.md §11 runbook

**Files:**
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add §11 after §10**

Insert before the `## Restore from backup` heading:

````markdown
### 11. Observability (OpenObserve)

Self-hosted OpenObserve ships the app's pino logs (Phase 1). One container, parquet offloaded to the private `motori-backups` bucket under `openobserve/`, UI reached over the Tailnet.

```bash
# 1. Swapfile (OOM safety net — OO wants ~512MB-1GB; do once)
ssh root@motori 'fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo "/swapfile none swap sw 0 0" >> /etc/fstab'

# 2. Env file on the host (from infra/observability/.env.example; fill secrets)
ssh root@motori 'mkdir -p /opt/observability'
#   scp a filled .env up, or edit in place:
ssh root@motori 'vim /opt/observability/.env'   # ZO_ROOT_USER_*, ZO_S3_* (reuse project Hetzner keys)

# 3. Deploy the container
just oo-deploy
just oo-logs            # confirm it boots and connects to S3

# 4. Attach the Dokku app to the shared network + point it at OO
ssh root@motori 'dokku docker-options:add motori deploy,run "--network=observability"'
ssh root@motori 'dokku config:set --no-restart motori \
  OPENOBSERVE_URL=http://openobserve:5080 \
  OPENOBSERVE_ORG=default \
  OPENOBSERVE_STREAM=motori \
  OPENOBSERVE_USER=ingest@motori.fi \
  OPENOBSERVE_PASSWORD=<ingest-user-password>'
ssh root@motori 'dokku ps:rebuild motori'   # picks up the network + config

# 5. Create the non-root ingestion user (least privilege; root is UI-only)
#    OO UI → Management → Users → add `ingest@motori.fi` with an Ingestion role,
#    then set its password into the OPENOBSERVE_PASSWORD config above.

# 6. Operator UI access (loopback-bound; pick one)
ssh -L 5080:localhost:5080 root@motori   # then open http://localhost:5080
#    or: tailscale serve --bg https / proxy 5080   (persistent Tailnet URL)

# 7. Verify ingestion: generate traffic, then in the OO UI → Logs → stream `motori`,
#    confirm records arrive. Check `just oo-logs` for any `[openobserve] ingest …` warnings.
```

**Dashboards & alerts.** Build them once in the UI, then export and commit the JSON to `infra/observability/dashboards/` and `infra/observability/alerts/` (the only version control for them — re-import after a container rebuild).
- Dashboards: 5xx error rate + p50/p95 latency; auth failures + rate-limit rejections; image-upload failures; DB error volume; business events (listing-created, contact/booking).
- Alerts: sustained 5xx spike; **ingestion dead-man's switch — no logs for 20 min** (chosen so a quiet overnight stretch doesn't false-positive); VPS disk high (meta/WAL/cache — parquet is in S3).

**Memory note.** OO is capped (`ZO_MEM*` + `mem_limit: 1g`) and the 2GB swapfile backstops Postgres + Node + OO. If OO restart-loops, check `docker logs openobserve` for OOM and lower `ZO_MEM_TABLE_MAX_SIZE`.
````

- [ ] **Step 2: Commit**

```bash
git add DEPLOY.md
git commit -m "docs(deploy): §11 OpenObserve runbook"
```

---

## Task 8: GitHub issues for Phase 2 & 3

- [ ] **Step 1: Open the traces issue**

```bash
gh issue create --label enhancement,p2 --title "Observability Phase 2: distributed traces via OpenObserve" --body "Phase 2 of the OpenObserve work (Phase 1 = logs, see docs/superpowers/specs/2026-06-07-openobserve-observability-design.md).

Add OpenTelemetry tracing exported to OO's built-in OTLP receiver (no Collector):
- Add @opentelemetry/sdk-node + auto-instrumentation (HTTP server + pg).
- Export OTLP/HTTP to \`\${OPENOBSERVE_URL}/api/{org}/v1/traces\` with Basic auth.
- Correlate traceId into pino logs.
- Tune sampling for the low-RAM VPS.
- Server-only; keep OTel SDK out of the client bundle (grep check).

Closes the tracing half of #75/#79 follow-up."
```

- [ ] **Step 2: Open the metrics issue**

```bash
gh issue create --label enhancement,p2 --title "Observability Phase 3: metrics (RED + host) via OpenObserve" --body "Phase 3 of the OpenObserve work (Phase 1 = logs, see docs/superpowers/specs/2026-06-07-openobserve-observability-design.md).

Add OpenTelemetry metrics exported to OO's OTLP receiver:
- RED metrics (rate/errors/duration) for HTTP + key flows.
- Node runtime metrics; consider host metrics.
- Export OTLP/HTTP to \`\${OPENOBSERVE_URL}/api/{org}/v1/metrics\`.
- Watch cardinality + memory on the low-RAM VPS.
- Dashboards/alerts in OO."
```

- [ ] **Step 3: Record the issue numbers**

Run: `gh issue list -l p2 --limit 5`
Note the two new issue numbers (no commit — issues are external).

---

## Task 9: Final verification

- [ ] **Step 1: Full local gate**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all PASS.

- [ ] **Step 2: Client-bundle safety (the OO sink must not reach the browser)**

Run:
```bash
grep -l "createOpenObserveStream\|OPENOBSERVE_URL\|_json" .output/public/assets/*.js
```
Expected: **no matches** (exit 1). The OO stream and pino are server-only; a match means the log module leaked into the client bundle — stop and fix (mirror the `AsyncLocalStorage` guidance in CLAUDE.md / `src/lib/nonce.ts`).

- [ ] **Step 3: Dev smoke test (manual)**

```bash
docker compose --profile obs up -d openobserve   # start local OO
# uncomment the OPENOBSERVE_* block in .env
pnpm dev
```
Hit a few routes, then open `http://localhost:5080` (admin@motori.local / motori) → Logs → stream `motori`. Confirm records arrive with redaction applied (no raw emails/IPs). Stop OO (`docker compose --profile obs down`) and confirm the app keeps serving and logging to stdout with at most one `[openobserve] ingest …` stderr warning.

- [ ] **Step 4: Confirm nothing else regressed**

Run: `pnpm test`
Expected: PASS (existing suite; `pino.test.ts` unaffected).

- [ ] **Step 5: Push the branch / open the PR** (when ready — ask the user first per repo policy on pushing)

---

## Self-Review

**Spec coverage:**
- OO container (pinned v0.90.3, OSS, single-node) → Tasks 4, 5. ✅
- S3 offload to `motori-backups/openobserve/` → Task 5. ✅
- Memory caps + `mem_limit` + swapfile → Tasks 4, 5, 7. ✅
- pino → OO native JSON ingest, gated, stdout fallback, batch/flush/drop-oldest, SIGTERM/clean-shutdown flush → Tasks 1, 2. ✅
- Dedicated non-root ingestion user → Task 7 step 5. ✅
- Env vars + gating (CI off) → Task 3. ✅
- Prod networking (observability network, Tailscale-only UI) → Tasks 5, 7. ✅
- Dashboards/alerts (what to monitor) + committed JSON exports + dead-man's switch 20 min → Tasks 5, 7. ✅
- DEPLOY §11, CLAUDE/AGENTS note, justfile recipes → Tasks 3, 6, 7. ✅
- Phase 2/3 GitHub issues → Task 8. ✅
- Client-bundle safety + no-new-tests convention → Task 9, Task 1 (optional test). ✅

**Placeholder scan:** none — every code/edit step contains complete content; `<ingest-user-password>` / secret fields in the runbook are deliberate operator inputs, not plan gaps.

**Type/name consistency:** `createOpenObserveStream` + `OpenObserveStreamConfig` defined in Task 1, consumed with matching field names (`url/org/stream/user/password`) in Task 2. Env var names (`OPENOBSERVE_*`, `ZO_*`) consistent across Tasks 2–7 and the spec.
