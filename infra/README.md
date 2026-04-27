# Motori Infrastructure

Single Hetzner Cloud VPS running the app (served at **motori.fi**) and PostgreSQL. Terraform manages provisioning; deployments are manual rsync + systemd.

## Server

| Attribute | Value |
|-----------|-------|
| Provider | Hetzner Cloud |
| Type | CX33 (4 vCPU, 8 GB RAM, 80 GB NVMe) |
| OS | Ubuntu 24.04 LTS |
| Location | hel1 (Helsinki) |
| Monthly cost | ~€7.51 (€6.49 server + €0.50 IPv4 + €0.52 pgdata volume) + Object Storage for pg_dump backups (pennies) |

## Volume

A 10 GB `hcloud_volume` named `pgdata` is attached to the server. PostgreSQL's data directory (`/var/lib/postgresql`) lives on it. The volume has `delete_protection = true` and is **not** tied to the server lifecycle — it survives `terraform destroy` (you must disable delete protection first) and can be reattached to a replacement server.

Device path inside the server: `/dev/disk/by-id/scsi-0HC_Volume_<volume_id>` (Hetzner uses the numeric volume ID, not the name — the ID is baked into cloud-init by Terraform via `hcloud_volume.pgdata.id`)  
Mount point: `/var/lib/postgresql`  
fstab entry: added by cloud-init with `nofail` so a missing volume doesn't brick boot.

**Migrating an existing server** (if you provisioned before the volume existed):

```bash
# 1. Attach the new volume (already done by terraform apply)
# 2. On the server — stop postgres, copy data, swap mount
systemctl stop postgresql
mkfs.ext4 /dev/disk/by-id/scsi-0HC_Volume_pgdata
mount /dev/disk/by-id/scsi-0HC_Volume_pgdata /mnt/pgdata-new
rsync -a /var/lib/postgresql/ /mnt/pgdata-new/
umount /mnt/pgdata-new
echo '/dev/disk/by-id/scsi-0HC_Volume_pgdata /var/lib/postgresql ext4 defaults,nofail 0 2' >> /etc/fstab
mv /var/lib/postgresql /var/lib/postgresql.bak
mkdir /var/lib/postgresql
mount /var/lib/postgresql
systemctl start postgresql
# Verify, then: rm -rf /var/lib/postgresql.bak
```

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

**How it works:**
- Tailscale is installed on first boot and joins your tailnet via a single-use auth key
- `tailscale up --ssh` enables Tailscale SSH — the daemon listens on port 22 inside the tailnet and validates connections against the ACL
- Password authentication is disabled in `sshd` as a belt-and-suspenders measure
- Port 22 is absent from the Hetzner firewall — invisible to the public internet

**First login after provisioning:**
```bash
ssh root@app-server
cloud-init status --wait      # blocks until first-boot setup finishes (~2–3 min)
cloud-init status --long      # should say "status: done"
```

## Recovery plan

Port 22 is closed to the public internet, so Tailscale is the only way in. If cloud-init fails or Tailscale never comes up, the box is unreachable via SSH. Path back in:

1. **Hetzner Cloud Console → your server → "Console" button.** Browser-based VNC session, bypasses SSH and the firewall entirely.
2. **Log in as `root`.** Hetzner emails the initial root password when the server is created — keep that email until you've confirmed Tailscale SSH works. (SSH key auth via VNC isn't supported; it's a real terminal, not an ssh client.)
3. **Diagnose:**
   ```bash
   cloud-init status --long              # did it finish? did it fail?
   tail -200 /var/log/cloud-init-output.log
   tail -200 /var/log/cloud-init.log
   tailscale status                       # is the node connected?
   journalctl -u tailscaled -n 100
   ```
4. **Common fix — Tailscale key burned/expired.** The auth key is single-use; if cloud-init crashed after burning it, re-running `tailscale up` won't work. Generate a fresh non-ephemeral, single-use, pre-approved key in the Tailscale admin console and run:
   ```bash
   tailscale up --authkey=tskey-... --ssh
   ```
5. **If cloud-init itself failed mid-run**, fix the underlying issue and either re-run the failed step manually or `cloud-init clean && cloud-init init` (rare; usually faster to fix by hand).

Once Tailscale SSH works, close the VNC tab and use `ssh root@app-server` from your tailnet as normal.

## Firewall

Managed by Hetzner Cloud firewall (`hcloud_firewall.web`). Only inbound rules — Hetzner allows all outbound by default.

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 80 | TCP | 0.0.0.0/0, ::/0 | HTTP (redirects to HTTPS) |
| 443 | TCP | 0.0.0.0/0, ::/0 | HTTPS |

SSH (port 22) is not exposed — access is via Tailscale only.

## DNS & TLS

DNS is managed in **Cloudflare** (not the registrar directly). Terraform doesn't touch DNS. The `domain` variable is the source of truth and is baked into the nginx config via cloud-init.

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
| `www.motori.fi` | A | `terraform output server_ip` |
| `www.motori.fi` | AAAA | `terraform output server_ipv6` |

**TLS is handled by Cloudflare** using a Cloudflare Origin Certificate (free, 15-year validity). Cloudflare terminates HTTPS at the edge and connects to the server over HTTPS using the origin cert. SSL mode in the Cloudflare dashboard must be **Full (strict)**: motori.fi → SSL/TLS → Overview.

- Flexible: don't use — Cloudflare connects to origin over plain HTTP, no cert validation.
- Full: Cloudflare connects over HTTPS but accepts any cert including self-signed. Avoid.
- **Full (strict)**: Cloudflare verifies the origin cert. Correct for this setup.

The origin cert and nginx SSL config both live in the repo under `infra/certs/` (gitignored) and `infra/nginx/motori.conf`. Deploy both with `just push-certs`.

## Backups

Hetzner server backups are disabled — the DB lives on the separate `pgdata` volume (which doesn't get included in server snapshots anyway) and the OS/config layer is fully reproducible via Terraform + deployment.

Instead, a nightly `pg_dump` cron runs at 02:00 and uploads a gzipped dump to Hetzner Object Storage:

- Script: `/usr/local/bin/db-backup`
- Credentials: `/etc/db-backup.env` (written by cloud-init, mode 600)
- Log: `/var/log/db-backup.log`
- Retention: last 30 dumps (older ones are pruned after each run)
- Failures: the script runs under `set -euo pipefail` and the prune step no longer masks errors, so any failure exits non-zero. There's no external alerting — check `/var/log/db-backup.log` periodically, or `aws s3 ls s3://<bucket>/db-backups/` to confirm a recent dump exists.

The backup S3 bucket lives in `fsn1` while the server lives in `hel1` — intentional DR isolation so a Hetzner Helsinki outage doesn't take backups with it.

**Restore a backup:**

```bash
# List available dumps
aws s3 ls s3://<bucket>/db-backups/ --endpoint-url <endpoint>

# Download and restore
aws s3 cp s3://<bucket>/db-backups/pgdump-20260101-020000.sql.gz - \
  --endpoint-url <endpoint> | gunzip | sudo -u postgres psql appdb
```

**Run a backup manually:**

```bash
ssh root@app-server /usr/local/bin/db-backup
```

## Protections

The **primary IP** has `delete_protection = true` — it survives `terraform destroy` and accidental deletion. The **server** has no delete/rebuild protection, so `terraform taint` + apply or a full destroy/recreate works without manual steps.

The **pgdata volume** has `delete_protection = true` — DB data survives server destruction. To drop the volume you must disable protection first:

```bash
hcloud volume disable-protection pgdata delete
hcloud primary-ip disable-protection app-ip delete  # if also removing the IP
```

## Terraform operations

State lives in the **`motori-tfstate`** Hetzner Object Storage bucket (Helsinki, `hel1`) with native S3 lockfile-based locking — no DynamoDB. The bucket must exist before `terraform init`. Bootstrap once:

1. Create the bucket by hand in the Hetzner Cloud Console: project → Object Storage → Create bucket → name `motori-tfstate`, location `Helsinki`.
2. Generate an Object Storage access key in the same project (Security → Object Storage → Generate credentials). The key is project-wide; one set of credentials addresses both `motori-tfstate` (state) and `motori-backups` (db dumps).
3. Export the credentials before running terraform:
   ```bash
   export AWS_ACCESS_KEY_ID=...
   export AWS_SECRET_ACCESS_KEY=...
   ```

Then:

```bash
cd infra

terraform init          # first time only — downloads hcloud provider, configures S3 backend
terraform plan          # preview changes
terraform apply         # provision / update
terraform destroy       # tear down everything (protections must be disabled first)
terraform output        # show server IP
```

If you ever need to migrate state out of S3 (or recover from a deleted state file), `terraform state pull > backup.tfstate` works against the remote backend.

## What cloud-init installs

Runs once on first boot. Takes ~2-3 minutes.

- Node.js 24 (via NodeSource)
- pnpm — version pinned via `var.pnpm_version`, must match `package.json`'s `packageManager` field
- PostgreSQL 17 (via PGDG apt repo — Ubuntu 24.04's default is 16; we pin 17 to match dev)
- Nginx + an `/etc/nginx/sites-available/motori` site (HTTP bootstrap only — replaced by SSL config via `just push-certs`)
- UFW (secondary firewall, mirrors Hetzner firewall rules)
- AWS CLI (used by the backup cron)

Also:
- Creates PostgreSQL user `appuser` and database `appdb`, then verifies `appuser` can authenticate
- Creates the `app` system user; the `motori.service` systemd unit runs as `app`
- Creates `/opt/motori` (deployment target, owned `app:app`)
- Writes `/etc/motori.env` (mode 600, owned `app:app`) with `DATABASE_URL` pre-filled
- Enables `motori.service` (it will sit in `failed` state until the first deploy populates `/opt/motori` — expected)
- Disables SSH password authentication

## Deployment

Root deploys (over Tailscale SSH); the service runs as the unprivileged `app` user.

```bash
# Local: build the app
pnpm build

# Local: copy to server (over Tailscale — port 22 isn't public)
rsync -avz --delete .output/ root@app-server:/opt/motori/.output/
rsync -avz package.json pnpm-lock.yaml root@app-server:/opt/motori/

# Server: install deps, fix ownership, restart
ssh root@app-server "cd /opt/motori && pnpm install --prod && chown -R app:app /opt/motori && systemctl restart motori"
```

Before the first deploy, edit `/etc/motori.env` on the server and add the remaining secrets (`BETTER_AUTH_SECRET`, `STORAGE_*`, `RESEND_*`, etc.). `DATABASE_URL` is already set by cloud-init.

### TLS certificates (after server rebuild)

The Cloudflare Origin Certificate lives in `infra/certs/` (gitignored). The SSL nginx config is in `infra/nginx/motori.conf` (committed). Deploy both in one step:

```bash
just push-certs
```

This copies the certs, deploys the nginx SSL config, tests it, and reloads nginx. Cloudflare SSL mode must be **Full (strict)**.

## Installed services

| Service | Managed by | Config location |
|---------|-----------|-----------------|
| Motori app (Node.js, runs as `app`) | systemd | `/etc/systemd/system/motori.service`, env in `/etc/motori.env` |
| PostgreSQL | systemd | `/etc/postgresql/` |
| Nginx | systemd | `/etc/nginx/sites-available/motori` |
