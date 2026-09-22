# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.3.5-alpha

**State (2026-09-22):** `CHAN-01` + `BS-17` resolved (preload bundled via Vite). **Credits modal redesign complete** ✅ — `CreditsModal` component extracted (`src/renderer/components/CreditsModal.tsx`), shadow/depth, section cards, copy-to-clipboard, animation, backdrop click-to-close, focus polish. Pushado para GitHub (`v0.3.5-alpha` tag).

**Build:** AppImage 245M + `.deb` 215M (`v0.3.5-alpha`) — inicia, lista drawers, fecha. Auto-updater still 404 (`BS-06` pending).

**Pending:** `BS-06` (publish/`latest-linux.yml`), `a11y` P2 (`N4-N7` overlay, `N12` dirty, `N16` `Ctrl+S`, `N10` focus), `P1.4` code signing `SKIP`, Flatpak Flathub.

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-22 — Credits modal redesigned + visually verified (AppImage built, user confirmed aesthetically improved). CHAN-01 + BS-17 resolved. 74/74 tests._
