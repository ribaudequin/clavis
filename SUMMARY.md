# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.1.8-alpha (2026-09-07, Phase 2 a11y + ErrorBoundary + preload fix)

**State:** All 23 audit findings fixed. Phase 0 + Phase 1 + Phase 2 P0 a11y complete. **v0.1.8-alpha (2026-09-07):** 3 P0 a11y blockers fixed (focus indicator restored, drawer rows → semantic `<button>`+`<ul>`, credits modal now has `useFocusTrap`+`useModalKeyboard`); 10 P1 quick wins (focus restoration on modal close, `aria-pressed` on toggles, `aria-describedby` on inputs, color contrast fix red-500→red-700 / gray-500→gray-600, sr-only labels in ViewDrawer, `aria-describedby` in DeleteConfirmModal, 44×44 touch target on heart icon, `aria-hidden` on icon grid); `restartApp` IPC implemented end-to-end (channels + preload + main + types) — fixes the ErrorBoundary that silently fell back to `window.location.reload()`. **Preload fix (2026-09-07):** inlined CHANNELS constants in preload to fix runtime module resolution (`module not found: ../../shared/channels.js`) that broke `electronAPI` exposure in AppImage. **58/58 tests pass**, tsc + eslint clean. A11y audit `audits/audit_2026-09-07-a11y.md`.

**Phase 1 complete (2026-09-07):** P1.1 dual build system, P1.2 ESM/CommonJS (.mts), P1.3 IPC handler tests (8 → 9 channels), P1.13 CI quality gates. Phase 0 (2026-09-03): token import whitelist, password min-length, Zod validation. v0.1.7-alpha (2026-09-07): B2+B3+B5 IPC hardening, productName pin.

**Focus next:** Phase 2 remaining P1 a11y polish (live region for list updates, error inline vs toast), Phase 3 P3.1 (renderer component tests), or Post-MVP (auto-updater / i18n).

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-07 (v0.1.8-alpha)_
