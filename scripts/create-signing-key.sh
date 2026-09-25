#!/usr/bin/env bash
# APK signing key (D-052): creates it once in .signing/ (git-ignored), then saves the two repository secrets
# tv-apk.yml needs with the GitHub CLI. An existing key is reused, never replaced. Back up .signing/.
# Usage: scripts/create-signing-key.sh [--no-upload]   (--no-upload: only create; CI uses it for a throwaway key)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.signing"
KEYSTORE="$OUT/iptv-player-release.p12"
ALIAS="iptv-player"
UPLOAD=1
[ "${1:-}" = "--no-upload" ] && UPLOAD=0

if [ -e "$KEYSTORE" ]; then
  echo "Using the existing key: $KEYSTORE"
else
  mkdir -p "$OUT"
  chmod 700 "$OUT"
  PASSWORD="$(openssl rand -hex 24)"
  if command -v keytool >/dev/null 2>&1; then
    keytool -genkeypair -storetype PKCS12 -keystore "$KEYSTORE" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 36500 \
      -storepass "$PASSWORD" -keypass "$PASSWORD" -dname "CN=$ALIAS" >/dev/null 2>&1
  else
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TMP/key.pem" -out "$TMP/cert.pem" -days 36500 -subj "/CN=$ALIAS" 2>/dev/null
    openssl pkcs12 -export -inkey "$TMP/key.pem" -in "$TMP/cert.pem" -name "$ALIAS" -out "$KEYSTORE" -passout "pass:$PASSWORD"
  fi
  chmod 600 "$KEYSTORE"
  base64 -w0 "$KEYSTORE" > "$OUT/ANDROID_KEYSTORE_BASE64.txt"
  printf '%s' "$PASSWORD" > "$OUT/ANDROID_KEYSTORE_PASSWORD.txt"
  chmod 600 "$OUT"/*.txt
  echo "Created $KEYSTORE"
fi

FINGERPRINT="$(openssl pkcs12 -in "$KEYSTORE" -passin "file:$OUT/ANDROID_KEYSTORE_PASSWORD.txt" -nokeys 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2 || true)"
[ -n "$FINGERPRINT" ] && echo "Certificate SHA-256: $FINGERPRINT (tv-apk.yml prints the same in its summary)"
[ "$UPLOAD" = 1 ] || exit 0

manual() {
  cat <<MSG

Add the two repository secrets by hand (GitHub → Settings → Secrets and variables → Actions → New repository secret):
  ANDROID_KEYSTORE_BASE64    = contents of .signing/ANDROID_KEYSTORE_BASE64.txt
  ANDROID_KEYSTORE_PASSWORD  = contents of .signing/ANDROID_KEYSTORE_PASSWORD.txt
MSG
}
backup() {
  echo
  echo "Now back up the .signing folder (e.g. right-click it in the Codespace file list → Download) and keep it private."
  echo "Without it, future APKs cannot install over the ones signed with it."
}

if ! command -v gh >/dev/null 2>&1; then
  echo "The GitHub CLI (gh) is not installed, so the secrets cannot be saved automatically."
  manual
  backup
  exit 0
fi

REPO="$(git -C "$ROOT" remote get-url origin | sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\.git$##')"
# Codespaces set GITHUB_TOKEN, which may not save secrets; use your own login instead.
ghx() { env -u GITHUB_TOKEN -u GH_TOKEN gh "$@"; }
if ! ghx auth status -h github.com >/dev/null 2>&1; then
  echo
  echo "Log in to GitHub once so the script can save the secrets (a browser tab or a one-time code follows)."
  ghx auth login -h github.com --web --git-protocol https
fi

if ghx secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO" < "$OUT/ANDROID_KEYSTORE_BASE64.txt" \
  && ghx secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO" < "$OUT/ANDROID_KEYSTORE_PASSWORD.txt"; then
  echo
  echo "Saved ANDROID_KEYSTORE_BASE64 and ANDROID_KEYSTORE_PASSWORD to $REPO. The next tv-apk.yml run signs with this key."
else
  echo "Saving the secrets failed (your login needs admin access to $REPO)."
  manual
fi
backup
