# Observability (OpenObserve)

Self-hosted OpenObserve — single container, logs only (Phase 1).

- `docker-compose.yml` — prod stack (S3 offload to `motori-backups/openobserve/`, 30-day retention, memory caps, loopback-only port).
- `.env.example` — env template; the real `.env` lives at `/opt/observability/.env` on the VPS.
- `dashboards/`, `alerts/` — JSON exports from the OO UI (the only version control for them; re-import after a rebuild).

Deploy + access runbook: `DEPLOY.md` §11. App-side wiring: `src/lib/log/pino.ts` + `openobserve-stream.ts`.
