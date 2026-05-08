set shell := ["bash", "-c"]

# SSH host for the Dokku VPS (via Tailscale SSH). Override per-invocation: `just host=root@1.2.3.4 ssh`
host := "root@motori"
app := "motori"

# Age recipients for encrypting secrets (public key from ~/.config/sops/age/keys.txt).
age_pub := "age1pk32xkk4hx7frnnyjaf9rk3myxz2xjczv7th97czlc7lf5mv8qaqqp6wgx"
age_key := "~/.config/sops/age/keys.txt"

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

# Grant admin role to a user: just make-admin email=user@example.com
make-admin email:
    ssh {{host}} "dokku postgres:connect {{app}} -c \"UPDATE \\\"user\\\" SET role = 'admin' WHERE email = '{{email}}'; SELECT email, role FROM \\\"user\\\" WHERE email = '{{email}}';\""

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
    @test -f {{age_key}} || (echo "error: {{age_key}} not found" && exit 1)
    age -d -i {{age_key}} secrets/dokku-config.sh.age | ssh {{host}} bash

# Export full dokku config and age-encrypt to secrets/motori.env.age (off-VPS backup)
secrets-export:
    ssh {{host}} "dokku config:export --format=docker-args {{app}}" \
      | age -r {{age_pub}} -o secrets/motori.env.age
    @echo "✓ wrote secrets/motori.env.age"

# Decrypt secrets/motori.env.age to stdout
secrets-decrypt:
    age -d -i {{age_key}} secrets/motori.env.age
