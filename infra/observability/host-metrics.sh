#!/usr/bin/env bash
# Push VPS root-volume disk usage to Loki as an app="host" line. Run from cron on the
# VPS (e.g. every 5 min) so the "disk > 80%" Grafana alert has data. Lean alternative to
# running node-exporter + Prometheus for a single metric.
#
#   */5 * * * * root /usr/local/bin/motori-host-metrics >/dev/null 2>&1
#
# See DEPLOY.md §11.
set -euo pipefail

LOKI_URL="${LOKI_URL:-http://127.0.0.1:3100}"
HOSTNAME_LABEL="${HOST_HOSTNAME:-motori}"

pct=$(df --output=pcent / | tail -1 | tr -dc '0-9')
ts=$(date +%s)000000000
# Inner log line is JSON; escape its quotes for embedding in the push payload.
line="{\\\"disk_used_pct\\\":${pct},\\\"msg\\\":\\\"host.disk\\\"}"

curl -sf -H 'Content-Type: application/json' -XPOST "${LOKI_URL}/loki/api/v1/push" \
  --data-raw "{\"streams\":[{\"stream\":{\"app\":\"host\",\"host\":\"${HOSTNAME_LABEL}\"},\"values\":[[\"${ts}\",\"${line}\"]]}]}"
