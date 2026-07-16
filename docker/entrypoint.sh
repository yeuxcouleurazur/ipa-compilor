#!/bin/bash
# IPA Compilor — Docker macOS container entrypoint
set -euo pipefail

ACTION="${1:-build}"
CONFIG="${2:-Release}"

echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║  IPA Compilor  ·  Docker Build Agent  ║"
echo "  ╚════════════════════════════════════════╝"
echo ""
echo "  → Action      : $ACTION"
echo "  → Config      : $CONFIG"
echo "  → Workspace   : $(pwd)"
echo ""

case "$ACTION" in
  build)
    echo "  [01] → Building Swift project..."
    xcodebuild \
      -scheme "${PROJECT_NAME:-MyApp}" \
      -configuration "$CONFIG" \
      -sdk iphoneos \
      -archivePath "artifacts/${PROJECT_NAME:-MyApp}.xcarchive" \
      archive \
      DEVELOPMENT_TEAM="${TEAM_ID:-}" \
      CODE_SIGN_STYLE=Manual \
      CODE_SIGN_IDENTITY="iPhone Distribution" \
      2>&1 | xcbeautify || { echo "  ✗ Build failed"; exit 1; }

    echo "  [02] → Exporting .ipa..."
    xcodebuild \
      -exportArchive \
      -archivePath "artifacts/${PROJECT_NAME:-MyApp}.xcarchive" \
      -exportPath "artifacts/ipa" \
      -exportOptionsPlist "config/export.plist" \
      2>&1 | xcbeautify || { echo "  ✗ Export failed"; exit 1; }

    echo "  ✓ Build complete → artifacts/ipa/"
    ;;

  sign)
    echo "  [01] → Signing .ipa..."
    /usr/bin/codesign \
      --force \
      --sign "${CERT_NAME:-iPhone Distribution}" \
      --entitlements "config/entitlements.plist" \
      "artifacts/ipa/${PROJECT_NAME:-MyApp}.ipa"
    echo "  ✓ Signing complete"
    ;;

  shell)
    exec /bin/bash
    ;;

  *)
    echo "  Usage: entrypoint.sh [build|sign|shell]"
    exit 1
    ;;
esac
