# Observability (OpenObserve)

Self-hosted OpenObserve — logs only (Phase 1). In **prod** it runs as a **Dokku app**
(`openobserve`) served at https://logs.motori.fi (Dokku nginx + wildcard `*.motori.fi`
cert), with parquet offloaded to the private `motori-backups` bucket. The `motori` app
ships logs to it over a private `observability` Docker network. **Dev** runs OO as a plain
compose service in the root `docker-compose.yml` (`docker compose up -d`).

- `.env.example` — the canonical list of `dokku config:set openobserve …` values (S3
  offload, 30-day retention, memory caps). Not a compose env file.
- `dashboards/`, `alerts/` — JSON exports from the OO UI (the only version control for
  them; re-import after a rebuild).

Deploy runbook: `DEPLOY.md` §11. `just oo-deploy` / `just oo-logs`. App-side wiring:
`src/lib/log/pino.ts` + `openobserve-stream.ts`.
