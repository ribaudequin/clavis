# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.1.3-alpha (2026-09-03, first CI-built release — published with 6 assets, AppImage + Win ZIP smoke-tested)

**State:** All 23 audit findings fixed. **Phase 0 security fixes COMPLETE:** P0.1 token-based import whitelist, P0.2 password min-length, P0.3 Zod runtime validation. **Import drawer feature complete:** header button → `openFile()` → token-based `importDrawer()` → refresh list. Full drawer flow: create → list → **import** → unlock → view/edit → save/delete. Store `src/main/store.ts`. **51/51 tests pass**. tsc + eslint clean. Menu removed, Credits modal with SVG icons.

**Release 0.1.2-alpha (2026-09-02):** All 4 targets built via Wine 10 on Linux — .deb 213M, AppImage 121M, Portable 96M, NSIS 108M (ASAR 1043 files). `gh release create v0.1.2-alpha` 4 assets. `argon2` Win32 PE32+ via `afterPack.js`, `scrypt` fallback.

**CI/CD migration DONE (2026-09-03):** Build consolidated to **single Electron Forge** (electron-builder removed, resolves P1.1). Added `.github/workflows/release.yml` — builds 6 targets on native runners (deb/.AppImage/.rpm Linux, Portable+Squirrel Win, DMG mac) and publishes Release on tag push. First green run `33781273256` (2026-09-03, Node 22 + Squirrel 7z vendor fix) → Release `v0.1.3-alpha` with 6 assets (deb, AppImage, Setup.exe, zip, nupkg, dmg). Local Linux build validated (deb + AppImage), 51/51 tests, lint + tsc clean. `icons/mac/icon.icns` created. Old scripts in `scripts/backup/`. Docs updated.

**Focus next:** Phase 1 — P1.2 (ESM/CommonJS mismatch), P1.3 (IPC handler tests). Smoke tests validated: AppImage (Linux) + Windows Portable ZIP. dmg CI-built but unverifiable (no Mac).

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-03_
