#!/usr/bin/env bash
# Downloads the APK from the `tv-apk` prerelease and serves it at <codespace link>/tv.apk,
# so an Android TV can fetch it (e.g. with the Downloader app). See DECISIONS.md#d-037.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v gh > /dev/null; then sudo apt-get update -qq && sudo apt-get install -y -qq gh; fi
gh release download tv-apk --pattern tv.apk --output /tmp/iptv-tv.apk --clobber
gh release view tv-apk --json body --jq .body
echo "TV download link: https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}/tv.apk (port 5173 must be public)"
