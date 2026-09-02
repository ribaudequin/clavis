# TODO — Clavis

## Milestones
- [x] Scaffold Electron + TypeScript + React project (package.json, tsconfig, eslint, vite, tailwind)
- [x] Encryption module: AES-256-GCM + Argon2id key derivation (6 unit tests passing)
- [x] Drawer store: create/list/save/delete/export/import encrypted `.clavis` files (extracted to `src/main/store.ts`)
- [x] Icon generator: deterministic 3×3 grid from drawer hash
- [x] Main process: IPC bridge between renderer and store (sandbox, CSP, UUID validation, nav guards)
- [x] Renderer: Home screen — list drawers with icons, create modal
- [x] Renderer: View drawer screen (title edit, content edit, save, delete) — unlock via password modal
- [x] Wire up Electron Forge + Vite plugin for dev/build (Vite renderer bundling fixes blank screen)
- [x] Packaging: Linux .deb build (electron-forge make)
- [x] Packaging: Windows NSIS installer (electron-builder, build.files fix)
- [x] Packaging: AppImage (Linux) — `release_artifacts/Clavis-0.1.1-alpha.AppImage` (121M) — **runtime FIXED 2026-09-02** (`electron-log` moved to `dependencies`, ASAR verified 1043 files, boots with `Clavis started`)
- [x] Packaging: Windows Portable — `release_artifacts/Clavis-Portable-0.1.1-alpha.exe` (96M, built via Wine 10, ASAR 1043 files, `afterPack` PE32+, published 2026-09-02 `v0.1.1-alpha`)
- [ ] Packaging: Flatpak manifest
- [x] Tests: encryption round-trip, drawer CRUD (store), component tests (51/51 passing)
- [x] Audit remediation: all 23 findings from `audits/audit_2026-08-30.md` addressed
- [x] README + user docs — updated `Credits & support` section with requested copy (intro + GitHub + Credits + Support Ko-fi/ETH/SOL + footer *From Portugal, with love.*)
- [x] UI polish: Remove native Electron menu (`Menu.setApplicationMenu(null)`), add Credits button with `icons/svg` via `vite-plugin-svgr` (`?react`), sanitized SVGs, modal `Credits & support`
- [x] **UI feature: Import drawer button** — header button triggers `openFile()` → `importDrawer(token)` flow

## 🔨 Phase 0 — CRITICAL SECURITY FIXES (Immediate)

- [ ] P0.1: Fix `import-drawer` filePath validation (session-based token whitelist) — 1.5h
- [ ] P0.2: Enforce password min-length in backend (store.ts + unit tests) — 0.5h
- [ ] P0.3: Add Zod runtime validation to IPC handlers (schema validation for 4 handlers) — 2.5h
- [ ] Run `npm run test` — all must pass

## Phase 1 — BUILD SYSTEM & RELIABILITY (High Priority)

- [ ] P1.1: Resolve dual build system (remove electron-builder, keep Forge) — 1.5h
- [ ] P1.2: Fix ESM/CommonJS mismatch (`"type": "module"`) — 0.5h
- [ ] P1.3: Add IPC handler tests (8 handlers, vitest mocking) — 6h
- [ ] P1.4: Code signing (deferred; document unsigned status in README) — SKIP
- [ ] Verify `npm run make` builds all 4 platforms successfully

## Phase 2 — UX/DX IMPROVEMENTS (Medium Priority)

- [ ] P2.1: Convert preload to TypeScript (preload/index.ts with ElectronAPI types) — 0.5h
- [ ] P2.2: Define structured error types (Result<T, E>, ErrorCode enum) — 2h
- [ ] P2.3: Add centralized logging (electron-log setup) — 1h
- [ ] P2.4: Add loading states to UI (HomeScreen async actions + PasswordModal) — 1.5h
- [ ] P2.5: Add React error boundary (ErrorBoundary.tsx wrapper) — 0.75h
- [ ] P2.6: Add navigation guards to Credits window — 0.5h
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test` — all must pass

## Phase 3 — QUALITY ASSURANCE (Lower Priority)

- [ ] P3.1: Add renderer component tests (HomeScreen, PasswordModal, ViewDrawer + jsdom setup) — 8h
- [ ] P3.2: Add E2E tests with Playwright (critical flows, error paths) — 16h [DEFERRED to v0.1]

## Deferred (Post-MVP)

- [ ] Auto-updater (electron-updater + GitHub Releases endpoint) — v0.1+
- [ ] Flatpak manifest — already scripted, v0.1+
- [ ] i18n (PT-PT/PT-BR auto-detect) — post-alpha per PLANO.md
- [ ] Icon path standardization (cosmetic cleanup) — maintenance sprint
- [ ] Code signing (EV certs, Apple notarization) — post-v1.0 if needed

## Progress
- **Done**: All 23 audit-2026-08-30 findings fixed, full drawer flow (+ import UI), security hardening, store extraction, 51/51 tests, **v0.1.2-alpha** (2026-09-02, `8e2bb3c`, tag `v0.1.2-alpha`): import drawer button in header, 4 targets rebuilt (deb 213M, AppImage 121M, Portable 96M, NSIS 108M, ASAR 1043), `gh release create v0.1.2-alpha` 4 assets. **v0.1.1-alpha** baseline: fixed `argon2` Win32 `PE32+` via `afterPack` + `scrypt` fallback, save/delete `Result` mismatch, Windows `confirm()` focus steal (`autoFocus` + `window.focus()`).
- **Tested**: Encryption round-trip, wrong-password rejection, drawer CRUD, path-traversal rejection, import drawer flow, HomeScreen rendering, all build targets, ASAR content (1043 files both platforms), AppImage runtime (`Clavis started` log), Windows `PE32+` verified, save/delete `Result` flow, Windows modal focus after delete
- **Audit 2026-09-01**: 14 recommendations validated by 4 specialized sub-agents; consolidated into 4-phase roadmap (Phase 0-3, ~35h total; MVP target 18.75h)
- **Current focus**: Testar `v0.1.2-alpha` em Windows 11 + Linux → Phase 0 security fixes (P0.1-0.3) → Flatpak → auto-updater → i18n
