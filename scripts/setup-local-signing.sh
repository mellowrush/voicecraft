#!/usr/bin/env bash
# One-time setup: creates a stable, self-signed local code-signing certificate
# so `build-app.sh` can sign Voicecraft.app consistently across rebuilds.
#
# Why: Tauri's default (no signing identity configured) falls back to ad-hoc
# signing, which macOS gives a new identity hash on every rebuild. TCC
# (Accessibility, etc.) grants are tied to that identity, so every rebuild
# looks like a brand-new, never-authorized app — toggling the stale entry in
# System Settings does nothing, "Recheck" correctly reports not-trusted.
# See issue #54.
#
# This certificate is self-signed and local-only: it does NOT require an
# Apple Developer account, and it is never used for distribution/notarization
# (see issue #26's decision to stay local/personal-use only) — it only gives
# local builds a stable signing identity so OS permission grants persist.
set -euo pipefail

IDENTITY_NAME="Voicecraft Local Dev"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -v -p codesigning | grep -q "$IDENTITY_NAME"; then
  echo "Signing identity \"$IDENTITY_NAME\" already exists — nothing to do."
  exit 0
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

openssl req -x509 -newkey rsa:2048 -keyout "$TMP_DIR/key.pem" -out "$TMP_DIR/cert.pem" \
  -days 3650 -nodes -subj "/CN=$IDENTITY_NAME" \
  -addext "extendedKeyUsage=codeSigning" >/dev/null 2>&1

openssl pkcs12 -export -out "$TMP_DIR/cert.p12" \
  -inkey "$TMP_DIR/key.pem" -in "$TMP_DIR/cert.pem" -passout pass:

echo "Importing certificate into login keychain (may prompt for your login password)..."
security import "$TMP_DIR/cert.p12" -k "$KEYCHAIN" -P "" -T /usr/bin/codesign -T /usr/bin/security

echo "Trusting certificate for code signing (may prompt for your login password)..."
security add-trusted-cert -d -r trustRoot -k "$KEYCHAIN" "$TMP_DIR/cert.pem"

echo "Granting codesign access to the new key (may prompt for your login password)..."
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "" "$KEYCHAIN" >/dev/null 2>&1 || \
  echo "  (skip if this failed — codesign may still prompt once on first use, that's fine)"

echo
echo "Done. Verify with: security find-identity -v -p codesigning"
echo "Next: run scripts/build-app.sh, then re-grant Accessibility once more —"
echo "future rebuilds will keep this identity, so the grant should persist."
