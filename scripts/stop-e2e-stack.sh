#!/usr/bin/env bash
# Stops services started by start-e2e-stack.sh. Args: any of panel backend worker (default: all).
set -uo pipefail
RUN="${E2E_RUN_DIR:-/tmp/iptv-e2e}"
for name in "${@:-panel backend worker}"; do
  for service in $name; do
    pid_file="$RUN/$service.pid"
    [ -f "$pid_file" ] || continue
    pkill -TERM -P "$(cat "$pid_file")" 2>/dev/null
    kill "$(cat "$pid_file")" 2>/dev/null
    rm -f "$pid_file"
  done
done
# dotnet run starts the app as a child; make sure port 5091 is free when the backend was requested.
case " $* " in *" backend "*|"  ") fuser -k 5091/tcp 2>/dev/null ;; esac
exit 0
