#!/bin/bash

set -e

cd "$(dirname "$0")/.."

VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
ARTIFACTS="release_artifacts"

echo "════════════════════════════════════════════════════════"
echo "🚀 Clavis v$VERSION — All Build Targets"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Platform: $(uname -s)"
echo "Wine: $(wine --version)"
echo ""

# Clean & Build
echo "🔨 Building TypeScript + Renderer..."
npm run clean > /dev/null 2>&1
npm run build > /dev/null 2>&1
mkdir -p "$ARTIFACTS"

echo ""
echo "📦 Generating Build Targets:"
echo ""

# 1. Linux .deb (Forge)
echo "  [1/4] Linux .deb package..."
if npm run make > /tmp/make.log 2>&1; then
  if [ -f "out/make/deb/x64"/*.deb ]; then
    cp "out/make/deb/x64"/*.deb "$ARTIFACTS/"
    DEB=$(ls "$ARTIFACTS"/*.deb | head -1)
    SIZE=$(du -h "$DEB" | cut -f1)
    echo "        ✅ $(basename "$DEB") ($SIZE)"
  else
    echo "        ❌ Deb not found in output"
  fi
else
  echo "        ❌ Deb build failed"
fi

# 2. Linux AppImage (electron-builder)
echo "  [2/4] Linux AppImage..."
rm -rf dist/linux-unpacked 2>/dev/null || true
if npx electron-builder --linux AppImage -p never > /tmp/appimage.log 2>&1; then
  if [ -f dist/Clavis-*.AppImage ]; then
    cp dist/Clavis-*.AppImage "$ARTIFACTS/"
    APPIMAGE=$(ls "$ARTIFACTS"/Clavis-*.AppImage | head -1)
    SIZE=$(du -h "$APPIMAGE" | cut -f1)
    echo "        ✅ $(basename "$APPIMAGE") ($SIZE)"
  else
    echo "        ⚠️  AppImage build skipped (requires clean ASAR)"
  fi
else
  echo "        ⚠️  AppImage build skipped"
fi

# 3. Windows Portable exe (electron-builder with Wine)
echo "  [3/4] Windows Portable exe (via Wine)..."
if WINEARCH=win64 npx electron-builder --win portable -p never > /tmp/portable.log 2>&1; then
  PORTABLE=$(find dist -name "*Portable*.exe" 2>/dev/null | head -1)
  if [ -n "$PORTABLE" ] && [ -f "$PORTABLE" ]; then
    cp "$PORTABLE" "$ARTIFACTS/"
    SIZE=$(du -h "$ARTIFACTS"/*Portable*.exe 2>/dev/null | cut -f1)
    echo "        ✅ Windows Portable ($SIZE)"
  else
    echo "        ⚠️  Portable exe not found"
  fi
else
  echo "        ⚠️  Portable build skipped"
fi

# 4. Windows NSIS Installer (electron-builder with Wine)
echo "  [4/4] Windows NSIS Installer (via Wine)..."
if WINEARCH=win64 npx electron-builder --win nsis -p never > /tmp/nsis.log 2>&1; then
  INSTALLER=$(find dist -name "*Setup*.exe" 2>/dev/null | head -1)
  if [ -n "$INSTALLER" ] && [ -f "$INSTALLER" ]; then
    cp "$INSTALLER" "$ARTIFACTS/"
    SIZE=$(du -h "$ARTIFACTS"/*Setup*.exe 2>/dev/null | cut -f1)
    echo "        ✅ Windows Installer ($SIZE)"
  else
    echo "        ⚠️  Installer exe not found"
  fi
else
  echo "        ⚠️  Installer build skipped"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Build Complete"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Artifacts in: $ARTIFACTS/"
echo ""

if ls "$ARTIFACTS"/* > /dev/null 2>&1; then
  ls -lh "$ARTIFACTS"/ | tail -n +2 | awk '{printf "  %s (%s)\n", $9, $5}'
else
  echo "  (No artifacts)"
fi

echo ""
echo "Target Status:"
[ -f "$ARTIFACTS"/*.deb ] && echo "  ✅ Linux .deb" || echo "  ❌ Linux .deb"
[ -f "$ARTIFACTS"/Clavis-*.AppImage ] && echo "  ✅ Linux AppImage" || echo "  ⏸️  Linux AppImage"
[ -f "$ARTIFACTS"/*Portable*.exe ] && echo "  ✅ Windows Portable" || echo "  ❌ Windows Portable"
[ -f "$ARTIFACTS"/*Setup*.exe ] && echo "  ✅ Windows NSIS Installer" || echo "  ❌ Windows NSIS Installer"

echo ""

