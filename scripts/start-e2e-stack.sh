#!/usr/bin/env bash
# Starts the fake Xtream panel (:8091, all interfaces) in the background: the apps talk to it directly (D-038, D-088).
# Used by the TV end-to-end workflow; also works locally. The PID goes to $E2E_RUN_DIR.
# FAKE_PANEL_STRESS=<n> adds n generated titles per category (see tools/fake-xtream-server).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="${E2E_RUN_DIR:-/tmp/iptv-e2e}"
mkdir -p "$RUN"

python3 "$ROOT/tools/fake-xtream-server/server.py" --port 8091 >> "$RUN/panel.log" 2>&1 &
echo $! > "$RUN/panel.pid"
for _ in $(seq 1 30); do curl -sf "http://localhost:8091/player_api.php" > /dev/null && break; sleep 0.5; done
curl -sf "http://localhost:8091/player_api.php" > /dev/null || { cat "$RUN/panel.log"; exit 1; }
echo "Fake panel up (log in $RUN/panel.log)"
