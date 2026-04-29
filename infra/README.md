# Motori Infrastructure

Single Hetzner Cloud VPS running the app (served at **motori.fi**) via Docker Compose. Terraform provisions the box; deployments are driven by `just` recipes (`just deploy` for routine code changes, `just bootstrap` after a rebuild, `just nuke` for full DR).

## Server

| Attribute | Value |
|-----------|-------|
| Provider | Hetzner Cloud |
| Type | CX33 (4 vCPU, 8 GB RAM, 80 GB NVMe) |
| OS | Ubuntu 24.04 LTS |
| Location | hel1 (Helsinki) |
| Monthly cost | ~€7.51 (€6.49 server + €0.50 IPv4 + €0.52 pgdata volume) + Object Storage for pg_dump backups (pennies) |

## Stack

The whole runtime stack runs in containers, declared in `docker-compose.prod.yml` at the repo root:

- **`db`** — `postgres:17-alpine`. Data lives on the host at `/var/lib/motori/pgdata` (the Hetzner volume mount), bind-mounted into the container at `/var/lib/postgresql/data`. `PGDATA` is a subdir (`/var/lib/postgresql/data/pgdata`) to sidestep the `lost+found` directory ext4 creates at the mount root.
- **`migrate`** — oneshot, built from the `migrator` Dockerfile target. Runs `pnpm db:migrate` against `db`, exits 0, the app waits on `service_completed_successfully`.
- **`app`** — built from the `runner` target. Reads `/etc/motori.env`. Listens on port 3000, exposed only inside the compose network.
- **`nginx`** — `nginx:alpine`. Terminates TLS using the Cloudflare Origin Certificate at `/etc/ssl/motori.fi.{pem,key}`, proxies to `http://app:3000`. Binds host ports 80 and 443.

The dev `docker-compose.yml` (just Postgres on `:5433`) stays the same — `pnpm dev` is unaffected.

## Volume

A 10 GB `hcloud_volume` named `pgdata` is attached to the server and mounted at `/var/lib/motori/pgdata`. The volume has `delete_protection = true` and survives `terraform destroy` (you must disable delete protection first).

Device path inside the server: `/dev/disk/by-id/scsi-0HC_Volume_<volume_id>` (Hetzner uses the numeric volume ID, not the name)
fstab entry: added by cloud-init with `nofail` so a missing volume doesn't brick boot.

**Resizing the volume** (online, no downtime):

```bash
# In Terraform: increase size, then terraform apply
# On the server:
resize2fs /dev/disk/by-id/scsi-0HC_Volume_pgdata
```

**Get the volume ID:**

```bash
terraform output volume_id
```

## SSH access

Port 22 is not exposed publicly. SSH is only accessible over Tailscale.

**Connect:**
```bash
ssh root@app-server
```

That's it — no SSH key, no password. Tailscale SSH authenticates you via your tailnet identity.

**Prerequisites (one-time per local machine):**

1. Install Tailscale and log in to the same tailnet that owns the server:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh   # Linux/WSL; macOS+Windows have installers
   sudo tailscale up                                  # opens a browser to log in
   ```
2. Verify the server is visible:
   ```bash
   tailscale status                                   # app-server should appear with a 100.x IP
   ```
3. If `app-server` doesn't resolve as a hostname, enable MagicDNS in the Tailscale admin console — or use the IP directly (`ssh root@$(tailscale ip -4 app-server)`).

**Tailscale ACL requirement:**

The tailnet ACL must permit SSH as `root` to nodes tagged `tag:server`. The relevant policy block:

```jsonc
{
  "tagOwners": { "tag:server": ["autogroup:admin"] },
  "ssh": [
    {
      "action": "accept",
      "src":    ["autogroup:member"],
      "dst":    ["tag:server"],
      "users":  ["root"]
    }
  ]
}
```

Without this you'll get `tailnet policy does not permit you to SSH as user "root"`. The server tags itself via `--advertise-tags=tag:server` in cloud-init.

## Recovery plan

Port 22 is closed to the public internet, so Tailscale is the only way in. If cloud-init fails or Tailscale never comes up, use **Hetzner Cloud Console → your server → "Console"** (browser VNC, bypasses SSH and the firewall). Hetzner emails the initial root password when the server is created — keep that email until you've confirmed Tailscale SSH works.

Diagnose with:
```bash
cloud-init status --long
tail -200 /var/log/cloud-init-output.log
docker ps -a
docker compose -f /opt/motori/docker-compose.prod.yml logs --tail=100
```

If the Tailscale auth key was burned by a partial cloud-init run, generate a fresh non-ephemeral, single-use, pre-approved key in the admin console and run `tailscale up --authkey=tskey-... --ssh`.

## Firewall

Managed by Hetzner Cloud firewall (`hcloud_firewall.web`). Only inbound rules — Hetzner allows all outbound by default.

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 80 | TCP | 0.0.0.0/0, ::/0 | HTTP (redirects to HTTPS) |
| 443 | TCP | 0.0.0.0/0, ::/0 | HTTPS |

SSH (port 22) is not exposed — access is via Tailscale only.

## DNS & TLS

DNS is managed in **Cloudflare** (not the registrar directly). Terraform doesn't touch DNS. The `domain` variable is the source of truth, used for nginx `server_name` and `BETTER_AUTH_URL`.

A `hcloud_primary_ip` resource holds the static IPv4 with `auto_delete = false` and `delete_protection = true` — it survives server rebuilds and `terraform destroy`.

```bash
terraform output server_ip     # IPv4 for the A record
terraform output server_ipv6   # IPv6 for the AAAA record
```

Cloudflare DNS records (both proxied — orange cloud):

| Name | Type | Value |
|------|------|-------|
| `motori.fi` | A | `terraform output server_ip` |
| `motori.fi` | AAAA | `terraform output server_ipv6` |
| `www.motori.fi` | A | `terraform output server_ipv6` |

**TLS is handled by Cloudflare** using a Cloudflare Origin Certificate (free, 15-year validity). Cloudflare terminates HTTPS at the edge and connects to the nginx container over HTTPS using the origin cert. SSL mode in the Cloudflare dashboard must be **Full (strict)**: motori.fi → SSL/TLS → Overview.

The origin cert lives in `infra/certs/` (gitignored) and is deployed to `/etc/ssl/motori.fi.{pem,key}` on the host via `just push-certs`. The nginx config (`infra/nginx/motori.conf`) is rsynced to `/opt/motori/nginx/motori.conf` by `just push-config` (called from every `just deploy`).

## Backups

Hetzner server backups are disabled — the DB lives on the separate `pgdata` volume (which doesn't get included in server snapshots anyway) and the OS/config layer is fully reproducible via Terraform + deployment.

Instead, a nightly `pg_dump` cron runs at 02:00 and uploads a gzipped dump to Hetzner Object Storage:

- Script: `/usr/local/bin/db-backup` — runs `docker compose exec -T db pg_dump …`
- Credentials: `/etc/db-backup.env` (written by cloud-init, mode 600)
- Log: `/var/log/db-backup.log`
- Retention: last 30 dumps (older ones are pruned after each run)

The backup S3 bucket lives in `fsn1` while the server lives in `hel1` — intentional DR isolation so a Hetzner Helsinki outage doesn't take backups with it.

**Restore a backup:**

```bash
# List available dumps
aws s3 ls s3://<bucket>/db-backups/ --endpoint-url <endpoint>

# Download and pipe through psql in the container
aws s3 cp s3://<bucket>/db-backups/pgdump-20260101-020000.sql.gz - \
  --endpoint-url <endpoint> | gunzip | \
  ssh root@app-server "docker compose -f /opt/motori/docker-compose.prod.yml exec -T db psql -U appuser appdb"
```

**Run a backup manually:** `just backup`

## Protections

The **primary IP** has `delete_protection = true`. The **server** has no delete/rebuild protection, so `terraform taint` + apply works without manual steps. The **pgdata volume** has `delete_protection = true`. To drop the volume disable protection first:

```bash
hcloud volume disable-protection pgdata delete
hcloud primary-ip disable-protection app-ip delete  # if also removing the IP
```

## Terraform operations

State lives in the **`motori-tfstate`** Hetzner Object Storage bucket (Helsinki, `hel1`) with native S3 lockfile-based locking. The bucket must exist before `terraform init`. Bootstrap once:

1. Create the bucket by hand in the Hetzner Cloud Console: project → Object Storage → Create bucket → name `motori-tfstate`, location `Helsinki`.
2. Generate an Object Storage access key (Security → Object Storage → Generate credentials). One set of credentials addresses both `motori-tfstate` and `motori-backups`.
3. Export the credentials before running terraform:
   ```bash
   export AWS_ACCESS_KEY_ID=...
   export AWS_SECRET_ACCESS_KEY=...
   ```

Then:

```bash
cd infra
terraform init          # first time only
terraform plan
terraform apply
```

## What cloud-init installs

Runs once on first boot. Takes ~1–2 minutes (much shorter than the previous Node/Postgres native install).

- Docker Engine + Compose plugin (from Docker's official apt repo)
- Tailscale (joins the tailnet via single-use auth key)
- UFW (secondary firewall, mirrors Hetzner firewall rules)
- AWS CLI v2 (via the official installer — Ubuntu 24.04 dropped the apt package)
- `git`, `curl`, `unzip`, `ca-certificates`
- Backup cron (`/usr/local/bin/db-backup`, 02:00 daily)

Also:
- Formats and mounts the `pgdata` volume at `/var/lib/motori/pgdata`
- Writes `/etc/motori.env` (mode 600) with `NODE_ENV`, `PORT`, `DB_PASSWORD`, and `DATABASE_URL` pre-filled
- Disables SSH password authentication

It does **not** push config or start containers — those happen on first deploy (`just bootstrap`).

## Deployment

There are three flows, in increasing order of impact:

| Command | When to use | Roughly does |
|---------|-------------|--------------|
| `just deploy` | Routine code change merged to `main` | rsync compose+nginx → `docker pull` (from GHCR) → migrate → `up -d` |
| `just bootstrap` | After `terraform apply` of a fresh server (or after `just rebuild`) | Wait for cloud-init → GHCR login → push env → push compose+nginx → push certs → deploy |
| `just nuke` | Disaster recovery — destroy + rebuild + bootstrap end-to-end | `just rebuild` + `just bootstrap` |

The VPS holds **no source code** — only the compose file, nginx config, env, and TLS certs. Application images come from GHCR; everything else is rsynced from this repo.

### Routine deploys

```bash
just deploy                       # ships :latest (last green build of main)
just deploy tag=<short-or-full-sha>  # roll back / pin a specific build
```

`push-config` rsyncs `docker-compose.prod.yml` and `nginx/motori.conf` to `/opt/motori/`, then SSHes to the server, pulls the matching `motori-app` and `motori-migrate` images from GHCR, runs the `migrate` oneshot, then `up -d`. No build, no clone, no `git` on the VPS — images come from CI (`.github/workflows/ci.yml`, `release` job, gated on the full test suite).

### First-time bootstrap (or after a rebuild)

Prerequisites:
- `infra/secrets/ghcr-token` — a GitHub PAT with `read:packages` scope. See "GHCR access" below.
- `.env.production` at the repo root, with `DB_PASSWORD` matching the `db_password` tfvar.
- `infra/certs/motori.com.{pem,key}` — the Cloudflare origin certificate.

Then:

```bash
just bootstrap
```

Runs `wait-for-server → login → push-env → push-config → push-certs → deploy`. Each step is idempotent — re-running after a failure picks back up cleanly.

### Disaster recovery

```bash
just nuke
```

`taint` the server in Terraform, `apply` (volume + IP survive — both delete-protected), then full bootstrap. Total time ~3–5 min on the CX33 (faster than before since no build runs on the VPS).

⚠ **Manual step required first**: delete the existing `app-server` node in the Tailscale admin console, otherwise the new VPS registers as `app-server-1` and SSH (which targets `app-server` via MagicDNS) hits the dead node. There's no Tailscale CLI for this from the local side — open the admin and click delete.

### Build location

Builds run in GitHub Actions (`.github/workflows/ci.yml`, `release` job, gated on `lint + format + typecheck + test + e2e`) on every push to `main`, producing two images in **GHCR**:

- `ghcr.io/christianvilen/motori-app` (Dockerfile target `runner`)
- `ghcr.io/christianvilen/motori-migrate` (target `migrator`)

Each image is published with three tags: full SHA, short SHA (7 chars), and `:latest`. The VPS only pulls — no build CPU on production, no latency spike during deploy. Rollback is a one-liner: `just deploy tag=ad1549d` re-pulls and restarts in ~10 seconds.

### GHCR access

Both image packages are private (the repo is private). The server authenticates to GHCR with a personal access token persisted in `/root/.docker/config.json`.

1. Generate a token at github.com/settings/tokens — classic with scope `read:packages`, or a fine-grained PAT with package read access on this repo.
2. Save it as a single line (no trailing newline) at `infra/secrets/ghcr-token`. The directory is gitignored.
3. `just login` (called automatically by `bootstrap`) pipes it into `docker login ghcr.io` on the server. Run it again whenever you rotate the token.

## Installed services

| Service | Managed by | Config location |
|---------|-----------|-----------------|
| All app/db/nginx containers | `docker compose` | `/opt/motori/docker-compose.prod.yml`, env in `/etc/motori.env` |
| Backup cron | cron | `/etc/cron.d/db-backup` |
| Tailscale | systemd | `/etc/default/tailscaled` |
