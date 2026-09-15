#!/usr/bin/env bash
# Creates Motori's four EU-jurisdiction R2 buckets and connects images.motori.fi
# to motori-images. Safe to re-run: existing buckets and domains are skipped.
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

$WRANGLER r2 bucket list --jurisdiction $J
