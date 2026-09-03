# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.1.3-alpha (2026-09-03, first CI-built release — pending tag push)

**State:** All 23 audit findings fixed. **Import drawer feature complete:** header button → `openFile()` → token-based `importDrawer()` → refresh list. Full drawer flow: create → list → **import** → unlock → view/edit → save/delete. Store `src/main/store.ts`. **51/51 tests pass**. tsc + eslint clean. Menu removed, Credits modal with SVG icons.

**Release 0.1.2-alpha (2026-09-02):** All 4 targets built via Wine 10 on Linux — .deb 213M, AppImage 121M, Portable 96M, NSIS 108M (ASAR 1043 files). `gh release create v0.1.2-alpha` 4 assets. `argon2` Win32 PE32+ via `afterPack.js`, `scrypt` fallback.

**CI/CD migration DONE (2026-09-03):** Build consolidated to **single Electron Forge** (electron-builder removed, resolves P1.1). Added `.github/workflows/release.yml` — builds 6 targets on native runners (deb/.AppImage/.rpm Linux, Portable+Squirrel Win, DMG mac) and publishes Release on tag push. Local Linux build validated (deb + AppImage), 51/51 tests, lint + tsc clean. `icons/mac/icon.icns` created. Old scripts in `scripts/backup/`. Docs updated.

**Focus next:** First CI release test (push a `v*` tag → verify 6 assets appear). Then: test 0.1.2-alpha on Windows 11 + Linux; Phase 0 P0.1-0.3; post-alpha Flatpak, auto-updater, i18n. Code signing skipped.

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-03_
