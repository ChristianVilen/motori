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

# Check through the public path, so this covers Cloudflare and nginx too, not just
# the container. The query string gets past any Cloudflare cache of /api/health.
# Retry: the old container serves for a moment while Dokku swaps them over, so an
# early answer can be a healthy 200 carrying the previous version.
health_url="https://$public_host/api/health?sha=$sha"
for attempt in $(seq 1 6); do
	response=$(curl -sS --max-time 10 -w '\n%{http_code}' "$health_url" 2>/dev/null) || response=$'\n000'
	status=${response##*$'\n'}
	body=${response%$'\n'*}
	version=$(jq -r '.version // empty' <<<"$body" 2>/dev/null || true)
	if [ "$status" = "200" ] && [ "$version" = "$short" ]; then
		break
	fi
	[ "$attempt" = 6 ] || sleep 5
done

if [ "$status" != "200" ]; then
	echo "error: $health_url returned HTTP $status" >&2
	if [ "$status" = "403" ]; then
		# Seen on 2026-09-23: every deploy reported failure while the app was live.
		echo "  A 403 here is Cloudflare, not the app. Runners sit on datacenter IPs that bot" >&2
		echo "  protection blocks. The WAF skip rule for /api/health is in DEPLOY.md §5b;" >&2
		echo "  confirm under Security > Events in the Cloudflare dashboard." >&2
	fi
	exit 1
fi
if [ "$version" != "$short" ]; then
	echo "error: $public_host still reports version $version, expected $short" >&2
	exit 1
fi

# Set only once the new build is live, so SOURCE_VERSION is the deployed commit.
dokku config:set --no-restart "$app" "SOURCE_VERSION=$sha"
echo "$app is live at $short"
