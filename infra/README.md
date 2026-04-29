# Motori Infrastructure

Single Hetzner CX33 in `hel1` running Docker Compose. Terraform provisions; `just` deploys.

## Server

| Attribute | Value |
|-----------|-------|
| Type | CX33 (4 vCPU, 8 GB RAM, 80 GB NVMe) |
| OS | Ubuntu 24.04 LTS |
| Location | hel1 (Helsinki) |
| Cost | ~€7.51/mo (server + IPv4 + 10 GB pgdata volume) + Object Storage pennies |

The VPS holds **no source code** — only `/opt/motori/docker-compose.prod.yml`, `/opt/motori/nginx/motori.conf`, `/etc/motori.env`, and TLS certs at `/etc/ssl/motori.fi.{pem,key}`. App images come from GHCR.

Containers (see `docker-compose.prod.yml` for the full spec):

- **`db`** — `postgres:17-alpine`, data on the Hetzner volume at `/var/lib/motori/pgdata`.
- **`migrate`** — oneshot. Runs `pnpm db:migrate`, blocks `app` start until exit 0.
- **`app`** — TanStack Start runtime, listens on `:3000` inside the compose network.
- **`nginx`** — TLS termination, proxies to `app:3000`, binds host `:80`/`:443`.

## Deployment

```bash
just deploy                          # ships :latest (last green main build)
just deploy tag=<short-or-long-sha>  # rollback / pin
```

`deploy` rsyncs the compose file + nginx config, pulls GHCR images, runs migrations, restarts. Images are built by `.github/workflows/ci.yml` (`release` job, gated on `lint + format + typecheck + test + e2e`) and published as:

- `ghcr.io/christianvilen/motori-app` (Dockerfile target `runner`)
- `ghcr.io/christianvilen/motori-migrate` (target `migrator`)

Each is tagged `<full-sha>`, `<short-sha>` (7 chars), and `:latest`.

### Bootstrap (first deploy or after rebuild)

Prerequisites:

- `infra/secrets/ghcr-token` — GitHub PAT (classic, scope `read:packages`, or fine-grained with package read). Single line, no trailing newline.
- `.env.production` at the repo root, `DB_PASSWORD` matching the `db_password` tfvar.
- `infra/certs/motori.com.{pem,key}` — Cloudflare origin certificate.

```bash
just bootstrap
```

Runs `wait-for-server → login → push-env → push-config → push-certs → deploy`. Idempotent.

### Disaster recovery

```bash
just nuke   # rebuild server + full bootstrap (~3–5 min)
```

The `pgdata` volume and primary IPv4 are delete-protected and survive.

⚠ Before `nuke`: delete the old `app-server` node in the Tailscale admin console, otherwise the new VPS registers as `app-server-1`.

## SSH access

Port 22 is closed publicly — SSH is via Tailscale only.

```bash
ssh root@app-server   # Tailscale SSH authenticates via tailnet identity
```

One-time per local machine: install Tailscale, `sudo tailscale up`, confirm `tailscale status` shows `app-server`. The tailnet ACL must permit SSH as root to `tag:server`:

```jsonc
{
  "tagOwners": { "tag:server": ["autogroup:admin"] },
  "ssh": [{ "action": "accept", "src": ["autogroup:member"], "dst": ["tag:server"], "users": ["root"] }]
}
```

The server tags itself via `--advertise-tags=tag:server` in cloud-init.

**Last-resort access** if Tailscale is broken: Hetzner Cloud Console → server → "Console" (browser VNC). Hetzner emails the initial root password on creation — keep it until Tailscale SSH is verified working.

## DNS & TLS

Cloudflare (proxied) for `motori.fi` and `www.motori.fi`. Terraform doesn't touch DNS — pull current values with `just output`. SSL mode in Cloudflare must be **Full (strict)**.

The Cloudflare origin certificate (free, 15-year validity) lives in `infra/certs/` (gitignored) and is pushed by `just push-certs`. The static IPv4 has `delete_protection = true` and survives rebuilds.

## Storage

**`pgdata` volume** — 10 GB Hetzner volume mounted at `/var/lib/motori/pgdata`, `delete_protection = true`. Resize: bump size in Terraform → `apply` → on the server `resize2fs /dev/disk/by-id/scsi-0HC_Volume_$(terraform output -raw volume_id)`.

**Backups** — nightly `pg_dump` cron at 02:00 → gzipped → Hetzner Object Storage in `fsn1` (separate region from the server in `hel1` for DR isolation). Retention 30 dumps. Manual: `just backup`.

Restore:

```bash
aws s3 cp s3://<bucket>/db-backups/pgdump-<ts>.sql.gz - --endpoint-url <endpoint> | gunzip | \
  ssh root@app-server "docker compose -f /opt/motori/docker-compose.prod.yml exec -T db psql -U appuser appdb"
```

## Firewall

Hetzner Cloud firewall, inbound only:

| Port | Purpose |
|------|---------|
| 80 | HTTP → HTTPS redirect |
| 443 | HTTPS |

SSH (22) is not exposed.

## What cloud-init installs

Runs once on first boot (~1–2 min): Docker + Compose plugin, Tailscale, UFW, AWS CLI v2, backup cron, app cron. Mounts the pgdata volume, writes `/etc/motori.env` (mode 600) with `NODE_ENV`/`PORT`/`DB_PASSWORD`/`DATABASE_URL`, disables SSH password auth. Doesn't push config or start containers — `just bootstrap` does that.

## Terraform state

Lives in the **`motori-tfstate`** Hetzner Object Storage bucket (`hel1`) with native S3 lockfile-based locking. First-time setup:

1. Create the bucket in the Hetzner Cloud Console (Object Storage, location `hel1`).
2. Generate Object Storage credentials (Security → Object Storage). Same key works for `motori-tfstate` and `motori-backups`.
3. Export `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, then `terraform init`.

## Protections

| Resource | Protected | Why |
|----------|-----------|-----|
| `pgdata` volume | yes | DB lives here |
| Primary IPv4 | yes | DNS pinned |
| Server | no | `taint` + apply rebuilds it |

To drop a protected resource: `hcloud volume disable-protection pgdata delete` (or equivalent for the IP).

## Recovery diagnostics

```bash
cloud-init status --long
tail -200 /var/log/cloud-init-output.log
docker ps -a
just logs
```

If a Tailscale auth key was burned by a partial cloud-init: generate a fresh non-ephemeral, single-use, pre-approved key in admin and run `tailscale up --authkey=tskey-... --ssh`.
