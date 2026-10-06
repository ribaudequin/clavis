#!/usr/bin/env bash
# Dated snapshot of the unversioned memory files.
# These are gitignored (see .gitignore), so this script is the only thing
# standing between a bad edit and losing the project's working context.
# Run at the end of each session, after MEMORY.md -> TODO.md -> SUMMARY.md.
set -euo pipefail

cd "$(dirname "$0")/.."

KEEP="${MEMORY_SNAPSHOT_KEEP:-20}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="MEMORY/snapshots/$STAMP"

mkdir -p "$DEST"

for f in MEMORY.md SUMMARY.md TODO.md PLANO.md AGENTS.md; do
  [ -f "$f" ] && cp "$f" "$DEST/"
done

# HISTORY.md is a partition of MEMORY.md and can be large; copy it too.
if [ -f MEMORY/HISTORY.md ]; then
  cp MEMORY/HISTORY.md "$DEST/"
fi

echo "snapshot -> $DEST"

# Prune to the newest $KEEP snapshots.
if [ "$(find MEMORY/snapshots -mindepth 1 -maxdepth 1 -type d | wc -l)" -gt "$KEEP" ]; then
  find MEMORY/snapshots -mindepth 1 -maxdepth 1 -type d \
    | sort \
    | head -n "-$KEEP" \
    | xargs -r rm -rf
  echo "pruned to newest $KEEP snapshots"
fi