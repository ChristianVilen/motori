# Vuokramoto Infrastructure

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

Device path inside the server: `/dev/disk/by-id/scsi-0HC_Volume_pgdata`  
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
ssh root@app-server-1
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
- fail2ban is installed as additional protection
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

## DNS

The app is served at **motori.fi** (and **www.motori.fi**). DNS is managed at the registrar — Terraform doesn't touch it. The `domain` Terraform variable is the source of truth and gets passed into cloud-init (written to `/etc/app-domain`) so Certbot and nginx config can read it.

A `hcloud_primary_ip` resource holds the static IPv4. It has `auto_delete = false` and `delete_protection = true`, so the IP survives server rebuilds and accidental `terraform destroy` — once DNS points here, it stays valid.

```bash
terraform output server_ip     # IPv4 for the A record
terraform output server_ipv6   # IPv6 for the AAAA record
terraform output dns_records   # full record set (apex + www)
```

Records to create at the registrar:

| Name | Type | Value |
|------|------|-------|
| `motori.fi` | A | `terraform output server_ip` |
| `motori.fi` | AAAA | `terraform output server_ipv6` |
| `www.motori.fi` | A | `terraform output server_ip` |
| `www.motori.fi` | AAAA | `terraform output server_ipv6` |

After DNS resolves, issue the TLS cert on the server (one-time):

```bash
ssh root@app-server "certbot --nginx -d motori.fi -d www.motori.fi --agree-tos -m c.vilen@outlook.com -n"
```

## Backups

Hetzner server backups are disabled — the DB lives on the separate `pgdata` volume (which doesn't get included in server snapshots anyway) and the OS/config layer is fully reproducible via Terraform + deployment.

Instead, a nightly `pg_dump` cron runs at 02:00 and uploads a gzipped dump to Hetzner Object Storage:

- Script: `/usr/local/bin/db-backup`
- Credentials: `/etc/db-backup.env` (written by cloud-init, mode 600)
- Log: `/var/log/db-backup.log`
- Retention: last 30 dumps (older ones are pruned after each run)

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

```bash
cd infra

terraform init          # first time only — downloads hcloud provider
terraform plan          # preview changes
terraform apply         # provision / update
terraform destroy       # tear down everything (protections must be disabled first)
terraform output        # show server IP
```

State is stored locally in `terraform.tfstate`. Don't lose it — it's how Terraform tracks what it manages. Back it up somewhere safe (e.g. a private S3 bucket or encrypted file in 1Password).

## What cloud-init installs

Runs once on first boot. Takes ~2-3 minutes.

- Node.js 24 (via NodeSource)
- pnpm (via corepack)
- PostgreSQL 17 (via PGDG apt repo — Ubuntu 24.04's default is 16; we pin 17 to match dev)
- Nginx
- Certbot + python3-certbot-nginx (for Let's Encrypt SSL)
- UFW (secondary firewall, mirrors Hetzner firewall rules)
- fail2ban

Also:
- Creates PostgreSQL user `appuser` and database `appdb`
- Disables SSH password authentication
- Creates `/opt/app` (app deployment directory)

## Deployment

See `IAC_PLAN.md` for the full deployment walkthrough. Short version:

```bash
# Local: build the app
pnpm build

# Local: copy to server (over Tailscale — port 22 isn't public)
rsync -avz .output/ root@app-server:/opt/app/.output/
rsync -avz package.json pnpm-lock.yaml root@app-server:/opt/app/

# Server: install deps and restart
ssh root@app-server "cd /opt/app && pnpm install --prod && systemctl restart app"
```

## Installed services

| Service | Managed by | Config location |
|---------|-----------|-----------------|
| App (Node.js) | systemd | `/etc/systemd/system/app.service` |
| PostgreSQL | systemd | `/etc/postgresql/` |
| Nginx | systemd | `/etc/nginx/sites-available/app` |
| fail2ban | systemd | `/etc/fail2ban/` |
