#!/usr/bin/env bash
# Installs the APK once the emulator's package manager answers; retries because a just-booted
# emulator can still refuse installs (adb exit 255). Usage: apps/tv-app/e2e/install.sh <apk>
set -uo pipefail
APK="$1"
for _ in $(seq 1 60); do
  adb shell pm path android > /dev/null 2>&1 && break
  sleep 2
done
for attempt in 1 2 3; do
  adb install -r "$APK" && exit 0
  echo "adb install failed (attempt $attempt); retrying in 10 s"
  sleep 10
done
exit 1
