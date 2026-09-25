#!/usr/bin/env bash
# Creates the APK signing key once (D-052) and prints the two values for GitHub → Settings → Secrets → Actions.
# Needs openssl (keytool is used instead when installed). Output goes to .signing/ (git-ignored): back it up.
set -euo pipefail
OUT="$(cd "$(dirname "$0")/.." && pwd)/.signing"
KEYSTORE="$OUT/iptv-player-release.p12"
ALIAS="iptv-player"

if [ -e "$KEYSTORE" ]; then
  echo "A key already exists: $KEYSTORE"
  echo "A new key would make new APKs unable to install over ones signed with it. Delete the file first if you really want a new one."
  exit 1
fi
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

cat <<MSG
Created $KEYSTORE

Add two repository secrets (GitHub → Settings → Secrets and variables → Actions → New repository secret):
  ANDROID_KEYSTORE_BASE64    = contents of .signing/ANDROID_KEYSTORE_BASE64.txt
  ANDROID_KEYSTORE_PASSWORD  = contents of .signing/ANDROID_KEYSTORE_PASSWORD.txt

Then back up the .signing folder somewhere safe (password manager or private drive) and never commit it.
Without this key, future APKs cannot install over the ones signed with it.
MSG
