# Motori — deploy runbook

Production runs on a single Hetzner VPS as a Dokku app using the Heroku Node buildpack.

- **App name:** `motori`
- **Domains:** `motori.fi` (canonical), `www.motori.fi` (301 → apex via app middleware)
- **DB:** `dokku-postgres` plugin, Postgres 17, linked as `motori`
- **TLS:** `dokku-letsencrypt`, auto-renew via cron
- **Object storage:** Hetzner Object Storage (`hel1`)
  - `motori-images` — listing photos, public-read
  - `motori-backups` — encrypted nightly DB dumps, private
- **Deploy:** `git push dokku main`
- **Migrations:** auto-run via Procfile `release` phase

## Connection

```bash
ssh deploy@<vps-ip>
git remote add dokku dokku@<vps-ip>:motori   # local, one-time
```

## Phases

> Filled in as each phase is executed during the cutover. Capture the *real* commands run, including any deviations.

### 1. Server bootstrap

TODO — populate from Task 7.

### 2. Dokku install

TODO — populate from Task 8.

### 3. Postgres + app create + link

TODO — populate from Task 9.

### 4. Config (`dokku config:set`)

TODO — populate from Task 10. Commit a redacted template only (placeholders `<…>` for secret values).

### 5. First deploy + smoke test

TODO — populate from Task 11.

### 6. TLS

TODO — populate from Task 12.

### 7. DNS cutover

TODO — populate from Task 13. Pre-lower TTL ≥24 h before cutover.

### 8. Backups (encrypted nightly + verified restore)

TODO — populate from Task 14.

### 9. Host crontab (`/api/cron` jobs)

TODO — populate from Task 15. Tasks: `purge-sessions`, `notify-expiry`, `expire-bookings`.

### 10. Off-VPS secrets backup (age-encrypted)

TODO — populate from Task 16. Refresh procedure + decrypt one-liner.

## Restore from backup

TODO — populate from Task 14 Step 4. Includes pulling the `.gpg` from `motori-backups`, decrypting locally, importing into a throwaway DB to verify, then real restore.

## Common operations

```bash
# Tail logs
dokku logs motori -t

# Run a one-off script (e.g. seed)
dokku run motori pnpm <script>

# Set / unset env
dokku config:set motori KEY=value
dokku config:unset motori KEY

# Rebuild without code change (e.g. after env change)
dokku ps:rebuild motori

# Manual migration (rare — Procfile release runs them automatically)
dokku run motori pnpm db:migrate

# Manual backup (out of schedule)
dokku postgres:backup motori motori-backups
```

## Disaster recovery (VPS lost)

1. Provision new Ubuntu 24.04 VPS in Hetzner Cloud console.
2. Run Phases 1–3 of this runbook (bootstrap, Dokku install, Postgres plugin + DB create).
3. Decrypt `secrets/motori.env.age` locally:
   ```bash
   age -d -i ~/.config/age/motori.key secrets/motori.env.age
   ```
4. Replay each `KEY=value` into `dokku config:set motori …` on the new VPS.
5. Restore latest DB backup from `motori-backups` bucket (see *Restore from backup*).
6. `git push dokku main`. Release phase runs migrations against the restored DB.
7. Flip DNS to the new VPS IP.
