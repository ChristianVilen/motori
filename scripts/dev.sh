#!/usr/bin/env bash
# `pnpm dev` entrypoint: bring up the dev stack (Postgres) and run the dev
# server of every app in apps/* in the foreground, with prefixed output.
# Ctrl+C stops the dev servers AND tears the containers down.
set -euo pipefail

cleanup() {
	trap - EXIT INT TERM
	echo
	echo "→ stopping dev stack (docker compose down)…"
	docker compose down
}
trap cleanup EXIT INT TERM

docker compose up -d
pnpm --parallel --filter './apps/*' dev
