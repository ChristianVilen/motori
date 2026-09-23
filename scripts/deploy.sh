#!/usr/bin/env bash
# Deploys origin/main to one Dokku app and checks that it went live (DEPLOY.md §5b).
# Used by the CI deploy job and by `just deploy` / `just deploy-talli`.
#
# Usage: scripts/deploy.sh <app> <public-host> [expected-sha]
set -euo pipefail

app=$1
public_host=$2
expected_sha=${3:-}

# Tailscale SSH runs commands via plain bash (no dokku forced-command wrapper),
# so the dokku binary must be named explicitly.
dokku() { ssh dokku@motori dokku "$@"; }

git fetch --quiet origin main
sha=$(git rev-parse origin/main)
short=${sha:0:7}

# A re-run of an older CI run must not force-push its commit over a newer deploy.
if [ -n "$expected_sha" ] && [ "$sha" != "$expected_sha" ]; then
	echo "main is now at $short; the run for that commit deploys it. Skipping ${expected_sha:0:7}."
	exit 0
fi

# CI deploys never overlap (deploy-production concurrency group), so a lock is stale
# unless someone is deploying by hand right now.
report=$(dokku apps:report "$app")
if grep -Eq 'App locked:[[:space:]]+true' <<<"$report"; then
	echo "error: Dokku app $app has a deploy lock. Unless you are deploying it by hand right now, it is stale: follow 'Stale deploy lock' in DEPLOY.md §5b, then deploy again." >&2
	exit 1
fi

git push --force "dokku@motori:$app" "$sha:refs/heads/main"

# Ask the host itself, over the same Tailscale connection as everything else here,
# rather than fetching the public URL. Cloudflare's Bot Fight Mode answers a GitHub
# runner with a managed challenge, which curl cannot solve, so a public check
# returns 403 whatever the app is doing. On the free plan no rule can skip it: a
# custom skip rule matched our own laptop and never applied to the runner
# (2026-09-23, DEPLOY.md §5b). --resolve pins the host to loopback, so nginx picks
# the right vhost and the request never leaves the machine.
# Retry: the old container serves for a moment while Dokku swaps them over, so an
# early answer can be a healthy 200 carrying the previous version.
health_url="https://$public_host/api/health?sha=$sha"
probe="curl -sS -k --max-time 10 -w '\n%{http_code}' --resolve $public_host:443:127.0.0.1 '$health_url'"
for attempt in $(seq 1 6); do
	response=$(ssh dokku@motori "$probe" 2>/dev/null) || response=$'\n000'
	http_status=${response##*$'\n'}
	body=${response%$'\n'*}
	version=$(jq -r '.version // empty' <<<"$body" 2>/dev/null || true)
	if [ "$http_status" = "200" ] && [ "$version" = "$short" ]; then
		break
	fi
	[ "$attempt" = 6 ] || sleep 5
done

if [ "$http_status" != "200" ]; then
	echo "error: $app answered HTTP $http_status on $public_host/api/health (asked on the host)" >&2
	echo "  body: ${body:-<empty>}" >&2
	echo "  000 means the host could not be reached at all; 503 means the app is up but its database is not." >&2
	exit 1
fi
if [ "$version" != "$short" ]; then
	echo "error: $app still reports version ${version:-<none>}, expected $short" >&2
	echo "  an empty version means the running build predates the version field; deploy again." >&2
	exit 1
fi

# Set only once the new build is live, so SOURCE_VERSION is the deployed commit.
dokku config:set --no-restart "$app" "SOURCE_VERSION=$sha"
echo "$app is live at $short"
