# SUMMARY — Current State

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — Cross-platform encrypted notes app (Electron + TypeScript + React + AES-256-GCM + Argon2id)

**Current version:** 0.1.7-alpha (2026-09-07, IPC-layer hardening)

**State:** All 23 audit findings fixed. Phase 0 security complete. **v0.1.7-alpha hardening:** B2 symlink rejection in `import-drawer` (`fs.lstat` + reject); B2 strip `details: e` from import-read error envelope; B3 decrypted content size cap (10 MB); B5 `CHANNELS` const (`src/shared/channels.ts`, kills drift risk between ipc-handlers + preload); doc sweep `.config.ts` → `.config.mts`. **54/54 tests pass**, tsc + eslint clean. Audits: `audit_2026-09-07-appsec.md` (P2 only — no blockers), `review_2026-09-07-code.md`.

**Phase 1 P1.2 (2026-09-07):** configs renamed `.ts` → `.mts`. Phase 1 P1.3 (2026-09-07): IPC handlers extracted from `index.ts` → `src/main/ipc-handlers.ts` with `registerIpcHandlers({ ipcMain, dialog })` (DI for testability). 8 handlers, 34 tests.

**CI/CD (2026-09-03):** Single Electron Forge + `release.yml` — 6 targets on native runners, publish on tag push. AppSec + code review audits 2026-09-07.

**Focus next:** Phase 1 — P1.13 CI quality gates (lint+typecheck+test before make), `npm run make` validation all 4 platforms.

**Read more if:** Technical decision → PLANO.md | Task list → TODO.md | Full history → /MEMORY/HISTORY.md

_Last updated: 2026-09-07 (v0.1.7-alpha)_
