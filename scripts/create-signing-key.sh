#!/usr/bin/env bash
# APK signing key (D-052): creates it once in .signing/ (git-ignored), then saves the two repository secrets
# tv-apk.yml needs with the GitHub CLI. An existing key is reused unless --replace is given. Back up .signing/.
# Usage: scripts/create-signing-key.sh [--no-upload | --replace | --delete]
#   --no-upload  only create the key (CI uses it for a throwaway key)
#   --replace    make a new key (the old folder is kept as .signing.old-<time>) and save it to GitHub
#   --delete     remove the two secrets from GitHub (later APKs are debug-signed again); .signing/ stays
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.signing"
KEYSTORE="$OUT/iptv-player-release.p12"
ALIAS="iptv-player"
SECRETS=(ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD)
MODE="${1:-create}"
case "$MODE" in
  create | --no-upload | --replace | --delete) ;;
  *)
    sed -n '4,7p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac

# Asks before anything that cannot be undone.
confirm() {
  printf '%s Type "yes" to continue: ' "$1"
  read -r answer
  [ "$answer" = "yes" ] || { echo "Nothing changed."; exit 1; }
}

REPO="$(git -C "$ROOT" remote get-url origin 2>/dev/null | sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\.git$##')" || true
# Codespaces set GITHUB_TOKEN, which may not save secrets; use your own login instead.
ghx() { env -u GITHUB_TOKEN -u GH_TOKEN gh "$@"; }
gh_login() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "The GitHub CLI (gh) is not installed."
    return 1
  fi
  if ! ghx auth status -h github.com >/dev/null 2>&1; then
    echo
    echo "Log in to GitHub once so the script can change the secrets (a browser tab or a one-time code follows)."
    ghx auth login -h github.com --web --git-protocol https
  fi
}

if [ "$MODE" = "--delete" ]; then
  confirm "This removes ${SECRETS[*]} from $REPO. Later APKs are signed with the public debug key again."
  if ! gh_login; then
    echo "Delete them by hand: GitHub → Settings → Secrets and variables → Actions."
    exit 1
  fi
  for name in "${SECRETS[@]}"; do
    if ghx secret delete "$name" --repo "$REPO" 2>/dev/null; then echo "Deleted $name."; else echo "$name was not set."; fi
  done
  [ -e "$KEYSTORE" ] && echo "The local key in .signing/ was not touched; delete that folder yourself if you no longer need it."
  exit 0
fi

if [ "$MODE" = "--replace" ] && [ -e "$KEYSTORE" ]; then
  confirm "This makes a new key. Installed apps signed with the old one need one uninstall (back up the app data first)."
  OLD="$ROOT/.signing.old-$(date +%Y%m%d-%H%M%S)"
  mv "$OUT" "$OLD"
  echo "The old key moved to $OLD"
fi

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
[ "$MODE" = "--no-upload" ] && exit 0

manual() {
  cat <<MSG

Add the two repository secrets by hand (GitHub → Settings → Secrets and variables → Actions → New repository secret):
  ANDROID_KEYSTORE_BASE64    = contents of .signing/ANDROID_KEYSTORE_BASE64.txt
  ANDROID_KEYSTORE_PASSWORD  = contents of .signing/ANDROID_KEYSTORE_PASSWORD.txt
MSG
}
backup() {
  echo
  echo "Now back up the .signing folder (e.g. right-click it in the Codespace file list → Download) and keep it private,"
  echo "for example as attachments in a password manager entry."
  echo "If it is lost, the next APK needs a new key and one uninstall (back up the app data first)."
}

if ! gh_login; then
  echo "The secrets cannot be saved automatically."
  manual
  backup
  exit 0
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
