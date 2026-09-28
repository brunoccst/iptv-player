#!/usr/bin/env bash
# Stops the fake panel started by start-e2e-stack.sh.
set -uo pipefail
RUN="${E2E_RUN_DIR:-/tmp/iptv-e2e}"
pid_file="$RUN/panel.pid"
if [ -f "$pid_file" ]; then
  kill "$(cat "$pid_file")" 2>/dev/null
  rm -f "$pid_file"
fi
exit 0
