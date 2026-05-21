# Per-worktree isolation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `workmux` worktrees self-contained — each gets its own Postgres container, dev server port, and `BETTER_AUTH_URL` — while sharing `.env` secrets and the pnpm store.

**Architecture:** Two bash scripts (port assignment + `.env` patching) run from workmux's `post_create` hook. `docker-compose.yml` becomes port-parameterized and loses its hardcoded project name so `COMPOSE_PROJECT_NAME` per worktree drives container/volume naming. `vite.config.ts` reads `PORT` so the dev server honors the patched env.

**Tech Stack:** bash, docker compose, sed, Vite, TanStack Start (Nitro), workmux.

**Spec:** `docs/superpowers/specs/2026-05-21-worktree-isolation-design.md`

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `scripts/worktree-ports.sh` | Compute stable `WORKTREE_OFFSET`/`DB_PORT`/`DEV_PORT` from `WM_HANDLE`, persist to `.worktree-offset`, bump on port collision | Create |
| `scripts/patch-worktree-env.sh` | Source ports script, sed-rewrite `DATABASE_URL`/`BETTER_AUTH_URL`/`PORT` in `.env` | Create |
| `docker-compose.yml` | Drop hardcoded `name: motori`, parameterize port via `${DB_PORT:-5433}` | Modify |
| `vite.config.ts` | Read `process.env.PORT` for `server.port` (fallback 3000) | Modify |
| `.gitignore` | Ignore `.worktree-offset` | Modify |
| `.workmux.yaml` | Add `post_create`/`pre_remove` hooks, replace install pane with `pnpm dev` | Modify |

---

## Task 1: Make Vite read PORT from env

**Files:**
- Modify: `vite.config.ts:22-25`

- [ ] **Step 1: Edit `vite.config.ts`**

Replace the `server` block:

```ts
	server: {
		port: 3000,
	},
```

with:

```ts
	server: {
		port: Number(process.env.PORT) || 3000,
	},
```

- [ ] **Step 2: Verify dev server respects PORT**

Run: `PORT=3055 pnpm dev`
Expected: Vite logs `Local: http://localhost:3055/`. Stop the server (Ctrl-C).

- [ ] **Step 3: Verify default still works**

Run: `pnpm dev`
Expected: Vite logs `Local: http://localhost:3000/`. Stop the server.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "feat(dev): vite dev server reads PORT env"
```

---

## Task 2: Parameterize docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Edit `docker-compose.yml`**

Replace the full file contents with:

```yaml
services:
  db:
    image: postgres:17-alpine

    ports:
      - "${DB_PORT:-5433}:5432"
    environment:
      POSTGRES_USER: motori
      POSTGRES_PASSWORD: motori
      POSTGRES_DB: motori
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Two changes from before: top-level `name: motori` removed; `ports` uses `${DB_PORT:-5433}`. The compose project name now defaults to the directory name (`motori` in the main checkout), so existing developers keep their `motori_pgdata` volume.

- [ ] **Step 2: Verify main worktree still boots**

Run: `docker compose up -d db && docker compose ps`
Expected: a service `db` with state `running`, host port `5433`. Project name shows as `motori` in `docker compose ls`.

- [ ] **Step 3: Verify DB_PORT override works**

Run: `docker compose down && DB_PORT=5499 docker compose -p motori-test up -d db && docker compose -p motori-test ps`
Expected: container bound to host port `5499`. Then tear down: `docker compose -p motori-test down -v`.

- [ ] **Step 4: Bring main DB back up for subsequent tasks**

Run: `docker compose up -d db`
Expected: running, port 5433.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(dev): parameterize docker-compose port and project name"
```

---

## Task 3: Add `scripts/worktree-ports.sh`

**Files:**
- Create: `scripts/worktree-ports.sh`

Note: this script is meant to be **sourced** from the patch script (so its exports propagate). It can also be executed standalone to print the values for debugging.

- [ ] **Step 1: Create the script**

Write `scripts/worktree-ports.sh`:

```bash
#!/usr/bin/env bash
# Compute stable per-worktree port offset.
#
# Sources WM_HANDLE (from workmux) or falls back to the basename of $PWD.
# Persists the chosen offset to .worktree-offset at the worktree root so subsequent
# invocations are stable. Bumps the offset on port collisions and rewrites the file.
#
# Exports: WORKTREE_OFFSET, DB_PORT, DEV_PORT, COMPOSE_PROJECT_NAME

set -euo pipefail

handle="${WM_HANDLE:-$(basename "$PWD")}"

offset_file=".worktree-offset"

port_free() {
	! lsof -iTCP:"$1" -sTCP:LISTEN -P -n >/dev/null 2>&1
}

compute_offset() {
	# sha256 of handle -> hex -> integer mod 100
	local hex
	hex=$(printf '%s' "$handle" | shasum -a 256 | cut -c1-8)
	echo $(( 0x$hex % 100 ))
}

if [[ -f "$offset_file" ]]; then
	offset=$(<"$offset_file")
else
	offset=$(compute_offset)
	# Bump on collision (max 100 tries; wraps).
	for _ in $(seq 1 100); do
		db_port=$((5433 + offset))
		dev_port=$((3000 + offset))
		if port_free "$db_port" && port_free "$dev_port"; then
			break
		fi
		offset=$(( (offset + 1) % 100 ))
	done
	echo "$offset" > "$offset_file"
fi

export WORKTREE_OFFSET="$offset"
export DB_PORT=$((5433 + offset))
export DEV_PORT=$((3000 + offset))
export COMPOSE_PROJECT_NAME="motori-${handle}"

# When executed (not sourced), print the values.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	echo "WM_HANDLE=$handle"
	echo "WORKTREE_OFFSET=$WORKTREE_OFFSET"
	echo "DB_PORT=$DB_PORT"
	echo "DEV_PORT=$DEV_PORT"
	echo "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"
fi
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/worktree-ports.sh`

- [ ] **Step 3: Smoke test with explicit handle**

Run: `rm -f /tmp/wt-test/.worktree-offset; mkdir -p /tmp/wt-test && cd /tmp/wt-test && WM_HANDLE=feat-alpha /Users/christian.vilen/work/motori/scripts/worktree-ports.sh`
Expected: output shows `WM_HANDLE=feat-alpha`, an offset in 0..99, matching `DB_PORT` and `DEV_PORT`, and `COMPOSE_PROJECT_NAME=motori-feat-alpha`. A `.worktree-offset` file is created.

- [ ] **Step 4: Verify stability**

Run: `/Users/christian.vilen/work/motori/scripts/worktree-ports.sh`
Expected: same offset as step 3 (read from `.worktree-offset`).

- [ ] **Step 5: Verify different handle gives different offset**

Run: `rm .worktree-offset; WM_HANDLE=feat-beta /Users/christian.vilen/work/motori/scripts/worktree-ports.sh`
Expected: different offset (very likely; collisions possible but rare).

- [ ] **Step 6: Cleanup test dir and return**

Run: `cd /Users/christian.vilen/work/motori && rm -rf /tmp/wt-test`

- [ ] **Step 7: Commit**

```bash
git add scripts/worktree-ports.sh
git commit -m "feat(dev): add worktree-ports.sh for per-worktree port assignment"
```

---

## Task 4: Add `scripts/patch-worktree-env.sh`

**Files:**
- Create: `scripts/patch-worktree-env.sh`

- [ ] **Step 1: Create the script**

Write `scripts/patch-worktree-env.sh`:

```bash
#!/usr/bin/env bash
# Rewrite DATABASE_URL, BETTER_AUTH_URL, and PORT in ./.env to match this worktree's
# allocated ports. Idempotent. Leaves all other keys untouched.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worktree-ports.sh
source "$here/worktree-ports.sh"

if [[ ! -f .env ]]; then
	echo "patch-worktree-env: .env not found in $PWD" >&2
	exit 1
fi

# Use a temp file so we never partially overwrite .env.
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

new_db_url="DATABASE_URL=postgresql://motori:motori@localhost:${DB_PORT}/motori"
new_auth_url="BETTER_AUTH_URL=http://localhost:${DEV_PORT}"
new_port="PORT=${DEV_PORT}"

# Rewrite existing lines.
sed \
	-e "s|^DATABASE_URL=.*$|${new_db_url}|" \
	-e "s|^BETTER_AUTH_URL=.*$|${new_auth_url}|" \
	-e "s|^PORT=.*$|${new_port}|" \
	.env > "$tmp"

# Append PORT if it wasn't already present.
if ! grep -q '^PORT=' "$tmp"; then
	printf '\n%s\n' "$new_port" >> "$tmp"
fi

mv "$tmp" .env
trap - EXIT

echo "patch-worktree-env: offset=$WORKTREE_OFFSET DB_PORT=$DB_PORT DEV_PORT=$DEV_PORT"
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/patch-worktree-env.sh`

- [ ] **Step 3: Smoke test against a copy of `.env`**

Run:
```bash
mkdir -p /tmp/wt-patch-test && cp .env /tmp/wt-patch-test/.env && cd /tmp/wt-patch-test && WM_HANDLE=feat-alpha /Users/christian.vilen/work/motori/scripts/patch-worktree-env.sh
```
Expected: command prints `offset=<N> DB_PORT=<5433+N> DEV_PORT=<3000+N>`. Then `grep -E '^(DATABASE_URL|BETTER_AUTH_URL|PORT)=' .env` shows the three keys with the new values.

- [ ] **Step 4: Verify idempotency**

Run the script a second time in `/tmp/wt-patch-test`. Expected: same output; `.env` unchanged (compare with `md5sum .env` before and after).

- [ ] **Step 5: Cleanup and return**

Run: `cd /Users/christian.vilen/work/motori && rm -rf /tmp/wt-patch-test`

- [ ] **Step 6: Commit**

```bash
git add scripts/patch-worktree-env.sh
git commit -m "feat(dev): add patch-worktree-env.sh to rewrite per-worktree env"
```

---

## Task 5: Ignore `.worktree-offset`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append the entry**

Add a line to `.gitignore` (after the existing `.env` / `.env.prod` block, before the `*.local` line is fine):

```
.worktree-offset
```

- [ ] **Step 2: Verify**

Run: `grep -F '.worktree-offset' .gitignore`
Expected: prints `.worktree-offset`.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore .worktree-offset"
```

---

## Task 6: Wire `.workmux.yaml` lifecycle hooks

**Files:**
- Modify: `.workmux.yaml`

- [ ] **Step 1: Replace `.workmux.yaml`**

Replace the file contents with:

```yaml
nerdfont: true

merge_strategy: rebase
agent: claude

files:
  copy:
    - .env
    - .env.prod

post_create: |
  ./scripts/patch-worktree-env.sh
  docker compose up -d db
  pnpm install
  pnpm db:migrate
  pnpm db:seed

pre_remove: |
  docker compose down -v

panes:
  - command: <agent>
    focus: true
  - command: pnpm dev
    split: vertical
```

Note: `docker compose up/down` no longer needs `-p motori-${WM_HANDLE}` because `patch-worktree-env.sh` sources `worktree-ports.sh`, which exports `COMPOSE_PROJECT_NAME`. workmux hooks inherit that export into subsequent commands in the same `post_create` block. For `pre_remove`, we re-source via the same path:

Actually, `pre_remove` runs in a fresh shell — `COMPOSE_PROJECT_NAME` won't carry over from `post_create`. Fix the `pre_remove` line:

```yaml
pre_remove: |
  source scripts/worktree-ports.sh
  docker compose down -v
```

And the same fix for `post_create` to be explicit (don't rely on the patch script's side effect for the subsequent compose call):

```yaml
post_create: |
  source scripts/worktree-ports.sh
  ./scripts/patch-worktree-env.sh
  docker compose up -d db
  pnpm install
  pnpm db:migrate
  pnpm db:seed
```

Final file contents:

```yaml
nerdfont: true

merge_strategy: rebase
agent: claude

files:
  copy:
    - .env
    - .env.prod

post_create: |
  source scripts/worktree-ports.sh
  ./scripts/patch-worktree-env.sh
  docker compose up -d db
  pnpm install
  pnpm db:migrate
  pnpm db:seed

pre_remove: |
  source scripts/worktree-ports.sh
  docker compose down -v

panes:
  - command: <agent>
    focus: true
  - command: pnpm dev
    split: vertical
```

- [ ] **Step 2: Lint-check the YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.workmux.yaml'))" && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .workmux.yaml
git commit -m "feat(dev): workmux hooks for per-worktree db, install, migrate, seed"
```

---

## Task 7: End-to-end smoke test

This task does not modify code. It verifies the whole flow in a real workmux worktree.

- [ ] **Step 1: Create a test worktree**

Run: `workmux create feat-isolation-smoke`
Expected: workmux creates the worktree, copies `.env`, runs `post_create` (env patched, DB up, install, migrate, seed), opens tmux window with agent pane + `pnpm dev` pane.

- [ ] **Step 2: Confirm port assignment**

In the new worktree pane, run: `cat .worktree-offset && grep -E '^(DATABASE_URL|BETTER_AUTH_URL|PORT)=' .env`
Expected: an offset 0-99; the three env keys point at `5433+offset` / `3000+offset`.

- [ ] **Step 3: Confirm DB container**

Run: `docker compose ps`
Expected: a service `db` in state `running`, host port matches `.env`'s `DATABASE_URL`. `docker compose ls` shows project `motori-feat-isolation-smoke`.

- [ ] **Step 4: Confirm dev server is reachable**

Visit `http://localhost:<DEV_PORT>` (the value in `.env`).
Expected: the motori landing page loads. (Stop here if it doesn't — the most likely cause is `vite.config.ts` not picking up `PORT`; re-check Task 1.)

- [ ] **Step 5: Confirm main worktree is unaffected**

In the main tree, run: `docker compose ps && curl -sf http://localhost:3000/ -o /dev/null && echo OK`
Expected: main DB still on 5433, main dev server (if running) reachable on 3000, `OK` printed.

- [ ] **Step 6: Tear down**

Run: `workmux remove feat-isolation-smoke`
Expected: `pre_remove` runs `docker compose down -v` for the per-worktree project; the worktree and its postgres volume are gone. Verify with `docker volume ls | grep motori-feat-isolation-smoke` (should print nothing).

- [ ] **Step 7: Run repo checks**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass.

- [ ] **Step 8: No commit needed**

This task is verification-only.

---

## Self-review

**Spec coverage:**
- Architecture/isolation matrix → Tasks 2, 3, 6.
- Port assignment with collision bump + `.worktree-offset` → Task 3.
- docker-compose parameterization → Task 2.
- `.env` patching → Task 4.
- `.workmux.yaml` hooks → Task 6.
- Main worktree compatibility → verified in Tasks 2.step 2 and 7.step 5.
- `.worktree-offset` gitignored → Task 5.
- Vite dev port wiring (open question) → Task 1.

**Placeholder scan:** none.

**Type/name consistency:** `WORKTREE_OFFSET` / `DB_PORT` / `DEV_PORT` / `COMPOSE_PROJECT_NAME` used identically across scripts and hooks.
