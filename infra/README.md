# Vuokramoto Infrastructure

Single Hetzner Cloud VPS running the app (served at **motori.fi**) and PostgreSQL. Terraform manages provisioning; deployments are manual rsync + systemd.

## Server

| Attribute | Value |
|-----------|-------|
| Provider | Hetzner Cloud |
| Type | CX33 (4 vCPU, 8 GB RAM, 80 GB NVMe) |
| OS | Ubuntu 24.04 LTS |
| Location | hel1 (Helsinki) |
| Monthly cost | ~€8.29 (€6.49 server + €0.50 IPv4 + €1.30 backups) |

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

Hetzner automatic backups are enabled (`backups = true`). Hetzner keeps 7 daily snapshots and rotates them automatically. Backups add 20% to server cost (~€1.30/mo).

For database-level backups, set up a pg_dump cron job and copy dumps off-server (e.g. to Hetzner Storage Box or S3).

## Protections

Both `delete_protection` and `rebuild_protection` are enabled on the server and primary IP. The Tailscale auth key is single-use and burned on first boot — combined with `rebuild_protection`, this means a botched cloud-init isn't recoverable via `terraform taint` + apply. Recovery is the Hetzner web console (VNC) or disabling protections and rebuilding with a fresh auth key.

To destroy or rebuild, you must first disable them:

```bash
# In Hetzner console: Server > Actions > Disable delete protection
# Or via hcloud CLI:
hcloud server disable-protection app-server delete rebuild
hcloud primary-ip disable-protection app-ip delete
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
