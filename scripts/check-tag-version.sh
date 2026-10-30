#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p 'require("./package.json").version')
REF="${GITHUB_REF_NAME:-}"

if [ -z "$REF" ]; then
  # Local run: try the exact tag on the current commit, else exit 0 (nothing to guard)
  REF=$(git describe --tags --exact-match 2>/dev/null || true)
fi

if [ -z "$REF" ]; then
  echo "check-tag-version: no tag ref to check (local, no exact tag) — OK"
  exit 0
fi

if [[ "$REF" != v* ]]; then
  echo "check-tag-version: ref '$REF' is not a tag — OK"
  exit 0
fi

EXPECTED="v${VERSION}"
if [ "$REF" = "$EXPECTED" ]; then
  echo "check-tag-version: tag '$REF' matches package.json '$VERSION' — OK"
  exit 0
fi

echo "check-tag-version: MISMATCH — tag is '$REF' but package.json is '$VERSION' (expected '$EXPECTED')"
echo "This is the v0.6.13-beta class of defect: the tag and the in-app version must agree."
exit 1
