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

The repo is a pnpm workspace (`apps/motori` + shared `packages/*`); root `package.json`'s `build`/`start`/`db:migrate` scripts dispatch via `pnpm --filter ${DEPLOY_APP:-motori} ...`, defaulting to the `motori` app so the Procfile and buildpack config don't need to change. One-time, set it explicitly on the Dokku app so it's pinned regardless of the default: `ssh root@motori "dokku config:set --no-restart motori DEPLOY_APP=motori"`. `talli.motori.fi` is a **second** Dokku app (its own `dokku apps:create talli`) on the same host, receiving the same repo/Procfile with `DEPLOY_APP=talli` set on that app's config — not a change to this app's deploy. See §12.

## Connection

```bash
ssh root@motori                                # via Tailscale
git remote add dokku dokku@<vps-ip>:motori     # local, one-time
```

Auth is **Tailscale SSH** (tailnet identity, no local keys): the server runs `tailscale --ssh` and the tailnet policy must have an `ssh` rule allowing it (see below). Public port 22 is UFW-blocked; SSH is reachable only over `tailscale0`.

**Gotcha — `Permission denied (publickey)` on `ssh root@motori`:** almost always means Tailscale SSH got disabled on the server (any later `tailscale up` without `--ssh` resets the flag) and the connection fell through to plain sshd. Check from your machine: `tailscale status --json | jq '.Peer[] | select(.HostName=="motori") | .sshHostKeys'` — `false`/missing means Tailscale SSH is off. Recovery: Hetzner web console → reset root password → open the `>_` console → run `tailscale set --ssh=true` (`set`, not `up` — `set` changes only that flag). Afterwards optionally `passwd -l root` to re-lock the password.

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
// Tailscale SSH access. With Tailscale SSH enabled on the server it intercepts ALL
// tailnet SSH — admin logins AND the CI deploy — so both rules are required:
// without the member rule, admin ssh fails "Permission denied (publickey)";
// without the tag:ci rule, the deploy job fails "tailnet policy does not permit you to SSH".
"ssh": [
  { "action": "accept", "src": ["autogroup:member"], "dst": ["tag:server"], "users": ["autogroup:nonroot", "root", "dokku"] },
  { "action": "accept", "src": ["tag:ci"], "dst": ["tag:server"], "users": ["dokku"] },
],
```

Tailscale SSH quirk: it executes commands via plain bash as the target user, bypassing dokku's
`authorized_keys` forced-command wrapper. Consequences: remote dokku commands need the explicit
binary (`ssh dokku@motori dokku config:set …`, not `ssh dokku@motori config:set …`), and git
remotes must use the scp-style path (`dokku@motori:motori`, resolving to `/home/dokku/motori`) —
`ssh://dokku@motori/motori` fails because the absolute path `/motori` doesn't exist.

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

### 11. Observability (OpenObserve)

Self-hosted OpenObserve ships the app's pino logs (Phase 1). It runs as a **Dokku app** (`openobserve`) served at **https://logs.motori.fi** (Dokku nginx + the wildcard `*.motori.fi` cert), parquet offloaded to the private `motori-backups` bucket under `openobserve/`. The `motori` app ships logs over a private Docker network, not the public URL. UI auth is OpenObserve's built-in login — use a strong root password (OSS has no SSO/MFA).

First-time setup — run on the VPS (`ssh root@motori`, then `dokku …`):

```bash
# 0. Swapfile (OOM safety net — OO wants ~512MB-1GB; do once)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo "/swapfile none swap sw 0 0" >> /etc/fstab

# 1. Create the app + domain (set domain before first deploy so port maps aren't reset)
dokku apps:create openobserve
dokku domains:set openobserve logs.motori.fi

# 2. Config — values from infra/observability/.env.example (fill secrets; reuse the
#    project-wide Hetzner keys for ZO_S3_ACCESS_KEY/SECRET_KEY). Single --no-restart set:
dokku config:set --no-restart openobserve \
  ZO_ROOT_USER_EMAIL=admin@motori.fi ZO_ROOT_USER_PASSWORD='<strong-unique>' \
  ZO_TELEMETRY=false ZO_LOCAL_MODE=true ZO_DATA_DIR=/data \
  ZO_LOCAL_MODE_STORAGE=s3 ZO_S3_PROVIDER=s3 \
  ZO_S3_SERVER_URL=https://hel1.your-objectstorage.com ZO_S3_REGION_NAME=hel1 \
  ZO_S3_BUCKET_NAME=motori-backups ZO_S3_BUCKET_PREFIX=openobserve/ \
  ZO_S3_ACCESS_KEY='<key>' ZO_S3_SECRET_KEY='<secret>' \
  ZO_S3_FEATURE_FORCE_HOSTED_STYLE=false ZO_COMPACT_DATA_RETENTION_DAYS=30 \
  ZO_MEMORY_CACHE_ENABLED=false ZO_MEMORY_CACHE_DATAFUSION_MAX_SIZE=256 \
  ZO_MEM_TABLE_MAX_SIZE=128 ZO_MAX_FILE_SIZE_IN_MEMORY=128 ZO_FILE_MOVE_THREAD_NUM=1

# 3. Persistent /data + memory cap
dokku storage:ensure-directory openobserve
dokku storage:mount openobserve /var/lib/dokku/data/storage/openobserve:/data
dokku resource:limit --memory 1g --process-type web openobserve

# 4. Private network so `motori` can reach OO internally
dokku network:create observability
dokku network:set openobserve attach-post-create observability
dokku network:set motori attach-post-create observability

# 5. Deploy from the pinned image
dokku git:from-image openobserve public.ecr.aws/zinclabs/openobserve:v0.90.3

# 6. Map the public proxy to OO's port 5080 (from-image does NOT honour EXPOSE — set manually)
dokku ports:set openobserve http:80:5080 https:443:5080

# 7. TLS — apply the wildcard *.motori.fi cert (cert+key already on the host)
tar cvf /tmp/oo-cert.tar -C /path/to/certs server.crt server.key
dokku certs:add openobserve < /tmp/oo-cert.tar

# 8. Cloudflare: add a DNS record  logs.motori.fi → the VPS (proxied is fine).

# 9. Create the non-root ingestion user (least privilege; root is UI-only):
#    open https://logs.motori.fi, log in as root → Management → Users →
#    add `ingest@motori.fi` with an Ingestion role; note its password.

# 10. Wire the motori app to ship logs over the private network, then rebuild it:
dokku config:set --no-restart motori \
  OPENOBSERVE_URL=http://openobserve.web:5080 \
  OPENOBSERVE_ORG=default OPENOBSERVE_STREAM=motori \
  OPENOBSERVE_USER=ingest@motori.fi OPENOBSERVE_PASSWORD='<ingest-user-password>'
dokku ps:rebuild motori    # joins the network + picks up config
```

Updates later: `just oo-deploy` (re-pulls the pinned image; bump the tag in the recipe + image when upgrading). Logs: `just oo-logs`. Verify ingestion: generate traffic, then logs.motori.fi → Logs → stream `motori`; `just oo-logs` shows any `[openobserve] ingest …` warnings on the app side.

**Dashboards & alerts.** Build them once in the UI, then export and commit the JSON to `infra/observability/dashboards/` and `infra/observability/alerts/` (the only version control for them — re-import after a rebuild).
- Dashboards: 5xx error rate + p50/p95 latency; auth failures + rate-limit rejections; image-upload failures; DB error volume; business events (listing-created, contact/booking).
- Alerts: sustained 5xx spike; **ingestion dead-man's switch — no logs for 20 min** (chosen so a quiet overnight stretch doesn't false-positive); VPS disk high (meta/WAL/cache — parquet is in S3).

**Memory note.** OO is capped (`ZO_MEM*` + `dokku resource:limit --memory 1g`) and the 2GB swapfile backstops Postgres + Node + OO. If OO restart-loops, check `dokku logs openobserve` for OOM and lower `ZO_MEM_TABLE_MAX_SIZE`.

**Security note.** `logs.motori.fi` is publicly reachable and OO OSS auth is username/password only (no MFA). Use a strong, unique root password. To add a stronger gate later, put Cloudflare Access in front of the hostname (and keep app ingest on the internal `observability` network so it isn't blocked).

### 12. Second app (talli)

`talli` (talli.motori.fi — garage / maintenance companion) is a **second** Dokku app on the same host. It shares motori's Postgres (owning only the `talli` schema) and motori's login (shared session cookie), and mounts no auth routes. It receives the same repo/Procfile with `DEPLOY_APP=talli` set on its config.

**App create + link** — same Postgres service as motori, **no** new `postgres:create`:

```bash
ssh root@motori
dokku apps:create talli
dokku postgres:link motori talli                    # talli's DATABASE_URL → motori's DB (talli migrates only its `talli` schema)
                                                    # NOTE: the linked DATABASE_URL uses the plugin's stored password, which is STALE
                                                    # (the Postgres password was rotated out-of-band, see `just` rotate). Override it below.
dokku domains:add talli talli.motori.fi
dokku ports:set talli http:80:3001 https:443:3001   # talli's container listens on 3001
dokku nginx:set talli client-max-body-size 12m
```

**Config.** Add a `dokku config:set --no-restart talli …` block to `secrets/dokku-config.sh.age` (mirror motori's, §4) and apply with `just config-apply`:

```bash
dokku config:set --no-restart talli \
    NODE_ENV=production \
    DEPLOY_APP=talli \
    DATABASE_URL='<same value as motori — see note below>' \
    BETTER_AUTH_SECRET='<same value as motori>' \
    BETTER_AUTH_URL=https://motori.fi \
    APP_ORIGIN=https://talli.motori.fi \
    STORAGE_ENDPOINT='https://hel1.your-objectstorage.com' \
    STORAGE_BUCKET=motori-images \
    STORAGE_ACCESS_KEY='<key>' STORAGE_SECRET_KEY='<secret>' \
    STORAGE_PUBLIC_URL='https://motori-images.hel1.your-objectstorage.com' \
    RESEND_API_KEY='<key>' \
    CRON_SECRET='<new value, distinct from motori>' \
    LOG_LEVEL=info
```

- `DEPLOY_APP=talli` makes the root `build`/`start`/`db:migrate` scripts target the talli app.
- `DATABASE_URL` **must** be set explicitly to motori's value (`dokku config:get motori DATABASE_URL`) — do **not** rely on the one `postgres:link` injected. motori keeps an explicit override because the Postgres password was rotated out-of-band (`just` rotate), leaving the plugin's stored/linked DSN stale. Without this, talli's release-phase `pnpm db:migrate` fails with `password authentication failed for user "postgres"` (28P01) and the whole deploy is rejected.
- `BETTER_AUTH_SECRET` **must** equal motori's — the session cookie is shared across `.motori.fi`.
- `BETTER_AUTH_URL=https://motori.fi` (motori is the auth host); `APP_ORIGIN=https://talli.motori.fi` scopes csrf to talli's own origin.
- Same `motori-images` bucket as motori; talli writes under the `talli/` key prefix.
- Optional OpenObserve sink on its own stream: add `OPENOBSERVE_URL=http://openobserve.web:5080 OPENOBSERVE_ORG=default OPENOBSERVE_STREAM=talli OPENOBSERVE_USER=… OPENOBSERVE_PASSWORD=…` and join talli to the `observability` network (`dokku network:set talli attach-post-create observability`, cf. §11).

No motori-side config change is needed for talli's cross-origin sign-out: `createAuth` already adds `talli.motori.fi` to `trustedOrigins` and motori's CORS allow-list appends it automatically (`apps/motori/src/lib/cors.ts`).

**TLS.** talli.motori.fi is covered by the existing `*.motori.fi` wildcard Cloudflare Origin Cert — reuse the same bundle (as §11 does for OpenObserve):

```bash
tar cvf /tmp/talli-cert.tar -C /path/to/certs server.crt server.key
dokku certs:add talli < /tmp/talli-cert.tar
dokku proxy:build-config talli
```

Then add the Cloudflare DNS record for `talli` → the VPS (proxied, orange cloud): `A talli <vps-ipv4>`, `AAAA talli <vps-ipv6>`.

**First deploy + migrate.** The CI `deploy` job pushes to `dokku@motori:talli` (`.github/workflows/ci.yml`, "Push talli to Dokku"). The release phase runs `pnpm db:migrate`, which with `DEPLOY_APP=talli` migrates only the `talli` schema (`migrationTableSchema: "talli"`). **Ordering constraint:** the talli Dokku app must exist on the server before this branch merges to `main`, or the deploy job's talli push fails.

**Cron.** `just cron-install` installs both apps' cron files. talli's reminder digest runs daily at 03:45 UTC via `infra/cron/talli.crontab` → `/etc/cron.d/talli`; the `talli-cron` wrapper reads `CRON_SECRET` from `dokku config:get talli` and POSTs to `https://talli.motori.fi/api/cron?task=reminder-digest`.

The shared `Procfile` and `app.json` are unchanged — root scripts dispatch on `${DEPLOY_APP:-motori}`.

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
