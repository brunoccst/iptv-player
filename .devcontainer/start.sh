#!/usr/bin/env bash
# Starts backend, worker, web dev server and fake panel in the background on every Codespace start.
# The phone reaches only the web port; the API is proxied through it (same origin, HTTPS). Log: /tmp/iptv-dev.log
set -euo pipefail
cd "$(dirname "$0")/.."

public="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
export APP_API_BASE_URL="$public" BACKEND_PUBLIC_BASE_URL="$public" BACKEND_CORS_ORIGINS="$public"

# Stop a previous run (its own process group), then start a new one.
if [ -f /tmp/iptv-dev.pid ]; then kill -TERM -- "-$(cat /tmp/iptv-dev.pid)" 2>/dev/null || true; fi
setsid nohup node scripts/dev.mjs --fake > /tmp/iptv-dev.log 2>&1 < /dev/null &
echo $! > /tmp/iptv-dev.pid
echo "Starting… open $public (log: /tmp/iptv-dev.log)"
