#!/usr/bin/env bash
# Runs the Maestro flows against an installed APK. Expects the local stack from scripts/start-e2e-stack.sh.
# Usage: apps/tv-app/e2e/run.sh <output-dir>
set -euo pipefail
OUT="${1:-maestro-output}"
APP_ID="${APP_ID:-com.iptvplayer.tv}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"

# On failure, print what was on screen and the app/player logs, so the CI log alone explains it.
diagnose() {
  echo "::group::Screen (text and ids)"
  maestro hierarchy 2>/dev/null | grep -oE '"(text|resource-id|accessibilityText)" *: *"[^"]+"' | tail -80 || true
  echo "::endgroup::"
  echo "::group::logcat (app, JS, player)"
  adb logcat -d -v brief ReactNativeJS:V ReactNative:W ExoPlayerImpl:V MediaCodecRenderer:V MediaCodecUtil:V EventLogger:V AndroidRuntime:E '*:S' | tail -150 || true
  echo "::endgroup::"
}

run_flow() {
  local name="$1"
  maestro test "$HERE/$name.yaml" -e APP_ID="$APP_ID" --format junit --output "$OUT/$name.xml" \
    --debug-output "$OUT/$name" --test-output-dir "$OUT/$name" || { diagnose; return 1; }
}

run_flow 01-online

# Offline: stop provider and backend, then relaunch.
"$HERE/../../../scripts/stop-e2e-stack.sh" backend panel
run_flow 02-offline
