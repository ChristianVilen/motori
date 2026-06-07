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
- **Single admin.** SSO/OIDC is OO Enterprise-only and was dropped. UI is reached over Tailscale, not publicly exposed.

## Architecture

```
DEV (docker-compose, opt-in `--profile obs`)
  app (pino) ──HTTP──> openobserve:5080 ──> local disk /data (sqlite meta + parquet)
  app also ──> stdout (unchanged)

PROD (Hetzner VPS)
  Dokku app (pino) ──HTTP──> openobserve container ──> Hetzner S3 motori-backups/openobserve/
       │ also keeps                 │ standalone compose under infra/observability/  (parquet, 30-day retention)
       └─> stdout (Dokku logs,      │ local disk: sqlite meta + WAL + cache only (~GBs)
            fallback)               │ UI: Tailscale-only, no public route, no TLS cert
```

### Why this shape

- **S3 offload into the existing private `motori-backups` bucket** (prefix `openobserve/`), keeping the VPS disk small. The app's *image* bucket (`motori-images`) is public-read so logs can't go there — but `motori-backups` is already private (encrypted DB backups) and the Hetzner keys are project-wide, so OO reuses it under its own prefix with **no new bucket**. Backup objects live at the bucket root (`postgres-motori-*.tgz.gpg`); the `openobserve/` prefix keeps the two from colliding, and OO's compactor manages its own retention within its prefix.
- **Native JSON ingest, not the OTel SDK, for logs.** pino ships to OO's `POST /api/{org}/{stream}/_json` (Basic auth). This avoids pulling `@opentelemetry/*` into the Node process for Phase 1 (lower RAM, fewer deps). OO's OTLP receiver (`/api/{org}/v1/{logs,traces,metrics}` on :5080) is built in and stays available, so Phase 2 only adds an app-side OTel SDK pointed at `/v1/traces` — no infra change.
- **No OTel Collector container.** The app talks to OO directly. One less process competing for RAM.
- **stdout logging stays on.** The OO transport runs in a pino worker thread and is best-effort; if OO is down or slow it must never block or crash the app, and Dokku still captures stdout as a durable fallback log source.

## Components

### 1. OpenObserve container
- Image: `public.ecr.aws/zinclabs/openobserve:v0.90.3` — **pinned** (latest stable as of 2026-05-26; not `latest`, not the enterprise image the quickstart now defaults to). OO has had breaking changes between minor versions, so the tag is fixed and bumped deliberately.
- Single-node local mode (`ZO_LOCAL_MODE=true`), sqlite meta store (default in local mode — no etcd/postgres).
- Root admin via `ZO_ROOT_USER_EMAIL` / `ZO_ROOT_USER_PASSWORD` (first-boot only) — **for UI/admin access only** (see §4 for the separate app ingestion user).
- `ZO_TELEMETRY=false`.
- Data dir mounted at `/data` (`ZO_DATA_DIR=/data`), backed by a host volume.

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
- New pino transport module (e.g. `src/lib/log/openobserve-transport.ts`) built on `pino-abstract-transport`: batches records and POSTs a JSON array to `/api/{org}/{stream}/_json` with Basic auth, runs in a worker thread.
- **Batch / flush policy (explicit):**
  - Flush when **either** ~100 records are buffered **or** 5 seconds elapse, whichever first.
  - In-memory buffer cap ~1,000 records; if ingest is failing and the cap is hit, **drop oldest** (bounded memory — never grow unboundedly under an OO outage).
  - On `SIGTERM`/clean shutdown: attempt a final flush with a short (~2s) timeout, then exit.
  - On crash or flush failure: **accept the loss of the in-flight buffer.** This is acceptable because stdout → Dokku is the durable source of truth; OO is a queryable convenience layer, not the system of record. Documented as a deliberate trade-off, not an oversight.
- Wired as a **second target** alongside the existing stdout target (pino multi-transport), so stdout is never lost.
- **Gated on `OPENOBSERVE_URL`** — if unset (default in CI, and in dev when the `obs` profile isn't running), the transport is disabled and logging behaves exactly as today. Mirrors how the abandoned `pino-loki` transport was gated.
- **Dedicated ingestion user — not root.** Create a non-root OO user scoped to ingestion for the app to authenticate with; root creds are only for the operator UI. Limits blast radius if the app's creds leak. (Runbook step; cheap enough to do in Phase 1 rather than defer.)
- pino numeric levels are preserved (do not rebuild `src/lib/log/` core — `events.test.ts` asserts level 30). OO indexes `level` as a field; dashboards filter on the numeric value.
- New env vars: `OPENOBSERVE_URL`, `OPENOBSERVE_ORG` (default `default`), `OPENOBSERVE_STREAM` (e.g. `motori`), `OPENOBSERVE_USER` (the ingestion user), `OPENOBSERVE_PASSWORD`. Added to `.env.example` and `.env.ci` (empty/gated-off in CI).

### 5. Prod networking (Dokku app → OO container)
- OO joins an **external docker network** `observability`; the Dokku app is attached via `dokku docker-options:add motori deploy,run "--network=observability"` so it resolves OO by container name (`http://openobserve:5080`).
- OO's HTTP port is **not** published publicly. UI/API for the operator is reached over **Tailscale** (bind to the Tailscale interface / loopback + `tailscale serve`, runbook detail).
- Secrets (root password, ingestion-user password) via Dokku config + the existing `secrets/*.age` pattern. Nothing committed.

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

1. `docker-compose.yml` — add `openobserve` service (image pinned `v0.90.3`) under an opt-in `obs` profile (dev).
2. `infra/observability/docker-compose.yml` (+ `.env` template) — standalone prod OO stack with S3 offload to `motori-backups/openobserve/`, 30-day retention, mem caps, `mem_limit`.
3. `src/lib/log/openobserve-transport.ts` + wiring in `src/lib/log/pino.ts` (multi-target, gated on `OPENOBSERVE_URL`, batch/flush policy per §4).
4. Env: `.env.example`, `.env.ci` updated with the `OPENOBSERVE_*` vars (gated off in CI).
5. `DEPLOY.md` — new §11 (OpenObserve runbook: deploy, swapfile, root + ingestion users, retention, Tailscale access, verify ingestion, import dashboards/alerts). Replaces the abandoned Grafana §11.
6. `CLAUDE.md` / `AGENTS.md` — short observability section describing the pino→OO path and the gating env var.
7. `justfile` recipes: `oo-deploy` and `oo-logs` (both required — `oo-logs` for quick operator log tailing).
8. GitHub issues opened for **Phase 2 (traces)** and **Phase 3 (metrics)**.
9. **Dashboards + alerts committed as JSON exports** in `infra/observability/dashboards/` (and `.../alerts/`). OO dashboards/alerts are UI-created, so the JSON export is the **only** version control for them — a firm requirement, not "if practical." Losing alert config on a container rebuild is unacceptable; the runbook imports from these files.

## Out of scope (YAGNI / deferred)

- Traces (Phase 2 issue) and metrics (Phase 3 issue).
- OTel Collector.
- Public UI, TLS cert, OIDC/SSO.
- Rebuilding `src/lib/log/` core.
- Closing/cleaning up PR #124 and the `feat/logging-service` branch (separate housekeeping).

## Testing / verification

Per project convention, no new automated tests unless requested. Verification is:
- `pnpm typecheck` / `pnpm lint` / `pnpm build` pass.
- **Client-bundle safety (concrete mechanism):** the OO transport is referenced only by **module-path string** inside `pino.transport({ targets: [...] })` and executes in a worker thread — it is never statically `import`ed by client-reachable code, so it cannot enter the client graph. Verify with the existing bundle grep check pattern documented in CLAUDE.md (`grep -L` the transport's symbols across `.output/public/assets/*.js`), same as the `AsyncLocalStorage` guard.
- Gating: with `OPENOBSERVE_URL` unset, logging behaves exactly as today (CI stays green, no OO dependency in tests).
- Manual smoke test: bring up the dev `obs` profile, generate requests, confirm logs land in the OO UI; then the prod runbook's "verify ingestion" step after deploy.

## Open questions resolved

- Signals scope → logs first, OTLP scaffolded; traces/metrics are GH issues. ✅
- Dev parity → OO in dev via opt-in `obs` profile + prod. ✅
- Branch base → independent from `main`. ✅
- Ingestion → pino native JSON ingest now, OTLP receiver ready for Phase 2. ✅
- Exposure → Tailscale-only, no public route. ✅
- RAM → VPS ≥2GB, proceed with hard caps + swapfile. ✅
- Storage → S3 offload to existing private `motori-backups` bucket under `openobserve/` prefix, 30-day retention (no new bucket; image bucket is public-read so unusable for logs). ✅
- Image tag → pinned `v0.90.3`. ✅
- Flush policy → 100 records / 5s, bounded 1k buffer drop-oldest, best-effort flush on SIGTERM, accept loss on crash (stdout is durable). ✅
- Ingestion auth → dedicated non-root ingestion user. ✅
