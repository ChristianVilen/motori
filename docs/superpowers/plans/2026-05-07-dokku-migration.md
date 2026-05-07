# Dokku Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wipe the existing Hetzner VPS, rebuild it as a single-VPS Dokku host, and redeploy Motori on Dokku via the Node buildpack with Postgres, Let's Encrypt TLS, and verified encrypted backups.

**Architecture:** Repo prep lands first (delete old Compose/Terraform artifacts, add Procfile + apex-redirect middleware + engines pin + DEPLOY.md skeleton). Then operational phases execute against the live VPS, with each command captured in DEPLOY.md as we go. Cron is host crontab hitting `/api/cron`. Backups go to Hetzner Object Storage with GPG encryption. Secrets backed up off-VPS via age-encrypted `dokku config:export`.

**Tech Stack:** Dokku v0.34.x · Heroku Node buildpack · pnpm 10 · Node 24 · TanStack Start · Postgres 17 (`dokku-postgres`) · Let's Encrypt (`dokku-letsencrypt`) · Hetzner Object Storage · age (secrets backup) · GPG (DB backup encryption)

**Spec:** `docs/superpowers/specs/2026-05-07-dokku-migration-design.md`

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `src/lib/apex-redirect.ts` | Create | Request middleware: 301 from non-canonical host (e.g. `www.motori.fi`) to `BETTER_AUTH_URL` host. |
| `src/lib/apex-redirect.test.ts` | Create | Unit test for redirect middleware. |
| `src/start.ts` | Modify | Prepend `apexRedirectMiddleware` to `requestMiddleware`. |
| `Procfile` | Create | `release: pnpm db:migrate` + `web: pnpm start`. |
| `package.json` | Modify | Add `"engines": { "node": "24.x" }`. |
| `Dockerfile` | Delete | Tied to old Compose deploy. |
| `.dockerignore` | Delete | Same. |
| `docker-compose.yml` | Delete | Same. |
| `docker-compose.prod.yml` | Delete | Same. |
| `infra/` | Delete | Old Terraform + cloud-init + nginx + sops setup. |
| `.env.production` | Delete | Old plaintext prod env (replaced by `dokku config`). |
| `.env.production.enc` | Delete | Old sops-encrypted prod env. |
| `.sops.yaml` | Delete | sops config tied to deleted `.enc`. |
| `DEPLOY.md` | Create | Real-command runbook, populated as ops phases execute. |
| `secrets/motori.env.age` | Create (Phase 12) | age-encrypted off-VPS backup of `dokku config:export`. |

---

## Phase 1 — Repo prep

### Task 1: Apex-redirect middleware (TDD)

**Files:**
- Create: `src/lib/apex-redirect.ts`
- Test: `src/lib/apex-redirect.test.ts`
- Modify: `src/start.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/apex-redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeApexRedirect } from "./apex-redirect";

describe("computeApexRedirect", () => {
	it("returns null when canonical host is not configured", () => {
		expect(computeApexRedirect(new Request("https://www.motori.fi/x"), undefined)).toBeNull();
	});

	it("returns null when the request host already matches canonical", () => {
		expect(
			computeApexRedirect(new Request("https://motori.fi/x"), "https://motori.fi"),
		).toBeNull();
	});

	it("301-redirects www.motori.fi to motori.fi preserving path and query", () => {
		const res = computeApexRedirect(
			new Request("https://www.motori.fi/listings?page=2"),
			"https://motori.fi",
		);
		expect(res).not.toBeNull();
		expect(res?.status).toBe(301);
		expect(res?.headers.get("location")).toBe("https://motori.fi/listings?page=2");
	});

	it("ignores port and scheme differences in BETTER_AUTH_URL", () => {
		const res = computeApexRedirect(
			new Request("https://www.motori.fi/"),
			"https://motori.fi/",
		);
		expect(res?.headers.get("location")).toBe("https://motori.fi/");
	});

	it("does not redirect localhost in dev", () => {
		expect(
			computeApexRedirect(new Request("http://localhost:3000/x"), "http://localhost:3000"),
		).toBeNull();
	});
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `pnpm test src/lib/apex-redirect.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the middleware**

Create `src/lib/apex-redirect.ts`:

```ts
import { createMiddleware } from "@tanstack/react-start";

export function computeApexRedirect(
	request: Request,
	canonicalUrl: string | undefined,
): Response | null {
	if (!canonicalUrl) return null;
	let canonicalHost: string;
	try {
		canonicalHost = new URL(canonicalUrl).host;
	} catch {
		return null;
	}
	const url = new URL(request.url);
	if (url.host === canonicalHost) return null;

	const target = new URL(url.pathname + url.search, canonicalUrl);
	return new Response(null, {
		status: 301,
		headers: { location: target.toString() },
	});
}

export const apexRedirectMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
		const redirect = computeApexRedirect(request, process.env.BETTER_AUTH_URL);
		if (redirect) return redirect;
		return next();
	},
);
```

- [ ] **Step 4: Run test, confirm it passes**

Run: `pnpm test src/lib/apex-redirect.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Wire middleware into start.ts**

Modify `src/start.ts`:

```ts
import { createStart } from "@tanstack/react-start";
import { apexRedirectMiddleware } from "~/lib/apex-redirect";
import { corsMiddleware } from "~/lib/cors";
import { loggingMiddleware } from "~/lib/log/middleware";
import { nonceMiddleware } from "~/lib/nonce";
import { securityHeadersMiddleware } from "~/lib/security-headers";

export const startInstance = createStart(() => ({
	requestMiddleware: [
		apexRedirectMiddleware,
		corsMiddleware,
		nonceMiddleware,
		securityHeadersMiddleware,
		loggingMiddleware,
	],
}));
```

- [ ] **Step 6: Typecheck + unit tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/apex-redirect.ts src/lib/apex-redirect.test.ts src/start.ts
git commit -m "feat: add www→apex redirect middleware for Dokku deploy"
```

---

### Task 2: Procfile

**Files:**
- Create: `Procfile`

- [ ] **Step 1: Write Procfile**

Create `Procfile` at repo root with exactly these two lines:

```
release: pnpm db:migrate
web: pnpm start
```

- [ ] **Step 2: Commit**

```bash
git add Procfile
git commit -m "feat: add Procfile for Dokku buildpack (release-phase migrations)"
```

---

### Task 3: Pin Node engine in package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `engines.node`**

Locate the top-level fields in `package.json` (after `"packageManager"`) and add:

```json
"engines": {
  "node": "24.x"
},
```

The Heroku Node buildpack reads `engines.node`, not `.nvmrc`.

- [ ] **Step 2: Verify**

Run: `pnpm install` — confirms package.json still parses.
Expected: clean, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: pin Node engine to 24.x for Dokku buildpack"
```

---

### Task 4: Delete old deploy artifacts

**Files:**
- Delete: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.prod.yml`, `infra/` (entire dir), `.env.production`, `.env.production.enc`, `.sops.yaml`

- [ ] **Step 1: Confirm no other code references them**

Run:
```bash
grep -rn --exclude-dir=node_modules --exclude-dir=.git \
  -e 'docker-compose' -e 'Dockerfile' -e 'infra/' -e '.env.production' -e '.sops' \
  . | grep -v 'docs/superpowers/' || true
```
Expected: no application-code matches. References inside the spec/plan or in `AGENTS.md`/`PROJECT.md` are documentation and will be cleaned up in Task 5.

- [ ] **Step 2: Delete files and dir**

```bash
git rm Dockerfile .dockerignore docker-compose.yml docker-compose.prod.yml \
       .env.production .env.production.enc .sops.yaml
git rm -r infra/
```

- [ ] **Step 3: Typecheck + tests still green**

Run: `pnpm typecheck && pnpm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove old Compose/Terraform deploy artifacts (replaced by Dokku)"
```

---

### Task 5: DEPLOY.md skeleton + housekeeping

**Files:**
- Create: `DEPLOY.md`
- Modify: `PROJECT.md` and `AGENTS.md` if they reference the old deploy paths

- [ ] **Step 1: Create DEPLOY.md skeleton**

Create `DEPLOY.md` at repo root:

```markdown
# Motori — deploy runbook

Production runs on a single Hetzner VPS as a Dokku app using the Heroku Node buildpack.

- **App name:** `motori`
- **Domains:** `motori.fi` (canonical), `www.motori.fi` (301→apex via app middleware)
- **DB:** `dokku-postgres` plugin, Postgres 17, linked as `motori`
- **TLS:** `dokku-letsencrypt`, auto-renew via cron
- **Object storage:** Hetzner Object Storage (`hel1`) — see `.env.example`
- **Deploy:** `git push dokku main`
- **Migrations:** auto-run via Procfile `release` phase

## Connection

```
ssh deploy@<vps-ip>
git remote add dokku dokku@<vps-ip>:motori   # local
```

## Phases

> Filled in as each phase is executed during the cutover. Capture the *real* commands run, including any deviations.

### 1. Server bootstrap
TODO

### 2. Dokku install
TODO

### 3. Postgres
TODO

### 4. App + domains + config
TODO

### 5. First deploy + smoke test
TODO

### 6. TLS
TODO

### 7. DNS cutover
TODO

### 8. Backups (encrypted nightly + verified restore)
TODO

### 9. Host crontab (`/api/cron` jobs)
TODO

### 10. Off-VPS secrets backup (age)
TODO

## Restore from backup

TODO — captured in Phase 8.

## Common operations

- Tail logs: `dokku logs motori -t`
- Run one-off: `dokku run motori pnpm <script>`
- Set env: `dokku config:set motori KEY=value`
- Rebuild: `dokku ps:rebuild motori`
```

- [ ] **Step 2: Scrub stale references in PROJECT.md / AGENTS.md**

Search:
```bash
grep -n -e 'docker-compose' -e 'sops' -e 'infra/' -e 'terraform' PROJECT.md AGENTS.md || true
```
For each hit, either delete the paragraph or rewrite it to point at Dokku/`DEPLOY.md`. Keep edits minimal — just remove dead references; don't rewrite unrelated sections.

- [ ] **Step 3: Typecheck + tests + lint**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add DEPLOY.md PROJECT.md AGENTS.md
git commit -m "docs: add DEPLOY.md skeleton and remove old deploy references"
```

---

## Phase 2–13 — Operational cutover

> These tasks execute against the live VPS. The pattern for each: run the commands, confirm the outcome, paste the *actual* commands (with secrets redacted) into the matching DEPLOY.md section, commit. Steps that require human-only inputs (Hetzner Cloud console, DNS provider, GPG key generation) are explicit.

### Task 6: Phase 0 — Pre-flight

- [ ] **Step 1: Capture current prod state**

Record locally (do not commit):
- DNS A records currently pointing at the old VPS
- Hetzner Object Storage access key + secret + bucket name
- Resend API key
- Any other env values currently set on the old box

These will be re-applied in Phase 6.

- [ ] **Step 2: Lower DNS TTL**

In the DNS provider, set TTL on `motori.fi` and `www.motori.fi` A records to **60 s**. Do this **at least 24 h** before the planned cutover.

- [ ] **Step 3: Confirm `.env.example` covers everything**

```bash
diff <(grep -oE '^[A-Z_]+' .env.example | sort -u) \
     <(printf '%s\n' BETTER_AUTH_SECRET BETTER_AUTH_URL DATABASE_URL STORAGE_ENDPOINT STORAGE_BUCKET STORAGE_ACCESS_KEY STORAGE_SECRET_KEY STORAGE_PUBLIC_URL RESEND_API_KEY CRON_SECRET LOG_LEVEL ALLOWED_ORIGINS | sort -u)
```
Expected: no missing entries on the right side. Anything missing → add to `.env.example` in a separate commit.

- [ ] **Step 4: Create `motori-backups` bucket**

In the Hetzner Cloud console: **Object Storage → Create bucket** with:
- Name: `motori-backups`
- Region: `hel1` (Helsinki — same as `motori-images` for low latency)
- ACL: **private** (backups must never be public-read, unlike `motori-images`)

Generate a fresh **Object Storage access key + secret** scoped to this bucket (or reuse the existing keypair if it has write access to both buckets). Record the credentials locally; they're used in Task 14 Step 2 for `dokku postgres:backup-auth`.

> Why a separate bucket: backups have different access patterns (write-once, read on disaster) and different ACL (private) from images (public-read). Mixing them would force one bucket-wide ACL.

---

### Task 7: Phase 2 — Server bootstrap

- [ ] **Step 1: Rebuild VPS**

In Hetzner Cloud console: Server → Rebuild → Ubuntu 24.04. Note the IPv4 address.

- [ ] **Step 2: Initial SSH + harden**

From local:
```bash
ssh root@<vps-ip>
```
On the VPS:
```bash
# create non-root deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# disable root + password SSH
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# unattended upgrades + fail2ban
apt-get update
apt-get install -y unattended-upgrades fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

# 2 GB swap (cheap insurance against build OOM)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

- [ ] **Step 3: Verify SSH as deploy user works**

From local: `ssh deploy@<vps-ip> sudo -n true` → expect a sudo prompt confirmation. Disconnect from root session.

- [ ] **Step 4: Capture into DEPLOY.md**

Replace the `### 1. Server bootstrap\nTODO` section with the actual commands run (redact IP if you prefer, but keep the structure).

- [ ] **Step 5: Commit**

```bash
git add DEPLOY.md
git commit -m "docs(deploy): capture server bootstrap commands"
```

---

### Task 8: Phase 3 — Dokku install

- [ ] **Step 1: Bootstrap Dokku**

On VPS as `deploy` (or root) — Dokku's bootstrap script needs root:
```bash
sudo -i
wget -NP . https://dokku.com/install/v0.34.x/bootstrap.sh
DOKKU_TAG=v0.34.x bash bootstrap.sh
```

- [ ] **Step 2: Add admin SSH key + global domain**

```bash
dokku ssh-keys:add admin < /home/deploy/.ssh/authorized_keys
dokku domains:set-global motori.fi
```

- [ ] **Step 3: Verify**

```bash
dokku version       # expect 0.34.x
dokku domains:report --global
```

- [ ] **Step 4: Capture + commit**

Update DEPLOY.md `### 2. Dokku install` section with real commands. Commit:
```bash
git add DEPLOY.md && git commit -m "docs(deploy): capture Dokku install"
```

---

### Task 9: Phases 4–5 — Postgres + app create + link

- [ ] **Step 1: Install Postgres plugin and create DB**

On VPS:
```bash
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git
dokku postgres:create motori --image-version 17
```

- [ ] **Step 2: Create app + link DB + set domains**

```bash
dokku apps:create motori
dokku postgres:link motori motori
dokku domains:set motori motori.fi www.motori.fi
```

- [ ] **Step 3: Verify**

```bash
dokku apps:list           # motori present
dokku config:show motori  # DATABASE_URL present (from link)
dokku domains:report motori
```

- [ ] **Step 4: Capture + commit**

Fold real commands into DEPLOY.md `### 4. App + domains + config` (first half). Commit.

---

### Task 10: Phase 6 — Config

- [ ] **Step 1: Generate fresh secrets locally**

```bash
openssl rand -hex 32   # → BETTER_AUTH_SECRET
openssl rand -hex 32   # → CRON_SECRET
```

- [ ] **Step 2: Set every required key**

On VPS (one command, keeps the app from rebuilding 10×):
```bash
dokku config:set --no-restart motori \
  BETTER_AUTH_SECRET=<…> \
  BETTER_AUTH_URL=https://motori.fi \
  ALLOWED_ORIGINS=https://motori.fi \
  STORAGE_ENDPOINT=https://hel1.your-objectstorage.com \
  STORAGE_BUCKET=motori-images \
  STORAGE_ACCESS_KEY=<…> \
  STORAGE_SECRET_KEY=<…> \
  STORAGE_PUBLIC_URL=https://motori-images.hel1.your-objectstorage.com \
  RESEND_API_KEY=<…> \
  CRON_SECRET=<…> \
  LOG_LEVEL=info
```

Do **not** set `DATABASE_URL` — `postgres:link` already injected it.

- [ ] **Step 3: Verify**

```bash
dokku config:show motori | sed 's/=.*/=***/'   # mask values, just confirm keys
```
Expected: every key from Step 2 plus `DATABASE_URL` is present.

- [ ] **Step 4: Capture + commit**

Append redacted `dokku config:set` template to DEPLOY.md (with `<…>` placeholders, not real secrets). Commit.

---

### Task 11: Phase 7 — First deploy

- [ ] **Step 1: Add dokku remote and push**

From local repo (on `dokku` branch):
```bash
git remote add dokku dokku@<vps-ip>:motori
git push dokku dokku:main
```

- [ ] **Step 2: Watch the build**

The buildpack should:
1. Detect Node + pnpm via `packageManager`
2. Run `pnpm install`
3. Run `pnpm build`
4. Trigger `release: pnpm db:migrate` — **migrations run before the new container takes over**
5. Start `web: pnpm start` on injected `PORT`

If the build OOMs, confirm swap is on (`free -h` on VPS) and retry.

- [ ] **Step 3: Smoke test on Dokku-issued hostname**

```bash
curl -I http://<vps-ip>/                # 200 or 301 (apex redirect not yet active w/o proper Host)
curl -I -H "Host: motori.fi" http://<vps-ip>/   # expect 200
```

- [ ] **Step 4: Capture + commit**

Update DEPLOY.md `### 5. First deploy + smoke test`. Commit.

---

### Task 12: Phase 8 — TLS

- [ ] **Step 1: Install plugin + enable**

On VPS:
```bash
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
dokku letsencrypt:set motori email ops@motori.fi
dokku letsencrypt:enable motori
dokku letsencrypt:cron-job --add
```

> Note: `letsencrypt:enable` will fail until DNS resolves to the VPS for both `motori.fi` and `www.motori.fi`. If you hit that, do Task 13 first, then come back. Update DEPLOY.md to reflect the order you actually used.

- [ ] **Step 2: Verify TLS**

```bash
curl -I https://motori.fi/        # 200 + valid cert
curl -I https://www.motori.fi/    # 301 → https://motori.fi/
```

- [ ] **Step 3: Capture + commit**

Update DEPLOY.md `### 6. TLS`. Commit.

---

### Task 13: Phase 9 — DNS cutover

- [ ] **Step 1: Flip A records**

DNS provider:
- `motori.fi` A → `<vps-ip>`
- `www.motori.fi` A → `<vps-ip>`
- TTL stays at 60 s for now; raise to 3600 s after Phase 13 if desired.

- [ ] **Step 2: Wait + verify propagation**

```bash
dig +short motori.fi
dig +short www.motori.fi
```
Both must return the new IP from multiple resolvers. If using `1.1.1.1` only, also check `8.8.8.8`.

- [ ] **Step 3: Full smoke test**

Manual against `https://motori.fi`:
- [ ] Sign up with a fresh email → confirm email verification flow
- [ ] Create a listing
- [ ] Upload an image (verify it lands in Hetzner Object Storage, not local disk)
- [ ] Make a booking
- [ ] Visit `https://www.motori.fi/listings` → confirm 301 to apex
- [ ] Open browser devtools → no mixed-content / CSP warnings

- [ ] **Step 4: Capture + commit**

Update DEPLOY.md `### 7. DNS cutover`. Commit.

---

### Task 14: Phase 10 — Backups (encrypted nightly + verified restore)

- [ ] **Step 1: Generate GPG key for backup encryption**

On a *secure local* machine (not the VPS — store the private key offline):
```bash
gpg --quick-generate-key 'Motori Backup <ops@motori.fi>' rsa4096 encr 5y
gpg --export --armor 'Motori Backup' > motori-backup-pubkey.asc
```
Copy `motori-backup-pubkey.asc` to the VPS at `/tmp/motori-backup-pubkey.asc`.

- [ ] **Step 2: Configure backup auth + encryption + schedule**

On VPS:
```bash
gpg --import /tmp/motori-backup-pubkey.asc
KEYID=$(gpg --list-keys --with-colons 'Motori Backup' | awk -F: '/^pub/ {print $5; exit}')

dokku postgres:backup-auth motori <s3-access-key> <s3-secret-key> default hel1.your-objectstorage.com
dokku postgres:backup-set-encryption motori "$KEYID"
dokku postgres:backup-schedule motori "0 3 * * *" motori-backups
```

> Bucket `motori-backups` was created in Task 6 Step 4. Use the access key/secret recorded then.

- [ ] **Step 3: Trigger one immediate backup**

```bash
dokku postgres:backup motori motori-backups
```
Confirm the file lands in the bucket and is `.gpg` encrypted.

- [ ] **Step 4: Verified restore**

On VPS:
```bash
# pull the backup file out of the bucket (use any S3 client; `s3cmd` or `mc`)
# decrypt with the GPG private key (do this locally, not on VPS, since private key lives offline):
gpg --decrypt motori-<timestamp>.tgz.gpg > motori.tgz

# create a throwaway DB
dokku postgres:create motori-restore-test --image-version 17
# load the dump
dokku postgres:import motori-restore-test < motori.tgz
# spot-check
dokku postgres:connect motori-restore-test -c "SELECT count(*) FROM users;"
# tear down
dokku postgres:destroy motori-restore-test --force
```

- [ ] **Step 5: Capture + commit**

Update DEPLOY.md `### 8. Backups` *and* fill in the `## Restore from backup` section with the exact commands used in Step 4. Commit.

---

### Task 15: Phase 11 — Host crontab for `/api/cron`

> Real endpoint: `POST /api/cron?task=<name>` with `Authorization: Bearer $CRON_SECRET`.
> Tasks defined in `src/routes/api/cron.ts`: `purge-sessions`, `notify-expiry`, `expire-bookings`.

- [ ] **Step 1: Add crontab entries**

On VPS as root (`sudo crontab -e`):
```cron
CRON_SECRET=<paste-cron-secret-from-dokku-config>

5  4 * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://motori.fi/api/cron?task=purge-sessions" >/dev/null
0  6 * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://motori.fi/api/cron?task=notify-expiry"   >/dev/null
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://motori.fi/api/cron?task=expire-bookings" >/dev/null
```

> Note: `CRON_SECRET` lives in two places — `dokku config` (for the app) and root crontab (for the trigger). Both must match.

- [ ] **Step 2: Verify by running one manually**

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer <secret>" \
  "https://motori.fi/api/cron?task=purge-sessions"
```
Expected: `200` with `{"purge-sessions":{"deleted":N}}`.

- [ ] **Step 3: Capture + commit**

Update DEPLOY.md `### 9. Host crontab`. Commit.

---

### Task 16: Phase 12 — Off-VPS secrets backup (age)

- [ ] **Step 1: Generate age keypair locally (one-time)**

```bash
age-keygen -o ~/.config/age/motori.key
# public key is printed; copy it. Private key file MUST stay off the VPS.
```

- [ ] **Step 2: Export + encrypt + commit**

From local:
```bash
mkdir -p secrets
ssh deploy@<vps-ip> "dokku config:export motori" \
  | age -r age1<your-pubkey> \
  > secrets/motori.env.age
git add secrets/motori.env.age
git commit -m "ops: add age-encrypted off-VPS secrets backup"
```

- [ ] **Step 3: Document refresh procedure**

Update DEPLOY.md `### 10. Off-VPS secrets backup`:
- one-line how to refresh after a `config:set` change (re-run the export command, commit)
- one-line decrypt: `age -d -i ~/.config/age/motori.key secrets/motori.env.age`

Commit DEPLOY.md.

---

### Task 17: Final pass + ship

- [ ] **Step 1: Full verification suite**

Locally:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```
Expected: all green.

- [ ] **Step 2: DEPLOY.md polish**

Re-read DEPLOY.md end-to-end. Confirm:
- Every section has real commands (no `TODO` left).
- Restore section is filled from Task 14.
- IP address handling is consistent (placeholder `<vps-ip>` or real IP, your call).

- [ ] **Step 3: Commit any final DEPLOY.md cleanup**

```bash
git add DEPLOY.md
git commit -m "docs(deploy): final polish of runbook"
```

- [ ] **Step 4: Open PR**

```bash
git push -u origin dokku
gh pr create --title "Migrate prod to Dokku (closes #80)" --body "$(cat <<'EOF'
## Summary
- Wipes the old Compose/Terraform Hetzner setup and redeploys Motori on Dokku via the Heroku Node buildpack
- Adds Procfile (release-phase migrations), Node 24 engine pin, www→apex redirect middleware
- Captures the real cutover commands in DEPLOY.md
- Postgres backups encrypted with GPG, scheduled nightly to Hetzner Object Storage, verified with a restore
- Host crontab triggers `/api/cron` (purge-sessions, notify-expiry, expire-bookings)
- `secrets/motori.env.age` committed as off-VPS secrets backup

Closes #80.

## Test plan
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green
- [x] motori.fi serves over HTTPS with valid Let's Encrypt cert
- [x] www.motori.fi 301-redirects to motori.fi
- [x] Signup → listing → image upload → booking flow works end-to-end on prod
- [x] One nightly backup verified by restoring into a throwaway DB
- [x] `git push dokku main` deploys cleanly with auto-migrations
EOF
)"
```

---

## Acceptance criteria (from spec)

- [ ] motori.fi over HTTPS with valid Let's Encrypt cert
- [ ] www.motori.fi 301 → motori.fi
- [ ] `git push dokku main` deploys cleanly; release-phase migrations run
- [ ] Postgres data persists across redeploys
- [ ] Nightly encrypted backup with one verified restore
- [ ] Cron jobs hit `/api/cron` on schedule
- [ ] DEPLOY.md committed with real commands
- [ ] `secrets/motori.env.age` committed as off-VPS secrets backup
