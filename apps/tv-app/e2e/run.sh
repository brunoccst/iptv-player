#!/usr/bin/env bash
# Runs the Maestro flows (server mode, offline, direct mode) against an installed APK. Expects the local stack from scripts/start-e2e-stack.sh.
# Usage: apps/tv-app/e2e/run.sh <output-dir>
set -euo pipefail
OUT="${1:-maestro-output}"
APP_ID="${APP_ID:-com.iptvplayer.tv}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"

# On failure, print what was on screen and the app/player logs, so the CI log alone explains it.
diagnose() {
  local name="$1"
  echo "::group::Failed step (Maestro report)"
  grep -oE '<failure[^>]*>[^<]*' "$OUT/$name.xml" 2>/dev/null | head -20 || true
  find "$OUT/$name" -name 'commands-*.json' -exec grep -hoE '"(status|errorMessage|message)" *: *"[^"]{0,200}"' {} + 2>/dev/null | grep -B2 -A2 -iE 'fail|error' | tail -30 || true
  echo "::endgroup::"
  # A text field may have left the TV keyboard up; close it so the screen dump shows the app.
  adb shell input keyevent 111 >/dev/null 2>&1 || true
  echo "::group::Screen (text and ids)"
  maestro hierarchy 2>/dev/null | grep -oE '"(text|resource-id|accessibilityText)" *: *"[^"]+"' | tail -80 || true
  echo "::endgroup::"
  echo "::group::Crashes (logcat crash buffer)"
  adb logcat -d -b crash | tail -80 || true
  echo "::endgroup::"
  echo "::group::JS log (ReactNativeJS)"
  adb logcat -d -v brief -s ReactNativeJS:V | tail -80 || true
  echo "::endgroup::"
  echo "::group::logcat (app process: JS, player)"
  local pid
  pid="$(adb shell pidof -s "$APP_ID" 2>/dev/null | tr -d '\r' || true)"
  if [ -n "$pid" ]; then adb logcat -d -v brief --pid="$pid" | tail -200 || true; else
    echo "App is not running; JS and player tags only:"
    adb logcat -d -v brief ReactNativeJS:V ExoPlayerImpl:V MediaCodecRenderer:V AndroidRuntime:E '*:S' | tail -200 || true
  fi
  echo "::endgroup::"
}

run_flow() {
  local name="$1"
  maestro test "$HERE/$name.yaml" -e APP_ID="$APP_ID" --format junit --output "$OUT/$name.xml" \
    --debug-output "$OUT/$name" --test-output-dir "$OUT/$name" || { diagnose "$name"; return 1; }
}

run_flow 01-online

# Offline: stop provider and backend, then relaunch.
"$HERE/../../../scripts/stop-e2e-stack.sh" backend panel
run_flow 02-offline

# Direct mode: only the provider runs; the app talks to it without the backend (DECISIONS.md#d-038).
"$HERE/../../../scripts/start-e2e-stack.sh" panel
run_flow 03-direct
