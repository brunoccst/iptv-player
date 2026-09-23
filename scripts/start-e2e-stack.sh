#!/usr/bin/env bash
# Starts fake Xtream panel (:8091), backend (:5091, temp DATA_DIR, all interfaces) and the title normalizer worker
# in the background. Used by the TV end-to-end workflow; also works locally. PIDs go to $E2E_RUN_DIR.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="${E2E_RUN_DIR:-/tmp/iptv-e2e}"
mkdir -p "$RUN/data"
export DATA_DIR="$RUN/data"

python3 "$ROOT/tools/fake-xtream-server/server.py" --port 8091 > "$RUN/panel.log" 2>&1 &
echo $! > "$RUN/panel.pid"

(cd "$ROOT/backend" && ASPNETCORE_URLS=http://0.0.0.0:5091 ASPNETCORE_ENVIRONMENT=Development \
  exec dotnet run --no-launch-profile --project src/Backend.Api) > "$RUN/backend.log" 2>&1 &
echo $! > "$RUN/backend.pid"

for _ in $(seq 1 120); do
  curl -sf http://localhost:5091/api/health > /dev/null && break
  sleep 1
done
curl -sf http://localhost:5091/api/health > /dev/null || { cat "$RUN/backend.log"; exit 1; }

(cd "$ROOT/services/title-normalizer" && exec .venv/bin/python -m title_normalizer --interval 1) > "$RUN/worker.log" 2>&1 &
echo $! > "$RUN/worker.pid"
echo "E2E stack up (logs in $RUN)"
