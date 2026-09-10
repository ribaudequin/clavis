# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.2.0-alpha (P3.1 + P3.2 + Flatpak manifest atualizado)

**State:** All 23 audit findings fixed. Phase 0 + Phase 1 + Phase 2 P0 a11y complete. **P3.1 completo (2026-09-09):** `tests/PasswordModal.test.tsx` (+interação submit/close/visibility), `tests/ViewDrawer.test.tsx` (+interação back/save/delete), `tests/HomeScreen.test.tsx` expandido. **Resolução da interação:** mock dos hooks (`useFocusTrap`, `useModalKeyboard`) + `cleanup` entre testes. **69/69 pass**, tsc + eslint limpos. **v0.1.9.1-alpha (2026-09-08):** Preload runtime fix (inlined CHANNELS constants to fix `module not found: ../../shared/channels.js` that broke `electronAPI` in AppImage) + CI workflow artifact name fix (include version in artifact name to prevent cross-run merging). **v0.1.8-alpha (2026-09-07):** 3 P0 a11y blockers fixed (focus indicator restored, drawer rows → semantic `<button>`+`<ul>`, credits modal now has `useFocusTrap`+`useModalKeyboard`); 10 P1 quick wins (focus restoration, `aria-pressed`, `aria-describedby`, color contrast, sr-only labels, touch targets, `aria-hidden`); `restartApp` IPC implemented end-to-end; preload runtime fix (inlined CHANNELS). **58/58 tests pass**, tsc + eslint clean.

**Phase 1 complete (2026-09-07):** P1.1 dual build system, P1.2 ESM/CommonJS (.mts), P1.3 IPC handler tests (8 → 9 channels), P1.13 CI quality gates. Phase 0 (2026-09-03): token import whitelist, password min-length, Zod validation. v0.1.7-alpha (2026-09-07): B2+B3+B5 IPC hardening, productName pin.

**Focus next:** Post-MVP (auto-updater / i18n) ou expansão P3.2 (E2E interativo completo). **v0.2.0-alpha:** P3.1 + P3.2 completos; Flatpak manifest atualizado (`Clavis-0.2.0-alpha.AppImage`).

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-09 (v0.2.0-alpha)_
