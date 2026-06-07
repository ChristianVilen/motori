set shell := ["bash", "-c"]

# SSH host for the Dokku VPS (via Tailscale SSH). Override per-invocation: `just host=root@1.2.3.4 ssh`
host := "root@motori"
app := "motori"

# Age recipients for encrypting secrets (public key — safe to commit).
age_pub := "age1gh73uxuev6n4x40tajwyqdqm0rfug7j4uvpnant5l2w9z56hu9jq9f59uy"

# Age private key fetched from 1Password on demand. Requires `op` CLI signed in
# (either via the desktop-app integration or OP_SERVICE_ACCOUNT_TOKEN).
age_key_ref := "op://Vuokramoto/motori age key/password"

# List available commands
default:
    @just --list

# --- Server access ---

ssh:
    ssh {{host}}

# Fix Tailscale SSH MTU locally (run when SSH hangs but ping works)
fix-mtu:
    sudo ip link set tailscale0 mtu 1200

# Tail app logs
logs:
    ssh {{host}} "dokku logs {{app}} -t"

# Show app status, processes, config keys
status:
    ssh {{host}} "dokku ps:report {{app}} && echo && dokku config:keys {{app}}"

# --- Deploy ---

# Deploy current local main to Dokku (Procfile release runs migrations)
deploy:
    git push dokku main

# Restart app (no rebuild)
restart:
    ssh {{host}} "dokku ps:restart {{app}}"

# Rebuild app (e.g. after env change) — re-runs release phase
rebuild:
    ssh {{host}} "dokku ps:rebuild {{app}}"

# Add the dokku git remote (one-time, run locally)
add-remote ip:
    git remote add dokku dokku@{{ip}}:{{app}}

# --- Database (prod) ---

# Open psql shell against the linked Postgres
psql:
    ssh -t {{host}} "dokku postgres:connect {{app}}"

# Trigger an out-of-schedule encrypted backup to motori-backups bucket
backup:
    ssh {{host}} "dokku postgres:backup {{app}} motori-backups"

# Manual migration (rare — release phase runs them automatically)
migrate-prod:
    ssh {{host}} "dokku run {{app}} pnpm db:migrate"

# Rotate the Postgres password, update dokku config, and re-encrypt secrets
rotate-db-password:
    #!/usr/bin/env bash
    set -euo pipefail
    op whoami >/dev/null 2>&1 || { echo "error: not signed in to 1Password (run: eval \"\$(op signin)\")" >&2; exit 1; }
    NEW_PASS=$(openssl rand -hex 20)
    echo "ALTER USER postgres PASSWORD '${NEW_PASS}';" | ssh {{host}} "dokku postgres:connect {{app}}"
    ssh {{host}} "dokku config:set {{app}} DATABASE_URL=postgres://postgres:${NEW_PASS}@dokku-postgres-motori:5432/{{app}}"
    # Update secrets/dokku-config.sh and re-encrypt
    age -d -i <(op read "{{age_key_ref}}") secrets/dokku-config.sh.age > secrets/dokku-config.sh
    sed -i "s|DATABASE_URL=postgres://postgres:[^@]*@|DATABASE_URL=postgres://postgres:${NEW_PASS}@|" secrets/dokku-config.sh
    age -r {{age_pub}} -o secrets/dokku-config.sh.age secrets/dokku-config.sh
    rm secrets/dokku-config.sh
    just secrets-export
    echo "✓ password rotated and secrets re-encrypted"
    echo "  New password: ${NEW_PASS}"
    echo "  Update DataGrip with the new password"

# Grant admin role to a user: just make-admin user@example.com
make-admin email:
    echo "UPDATE \"user\" SET role = 'admin' WHERE email = '{{email}}'; SELECT email, role FROM \"user\" WHERE email = '{{email}}';" | ssh {{host}} "dokku postgres:connect {{app}}"

# --- Config / secrets ---

# Show all config keys (values redacted)
config:
    ssh {{host}} "dokku config:keys {{app}}"

# Set a single env: just config-set KEY=value
config-set kv:
    ssh {{host}} "dokku config:set {{app}} {{kv}}"

# Encrypt secrets/dokku-config.sh → secrets/dokku-config.sh.age (commit the .age, not the plaintext)
config-encrypt:
    @test -f secrets/dokku-config.sh || (echo "error: secrets/dokku-config.sh not found" && exit 1)
    age -r {{age_pub}} -o secrets/dokku-config.sh.age secrets/dokku-config.sh
    @echo "✓ wrote secrets/dokku-config.sh.age"

# Decrypt secrets/dokku-config.sh.age and run it on the VPS (sets all dokku config in one go)
config-apply:
    @op whoami >/dev/null 2>&1 || (echo "error: not signed in to 1Password (run: eval \"\$(op signin)\")" && exit 1)
    age -d -i <(op read "{{age_key_ref}}") secrets/dokku-config.sh.age | ssh {{host}} bash

# Encrypt secrets/backup-setup.sh → secrets/backup-setup.sh.age (postgres backup auth + encryption + schedule)
backup-encrypt:
    @test -f secrets/backup-setup.sh || (echo "error: secrets/backup-setup.sh not found" && exit 1)
    age -r {{age_pub}} -o secrets/backup-setup.sh.age secrets/backup-setup.sh
    @echo "✓ wrote secrets/backup-setup.sh.age"

# Decrypt secrets/backup-setup.sh.age and run it on the VPS (configures dokku-postgres backups)
backup-setup:
    @op whoami >/dev/null 2>&1 || (echo "error: not signed in to 1Password (run: eval \"\$(op signin)\")" && exit 1)
    age -d -i <(op read "{{age_key_ref}}") secrets/backup-setup.sh.age | ssh {{host}} bash

# Install host crontab + wrapper script for /api/cron tasks
cron-install:
    scp infra/cron/motori-cron {{host}}:/usr/local/bin/motori-cron
    scp infra/cron/motori.crontab {{host}}:/etc/cron.d/motori
    ssh {{host}} "chmod 755 /usr/local/bin/motori-cron && chmod 644 /etc/cron.d/motori"
    @echo "✓ cron installed; check with: ssh {{host}} 'cat /etc/cron.d/motori && systemctl status cron --no-pager'"

# Decrypt secrets/certs/*.age, build a tarball, and install on Dokku as the app's TLS cert
certs-apply:
    @test -f secrets/certs/motori.fi.pem.age || (echo "error: secrets/certs/motori.fi.pem.age not found" && exit 1)
    @test -f secrets/certs/motori.fi.key.age || (echo "error: secrets/certs/motori.fi.key.age not found" && exit 1)
    @op whoami >/dev/null 2>&1 || (echo "error: not signed in to 1Password (run: eval \"\$(op signin)\")" && exit 1)
    key="$(op read "{{age_key_ref}}")" && \
      tmp=$(mktemp -d) && \
      age -d -i <(printf '%s' "$key") secrets/certs/motori.fi.pem.age > "$tmp/server.crt" && \
      age -d -i <(printf '%s' "$key") secrets/certs/motori.fi.key.age > "$tmp/server.key" && \
      tar -C "$tmp" -cf "$tmp/certs.tar" server.crt server.key && \
      ssh {{host}} "dokku certs:add {{app}}" < "$tmp/certs.tar" && \
      rm -rf "$tmp"
    @echo "✓ cert installed on Dokku"

# Export full dokku config and age-encrypt to secrets/motori.env.age (off-VPS backup)
secrets-export:
    ssh {{host}} "dokku config:export --format=docker-args {{app}}" \
      | age -r {{age_pub}} -o secrets/motori.env.age
    @echo "✓ wrote secrets/motori.env.age"

# Decrypt secrets/motori.env.age to stdout
secrets-decrypt:
    @op whoami >/dev/null 2>&1 || (echo "error: not signed in to 1Password (run: eval \"\$(op signin)\")" && exit 1)
    age -d -i <(op read "{{age_key_ref}}") secrets/motori.env.age

# Decrypt every secrets/**/*.age to a matching plaintext file (strips .age, mode 600).
# Edit them, then run `just secrets-encrypt-all` to re-encrypt and shred plaintext.
secrets-decrypt-all:
    #!/usr/bin/env bash
    set -euo pipefail
    op whoami >/dev/null 2>&1 || { echo "error: not signed in to 1Password (run: eval \"\$(op signin)\")" >&2; exit 1; }
    key=$(op read "{{age_key_ref}}")
    while IFS= read -r -d '' f; do
      out="${f%.age}"
      age -d -i <(printf '%s' "$key") "$f" > "$out"
      chmod 600 "$out"
      echo "✓ $out"
    done < <(find secrets -type f -name '*.age' -print0)
    echo "edit the plaintext files, then run: just secrets-encrypt-all"

# Re-encrypt every plaintext counterpart of secrets/**/*.age, then shred the plaintext.
secrets-encrypt-all:
    #!/usr/bin/env bash
    set -euo pipefail
    while IFS= read -r -d '' f; do
      plain="${f%.age}"
      [ -f "$plain" ] || { echo "skip (no plaintext): $f"; continue; }
      age -r {{age_pub}} -o "$f" "$plain"
      command -v shred >/dev/null && shred -u "$plain" || rm -f "$plain"
      echo "✓ $f (plaintext removed)"
    done < <(find secrets -type f -name '*.age' -print0)

# --- Observability (OpenObserve) ---

# Sync the OO compose file to the VPS and (re)start the container.
# First run requires /opt/observability/.env present on the host (see DEPLOY.md §11).
oo-deploy:
    ssh {{host}} "mkdir -p /opt/observability"
    scp infra/observability/docker-compose.yml {{host}}:/opt/observability/docker-compose.yml
    ssh {{host}} "cd /opt/observability && docker compose up -d"

# Tail the OpenObserve container logs.
oo-logs:
    ssh {{host}} "docker logs openobserve -f --tail 100"
