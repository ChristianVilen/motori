# OpenObserve observability — design (Phase 1: logs)

**Date:** 2026-06-07
**Branch:** `add-openobserve` (independent from `main`)
**Status:** Approved design, pending spec review
**Supersedes:** the abandoned Grafana + Loki + Promtail approach (PR #124, branch `feat/logging-service`). Closes the durable-logs need behind #75/#79.

## Goal

Stand up self-hosted observability for Motori using a single OpenObserve (OO) container on the existing Hetzner VPS. Phase 1 ships **logs** end to end: pino → OpenObserve, with dashboards and alerts for a marketplace app. Traces and metrics are explicitly deferred (Phase 2/3, tracked as GitHub issues) but the ingestion path is left ready for them.

## Constraints

- **RAM is the bottleneck.** VPS is ≥2GB and already runs Postgres + the Node app. OO wants ~512MB–1GB even tuned. Design must cap OO memory hard and add a swapfile as an OOM safety net.
- **Lean MVP / hobby project.** Prefer simple over clever. One container, no OTel Collector, no extra moving parts.
- **Self-hosted, EU (`hel1`), no third parties** — same GDPR posture as the rest of the infra.
- **Single admin.** SSO/OIDC/MFA is OO Enterprise-only and was dropped. The UI is **public at `https://logs.motori.fi`**, gated by OO's built-in username/password (strong root password). App log-ingest stays on a private network, never the public URL.

## Architecture

```
DEV (docker-compose; OO starts with `docker compose up -d` / `pnpm dev`)
  app (pino) ──HTTP──> openobserve:5080 ──> local disk /data (sqlite meta + parquet)
  app also ──> stdout (unchanged)

PROD (Hetzner VPS, Dokku)
  motori app (pino) ──HTTP──> openobserve (Dokku app) ──> Hetzner S3 motori-backups/openobserve/
       │ also keeps         │  via private `observability`     (parquet, 30-day retention)
       └─> stdout           │  docker network (openobserve.web:5080)
           (Dokku logs,     │  local disk: sqlite meta + WAL + cache only (~GBs)
            fallback)       │
                            └─> public UI: https://logs.motori.fi
                                (Dokku nginx + *.motori.fi cert; OO built-in login)
```

### Why this shape

- **S3 offload into the existing private `motori-backups` bucket** (prefix `openobserve/`), keeping the VPS disk small. The app's *image* bucket (`motori-images`) is public-read so logs can't go there — but `motori-backups` is already private (encrypted DB backups) and the Hetzner keys are project-wide, so OO reuses it under its own prefix with **no new bucket**. Backup objects live at the bucket root (`postgres-motori-*.tgz.gpg`); the `openobserve/` prefix keeps the two from colliding, and OO's compactor manages its own retention within its prefix.
- **Native JSON ingest, not the OTel SDK, for logs.** pino ships to OO's `POST /api/{org}/{stream}/_json` (Basic auth). This avoids pulling `@opentelemetry/*` into the Node process for Phase 1 (lower RAM, fewer deps). OO's OTLP receiver (`/api/{org}/v1/{logs,traces,metrics}` on :5080) is built in and stays available, so Phase 2 only adds an app-side OTel SDK pointed at `/v1/traces` — no infra change.
- **No OTel Collector container.** The app talks to OO directly. One less process competing for RAM.
- **stdout logging stays on.** The OO sink is best-effort and async-batched; if OO is down or slow it must never block or crash the app, and Dokku still captures stdout as a durable fallback log source.
- **OO runs as a Dokku app, not standalone compose.** Because the UI is public (`logs.motori.fi`), Dokku's nginx + the wildcard `*.motori.fi` cert + a single Cloudflare DNS record do the TLS/vhost work — exactly what Dokku is for. The `motori` app reaches OO over a private `observability` Docker network (internal alias `openobserve.web:5080`), so log ingest never traverses the public proxy. UI auth is OO's built-in username/password (OSS has no SSO/MFA — Enterprise-only, dropped); a strong root password gates `logs.motori.fi`.

## Components

### 1. OpenObserve (Dokku app, image-deployed)
- Image: `public.ecr.aws/zinclabs/openobserve:v0.90.3` — **pinned** (latest stable as of 2026-05-26; not `latest`, not the enterprise image the quickstart now defaults to). OO has had breaking changes between minor versions, so the tag is fixed and bumped deliberately.
- Deployed as a Dokku app named `openobserve` via `dokku git:from-image` (prod). Local dev still runs it as a plain compose service (root `docker-compose.yml`).
- Single-node local mode (`ZO_LOCAL_MODE=true`), sqlite meta store (default in local mode — no etcd/postgres).
- Root admin via `ZO_ROOT_USER_EMAIL` / `ZO_ROOT_USER_PASSWORD` (first-boot only) — **the public `logs.motori.fi` UI login**. The app uses a *separate, non-root* ingestion user (see §4).
- `ZO_TELEMETRY=false`.
- Data dir at `/data` (`ZO_DATA_DIR=/data`) via `dokku storage:mount`; container capped with `dokku resource:limit --memory 1g`. OO listens on 5080 — `dokku ports:set` maps public 80/443 → 5080 (from-image doesn't honour EXPOSE).

### 2. Storage & retention
- **S3 offload to `motori-backups`** (existing private bucket, prefix `openobserve/`). Parquet ingested data goes to object storage; only the sqlite meta store + transient WAL + query cache stay on the VPS `/data` host volume.
  ```
  ZO_LOCAL_MODE_STORAGE=s3
  ZO_S3_PROVIDER=s3
  ZO_S3_SERVER_URL=https://hel1.your-objectstorage.com
  ZO_S3_REGION_NAME=hel1
  ZO_S3_BUCKET_NAME=motori-backups
  ZO_S3_BUCKET_PREFIX=openobserve/
  ZO_S3_ACCESS_KEY=…        # reuse the project-wide Hetzner keys (same as STORAGE_*)
  ZO_S3_SECRET_KEY=…
  ZO_S3_FEATURE_FORCE_HOSTED_STYLE=false   # path-style — required for Hetzner
  ```
- **Retention: 30 days.** Set the stream retention to 30 days (UI/API stream setting; global default via `ZO_COMPACT_DATA_RETENTION_DAYS=30` — exact precedence confirmed against docs at implementation). OO's compactor enforces it within its prefix and reclaims storage.
- **Local disk still monitored** (see alerts) for the meta/WAL/cache footprint, but it stays small since parquet lives in S3.

### 3. Resource limits / tuning
OO defaults grab ~50% of host RAM for caches — must be capped. The in-memory **file cache** is disabled outright (query volume is tiny — a single admin browsing occasionally); the separate **query-engine** and **memtable** ceilings are still set because they are independent of the file-cache toggle:
```
ZO_MEMORY_CACHE_ENABLED=false              # disable the in-memory file cache entirely
ZO_MEMORY_CACHE_DATAFUSION_MAX_SIZE=256    # cap query-engine working memory (MB)
ZO_MEM_TABLE_MAX_SIZE=128                  # cap ingest memtable (MB) — not 50%-of-RAM default
ZO_MAX_FILE_SIZE_IN_MEMORY=128             # flush memtable to disk sooner (MB)
ZO_FILE_MOVE_THREAD_NUM=1                  # single compactor thread
```
(`ZO_MEMORY_CACHE_MAX_SIZE` is intentionally **omitted** — it only sizes the file cache, which is disabled.) Plus, in the prod compose: `mem_limit` (~768MB–1GB) and `restart: unless-stopped`. A **1–2GB swapfile** on the VPS as an OOM safety net (runbook step). Dev compose can skip `mem_limit` but keeps the same caps for parity.

### 4. Log shipping (app side)
- New OO stream module (`src/lib/log/openobserve-stream.ts`): an in-process `Writable` that batches records and POSTs a JSON array to `/api/{org}/{stream}/_json` with Basic auth. Wired via `pino.multistream` — **not** a pino *worker* transport, which doesn't resolve cleanly as a standalone module in the bundled Nitro output. The POST is async/batched so it stays non-blocking on the main thread.
- **Batch / flush policy (explicit):**
  - Flush when **either** ~100 records are buffered **or** 5 seconds elapse, whichever first.
  - In-memory buffer cap ~1,000 records; if ingest is failing and the cap is hit, **drop oldest** (bounded memory — never grow unboundedly under an OO outage).
  - On `SIGTERM`/clean shutdown: attempt a final flush with a short (~2s) timeout, then exit.
  - On crash or flush failure: **accept the loss of the in-flight buffer.** This is acceptable because stdout → Dokku is the durable source of truth; OO is a queryable convenience layer, not the system of record. Documented as a deliberate trade-off, not an oversight.
- Wired as a **second target** alongside the existing stdout target (pino multi-transport), so stdout is never lost.
- **Gated on `OPENOBSERVE_URL`** — if unset (default in CI, and in dev unless you set it), the sink is disabled and logging behaves exactly as today. Mirrors how the abandoned `pino-loki` transport was gated.
- **Dedicated ingestion user — not root.** Create a non-root OO user scoped to ingestion for the app to authenticate with; root creds are only for the operator UI. Limits blast radius if the app's creds leak. (Runbook step; cheap enough to do in Phase 1 rather than defer.)
- pino numeric levels are preserved (do not rebuild `src/lib/log/` core — `events.test.ts` asserts level 30). OO indexes `level` as a field; dashboards filter on the numeric value.
- New env vars: `OPENOBSERVE_URL`, `OPENOBSERVE_ORG` (default `default`), `OPENOBSERVE_STREAM` (e.g. `motori`), `OPENOBSERVE_USER` (the ingestion user), `OPENOBSERVE_PASSWORD`. Documented (commented) in `.env.example`. `.env.ci` is intentionally left unchanged — the vars are optional and the sink is gated on `OPENOBSERVE_URL`, so CI needs nothing (absence = disabled).

### 5. Prod networking & exposure (both Dokku apps)
- **Public UI:** OO is served at `https://logs.motori.fi` via Dokku's nginx + the wildcard `*.motori.fi` cert (`dokku domains:set` + `dokku certs:add`) + one Cloudflare DNS record. `dokku ports:set openobserve http:80:5080 https:443:5080` maps the proxy to OO's port.
- **Private ingest:** `motori` and `openobserve` share a `dokku network:create observability` (both attached via `dokku network:set <app> attach-post-create observability`). The app ships logs to the internal alias `http://openobserve.web:5080` — ingest never traverses the public proxy. Requires a rebuild of both apps after attaching.
- **Auth:** the public UI uses OO's built-in root login (strong password). The app authenticates as a separate non-root ingestion user (§4). OO OSS has no SSO/MFA; Cloudflare Access could be layered later if needed.
- Secrets (root password, ingestion-user password, S3 keys) via `dokku config:set` + the existing `secrets/*.age` pattern. Nothing committed.

## What to monitor (dashboards + alerts)

Phase 1 works from request logs + the existing typed event catalog (`src/lib/log/events.ts`).

**Dashboards**
- Request error rate (5xx) and p50/p95 latency over time.
- Auth failures and rate-limit rejections (security signal).
- Image-upload failures (sharp/S3 errors).
- DB error-log volume.
- Business signals from the event catalog: listings created, contact/booking actions.

**Alerts**
- Sustained 5xx spike (threshold over a short window).
- **Ingestion dead-man's switch** — alert if **no logs received for 20 minutes**. Chosen over a tighter window so a quiet overnight stretch on a low-traffic marketplace doesn't false-positive; still catches a genuinely dead app or broken pipeline within ~20 min.
- VPS disk usage high (sqlite meta + WAL + cache growth; parquet itself is in S3).

## Deliverables

1. `docker-compose.yml` — add `openobserve` service (image pinned `v0.90.3`) for dev (starts with `docker compose up -d`).
2. `infra/observability/` — `.env.example` (the canonical `dokku config:set` value list: S3 offload to `motori-backups/openobserve/`, 30-day retention, mem caps), `README.md`, and `dashboards/`+`alerts/`. Prod deploys OO as a **Dokku app** (`dokku git:from-image`), not a compose stack.
3. `src/lib/log/openobserve-stream.ts` + wiring in `src/lib/log/pino.ts` (`pino.multistream`, gated on `OPENOBSERVE_URL`, batch/flush policy per §4).
4. Env: `.env.example` documents the `OPENOBSERVE_*` vars (commented). `.env.ci` deliberately unchanged (vars optional/gated; absence = disabled).
5. `DEPLOY.md` — new §11 (OpenObserve runbook: swapfile, `dokku apps:create`/`git:from-image`, storage mount, ports, domain + wildcard cert, `observability` network, root + ingestion users, app wiring, verify ingestion, import dashboards/alerts). Replaces the abandoned Grafana §11.
6. `CLAUDE.md` / `AGENTS.md` — short observability section describing the pino→OO path and the gating env var.
7. `justfile` recipes: `oo-deploy` and `oo-logs` (both required — `oo-logs` for quick operator log tailing).
8. GitHub issues opened for **Phase 2 (traces)** and **Phase 3 (metrics)**.
9. **Dashboards + alerts committed as JSON exports** in `infra/observability/dashboards/` (and `.../alerts/`). OO dashboards/alerts are UI-created, so the JSON export is the **only** version control for them — a firm requirement, not "if practical." Losing alert config on a container rebuild is unacceptable; the runbook imports from these files.

## Out of scope (YAGNI / deferred)

- Traces (Phase 2 issue) and metrics (Phase 3 issue).
- OTel Collector.
- OIDC/SSO/MFA on the OO UI (Enterprise-only; the public UI relies on OO's built-in password. Cloudflare Access is a possible future layer).
- Rebuilding `src/lib/log/` core.
- Closing/cleaning up PR #124 and the `feat/logging-service` branch (separate housekeeping).

## Testing / verification

Per project convention, no new automated tests unless requested. Verification is:
- `pnpm typecheck` / `pnpm lint` / `pnpm build` pass.
- **Client-bundle safety (concrete mechanism):** the OO stream is imported only by `pino.ts`, which is server-only (pino is node-only and already excluded from the client bundle), and its construction is additionally guarded by `typeof window === "undefined"`. Verify with the existing bundle grep check pattern documented in CLAUDE.md (`grep -l` for `createOpenObserveStream`/`OPENOBSERVE_URL` across `.output/public/assets/*.js` — expect no matches), same as the `AsyncLocalStorage` guard.
- Gating: with `OPENOBSERVE_URL` unset, logging behaves exactly as today (CI stays green, no OO dependency in tests).
- Manual smoke test: `docker compose up -d` (starts local OO), set `OPENOBSERVE_URL`, generate requests, confirm logs land in the OO UI; then the prod runbook's "verify ingestion" step after deploy.

## Open questions resolved

- Signals scope → logs first, OTLP scaffolded; traces/metrics are GH issues. ✅
- Dev parity → OO in dev via `docker compose up -d` (no profile) + prod. ✅
- Branch base → independent from `main`. ✅
- Ingestion → pino native JSON ingest now, OTLP receiver ready for Phase 2. ✅
- Exposure → public UI at `https://logs.motori.fi` (OO as a Dokku app: nginx + wildcard cert + CF DNS); OO built-in login (no Access layer); app ingests over the private `observability` network. ✅
- RAM → VPS ≥2GB, proceed with hard caps + swapfile. ✅
- Storage → S3 offload to existing private `motori-backups` bucket under `openobserve/` prefix, 30-day retention (no new bucket; image bucket is public-read so unusable for logs). ✅
- Image tag → pinned `v0.90.3`. ✅
- Flush policy → 100 records / 5s, bounded 1k buffer drop-oldest, best-effort flush on SIGTERM, accept loss on crash (stdout is durable). ✅
- Ingestion auth → dedicated non-root ingestion user. ✅
