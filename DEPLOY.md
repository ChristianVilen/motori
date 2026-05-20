# Motori — deploy runbook

Production runs on a single Hetzner VPS as a Dokku app using the Heroku Node buildpack.

- **App name:** `motori`
- **Domains:** `motori.fi` (canonical), `www.motori.fi` (301 → apex via app middleware)
- **DB:** `dokku-postgres` plugin, Postgres 17, linked as `motori`. Data on Hetzner volume `pgdata` mounted at `/var/lib/dokku/services/postgres` (so DB survives VPS rebuild)
- **TLS:** Cloudflare Origin Cert installed via `dokku certs:add`. CF in front (Full strict), no ACME
- **Object storage:** Hetzner Object Storage (`hel1`)
  - `motori-images` — listing photos, public-read
  - `motori-backups` — encrypted nightly DB dumps, private
- **Deploy:** automatic via GitHub Actions on push to `main` (after CI passes). Manual fallback: `just deploy` (= `git push dokku main`)
- **Migrations:** auto-run via Procfile `release` phase (`pnpm db:migrate`)
- **Secrets:** age-encrypted in `secrets/*.age`, decrypt key at `~/.config/sops/age/keys.txt`

## Connection

```bash
ssh root@motori                                # via Tailscale
git remote add dokku dokku@<vps-ip>:motori     # local, one-time
```

## Phases

### 1. Server bootstrap

VPS rebuild applies `cloud-init.yaml` (handles swap, UFW, SSH hardening, Tailscale, fstab for the pgdata volume).

Prereqs:
- `pgdata` Hetzner volume already exists with ext4 + label `pgdata` (`mkfs.ext4 -L pgdata /dev/sdb` once, on a fresh volume).
- Volume attached to the server.
- Fresh Tailscale auth key with tag `tag:server` from https://login.tailscale.com/admin/settings/keys

```bash
# locally — temporarily insert the auth key, do NOT commit
sed -i "s|\${TAILSCALE_AUTH_KEY}|tskey-auth-…|" cloud-init.yaml
hcloud server rebuild app-server --image ubuntu-24.04 --user-data-from-file cloud-init.yaml
git checkout cloud-init.yaml   # restore placeholder immediately
```

Wait ~3 min for cloud-init to finish (Tailscale online + apt upgrades). SSH in:

```bash
ssh root@motori
mount | grep postgres   # should show /dev/sdb on /var/lib/dokku/services/postgres
```

### 2. Dokku install

```bash
ssh root@motori
wget -NP . https://dokku.com/install/latest/bootstrap.sh
DOKKU_TAG=v0.38.1 bash bootstrap.sh
```

Then add your local SSH public key for `git push dokku main`:

```bash
# locally
cat ~/.ssh/id_ed25519.pub | ssh root@motori "dokku ssh-keys:add admin"
```

### 3. Postgres + app create + link

```bash
ssh root@motori
dokku plugin:install https://github.com/dokku/dokku-postgres.git postgres
POSTGRES_IMAGE_VERSION=17 dokku postgres:create motori
dokku apps:create motori
dokku postgres:link motori motori
dokku domains:add motori motori.fi www.motori.fi
dokku ports:set motori http:80:3000 https:443:3000
dokku nginx:set motori client-max-body-size 12m
```

### 4. Config (env vars)

Source of truth: `secrets/dokku-config.sh.age`. Apply in one command:

```bash
just config-apply
```

To rotate values, decrypt, edit, re-encrypt:
```bash
age -d -i ~/.config/sops/age/keys.txt -o secrets/dokku-config.sh secrets/dokku-config.sh.age
$EDITOR secrets/dokku-config.sh
just config-encrypt
rm secrets/dokku-config.sh   # keep only the .age in git
```

### 5. First deploy + smoke test

```bash
just add-remote <your-vps-ip>      # one-time, registers `dokku` git remote
just deploy                        # = git push dokku main
just logs                          # tail
```

Smoke test: `curl -kI --resolve motori.fi:443:<ip> https://motori.fi` → 200.

### 5b. CI/CD deploy (GitHub Actions over Tailscale)

After the first manual deploy works, hand off recurring deploys to GHA. The `deploy` job joins our tailnet (UFW only allows port 22 from `tailscale0`) and runs `git push dokku motori:motori` from the runner once `lint`, `format`, `typecheck`, `test`, and `e2e` all pass.

One-time setup:

**1. Generate a dedicated deploy SSH keypair**

```bash
ssh-keygen -t ed25519 -f /tmp/dokku_deploy -N "" -C "github-actions"
cat /tmp/dokku_deploy.pub | ssh root@motori "dokku ssh-keys:add gha"
```

**2. Set up Tailscale ACL tags (one-time, only if `tag:ci` doesn't exist yet)**

In the Tailscale admin → Access Controls, ensure the policy file has:

```jsonc
"tagOwners": {
  "tag:server": ["autogroup:admin"],
  "tag:ci":     ["autogroup:admin"],
},
"acls": [
  // CI runners can SSH to servers
  { "action": "accept", "src": ["tag:ci"], "dst": ["tag:server:22"] },
],
```

**3. Create a Tailscale OAuth client**

Tailscale admin → Settings → OAuth clients → **Generate OAuth client**. Scopes: `auth_keys` (write), tags: `tag:ci`. Copy the client ID and secret.

**4. Add four GitHub repo secrets** (Settings → Secrets and variables → Actions):

| Name                    | Value                                                  |
|-------------------------|--------------------------------------------------------|
| `DOKKU_SSH_PRIVATE_KEY` | full contents of `/tmp/dokku_deploy` (private key)     |
| `TS_OAUTH_CLIENT_ID`    | OAuth client ID from step 3                            |
| `TS_OAUTH_SECRET`       | OAuth client secret from step 3                        |

**5. Clean up locally**

```bash
shred -u /tmp/dokku_deploy /tmp/dokku_deploy.pub
```

The Dokku host is reached as `dokku@motori` over Tailscale MagicDNS — no public IP or static host key needed.

To revoke deploy access later: `ssh root@motori "dokku ssh-keys:remove gha"` and revoke the OAuth client in the Tailscale admin.

### 6. TLS

Cloudflare Origin Cert (valid until 2041, `*.motori.fi` + `motori.fi`):

```bash
just certs-apply
ssh root@motori 'dokku proxy:build-config motori'   # required after first cert add
```

### 7. DNS cutover

Cloudflare DNS, both records **proxied (orange cloud)**:

| Type | Name      | Content              |
|------|-----------|----------------------|
| A    | motori.fi | `<vps-ipv4>`         |
| AAAA | motori.fi | `<vps-ipv6>`         |
| A    | www       | `<vps-ipv4>`         |
| AAAA | www       | `<vps-ipv6>`         |

SSL/TLS mode: **Full (strict)**.

### 8. Backups (encrypted nightly + verified restore)

```bash
just backup-setup
ssh root@motori 'dokku postgres:backup motori motori-backups'   # one-shot test
```

Schedule lives in `secrets/backup-setup.sh.age` (default: 03:15 UTC daily). Encryption passphrase is also in there — losing the .age means losing all past backups, so the off-VPS backup of `~/.config/sops/age/keys.txt` is critical.

### 9. Host crontab (`/api/cron` jobs)

```bash
just cron-install
```

Schedules in `infra/cron/motori.crontab`:
- hourly: `expire-bookings`, `expire-tori-items`
- 03:30–03:40 UTC daily: `purge-sessions`, `notify-expiry`, `notify-tori-expiry`

Wrapper script (`/usr/local/bin/motori-cron`) reads `CRON_SECRET` from `dokku config` at runtime and POSTs to `https://motori.fi/api/cron?task=…` via `--resolve 127.0.0.1` (bypassing CF, faster + avoids CF bot rules).

### 10. Off-VPS secrets backup (age-encrypted)

```bash
just secrets-export   # writes secrets/motori.env.age
```

Re-run any time prod env changes. Decrypt with:
```bash
age -d -i ~/.config/sops/age/keys.txt secrets/motori.env.age
```

## Restore from backup

```bash
# 1. list backups in the bucket
aws s3 ls --endpoint-url https://hel1.your-objectstorage.com s3://motori-backups/

# 2. download latest
aws s3 cp --endpoint-url https://hel1.your-objectstorage.com \
  s3://motori-backups/postgres-motori-YYYY-MM-DD-HH-MM-SS.tgz.gpg /tmp/dump.tgz.gpg

# 3. decrypt (passphrase from secrets/backup-setup.sh.age)
gpg --batch --yes --passphrase '<PASSPHRASE>' --decrypt /tmp/dump.tgz.gpg > /tmp/dump.tgz

# 4. verify in a throwaway docker postgres before any real restore
docker run --rm -d --name pgtest -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:17
sleep 5
docker exec pgtest psql -U postgres -c 'CREATE DATABASE motori;'
tar -xzOf /tmp/dump.tgz backup/export | docker exec -i pgtest pg_restore -U postgres -d motori
docker exec pgtest psql -U postgres -d motori -c '\dt'
docker rm -f pgtest

# 5. real restore into prod (DESTRUCTIVE — overwrites current DB)
ssh root@motori
dokku postgres:import motori < /path/to/backup/export
```

## Common operations

```bash
just logs                              # tail app logs
just status                            # ps:report + config keys
just restart                           # restart without rebuild
just rebuild                           # rebuild (re-runs release phase)
just psql                              # interactive psql
just backup                            # out-of-schedule backup
just config-set BOOL=true              # set single env var
just make-admin email=user@example.com # promote user to admin
```

## Disaster recovery (VPS lost)

1. Provision fresh Ubuntu 24.04 VPS in Hetzner Cloud.
2. **Re-attach the `pgdata` volume** to the new server (data survived).
3. Run Phase 1 (cloud-init bootstrap). Volume auto-mounts via fstab.
4. Run Phase 2 (Dokku install). The pre-existing data dir is now under the freshly-installed dokku-postgres — **import the latest backup instead of trusting the pre-existing data** unless you've verified it matches your latest backup.
5. Phase 3 (postgres + app create + link). If you imported from backup, skip create and use `dokku postgres:import`.
6. `just config-apply` (env), `just certs-apply` (TLS), `just backup-setup` (backups), `just cron-install` (crons).
7. `just deploy`. Release phase runs migrations against the restored DB.
8. Update Cloudflare DNS A/AAAA records to the new VPS IPs.

If the volume is also lost, restore from the latest object-storage backup (see "Restore from backup" above).
