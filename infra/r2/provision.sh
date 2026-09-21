#!/usr/bin/env bash
# Creates Motori's four EU-jurisdiction R2 buckets, connects images.motori.fi to
# motori-images and sets the 30-day expiry on motori-backups. Safe to re-run:
# existing buckets, domains and rules are skipped. The 14-day bucket lock is
# opt-in (R2_APPLY_LOCK=1): a locked bucket cannot be emptied, so it goes on only
# at the end of the cutover window, after the validation gates pass.
#
# Auth: `pnpm dlx wrangler login` once (OAuth), or CLOUDFLARE_API_TOKEN in the env.
# Needs CLOUDFLARE_ACCOUNT_ID (or CF_ACCOUNT_ID) and CF_ZONE_ID (motori.fi zone id).
# Reads secrets/r2-drill.env when present so the drill and the cutover use one file.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f secrets/r2-drill.env ]]; then
  set -a; source secrets/r2-drill.env; set +a
fi
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID}}"
: "${CF_ZONE_ID:?set CF_ZONE_ID to the motori.fi zone id}"

WRANGLER="pnpm dlx wrangler@4.131.2"
J=eu
BUCKETS=(motori-images motori-docs motori-backups motori-observability)

for b in "${BUCKETS[@]}"; do
  if $WRANGLER r2 bucket info "$b" --jurisdiction $J >/dev/null 2>&1; then
    echo "bucket $b already exists in $J"
  else
    $WRANGLER r2 bucket create "$b" --jurisdiction $J
  fi
done

# The only public entry to motori-images. The r2.dev URL stays disabled.
if $WRANGLER r2 bucket domain list motori-images --jurisdiction $J 2>/dev/null | grep -q 'images\.motori\.fi'; then
  echo "images.motori.fi already connected"
else
  $WRANGLER r2 bucket domain add motori-images --domain images.motori.fi \
    --zone-id "$CF_ZONE_ID" --min-tls 1.2 --jurisdiction $J --force
fi

# Retention for the nightly dumps. Whole bucket: motori-backups holds nothing else.
if $WRANGLER r2 bucket lifecycle list motori-backups --jurisdiction $J 2>/dev/null | grep -q 'expire-dumps-30d'; then
  echo "lifecycle expire-dumps-30d already set"
else
  $WRANGLER r2 bucket lifecycle add motori-backups expire-dumps-30d "" \
    --expire-days 30 --jurisdiction $J --force
fi

# Deletion protection. Opt-in, because it must not go on before the cutover's
# validation gates pass: a locked bucket cannot be emptied.
if [[ "${R2_APPLY_LOCK:-}" == "1" ]]; then
  $WRANGLER r2 bucket lock add motori-backups lock-dumps-14d "" \
    --retention-days 14 --jurisdiction $J --force
fi

$WRANGLER r2 bucket lifecycle list motori-backups --jurisdiction $J
$WRANGLER r2 bucket lock list motori-backups --jurisdiction $J

$WRANGLER r2 bucket list --jurisdiction $J
