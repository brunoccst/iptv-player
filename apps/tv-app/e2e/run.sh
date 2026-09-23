#!/usr/bin/env bash
# Runs the Maestro flows against an installed APK. Expects the local stack from scripts/start-e2e-stack.sh.
# Usage: apps/tv-app/e2e/run.sh <output-dir>
set -euo pipefail
OUT="${1:-maestro-output}"
APP_ID="${APP_ID:-com.iptvplayer.tv}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"

maestro test "$HERE/01-online.yaml" -e APP_ID="$APP_ID" --format junit --output "$OUT/online.xml" --debug-output "$OUT/online" --test-output-dir "$OUT/online"

# Offline: stop provider and backend, then relaunch.
"$HERE/../../../scripts/stop-e2e-stack.sh" backend panel
maestro test "$HERE/02-offline.yaml" -e APP_ID="$APP_ID" --format junit --output "$OUT/offline.xml" --debug-output "$OUT/offline" --test-output-dir "$OUT/offline"
