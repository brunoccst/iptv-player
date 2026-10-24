#!/usr/bin/env bash
# Runs the Maestro flows (main, offline, fresh sign-in, holding Right) against an installed APK. Expects the fake panel
# from scripts/start-e2e-stack.sh.
# Usage: apps/tv-app/e2e/run.sh <output-dir> [phone]   ("phone": only the phone flow; needs the fake panel)
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
  echo "::group::Focused view"
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb shell cat /sdcard/ui.xml 2>/dev/null | tr '>' '\n' | grep 'focused="true"' | head -5 || true
  echo "::endgroup::"
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

# Large library (D-093): only the stress flow, against a panel started with FAKE_PANEL_STRESS; always dumps the state.
if [ "${2:-}" = "stress" ]; then
  status=0
  run_flow 07-large-library || status=$?
  echo "::group::App log (diagnostics lines in logcat)"
  adb logcat -d -v time -s ReactNativeJS:V | grep -F '[appLog]' | tail -40 || true
  echo "::endgroup::"
  echo "::group::Layout: grid, header and first cards (uiautomator bounds)"
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb shell cat /sdcard/ui.xml 2>/dev/null | tr '>' '\n' | grep -E 'resource-id="(browse-|chips|sort|card-|top-nav|nav-movies)' \
    | sed -E 's/.*resource-id="([^"]*)".*focused="([a-z]*)".*bounds="([^"]*)".*/\1 focused=\2 \3/' | head -40 || true
  echo "Windows:"; adb shell dumpsys window windows 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | head -5 || true
  echo "::endgroup::"
  echo "::group::Main thread busy? (dumpsys gfxinfo)"
  adb shell dumpsys gfxinfo "$APP_ID" 2>/dev/null | head -30 || true
  echo "::endgroup::"
  [ "$status" -eq 0 ] && diagnose 07-large-library
  echo "::group::ANR traces"
  adb shell ls /data/anr 2>/dev/null || true
  adb shell dumpsys activity processes 2>/dev/null | grep -iE 'not responding|anr' | head -20 || true
  echo "::endgroup::"
  exit "$status"
fi

# Phone emulator (touch and the on-screen keyboard): only the phone flow, against the fake panel.
if [ "${2:-}" = "phone" ]; then
  curl -sf "http://localhost:8091/player_api.php" > /dev/null || "$HERE/../../../scripts/start-e2e-stack.sh"
  # A system dialog ("Pixel Launcher isn't responding") once covered the app on a freshly booted emulator.
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
  run_flow 04-phone-search
  exit 0
fi

run_flow 01-online

# Offline: stop the provider, then relaunch.
"$HERE/../../../scripts/stop-e2e-stack.sh"
run_flow 02-offline

# A fresh sign-in once the provider is back (DECISIONS.md#d-088).
sleep 1
"$HERE/../../../scripts/start-e2e-stack.sh"
run_flow 03-direct

# Holding Right in a Home row (D-069): a stress panel gives a row that ends in "See all". Maestro cannot hold a key and
# `input keyevent --duration` sends one press without repeats, so quick bursts stand in for a held key (a held key
# repeats every ~50 ms): 16 presses reach the row's end, 40 keep going past it.
"$HERE/../../../scripts/stop-e2e-stack.sh"
sleep 1
FAKE_PANEL_STRESS=200 "$HERE/../../../scripts/start-e2e-stack.sh"
focused_view() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb shell cat /sdcard/ui.xml 2>/dev/null | tr '>' '\n' | grep 'focused="true"' | head -3 || true
}
# A slow emulator may still be handling key presses (and scrolling the row) when the focus is first read (issue #301):
# wait until two reads in a row, 1 s apart, show the same focused view (at most 20 s).
settle_focus() {
  local last="" now i
  for i in $(seq 1 20); do
    now="$(focused_view)"
    [ -n "$now" ] && [ "$now" = "$last" ] && { printf '%s\n' "$now"; return 0; }
    last="$now"
    sleep 1
  done
  echo "(focus still moving after 20 s)"; printf '%s\n' "$now"
}
hold_failed=
for presses in 16 40; do
  run_flow 05-hold-right
  echo "Focused before the presses:"; settle_focus
  adb shell input keyevent $(printf '22 %.0s' $(seq 1 "$presses"))
  echo "Focused after $presses quick Right presses:"; focused="$(settle_focus)"; printf '%s\n' "$focused"
  # The emulator drops presses of a burst now and then (issue #301: 8 of 16 moved the focus). Still on a card of the
  # row: more presses, once; a focus that left the row still fails the check below.
  if printf '%s' "$focused" | grep -q 'resource-id="card-Stress Movie '; then
    echo "Presses were dropped: $presses more."
    adb shell input keyevent $(printf '22 %.0s' $(seq 1 "$presses"))
    echo "Focused after $presses more:"; settle_focus
  fi
  run_flow 06-hold-right-check || hold_failed=1
done

# Back to the normal panel for the phone flow.
"$HERE/../../../scripts/stop-e2e-stack.sh"
sleep 1
"$HERE/../../../scripts/start-e2e-stack.sh"
[ -z "$hold_failed" ] || { echo "Holding Right left the row or missed \"See all\" (see above)."; exit 1; }
