# Remove Worktree Port Offsets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the per-worktree port offset system so `pnpm dev` always binds the same fixed ports (DB 5433, Loki 3100, Grafana 3001, Vite 3000) regardless of which worktree you're in.

**Architecture:** Three scripts implement the port offset system (`worktree-ports.sh`, `patch-worktree-env.sh`, `compose.sh`). `vite.config.ts` has a companion worktree-detection block. The callers are `scripts/dev.sh`, `package.json`, and `.workmux.yaml`. All of these are simplified or deleted. `docker-compose.yml` already has sensible `${VAR:-default}` fallbacks and needs no changes. Docker Compose's default project name is derived from the working directory, so volume isolation between worktrees continues to work naturally.

**Tech Stack:** Bash, Vite, docker compose, workmux.

**Tradeoff accepted:** Two worktrees cannot run their dev stacks simultaneously without port conflicts. The user is aware and fine with this.

---

## File structure

- `scripts/worktree-ports.sh` — **delete**
- `scripts/patch-worktree-env.sh` — **delete**
- `scripts/compose.sh` — **delete**
- `scripts/dev.sh` — **modify** (call `docker compose` directly instead of `compose.sh`)
- `package.json` — **modify** (`dev:down` script)
- `.workmux.yaml` — **modify** (post_create and pre_remove hooks)
- `vite.config.ts` — **modify** (remove the `.worktree-offset` detection block, lines 10–47)
- `CLAUDE.md` — **modify** (`pnpm dev` bullet)
- `AGENTS.md` — **modify** (`pnpm dev` bullet)
- `infra/observability/README.md` — **modify** (remove worktree port sentences)

---

## Task 1: Delete the three port-offset scripts and update their callers

**Files:**
- Delete: `scripts/worktree-ports.sh`
- Delete: `scripts/patch-worktree-env.sh`
- Delete: `scripts/compose.sh`
- Modify: `scripts/dev.sh`
- Modify: `package.json`
- Modify: `.workmux.yaml`

- [ ] **Step 1: Delete the three scripts**

```bash
rm scripts/worktree-ports.sh scripts/patch-worktree-env.sh scripts/compose.sh
```

Expected: files gone, no errors.

- [ ] **Step 2: Rewrite `scripts/dev.sh` to call `docker compose` directly**

Replace the entire file with:

```bash
#!/usr/bin/env bash
# `pnpm dev` entrypoint: bring up the dev stack (Postgres + Loki + Grafana) and run the
# Vite dev server in the foreground. Ctrl+C stops Vite AND tears the containers down.
set -euo pipefail

cleanup() {
	trap - EXIT INT TERM
	echo
	echo "→ stopping dev stack (docker compose down)…"
	docker compose down
}
trap cleanup EXIT INT TERM

docker compose up -d
vite dev
```

- [ ] **Step 3: Update `package.json` `dev:down`**

Change:

```json
"dev:down": "bash scripts/compose.sh down",
```

to:

```json
"dev:down": "docker compose down",
```

- [ ] **Step 4: Update `.workmux.yaml` hooks**

`post_create` currently sources `worktree-ports.sh` and runs `patch-worktree-env.sh`. Remove those, keeping only the commands that still make sense:

```yaml
post_create:
  - mise trust
  - bash -c "docker compose up -d db && pnpm install && pnpm db:migrate && pnpm db:seed"
```

`pre_remove` currently sources `worktree-ports.sh` for the project name before tearing down. Remove that:

```yaml
pre_remove:
  - docker compose down -v
```

The full updated `.workmux.yaml`:

```yaml
nerdfont: true

merge_strategy: rebase
agent: claude

files:
  copy:
    - .env
    - .env.prod
  symlink:
    - .claude/settings.local.json

post_create:
  - mise trust
  - bash -c "docker compose up -d db && pnpm install && pnpm db:migrate && pnpm db:seed"

pre_remove:
  - docker compose down -v

panes:
  - command: <agent>
    focus: true
  - command: pnpm dev
    split: vertical
```

- [ ] **Step 5: Verify `pnpm dev:down` works**

Run: `pnpm dev:down`
Expected: runs `docker compose down`, exits 0 (even if no containers are up — docker compose is idempotent on down).

- [ ] **Step 6: Commit**

```bash
git add scripts/dev.sh package.json .workmux.yaml
git rm scripts/worktree-ports.sh scripts/patch-worktree-env.sh scripts/compose.sh
git commit -m "refactor(dev): remove worktree port offset system"
```

---

## Task 2: Remove the worktree detection block from `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

The block on lines 10–47 reads `.worktree-offset` and force-applies env overrides. Without the port offset system this is dead code.

- [ ] **Step 1: Remove the worktree block**

Delete everything from the comment through the closing `}` — replace:

```ts
// Per-worktree dev only: when this checkout is a workmux worktree (marked by
// .worktree-offset, written by scripts/worktree-ports.sh), force a stale set of
// shell-inherited keys to match .env. Node's loadEnvFile / --env-file skip keys
// already present in the environment, so a BETTER_AUTH_URL inherited from the
// parent shell would make the define block below inline the wrong canonical URL.
// Gated + key-scoped so normal builds (CI/prod, plain dev) keep standard
// shell-wins-over-.env precedence.
if (existsSync(".worktree-offset")) {
	const WORKTREE_OVERRIDE_KEYS = new Set(["BETTER_AUTH_URL", "DATABASE_URL", "PORT"]);
	try {
		const envText = readFileSync(".env", "utf8");
		for (const rawLine of envText.split("\n")) {
			const line = rawLine.trim();
			if (!line || line.startsWith("#")) {
				continue;
			}
			const eq = line.indexOf("=");
			if (eq <= 0) {
				continue;
			}
			const key = line.slice(0, eq).trim();
			if (!WORKTREE_OVERRIDE_KEYS.has(key)) {
				continue;
			}
			let value = line.slice(eq + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			process.env[key] = value;
		}
	} catch (err) {
		// biome-ignore lint/suspicious/noConsole: build-time config, surface real .env read failures
		console.warn("vite.config: failed to apply worktree .env overrides:", err);
	}
}
```

with nothing (delete it entirely).

- [ ] **Step 2: Remove the now-unused imports**

`existsSync` and `readFileSync` are no longer used. Remove them from the import line:

Change:

```ts
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
```

to:

```ts
import { execSync } from "node:child_process";
import path from "node:path";
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both PASS. (Biome will flag unused imports as errors if the import line isn't cleaned up — the step above prevents this.)

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "refactor(config): remove worktree env-override block from vite.config"
```

---

## Task 3: Update docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `infra/observability/README.md`

- [ ] **Step 1: Update `CLAUDE.md` `pnpm dev` bullet**

Find the `pnpm dev` line (currently includes the worktree compose mention) and replace it:

Old:
```
- `pnpm dev` — one command (`scripts/dev.sh`) that brings up the whole dev stack (Postgres + Loki + Grafana via docker compose) **and** runs the Vite dev server at http://localhost:3000. **Ctrl+C stops everything**, containers included (a trap runs `docker compose down`). Grafana: http://localhost:3001 (anonymous admin). Works the same in git worktrees — `scripts/compose.sh` auto-applies the per-worktree offset ports/project name (from `scripts/worktree-ports.sh`), so no manual sourcing. `pnpm dev:down` is a manual teardown if ever needed.
```

New:
```
- `pnpm dev` — one command (`scripts/dev.sh`) that brings up the whole dev stack (Postgres + Loki + Grafana via docker compose) **and** runs the Vite dev server at http://localhost:3000. **Ctrl+C stops everything**, containers included (a trap runs `docker compose down`). Grafana: http://localhost:3001 (anonymous admin). `pnpm dev:down` is a manual teardown if ever needed.
```

- [ ] **Step 2: Update `AGENTS.md` `pnpm dev` bullet**

Find the same `pnpm dev` line in `AGENTS.md` and apply the same replacement as Step 1.

- [ ] **Step 3: Update `infra/observability/README.md`**

In the Local dev section, find the worktree-offset sentence block:

Old:
```
- Grafana: <http://localhost:3001> (anonymous admin — no login). Worktrees use offset ports
  applied automatically by `scripts/compose.sh` (no manual sourcing): `GRAFANA_PORT`/`LOKI_PORT`
  come from `scripts/worktree-ports.sh`, and `LOKI_URL` is baked into `.env` by
  `scripts/patch-worktree-env.sh`.
```

New:
```
- Grafana: <http://localhost:3001> (anonymous admin — no login).
```

- [ ] **Step 4: Verify docs look correct**

Run: `grep -n "worktree-ports\|compose\.sh\|patch-worktree\|worktree-offset\|WORKTREE_OFFSET\|offset ports" CLAUDE.md AGENTS.md infra/observability/README.md`
Expected: no output (all references removed).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md infra/observability/README.md
git commit -m "docs: remove worktree port offset references"
```

---

## Task 4: Cleanup and final verification

- [ ] **Step 1: Delete the stale `.worktree-offset` file from this worktree**

```bash
rm -f .worktree-offset
```

This file was generated locally by `worktree-ports.sh`. It's not tracked in git (verify: `git ls-files .worktree-offset` returns nothing), so deleting it is safe. Note: other active worktrees will have their own copy — delete them there too when winding those worktrees down.

- [ ] **Step 2: Verify `.worktree-offset` is not tracked**

Run: `git ls-files .worktree-offset`
Expected: no output.

- [ ] **Step 3: Full check suite**

Run each, expect PASS:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

- [ ] **Step 4: Smoke the dev startup**

Run: `pnpm dev` and confirm Vite starts at http://localhost:3000 and `docker compose ps` shows `db`, `loki`, and `grafana` containers up. Ctrl+C and confirm all containers stop.

---

## Self-review

- **Spec coverage:** All three scripts deleted ✓. Callers updated (dev.sh, package.json, .workmux.yaml) ✓. vite.config.ts worktree block removed ✓. Docs updated (CLAUDE.md, AGENTS.md, infra/observability/README.md) ✓. `.worktree-offset` cleanup ✓.
- **Placeholder scan:** All code blocks are complete and directly actionable.
- **Type consistency:** No cross-task type references — changes are pure deletion/simplification.
- **`docker-compose.yml` unchanged:** The `${DB_PORT:-5433}` etc. env-var patterns are harmless with defaults — no need to change them.
- **Volume isolation preserved:** Docker Compose derives its project name from the working directory name, so worktrees in different directories naturally get different project names (and thus separate volumes) without the port script.
