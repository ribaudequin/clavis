# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.3.3-alpha

**State (2026-09-14):** `CHAN-01` **resolved** — preload now imports `CHANNELS` from `src/shared/channels.ts` and is bundled by Vite (`scripts/build-preload.mjs`) into a self-contained `dist/main/preload.js` (`electron` external, `CHANNELS` inlined); `BS-17` also resolved (`copy:preload` Unix `cp` removed). Root cause: `sandbox: true` blocks preload `require()` of app-local modules + old copy shifted path depth. Validated: `typecheck` ✅, `lint` 0 errors (79 warnings), `test` **74/74** ✅; ASAR preload only requires `electron`; AppImage runtime `Clavis started` → `IPC handler called list-drawers` → `Drawers listed count:5`. ADR-007 updated (Resolved).

**Build:** AppImage 245M + `.deb` 215M (`v0.3.3-alpha`) — inicia, lista drawers, fecha. Auto-updater still 404 (`BS-06` pending).

**Pending:** `BS-06` (publish/`latest-linux.yml`), `a11y` P2 (`N4-N7` overlay, `N12` dirty, `N16` `Ctrl+S`, `N10` focus), `P1.4` code signing `SKIP`, Flatpak Flathub.

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-14 — CHAN-01 + BS-17 resolved (preload bundled via Vite); AppImage runtime validated; 74/74 tests._
