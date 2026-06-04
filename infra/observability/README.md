# Observability — Loki + Promtail (+ Grafana as a Dokku app)

Self-hosted log aggregation for the Motori app. Pino stdout JSON → Promtail → Loki → Grafana.
Grafana is **not** in this compose stack — it runs as a Dokku app so it inherits Dokku's nginx
vhost, TLS, and proxy (`grafana.motori.fi`). See `DEPLOY.md` §11 for the full prod runbook.

## Local dev

The **root** `docker-compose.yml` runs Loki + Grafana for local dev (no Promtail — the app
pushes pino logs straight to Loki via the `pino-loki` transport, gated on `LOKI_URL`). The
config files here (`loki-config.yml`, `grafana/provisioning/`) are reused by that compose.

- `pnpm dev` (`scripts/dev.sh`) starts the stack **and** the Vite server together;
  **Ctrl+C stops everything**, containers included (`docker compose down` via a trap).
- Grafana: <http://localhost:3001> (anonymous admin — no login).
- `pnpm dev:down` is a manual teardown. Alerting is not provisioned in dev (no SMTP).
- `level` arrives as a text label in dev too (pino-loki maps it), so the same dashboards work.

## What's here

- `docker-compose.yml` — Loki + Promtail, on the external `observability` Docker network.
- `loki-config.yml` — single-binary, filesystem storage, 30-day retention.
- `promtail-config.yml` — discovers Docker containers via the socket, keeps only `motori.*`,
  parses pino JSON, maps numeric levels to text, attaches `requestId` as structured metadata.
- `grafana/provisioning/` — datasource, dashboards, and alert rules provisioned into the Grafana
  Dokku app (mounted via `dokku storage:mount`).

## Label discipline

Only **low-cardinality** fields are Loki labels: `app`, `level`, `host`, `container`.
Everything else stays in the log body — query it with LogQL `| json`:

```logql
{app="motori"} | json | status >= 500          # server errors
{app="motori", level="error"}                    # error lines (label)
{app="motori"} | json | event = "image.upload_failed"
{app="motori"} | requestId = `abc-123`           # structured metadata lookup
```

`requestId` is **structured metadata** (indexed for correlation) — never a label, to keep
index cardinality bounded.

## Bring-up (VPS)

```bash
docker network create observability                 # once
docker compose -f infra/observability/docker-compose.yml up -d
```

Or via `just`: `just obs-deploy`.

## Local smoke test

```bash
docker network create observability
docker compose -f infra/observability/docker-compose.yml up -d
# emit a pino-shaped line from a container named like the Dokku app:
docker run -d --name motori.web.1 alpine:3.20 sh -c \
  'while true; do echo "{\"level\":30,\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"requestId\":\"$(cat /proc/sys/kernel/random/uuid)\",\"path\":\"/\",\"status\":200,\"msg\":\"request\"}"; sleep 2; done'
sleep 12
curl -s 'http://127.0.0.1:3100/loki/api/v1/label/level/values' | jq .data   # ["info"]
# teardown:
docker rm -f motori.web.1
docker compose -f infra/observability/docker-compose.yml down -v
docker network rm observability
```
