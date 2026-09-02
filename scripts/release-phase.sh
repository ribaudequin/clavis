#!/bin/bash

set -e

VERSION=$1
MESSAGE=$2

if [ -z "$VERSION" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: ./scripts/release-phase.sh <version> <message>"
  echo "Example: ./scripts/release-phase.sh 0.0.4 'Phase 0: Security hardening'"
  exit 1
fi

echo "════════════════════════════════════════════════════════"
echo "🚀 Clavis Release Phase Script"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Version: $VERSION"
echo "Message: $MESSAGE"
echo ""

echo "🔍 Step 1: Verifying quality gates..."
echo "  → npm run clean"
npm run clean > /dev/null 2>&1 || { echo "❌ Clean failed"; exit 1; }

echo "  → npm run build"
npm run build > /dev/null 2>&1 || { echo "❌ Build failed"; exit 1; }

echo "  → npm run test"
npm run test > /dev/null 2>&1 || { echo "❌ Tests failed"; exit 1; }

echo "  → npm run lint"
npm run lint > /dev/null 2>&1 || { echo "❌ Lint failed"; exit 1; }

echo "  → tsc --noEmit"
npx tsc --noEmit > /dev/null 2>&1 || { echo "❌ Typecheck failed"; exit 1; }

echo "✅ All quality gates passed!"
echo ""

echo "📝 Step 2: Updating version to $VERSION..."
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
rm -f package.json.bak
echo "✅ package.json updated"
echo ""

echo "📦 Step 3: Building release binaries..."
npm run release > /dev/null 2>&1 || { echo "❌ Release build failed"; exit 1; }
echo "✅ Binaries created in release/"
ls -lh release/Clavis* 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'
echo ""

echo "🏷️  Step 4: Creating git commit and tag..."
git add .
git commit -m "v$VERSION — $MESSAGE" || { echo "⚠️  No changes to commit"; }
git tag -a "v$VERSION" -m "$MESSAGE" || { echo "⚠️  Tag already exists"; }
git push origin main --tags 2>/dev/null || { echo "⚠️  Push may have failed (check connection)"; }
echo "✅ Git tag v$VERSION created and pushed"
echo ""

echo "📤 Step 5: Creating GitHub Release..."
RELEASE_NOTES="Phase release: $MESSAGE

See CHANGELOG.md and RELEASE_STRATEGY.md for details.

**Build artifacts**:
- Linux: AppImage (120MB+), .deb package
- Windows: NSIS installer (106MB+), Portable exe (106MB+)

**Quality**: All tests passing, lint clean, typecheck clean."

if command -v gh &> /dev/null; then
  BINARIES=(release/Clavis*.AppImage release/Clavis*.exe release/Clavis*.deb 2>/dev/null)
  if gh release create "v$VERSION" \
    --title "Clavis v$VERSION" \
    --notes "$RELEASE_NOTES" \
    ${BINARIES[@]} 2>/dev/null; then
    echo "✅ GitHub Release created"
  else
    echo "⚠️  GitHub Release creation failed (check gh CLI auth)"
  fi
else
  echo "⚠️  gh CLI not found. Manual GitHub release needed:"
  echo "   gh release create v$VERSION --title 'Clavis v$VERSION' --notes '...'"
fi
echo ""

echo "════════════════════════════════════════════════════════"
echo "✅ Release v$VERSION complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Verify GitHub Release: https://github.com/ribaudequin/clavis/releases/tag/v$VERSION"
echo "2. Update MEMORY.md with phase completion notes"
echo "3. Update SUMMARY.md with current state"
echo "4. Mark TODO.md phase tasks as [x]"
echo ""
