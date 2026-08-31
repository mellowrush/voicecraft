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

# OpenSSL 3.x's default PKCS12 encryption/MAC isn't readable by macOS's
# importer ("MAC verification failed"), and an empty password breaks it
# regardless — both -legacy and a real password are required together.
P12_PASSWORD="$(openssl rand -base64 24)"
openssl pkcs12 -export -legacy -out "$TMP_DIR/cert.p12" \
  -inkey "$TMP_DIR/key.pem" -in "$TMP_DIR/cert.pem" -passout "pass:$P12_PASSWORD"

echo "Importing certificate into login keychain (may prompt for your login password)..."
security import "$TMP_DIR/cert.p12" -k "$KEYCHAIN" -P "$P12_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security

# Trusting the cert requires an interactive authorization dialog — it can't
# be scripted reliably (fails silently/cancels in non-interactive contexts).
# Don't let this abort the whole script; fall back to manual instructions.
echo "Trusting certificate for code signing — approve the dialog if one appears..."
if ! security add-trusted-cert -r trustRoot -k "$KEYCHAIN" "$TMP_DIR/cert.pem"; then
  echo
  echo "Automatic trust step failed or was cancelled. Finish it manually:"
  echo "  1. Open Keychain Access.app, find \"$IDENTITY_NAME\" under \"login\" > \"My Certificates\"."
  echo "  2. Double-click it, expand \"Trust\", set \"Code Signing\" to \"Always Trust\"."
  echo "  3. Close the panel (enter your password if prompted)."
fi

echo
if security find-identity -v -p codesigning | grep -q "$IDENTITY_NAME"; then
  echo "Done — \"$IDENTITY_NAME\" is a valid signing identity."
else
  echo "Not done yet — \"$IDENTITY_NAME\" isn't showing as a valid identity."
  echo "Finish the manual trust step above, then re-run: security find-identity -v -p codesigning"
fi
echo "Next: run scripts/build-app.sh. The first codesign may show a \"key access\" dialog —"
echo "click \"Always Allow\". Then re-grant Accessibility once more; future rebuilds keep this"
echo "identity, so the grant should persist."
