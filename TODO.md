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
- [x] **UI feature: DeleteConfirmModal** — replaces native `confirm()` on drawer delete (red background, `danger.svg` biohazard icon, irreversible warning); used in HomeScreen + ViewDrawer

## 🔨 Phase 0 — CRITICAL SECURITY FIXES (Immediate)

- [x] P0.1: Fix `import-drawer` filePath validation (session-based token whitelist) — DONE (token-based `allowedImportPaths` Map + 5-min expiry)
- [x] P0.2: Enforce password min-length in backend (store.ts + unit tests) — DONE (min 8 chars in createDrawer, saveDrawer, Zod schemas)
- [x] P0.3: Add Zod runtime validation to IPC handlers (schema validation for 4 handlers) — DONE (6 schemas in validation.ts, all handlers use `.parse()`)
- [x] Run `npm run test` — all must pass (51/51)

## Phase 1 — BUILD SYSTEM & RELIABILITY (High Priority)

- [x] P1.1: Resolve dual build system (remove electron-builder, keep Forge) — DONE 2026-09-03 (consolidated to single Forge; electron-builder removed)
- [ ] P1.2: Fix ESM/CommonJS mismatch (`"type": "module"`) — 0.5h
- [ ] P1.3: Add IPC handler tests (8 handlers, vitest mocking) — 6h
- [ ] P1.4: Code signing (deferred; document unsigned status in README) — SKIP
- [ ] Verify `npm run make` builds all 4 platforms successfully

## Phase 2 — UX/DX IMPROVEMENTS (Medium Priority)

### P0 — Critical UX (Blocks User Trust)
- [x] P0.1: Replace all `alert()` with toast/notification system (react-hot-toast) — 2h
- [x] P0.2: Add focus trap to all modals (focus-trap-react or custom hook) — 2h
- [x] P0.3: Implement skeleton loaders for drawer list (shimmer animation) — 1.5h

### P1 — High Impact UX
- [x] P1.4: Add password visibility toggle + strength meter to PasswordModal — 1.5h
- [x] P1.5: Extract CreateDrawerModal to separate component — 0.5h
- [x] P1.6: Extract CreditsModal to separate component — 0.5h
- [x] P1.7: Add keyboard shortcuts (Ctrl+N, Escape, Enter, Ctrl+S) — 1h
- [x] P1.8: Add aria-live regions for loading states, errors, list updates — 1h
- [x] P1.9: Empty state illustration + CTA button ("Create your first drawer") — 1h

### P1 — Build Blockers
- [x] P1.10: Fix ESM/CommonJS mismatch ("type": "module" or CommonJS configs) — 0.5h
- [x] P1.11: Add @electron-forge/maker-rpm for Linux RPM target — 0.5h
- [x] P1.12: Implement auto-update (electron-updater + GitHub Releases) — 4h
- [x] P1.13: Add quality gates to CI (lint, typecheck, test before build/make) — 1h

### P2 — CI/CD Reliability & Polish
- [x] P2.1: Convert preload to TypeScript (preload/index.ts with ElectronAPI types) — 0.5h
- [x] P2.2: Define structured error types (Result<T, E>, ErrorCode enum) — 2h
- [x] P2.3: Add centralized logging (electron-log setup) — 1h
- [x] P2.4: Add loading states to UI (HomeScreen async actions + PasswordModal) — 1.5h
- [x] P2.5: Add React error boundary (ErrorBoundary.tsx wrapper) — 0.75h
- [x] P2.6: Add navigation guards to Credits window — 0.5h
- [x] P2.7: Fix CI certificate handling (remove cert secrets or make optional) — 0.5h
- [x] P2.8: Add typecheck script to package.json — 0.25h
- [x] P2.9: Add release/ to .gitignore — 0.1h
- [x] P2.10: Fix Flatpak manifest version (parameterize version injection) — 0.5h
- [x] P2.11: Add transitions/animations to modals (fade-in, scale) — 1h
- [x] P2.12: Click backdrop to close modals — 0.5h
- [x] P2.13: Portals for modals (ReactDOM.createPortal) — 1h
- [x] P2.14: Responsive breakpoints (max-w-[90vw], sm:/md:) — 1h
- [x] P2.15: Copy-to-clipboard for crypto addresses in Credits — 0.5h
- [x] P2.16: Consistent icon system (move Credits close icon to vite-plugin-svgr) — 0.5h

### P3 — Architecture & Code Quality
- [x] P3.1: Extract useModalKeyboard / useFocusTrap hooks — 1h
- [x] P3.2: Extract DrawerIcon component (memoize icon rendering) — 0.5h
- [x] P3.3: Add resetErrorBoundary to ErrorBoundary — 0.5h
- [x] P3.4: Unify error display (delete error modal pattern for all async errors) — 1h
- [x] Run `npm run lint`, `npm run typecheck`, `npm run test` — all must pass

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
- **Done**: All 23 audit-2026-08-30 findings fixed, full drawer flow (+ import UI), security hardening, store extraction, 51/51 tests, **v0.1.4-alpha** (2026-09-03): **DeleteConfirmModal** replaces native `confirm()` on delete in HomeScreen + ViewDrawer (red bg, `danger.svg` biohazard red/black icon, irreversible warning); 6 assets published (deb 94M, AppImage 123M, Setup.exe 150M, zip 154M, nupkg 149M, dmg 125M), run `33790511624` green, AppImage smoke-tested. **v0.1.3-alpha** bumped earlier same day. **v0.1.2-alpha** baseline: import drawer button, 4 targets via Wine 10, `gh release create` 4 assets. **v0.1.1-alpha**: fixed `argon2` Win32 `PE32+` via `afterPack` + `scrypt` fallback, save/delete `Result` mismatch, Windows `confirm()` focus steal.
- [x] **Tested**: Encryption round-trip, wrong-password rejection, drawer CRUD, path-traversal rejection, import drawer flow, HomeScreen rendering, all build targets, ASAR content, AppImage runtime (`Clavis started`), Windows `PE32+` verified, save/delete `Result` flow, Windows modal focus after delete, CI-built `v0.1.3-alpha` (AppImage Linux + ZIP Windows 11) and `v0.1.4-alpha` (AppImage delete-confirm UI)
- [x] **Audit 2026-09-01**: 14 recommendations validated by 4 specialized sub-agents; consolidated into 4-phase roadmap (Phase 0-3, ~35h total; MVP target 18.75h)

_P0 UX items from audit_2026-09-03-ui-ux.md: toast system (P0.1), focus traps (P0.2), skeleton loaders (P0.3) — all COMPLETED._
