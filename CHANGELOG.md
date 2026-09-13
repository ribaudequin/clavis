# Changelog — Clavis

## v0.3.2-alpha (2026-09-12)
- i18n implemented (PT-PT / PT-BR / EN fallback) (`src/i18n/index.ts`)
- PROMPT.md removed
- P3.2 E2E Playwright interactive complete (macOS Safari, keyboard, modal events, 3 error paths)
- Local build validated (`npm run build` + `make`)
- `CHAN-01` remains reverted/deferred (`inline CHANNELS`)

## v0.3.1-alpha (2026-09-09)
- P3.1 renderer component tests: 69/69 passing
- Flatpak manifest updated (`v0.3.1-alpha` AppImage)

## v0.2.0-alpha (2026-09-07)
- P3.2 E2E interactive started
- P1.2 ESM/CommonJS fix (`.mts` configs)

## v0.1.9.1-alpha (2026-09-08)
- Preload runtime fix (CHANNELS inline)
- CI workflow artifact fix (`clavis-${os}-${tag}`)

## v0.1.8-alpha (2026-09-07)
- Phase 2 P0 a11y complete (focus indicator, drawer rows `<button>`, credits modal focus trap)
- P1.10–P1.16: keyboard shortcuts, aria-live, empty state, skeleton loaders, password visibility, strength meter, transitions, backdrop close, responsive breakpoints, copy-to-clipboard
- ErrorBoundary `restartApp` end-to-end
- 58/58 tests pass

## v0.1.7-alpha (2026-09-07)
- IPC-layer hardening: symlink rejection, error envelope sanitization, decrypt size cap (10 MB), CHANNELS const (`src/shared/channels.ts`)
- AppSec audit fixed (P2 soft-blocking)
- 54/54 tests pass

## v0.1.4-alpha (2026-09-03)
- DeleteConfirmModal (red background, `danger.svg` biohazard icon)
- Import drawer UI button

## v0.1.3-alpha (2026-09-03)
- First CI-built green run (`33781273256`)

## v0.1.1-alpha (2026-09-02)
- `argon2` Win32 `PE32+` fix (`afterPack` + `scrypt` fallback)
- Windows `confirm()` focus steal fixed
- Save/delete `Result` mismatch fixed

## v0.1.0-alpha (baseline)
- Electron + TypeScript + React scaffold
- AES-256-GCM + Argon2id encryption module (6 unit tests)
- Drawer store (create/list/save/delete/export/import `.clavis`)
- Deterministic 3×3 icon generator
- Main process IPC bridge (sandbox, CSP, UUID validation, nav guards)
- Renderer: Home screen + View drawer + Create modal + Password unlock
- Electron Forge build (deb, AppImage, NSIS, Portable)

---

*Formatting based on `MEMORY.md` changelog + git tags. Updated 2026-09-12.*
