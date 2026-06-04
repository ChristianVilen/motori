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
