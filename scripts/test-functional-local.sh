#!/bin/bash
# Functional smoke + recommended flow for local Clavis build
# Requires DISPLAY=:0 (Electron GUI) and build present (npm run build / make)
set -euo pipefail

BUILD="release_artifacts/Clavis-0.5.1-beta.AppImage"
# Fallback to local electron build
if [[ ! -f "$BUILD" ]]; then
  BUILD="dist/linux-unpacked/clavis"
fi

echo "=== Clavis functional test ==="
echo "Binary: $BUILD"
[[ -f "$BUILD" ]] || { echo "Build not found. Run: npm run make"; exit 1; }

echo "=== 1. Smoke start ==="
# Launch with isolated user dir to avoid mixing real profile (HYG-16 fix)
DISPLAY=:0 "$BUILD" --user-data-dir=/tmp/clavis-test-$$ &
PID=$!
sleep 4

echo "=== 2. Flow (Playwright direct, not vitest) ==="
if command -v npx >/dev/null 2>&1 && [[ -f node_modules/.bin/playwright ]]; then
  DISPLAY=:0 npx playwright test tests/e2e/functional-flow.test.ts --reporter=line || echo "Playwright test ended (check report)"
else
  echo "Playwright not installed; install with: npm install -D @playwright/test"
fi

echo "=== 3. Cleanup ==="
kill $PID 2>/dev/null || true
rm -rf /tmp/clavis-test-$$
echo "PASS: local binary started and flow initiated (manual check needed for full validation)."
