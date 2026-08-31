#!/usr/bin/env bash
# Builds Voicecraft.app for local use (no notarization/distribution signing)
# and prints its path.
# Usage: scripts/build-app.sh [--install]
#   --install  Copy the build into /Applications, replacing any existing copy.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/packages/app"
BUNDLE_APP="$APP_DIR/src-tauri/target/release/bundle/macos/Voicecraft.app"
SIGNING_IDENTITY="Voicecraft Local Dev"

INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

(cd "$APP_DIR" && npm run tauri build)

if [ ! -d "$BUNDLE_APP" ]; then
  echo "Build finished but bundle not found at $BUNDLE_APP" >&2
  exit 1
fi

# Re-sign with a stable local identity instead of leaving Tauri's default
# ad-hoc signature, so OS permission grants (Accessibility, etc.) survive
# rebuilds. Run scripts/setup-local-signing.sh once to create the identity.
# See issue #54.
if security find-identity -v -p codesigning 2>/dev/null | grep -q "$SIGNING_IDENTITY"; then
  codesign --force --deep --sign "$SIGNING_IDENTITY" "$BUNDLE_APP"
  echo "Signed with local identity: $SIGNING_IDENTITY"
else
  echo "Note: no \"$SIGNING_IDENTITY\" identity found — bundle is ad-hoc signed." >&2
  echo "Run scripts/setup-local-signing.sh once to fix Accessibility grants resetting on every rebuild (#54)." >&2
fi

echo "Built: $BUNDLE_APP"

if [ "$INSTALL" = true ]; then
  rm -rf "/Applications/Voicecraft.app"
  cp -R "$BUNDLE_APP" "/Applications/Voicecraft.app"
  echo "Installed: /Applications/Voicecraft.app"
fi
