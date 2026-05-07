# Dokku migration & redeploy — design

**Issue:** [#80](https://github.com/ChristianVilen/motori/issues/80)
**Branch:** `dokku`
**Date:** 2026-05-07

## Goal

Wipe the existing Hetzner VPS and rebuild it as a single-VPS Dokku host. Redeploy Motori on Dokku via the Node buildpack with Postgres + Let's Encrypt + nightly encrypted backups. Establish the deploy pattern that issues #78 (Umami) and #79 (Grafana + Loki) will follow.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Build strategy | Heroku Node buildpack | Zero config; `package.json` already has `packageManager` and a `build` script. Dockerfile path can come later as a learning exercise. |
| VPS topology | Single VPS for prod + future side services | Dokku handles multi-app cleanly on one box. 80 GB is plenty for #78/#79. |
| Cutover safety | Rebuild in place, no snapshot, no parallel | Prod has no real users. Fix forward if it breaks. |
| Old deploy artifacts | Delete in this branch | `Dockerfile`, `docker-compose*.yml`, `.dockerignore`, `infra/`, `.env.production*`, `.sops.yaml` all tied to the old Compose/Terraform setup. |
| Doc location | `DEPLOY.md` at repo root | Discoverable at 11 pm when the VPS dies. |
| Issue scope | Full cutover | Branch lands when motori.fi serves over HTTPS on Dokku with verified backup restore. |

## Repo changes (this branch)

### Delete
- `Dockerfile`
- `docker-compose.yml`, `docker-compose.prod.yml`
- `.dockerignore`
- `infra/` (Terraform, cloud-init, nginx, certs, justfile)
- `.env.production`, `.env.production.enc`, `.sops.yaml`

### Add
- `Procfile`:
  ```
  release: pnpm db:migrate
  web: pnpm start
  ```
  Release-phase migrations run before each deploy swaps in; no more manual `dokku run` after every push.
- `DEPLOY.md` at repo root — runbook populated with the *real* commands run during cutover.
- App-side `www.motori.fi` → `motori.fi` 301 redirect middleware in the Nitro/TanStack Start server.
- `secrets/motori.env.age` — age-encrypted `dokku config:export` output, committed as the off-VPS backup of prod secrets.

### Modify
- `package.json`: add `"engines": { "node": "24.x" }` so the buildpack pins explicitly (the buildpack reads `engines.node`, not `.nvmrc`).

### Verify (no expected change)
- `package.json` has `"packageManager": "pnpm@10.33.0"` so the buildpack picks pnpm.
- `start` script binds to `process.env.PORT` (Nitro default).
- `.env.example` covers everything needed for `dokku config:set`.

## Phased plan

### Phase 0 — Pre-flight
- Note current DNS records, env vars, Hetzner Object Storage credentials.
- Lower DNS TTL on `motori.fi` and `www.motori.fi` A records to 60 s **at least 24 h before** the planned cutover so propagation is minutes, not hours.
- Confirm `.env.example` is current.

### Phase 1 — Repo prep
- Apply repo changes above as the first commit set on the `dokku` branch.
- Land `DEPLOY.md` skeleton with the runbook below as the starting outline; fill in real commands as later phases execute.

### Phase 2 — Server bootstrap
- Hetzner: rebuild VPS with Ubuntu 24.04.
- Non-root user, SSH key only, `ufw` (allow 22/80/443), `unattended-upgrades`, `fail2ban`.
- Add a 2 GB swapfile (cheap insurance against build OOM on small instances).

### Phase 3 — Dokku install
```
wget -NP . https://dokku.com/install/v0.34.x/bootstrap.sh
sudo DOKKU_TAG=v0.34.x bash bootstrap.sh
dokku ssh-keys:add admin < ~/.ssh/authorized_keys
dokku domains:set-global motori.fi
```

### Phase 4 — Postgres
```
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git
dokku postgres:create motori --image-version 17
```

### Phase 5 — App create + link
```
dokku apps:create motori
dokku postgres:link motori motori
dokku domains:set motori motori.fi www.motori.fi
```

### Phase 6 — Config
- `dokku config:set motori …` for every key in `.env.example`:
  freshly generated `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://motori.fi`,
  Hetzner Object Storage creds, `RESEND_API_KEY`, `CRON_SECRET`, `LOG_LEVEL=info`.
- `DATABASE_URL` is injected by `postgres:link` — do not set manually.

### Phase 7 — First deploy
```
# locally
git remote add dokku dokku@<vps-ip>:motori
git push dokku dokku:main
```
- Release phase auto-runs `pnpm db:migrate`.
- Smoke test on the Dokku-issued hostname / VPS IP **before** flipping DNS.

### Phase 8 — TLS
```
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
dokku letsencrypt:set motori email ops@motori.fi
dokku letsencrypt:enable motori
dokku letsencrypt:cron-job --add
```

### Phase 9 — DNS cutover
- Flip A records for `motori.fi` and `www.motori.fi` to the VPS IP.
- Full smoke test: signup → listing creation → image upload → booking → www redirect → TLS valid.

### Phase 10 — Backups
```
dokku postgres:backup-auth motori <s3-key> <s3-secret> default hel1.your-objectstorage.com
dokku postgres:backup-set-encryption motori <gpg-key-id>
dokku postgres:backup-schedule motori "0 3 * * *" <bucket>
```
- **Verified restore:** pull yesterday's backup, decrypt, `pg_restore` into a throwaway DB, smoke check. Document the restore command in DEPLOY.md.

### Phase 11 — Cron jobs (host crontab)
Motori uses `/api/cron/*` endpoints protected by `CRON_SECRET`. Add to root crontab:
```
0 6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://motori.fi/api/cron/notify-expiry
0 4 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://motori.fi/api/cron/purge-sessions
```
(Exact paths confirmed against `src/lib/notify-expiry.ts` and `purge-sessions.ts` during implementation.)

### Phase 12 — Secrets backup
```
dokku config:export --format=docker-args motori | age -r <age-pubkey> > secrets/motori.env.age
git add secrets/motori.env.age && git commit
```
Re-run whenever prod config changes.

### Phase 13 — Document
- Capture every actual command run into `DEPLOY.md`.
- Note any deviations from this design for future-you at 11 pm when the VPS dies.

## Acceptance criteria

- `motori.fi` resolves to Dokku app over HTTPS with valid Let's Encrypt cert.
- `www.motori.fi` 301-redirects to `motori.fi`.
- `git push dokku main` deploys cleanly; release phase runs migrations.
- Postgres data persists across redeploys.
- Nightly encrypted backup to Hetzner Object Storage; one restore verified end-to-end.
- Cron jobs hit `/api/cron/*` on schedule.
- `DEPLOY.md` committed with the real commands.
- `secrets/motori.env.age` committed as off-VPS secrets backup.

## Out of scope

- Dockerfile-based Dokku deploy (deferred — buildpack first).
- GitHub Actions → Dokku CI/CD (manual `git push dokku main` for now).
- `CHECKS` file / `/healthz` endpoint (default port-bind check is sufficient for v1).
- Hetzner Object Storage versioning / image backups.
- Observability beyond default Dokku logs (covered by #79).

## Open risks

- Build OOM on small VPS — mitigated by 2 GB swap in Phase 2.
- Heroku Node buildpack pnpm support depends on buildpack version. If it misbehaves, fallback is `BUILDPACK_URL=https://github.com/heroku/heroku-buildpack-nodejs#main` or pinning a known-good tag.
- DNS propagation longer than expected if Phase 0 TTL lowering is skipped.
