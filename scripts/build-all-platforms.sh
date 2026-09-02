#!/bin/bash

set -e

cd "$(dirname "$0")/.." || exit 1

VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
RELEASE_DIR="./release"

echo "════════════════════════════════════════════════════════"
echo "🚀 Clavis Multi-Platform Build"
echo "════════════════════════════════════════════════════════"
echo "Version: $VERSION"
echo ""

# Clean
echo "🧹 Cleaning..."
rm -rf out/ dist/ "$RELEASE_DIR" dist/linux-unpacked
mkdir -p "$RELEASE_DIR"

# Build main + renderer
echo "🔨 Building TypeScript + Renderer..."
npm run build > /dev/null 2>&1 || { echo "❌ Build failed"; exit 1; }

echo ""
echo "📦 Generating Platform Artifacts..."
echo ""

# 1. Linux .deb (via Forge)
echo "  [1/4] Linux .deb package..."
if npm run make > /tmp/forge-build.log 2>&1; then
  if [ -f "out/make/deb/x64"/*.deb ]; then
    cp "out/make/deb/x64"/*.deb "$RELEASE_DIR/"
    DEB=$(ls "$RELEASE_DIR"/*.deb 2>/dev/null | head -1)
    SIZE=$(du -h "$DEB" | cut -f1)
    echo "        ✅ $(basename "$DEB") ($SIZE)"
  else
    echo "        ⚠️  Deb not found in output"
  fi
else
  echo "        ⚠️  Deb build had issues"
fi

# 2. Linux AppImage (via electron-builder)
echo "  [2/4] Linux AppImage..."
if npx electron-builder --linux AppImage -p never > /tmp/builder-appimage.log 2>&1; then
  if [ -f dist/Clavis-*.AppImage ]; then
    cp dist/Clavis-*.AppImage "$RELEASE_DIR/"
    APPIMAGE=$(ls "$RELEASE_DIR"/Clavis-*.AppImage 2>/dev/null | head -1)
    SIZE=$(du -h "$APPIMAGE" | cut -f1)
    echo "        ✅ $(basename "$APPIMAGE") ($SIZE)"
  else
    echo "        ⚠️  AppImage not found"
  fi
else
  echo "        ⚠️  AppImage build had issues (may need system libraries)"
fi

# 3. Windows Portable exe (via electron-builder)
echo "  [3/4] Windows Portable exe..."
if npx electron-builder --win portable -p never > /tmp/builder-portable.log 2>&1; then
  PORTABLE=$(find dist -name "*Portable*.exe" 2>/dev/null | head -1)
  if [ -n "$PORTABLE" ] && [ -f "$PORTABLE" ]; then
    cp "$PORTABLE" "$RELEASE_DIR/"
    SIZE=$(du -h "$RELEASE_DIR"/*Portable*.exe | cut -f1)
    echo "        ✅ $(basename "$RELEASE_DIR"/*Portable*.exe) ($SIZE)"
  else
    echo "        ⚠️  Portable exe not found"
  fi
else
  echo "        ⚠️  Portable build had issues"
fi

# 4. Windows NSIS Installer (via electron-builder)
echo "  [4/4] Windows NSIS Installer..."
if npx electron-builder --win nsis -p never > /tmp/builder-nsis.log 2>&1; then
  INSTALLER=$(find dist -name "*Setup*.exe" 2>/dev/null | head -1)
  if [ -n "$INSTALLER" ] && [ -f "$INSTALLER" ]; then
    cp "$INSTALLER" "$RELEASE_DIR/"
    SIZE=$(du -h "$RELEASE_DIR"/*Setup*.exe | cut -f1)
    echo "        ✅ $(basename "$RELEASE_DIR"/*Setup*.exe) ($SIZE)"
  else
    echo "        ⚠️  Installer exe not found"
  fi
else
  echo "        ⚠️  Installer build had issues"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Build Summary"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Artifacts in: $RELEASE_DIR"
echo ""

if ls "$RELEASE_DIR"/* > /dev/null 2>&1; then
  ls -lh "$RELEASE_DIR" | tail -n +2 | awk '{printf "  %s (%s)\n", $9, $5}'
else
  echo "  (No artifacts generated)"
fi

echo ""
echo "Build targets:"
[ -f "$RELEASE_DIR"/*.deb ] && echo "  ✅ Linux .deb" || echo "  ❌ Linux .deb (failed)"
[ -f "$RELEASE_DIR"/Clavis-*.AppImage ] && echo "  ✅ Linux AppImage" || echo "  ❌ Linux AppImage (failed)"
[ -f "$RELEASE_DIR"/*Portable*.exe ] && echo "  ✅ Windows Portable" || echo "  ❌ Windows Portable (failed)"
[ -f "$RELEASE_DIR"/*Setup*.exe ] && echo "  ✅ Windows NSIS Installer" || echo "  ❌ Windows NSIS Installer (failed)"

echo ""
echo "════════════════════════════════════════════════════════"
