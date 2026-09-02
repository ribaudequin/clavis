# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.1.2-alpha (bumped 2026-09-02, tag `v0.1.2-alpha`)

**State:** All 23 audit findings fixed (v0.1.1-alpha baseline). **Import drawer feature complete:** button in header → `openFile()` dialog → `importDrawer(token)` → token-based security. Full drawer flow: create → list → **import** → unlock → view/edit → save/delete. Store `src/main/store.ts`. **51/51 tests pass**. tsc + eslint clean. Menu removed, Credits modal with SVG icons.

**Release 0.1.2-alpha (2026-09-02):** Linux .deb 213M built via `npm run make`, tagged + pushed to GitHub, release artifact staged. Windows/AppImage/Portable require cross-compile or dedicated build machines.

**Focus next:** Test 0.1.2-alpha on Linux. Windows/AppImage builds deferred. Post-alpha: Flatpak, auto-updater, i18n PT-PT/PT-BR. Code signing skipped.

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-02_
