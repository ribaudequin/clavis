# Changelog — Clavis

## v0.4.7-beta (2026-10-07)

### Accessibility — four live WCAG AA failures closed

- **1.4.3** — `PasswordModal` error text was `text-red-500` at 3.76:1, below the 4.5:1 that 12px text needs. Now `text-red-700` at 6.47:1.
- **1.4.11** — every form control boundary used bare `border` (`#e5e7eb`) at 1.24:1. New token `--border-input` (`#8a8a8a`) reaches 3.45:1 on white, 3.30:1 on `gray-50` and 3.14:1 on `gray-100`. `gray-400` was rejected at 2.54:1 (still failing) and `gray-500` at 4.83:1 (visibly heavy on every form).
- **1.4.11** — the duplicate-title alert's `border-yellow-300` measured 1.39:1 against `yellow-50` (previously recorded as 1.27:1; `yellow-300` is `#fcd34d`, not `#fde047`). Now `border-yellow-700` at 4.76:1 — `yellow-600` would have been 2.84:1, so the ramp could not be fixed one step up.

### Fixes

- **Escape fired twice per keypress.** `useFocusTrap` and `useModalKeyboard` each attached a `keydown` listener for it on the same container ref. It stayed invisible only because every `onEscape` was an idempotent `setState(false)`. `useFocusTrap` no longer handles Escape — Escape is modal-keyboard behaviour, not focus-containment — so `useModalKeyboard` is the sole owner. The `[containerRef, isActive]` dependency remains load-bearing: its cleanup restores focus to the pre-modal element.
- **Errors shown in the wrong language.** The renderer surfaced `result.error.message`, the main process's English diagnostic string, at 8 sites — a wrong password read "Incorrect password or drawer not found" inside a fully Portuguese UI, and the `msg.error_*` prefixes produced mixed text. Errors are now resolved from `AppError.code` via `tError()`; the main-process message is log text only.

### Verification

152/152 tests (green under `CI=true` too), `typecheck`/`typecheck:test`/`lint` clean. Both fixes validated in a locally built AppImage with an isolated `userData` — the accessibility fixes by runtime computed style (10/10) and the i18n fix by rendering the real wrong-password flow under `navigator.language` pt-PT (5/5). The Escape fix carries a negative control: `tests/escapeSingleInvocation.test.tsx` uses non-idempotent handlers and fails 4 of 5 tests at a 2:1 ratio when the duplicate handler is reintroduced.

## v0.3.4-alpha (2026-09-14)
- `CHAN-01` resolved: preload imports `CHANNELS` from `src/shared/channels.ts` (single source of truth)
- Preload bundled via Vite (`scripts/build-preload.mjs`) — self-contained `dist/main/preload.js`, `electron` external, `CHANNELS` inlined
- `BS-17` resolved: `copy:preload` (Unix-only `cp`) removed; bundling is cross-platform
- Verified in packaged AppImage: `electronAPI` exposed (`Drawers listed count:5`)
- 74/74 tests pass; typecheck clean; lint 0 errors

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
