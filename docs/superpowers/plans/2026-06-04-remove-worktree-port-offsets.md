# Remove Worktree Port Offsets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the per-worktree port offset system so `pnpm dev` always binds the same fixed ports (DB 5433, Vite 3000) regardless of which worktree you're in.

**Architecture:** Two scripts implement the port offset system (`worktree-ports.sh`, `patch-worktree-env.sh`). `vite.config.ts` has a companion worktree-detection block. The callers are `package.json` and `.workmux.yaml`, plus a new `scripts/dev.sh` entrypoint. All of these are simplified or deleted. `docker-compose.yml` already has sensible `${VAR:-default}` fallbacks and needs no changes. Docker Compose's default project name is derived from the working directory, so volume isolation between worktrees continues to work naturally.

**Tech Stack:** Bash, Vite, docker compose, workmux.

**Tradeoff accepted:** Two worktrees cannot run their dev stacks simultaneously without port conflicts. The user is aware and fine with this.

---

## File structure

- `scripts/worktree-ports.sh` — **delete**
- `scripts/patch-worktree-env.sh` — **delete**
- `scripts/dev.sh` — **add** (call `docker compose` directly)
- `package.json` — **modify** (`dev`/`dev:down` scripts)
- `.workmux.yaml` — **modify** (post_create and pre_remove hooks)
- `vite.config.ts` — **modify** (remove the `.worktree-offset` detection block)
- `AGENTS.md` (and its `CLAUDE.md` symlink) — **modify** (`pnpm dev` bullet)

---

## Task 1: Delete the port-offset scripts and update their callers

**Files:**
- Delete: `scripts/worktree-ports.sh`
- Delete: `scripts/patch-worktree-env.sh`
- Add: `scripts/dev.sh`
- Modify: `package.json`
- Modify: `.workmux.yaml`

- [ ] **Step 1: Delete the two scripts**

```bash
rm scripts/worktree-ports.sh scripts/patch-worktree-env.sh
```

Expected: files gone, no errors.

- [ ] **Step 2: Add `scripts/dev.sh` that calls `docker compose` directly**

Create the file with:

```bash
#!/usr/bin/env bash
# `pnpm dev` entrypoint: bring up the dev stack (Postgres) and run the
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

- [ ] **Step 3: Update `package.json` scripts**

Point `dev` at the new entrypoint and add a `dev:down`:

```json
"dev": "bash scripts/dev.sh",
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

- [ ] **Step 5: Verify `pnpm dev:down` works**

Run: `pnpm dev:down`
Expected: runs `docker compose down`, exits 0 (even if no containers are up — docker compose is idempotent on down).

- [ ] **Step 6: Commit**

```bash
git add scripts/dev.sh package.json .workmux.yaml
git rm scripts/worktree-ports.sh scripts/patch-worktree-env.sh
git commit -m "refactor(dev): remove worktree port offset system"
```

---

## Task 2: Remove the worktree detection block from `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

The `.worktree-offset` block reads the file and force-applies env overrides. Without the port offset system this is dead code.

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
- Modify: `AGENTS.md` (its `CLAUDE.md` symlink updates automatically)

- [ ] **Step 1: Update the `pnpm dev` bullet**

Find the `pnpm dev` line (currently includes the worktree compose mention) and replace it:

Old:
```
- `pnpm dev` — one command (`scripts/dev.sh`) that brings up the whole dev stack (Postgres + Loki + Grafana via docker compose) **and** runs the Vite dev server at http://localhost:3000. **Ctrl+C stops everything**, containers included (a trap runs `docker compose down`). Grafana: http://localhost:3001 (anonymous admin). Works the same in git worktrees — `scripts/compose.sh` auto-applies the per-worktree offset ports/project name (from `scripts/worktree-ports.sh`), so no manual sourcing. `pnpm dev:down` is a manual teardown if ever needed.
```

New:
```
- `pnpm dev` — one command (`scripts/dev.sh`) that brings up the dev stack (Postgres via docker compose) **and** runs the Vite dev server at http://localhost:3000. **Ctrl+C stops everything**, containers included (a trap runs `docker compose down`). `pnpm dev:down` is a manual teardown if ever needed.
```

- [ ] **Step 2: Verify docs look correct**

Run: `grep -n "worktree-ports\|compose\.sh\|patch-worktree\|worktree-offset\|WORKTREE_OFFSET\|offset ports" AGENTS.md`
Expected: no output (all references removed).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
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

Run: `pnpm dev` and confirm Vite starts at http://localhost:3000 and `docker compose ps` shows the `db` container up. Ctrl+C and confirm it stops.

---

## Self-review

- **Spec coverage:** Both port-offset scripts deleted ✓. Callers updated (new dev.sh, package.json, .workmux.yaml) ✓. vite.config.ts worktree block removed ✓. Docs updated (AGENTS.md + CLAUDE.md symlink) ✓. `.worktree-offset` cleanup ✓.
- **Placeholder scan:** All code blocks are complete and directly actionable.
- **Type consistency:** No cross-task type references — changes are pure deletion/simplification.
- **`docker-compose.yml` unchanged:** The `${DB_PORT:-5433}` etc. env-var patterns are harmless with defaults — no need to change them.
- **Volume isolation preserved:** Docker Compose derives its project name from the working directory name, so worktrees in different directories naturally get different project names (and thus separate volumes) without the port script.
