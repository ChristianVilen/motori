# Per-worktree isolation design

**Date:** 2026-05-21
**Status:** Draft

## Goal

Let multiple git worktrees of motori run in parallel on one dev machine, each with its own Postgres database, dev server port, and local uploads dir — driven by [workmux](https://workmux.raine.dev/) lifecycle hooks. Secrets and the pnpm store stay shared; ports and data are isolated.

## Constraints

- workmux already manages worktree creation and copies `.env` / `.env.prod` into each worktree (see `.workmux.yaml`).
- workmux exposes `WM_HANDLE`, `WM_WORKTREE_PATH`, `WM_PROJECT_ROOT` to hooks but no numeric slot index.
- The current `docker-compose.yml` hard-codes `name: motori` and port `5433:5432` — both must become per-worktree.
- `BETTER_AUTH_URL` flows into `SITE_URL` (`src/lib/constants.ts`), CSP, cookies, and canonical links, so the dev server port and `BETTER_AUTH_URL` must stay in sync.

## Architecture

Each worktree is a self-contained island:

| | Per-worktree | Shared (inherited from main) |
|---|---|---|
| Postgres container + named volume | ✅ | |
| DB port + dev server port | ✅ | |
| `/uploads/` directory | ✅ (in tree) | |
| `.env` secrets | | ✅ (copied by workmux) |
| pnpm content-addressed store | | ✅ (pnpm global) |

## Port assignment

`scripts/worktree-ports.sh` derives a stable offset `N ∈ 0..99` from `sha256(WM_HANDLE)` and exports:

- `WORKTREE_OFFSET=$N`
- `DB_PORT=$((5433 + N))`
- `DEV_PORT=$((3000 + N))`

**Persistence and collisions.** The chosen offset is written to `.worktree-offset` at the worktree root on first boot. Subsequent shell invocations read that file instead of recomputing. If two handles hash to the same offset, `post_create` detects the bound port (via `lsof -i`) and bumps `N` until both `$DB_PORT` and `$DEV_PORT` are free, then writes the chosen `N`. `.worktree-offset` is gitignored.

## docker-compose

`docker-compose.yml` becomes parameterized:

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

The hard-coded `name: motori` line is removed. `COMPOSE_PROJECT_NAME` (set per-worktree to `motori-${WM_HANDLE}` by the hook) drives container and volume naming so trees never share state.

## `.env` patching

`scripts/patch-worktree-env.sh` runs in `post_create` after workmux copies `.env`. It rewrites three keys in place using `sed`:

- `DATABASE_URL=postgresql://motori:motori@localhost:${DB_PORT}/motori`
- `BETTER_AUTH_URL=http://localhost:${DEV_PORT}`
- `PORT=${DEV_PORT}` (appended if absent — Vite reads this for the dev server, the node server reads it in prod)

Everything else (`BETTER_AUTH_SECRET`, `STORAGE_*`, `RESEND_API_KEY`, `CRON_SECRET`) is left untouched and inherited from main's `.env`.

## `.workmux.yaml` changes

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
  docker compose -p motori-${WM_HANDLE} up -d db
  pnpm install
  pnpm db:migrate
  pnpm db:seed

pre_remove: |
  docker compose -p motori-${WM_HANDLE} down -v

panes:
  - command: <agent>
    focus: true
  - command: pnpm dev
    split: vertical
```

Notes:

- `pnpm install` moves into `post_create` (was a pane) so the dev pane can start cleanly.
- The second pane runs `pnpm dev` so the tree boots into a ready-to-use server.
- `pre_remove` tears down the container *and* its volume — leaving stale postgres data behind would defeat the isolation.

## Scripts

Two new files under `scripts/`:

- `scripts/worktree-ports.sh` — sourced or invoked to print/export `WORKTREE_OFFSET`, `DB_PORT`, `DEV_PORT`. Reads `.worktree-offset` if present; otherwise hashes `WM_HANDLE` and writes the file. Handles collision-bump.
- `scripts/patch-worktree-env.sh` — calls `worktree-ports.sh`, then `sed`-rewrites `.env` in the current directory.

Both are bash, no node deps, so they run before `pnpm install`.

## Behaviour notes

- **Storage:** in dev `STORAGE_ENDPOINT` is typically unset, so image-storage falls back to `LocalStorage` writing to the worktree's `/uploads/` — naturally isolated. If a developer copies real Hetzner creds into `.env`, all worktrees share the bucket; that is the user's choice and out of scope to mitigate.
- **Migration drift:** each tree has its own DB, so a migration written in tree A only applies to tree B after a `git pull` + `pnpm db:migrate` in B. This is the intended behaviour — it matches branch-local schema state.
- **Main worktree compatibility:** the main worktree (no `WM_HANDLE`) keeps working because `worktree-ports.sh` falls back to defaults (5433/3000) when `WM_HANDLE` is unset and `.worktree-offset` is absent, and `docker compose` without `-p` uses the directory name as the project — equivalent to today's behaviour.

## Out of scope

- Sharing test users or fixture data between trees (each tree reseeds via `pnpm db:seed`).
- Snapshotting one tree's DB into another (`pg_dump`/`restore` flow — not needed for current workflow).
- E2e test isolation (Playwright config uses its own port via `PORT` env, already covered).
