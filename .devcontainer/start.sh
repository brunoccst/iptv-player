#!/usr/bin/env bash
# Starts the web dev server and the fake panel in the background (restarts them if running).
# --if-stopped: do nothing when the web app already answers (used on every start and attach).
# Only the web port is open; the fake panel is proxied through it (same origin, HTTPS): sign in with the page's own
# address as the server URL. Log: /tmp/iptv-dev.log
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--if-stopped" ] && curl -fs -o /dev/null http://localhost:5173/; then exit 0; fi

public="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
export FAKE_PANEL_IMAGE_BASE_URL="$public"

# Stop a previous run (its own process group), then start a new one.
if [ -f /tmp/iptv-dev.pid ]; then kill -TERM -- "-$(cat /tmp/iptv-dev.pid)" 2>/dev/null || true; fi
setsid nohup node scripts/dev.mjs > /tmp/iptv-dev.log 2>&1 < /dev/null &
echo $! > /tmp/iptv-dev.pid
echo "Starting… open $public (log: /tmp/iptv-dev.log)"
