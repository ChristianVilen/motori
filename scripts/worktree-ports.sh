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
