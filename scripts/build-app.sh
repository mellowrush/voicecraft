#!/usr/bin/env bash
# Builds Voicecraft.app for local use (no signing/notarization) and prints its path.
# Usage: scripts/build-app.sh [--install]
#   --install  Copy the build into /Applications, replacing any existing copy.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/packages/app"
BUNDLE_APP="$APP_DIR/src-tauri/target/release/bundle/macos/Voicecraft.app"

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

echo "Built: $BUNDLE_APP"

if [ "$INSTALL" = true ]; then
  rm -rf "/Applications/Voicecraft.app"
  cp -R "$BUNDLE_APP" "/Applications/Voicecraft.app"
  echo "Installed: /Applications/Voicecraft.app"
fi
