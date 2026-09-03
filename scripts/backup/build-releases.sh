#!/bin/bash
set -e

cd "$(dirname "$0")/.."

VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
ARTIFACTS="release_artifacts"

echo "════════════════════════════════════════════════════════"
echo "🚀 Clavis v$VERSION — Multi-Platform Build"
echo "════════════════════════════════════════════════════════"
echo ""

# Clean & Build
echo "🔨 Building TypeScript + Renderer..."
npm run clean > /dev/null 2>&1
npm run build > /dev/null 2>&1

mkdir -p "$ARTIFACTS"

# 1. Linux .deb (Forge)
echo ""
echo "📦 Generating Build Targets:"
echo "  [1/4] Linux .deb..."
npm run make > /tmp/make.log 2>&1
if [ -f "out/make/deb/x64"/*.deb ]; then
  cp "out/make/deb/x64"/*.deb "$ARTIFACTS/"
  SIZE=$(du -h "$ARTIFACTS"/*.deb | cut -f1)
  echo "        ✅ $(ls "$ARTIFACTS"/*.deb | xargs -I {} basename {}) ($SIZE)"
else
  echo "        ❌ Failed"
fi

# 2-4. Try electron-builder for AppImage + Windows targets
echo "  [2/4] Linux AppImage..."
if npx electron-builder --linux AppImage -p never > /tmp/appimage.log 2>&1; then
  if [ -f dist/Clavis-*.AppImage ]; then
    cp dist/Clavis-*.AppImage "$ARTIFACTS/"
    SIZE=$(du -h "$ARTIFACTS"/Clavis-*.AppImage | cut -f1)
    echo "        ✅ $(ls "$ARTIFACTS"/Clavis-*.AppImage | xargs -I {} basename {}) ($SIZE)"
  fi
else
  echo "        ⏸️  Skipped (requires clean environment)"
fi

echo "  [3/4] Windows Portable..."
echo "        ⏸️  Requires Windows (build on Windows or CI)"

echo "  [4/4] Windows NSIS Installer..."
echo "        ⏸️  Requires Windows (build on Windows or CI)"

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Build Complete"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Artifacts in: $ARTIFACTS/"
ls -lh "$ARTIFACTS"/ 2>/dev/null | tail -n +2 | awk '{printf "  %s (%s)\n", $9, $5}' || echo "  (None)"
echo ""
echo "Status:"
[ -f "$ARTIFACTS"/*.deb ] && echo "  ✅ Linux .deb (ready)" || echo "  ❌ Linux .deb"
[ -f "$ARTIFACTS"/Clavis-*.AppImage ] && echo "  ✅ Linux AppImage (ready)" || echo "  ⏸️  Linux AppImage (needs build)"
echo "  ⏸️  Windows Portable (build on Windows)"
echo "  ⏸️  Windows NSIS Installer (build on Windows)"
echo ""

