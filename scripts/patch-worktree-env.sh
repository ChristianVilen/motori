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
