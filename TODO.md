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
- [x] Packaging: Flatpak manifest — `flatpak/com.github.marcelosalvador.Clavis.yaml` atualizado (`Clavis-0.2.0-alpha.AppImage`)
- [x] Tests: encryption round-trip, drawer CRUD (store), component tests (51/51 passing)
- [x] **i18n** — auto-detect PT-PT/PT-BR (navigator.language), English fallback (`src/i18n/index.ts`); strings traduzidas em `HomeScreen`, `CreateDrawerModal`, `PasswordModal`, `DeleteConfirmModal`, `ViewDrawer`. Build validado (`npm run build` + `make` OK). CI fix (`detectLocale` `process.env.CI`) aplicado (`tests/ViewDrawer.test.tsx` ajustado). `v0.3.2-alpha` (`05305b3`) publicado.
- [x] **Icon path cleanup** — `PROMPT.md` removed (`rm`); `i18n` implemented (manifest/icon paths unchanged, only existing standardization confirmed).
- [x] **Build local validado** (`npm run build` → `npm run make --platform=linux`) antes de qualquer `git tag`/release.
- [x] Audit remediation: all 23 findings from `audits/audit_2026-08-30.md` addressed
- [x] README + user docs — updated `Credits & support` section with requested copy (intro + GitHub + Credits + Support Ko-fi/ETH/SOL + footer *From Portugal, with love.*)
- [x] UI polish: Remove native Electron menu (`Menu.setApplicationMenu(null)`), add Credits button with `icons/svg` via `vite-plugin-svgr` (`?react`), sanitized SVGs, modal `Credits & support`
- [x] **UI feature: Import drawer button** — header button triggers `openFile()` → `importDrawer(token)` flow
- [x] **UI feature: DeleteConfirmModal** — replaces native `confirm()` on drawer delete (red background, `danger.svg` biohazard icon, irreversible warning); used in HomeScreen + ViewDrawer
- [x] **UI polish: Credits modal redesign** — extract `CreditsModal` component, add shadow/depth, section cards, copy-to-clipboard for crypto addresses, animation, backdrop click-to-close, focus polish — see `PLANO-CREDITS-MODAL.md`

## 🔨 Phase 0 — CRITICAL SECURITY FIXES (Immediate)

- [x] P0.1: Fix `import-drawer` filePath validation (session-based token whitelist) — DONE (token-based `allowedImportPaths` Map + 5-min expiry)
- [x] P0.2: Enforce password min-length in backend (store.ts + unit tests) — DONE (min 8 chars in createDrawer, saveDrawer, Zod schemas)
- [x] P0.3: Add Zod runtime validation to IPC handlers (schema validation for 4 handlers) — DONE (6 schemas in validation.ts, all handlers use `.parse()`)
- [x] Run `npm run test` — all must pass (51/51)

## v0.1.9.1-alpha — preload fix + CI artifact fix (2026-09-08)

- [x] Preload runtime fix: inlined CHANNELS constants in `src/main/preload/index.ts` to fix `module not found: ../../shared/channels.js` — DONE
- [x] CI workflow artifact name fix: include version in artifact name (`clavis-${os}-${tag}`) to prevent cross-run merging — DONE
- [x] Version bump 0.1.8-alpha → 0.1.9.1-alpha — DONE
- **58/58 tests pass**, tsc + eslint clean.

## v0.1.8-alpha — Phase 2 P0 a11y + ErrorBoundary fix (2026-09-07)

- [x] A2 P0: Restore visible focus indicator (`src/renderer/index.css` — remove `* { outline-none }`, add `*:focus-visible { outline: 2px solid #2563eb }`) — DONE
- [x] A1 P0: Drawer rows are now semantic `<button>` inside `<ul role="list">` (`HomeScreen.tsx`) — DONE
- [x] A1 P0 / A5 P0: Credits modal wraps `useFocusTrap` + `useModalKeyboard` (`HomeScreen.tsx:319`) — DONE
- [x] A5 P1: `useFocusTrap` captures trigger element on mount, restores focus on unmount — DONE
- [x] A3 P1: `aria-pressed` on eye-icon toggles (PasswordModal + CreateDrawerModal) — DONE
- [x] A3 P1: `aria-describedby="password-error"` on PasswordModal input — DONE
- [x] A4 P1: `text-red-500` → `text-red-700`, `text-gray-500` → `text-gray-600` (contrast ≥4.5:1) — DONE
- [x] A6 P1: `<label className="sr-only">` for ViewDrawer title + content inputs — DONE
- [x] A3 P1: `aria-describedby="delete-confirm-desc"` on DeleteConfirmModal — DONE
- [x] A9 P1: Heart icon button `p-1` → `p-2` (40×40 touch target) — DONE
- [x] A3 P2: `aria-hidden="true"` on decorative 3×3 icon grid — DONE
- [x] **ErrorBoundary.restartApp implemented end-to-end**: `src/shared/channels.ts` adds `RESTART_APP`, `src/shared/types.ts` adds `restartApp: () => Promise<void>`, `src/main/preload/index.ts` exposes it, `src/main/ipc-handlers.ts` registers the handler calling `app.quit()` via `setImmediate`. Tests updated to mock `app` in `vi.mock('electron', ...)` — DONE
- [x] **Preload runtime fix**: inlined CHANNELS constants in `src/main/preload/index.ts` to fix `module not found: ../../shared/channels.js` that broke `electronAPI` exposure in AppImage — DONE
- [x] A11y audit `audits/audit_2026-09-07-a11y.md` — DONE (3 P0 + 10 P1 quick wins + ~5 P2 polish deferred)
- [x] Version bump 0.1.7-alpha → 0.1.8-alpha — DONE
- **58/58 tests pass**, tsc + eslint clean.

## v0.1.7-alpha — IPC-layer hardening (2026-09-07)

- [x] B2: Symlink rejection in `import-drawer` (`fs.lstat` + `isSymbolicLink()` reject) — DONE
- [x] B2: Strip `details: e` from import-read error envelope — DONE (prevents raw exception text crossing IPC)
- [x] B3: Decrypted content size cap 10 MB in `encryption.ts:decrypt` — DONE (mirrors Zod `SaveDrawerSchema.content.max(10_000_000)`)
- [x] B5: `CHANNELS` const in `src/shared/channels.ts` (1 source of truth for IPC channel names) — DONE
- [x] Doc sweep `.config.ts` → `.config.mts` in `BUILD_MANUAL.md`, `BUILD_TARGETS.md`, `docs/clavis-ci-cd-setup.md` — DONE
- [x] Version bump 0.1.6-alpha → 0.1.7-alpha — DONE
- [x] AppSec audit `audits/audit_2026-09-07-appsec.md` — DONE (no P0/P1; P2 only, all fixed)
- [x] Code review `audits/review_2026-09-07-code.md` — DONE

## Phase 1 — BUILD SYSTEM & RELIABILITY (High Priority)

- [x] P1.1: Resolve dual build system (remove electron-builder, keep Forge) — DONE 2026-09-03 (consolidated to single Forge; electron-builder removed)
- [x] P1.2: Fix ESM/CommonJS mismatch — DONE 2026-09-07 (renamed `forge.config.ts`/`vite.config.ts`/`vitest.config.ts` → `.mts`; electron-forge 7.11.2 + Vitest + Vite all support `.mts` natively; `tsconfig.json` excludes `*.config.mts`; CommonJS preserved for `src/main` runtime via Electron; `npm run make` validated Linux → deb (215M) + AppImage (244M))
- [x] P1.3: Add IPC handler tests (8 handlers, vitest mocking) — DONE 2026-09-07 (extracted `handleIPC()` from `index.ts` → `registerIpcHandlers({ ipcMain, dialog })` in `src/main/ipc-handlers.ts`; 34 tests in `tests/ipc-handlers.test.ts`; `dialog` DI for testability; covers Zod validation, error codes, token whitelist + atomic consume)
- [ ] P1.4: Code signing (deferred; document unsigned status in README) — SKIP
- [x] **Released as `v0.4.3-beta`** (2026-10-03): 7 commits, tag `a739b1e`, run `37128865586` verde (5 jobs), 6 assets. Release AppImage verificado: arranca como `0.4.3-beta`, round-trip IPC OK, shutdown limpo, argon2 32-byte raw hash, `electron-updater` ausente.
- [x] **BS-06**: update check **manual** via GitHub Releases — `checkUpdate` (`main` `https.get`) exposto no `preload`; `CreditsModal` mostra botão "Nova versão" quando `tag_name` ≠ `app.getVersion()`; `autoUpdater` removido (404 eliminado); `AppImage` `v0.4.0-beta` validado; `v0.4.1-beta` e `v0.4.2-beta` tags/releases criadas. **Limpeza 2026-10-03:** `electron-updater`, o script `scripts/generate-latest-yml.mjs`, o hook `postMake` e o `latest.yml` versionado foram removidos — o hook nunca correu (npm só dispara hooks em minúsculas, `postmake`), logo era código morto; `latest.yml` estava parado em `0.4.0-beta` a apontar para um AppImage `0.3.8-alpha` inexistente.
- [x] Verify `npm run make` builds Linux targets (deb + AppImage) — DONE 2026-09-07
- [ ] P1.13: CI quality gates (lint + typecheck + test before build/make) — DONE 2026-09-07 (`quality` job in `.github/workflows/release.yml`, runs in 28s; `build` job gated by `if: startsWith(github.ref, 'refs/tags/v')` + `needs: quality`; CI run `34146157247` green)

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
- [x] P1.11: Add @electron-forge/maker-rpm for Linux RPM target — **DROPPED** (`rpmbuild` fails to strip the argon2 prebuilds; no `.rpm` target ships)
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

- [x] P3.1: Renderer component tests (HomeScreen, PasswordModal, ViewDrawer + jsdom setup) — 69/69 pass (interação resolvida via mock dos hooks `useFocusTrap`/`useModalKeyboard` + `cleanup`)
- [x] P3.2: E2E Playwright interativo completo (electron context, critical flows + 3 error paths + teclado `Ctrl+N`/`Escape`/`Enter`/`Ctrl+S` + eventos de modal: focus trap, delete confirm, import dialog) — `tests/e2e/playwright.config.ts` (+macOS `Desktop Safari`) + `tests/e2e/clavis.spec.ts`

## Audit 2026-09-13 — Validações (Estado atual)
- [x] **VALID-01** (P3): `importDrawerRaw` valida `encryptedData`, `salt`, `iv`, `authTag`, `keyDerivation` (`store.ts`)
- [x] **DOS-01** (P3): `importDrawerRaw` limite `MAX_IMPORT_FILE_SIZE` (11_000_000) (`store.ts`)
- [x] **OVERWRITE-01** (P3): Import bloqueia sobrescrita (`fs.access` verifica existência) (`store.ts`)
- [x] **KDF-01** (P3): `keyDerivation` validado (`iterations >= 1`, `memory >= 2**14`, `parallelism >= 1`) (`store.ts`)
- [x] **TEST-01** (P3): `tests/validation.test.ts` criado (5 testes: SaveDrawer max content, CreateDrawer min password, ImportDrawer UUID, DeleteDrawer UUID)
- [x] **TYPE-01** (P3): `restartApp` corrigido para `Promise<Result<void>>` (`types.ts`)
- [x] **DEAD-01** (P3): `createCreditsWindow()` removido (`main/index.ts`)
- [x] **LOG-01** (P3): `isDev` simplificado (`logger.ts`)
- [x] **LOG-02** (P3): `title` removido/substituído por `titleLength` nos logs (`ipc-handlers.ts`, `store.ts`)

## CHAN-01 + BS-17 — preload bundling (2026-09-14)

- [x] **CHAN-01** (P2): Preload now imports `CHANNELS` from `src/shared/channels.ts` (single source of truth) — inline duplicate removed
- [x] **BS-17** (Medium): `copy:preload` (Unix-only `cp`) removed; replaced by cross-platform Vite bundling (`scripts/build-preload.mjs`)
- [x] `package.json`: `build:preload` script added; `build` = clean → tsc → build:preload → vite renderer
- [x] `scripts/build-preload.mjs` bundles preload to `dist/main/preload.js` (electron external, CHANNELS inlined) + removes redundant `dist/main/preload/`
- [x] Verified: `typecheck` ✅, `lint` 0 errors (79 warnings), `test` 74/74 ✅
- [x] Verified ASAR: `dist/main/preload.js` has only `require("electron")`; no `shared/channels` require
- [x] Verified runtime (AppImage `v0.3.3-alpha`): `Clavis started` → `IPC handler called list-drawers` → `Drawers listed count:5`
- [x] ADR-007 updated (Superseded → Resolved)

## Audit 2026-09-23 — Validated Findings (30 total: 0 🔴, 12 🟡 High, 18 💭 Medium/Low)
- [x] P0.1 — DATA_DIR (`main/index.ts`) → `app.getPath('userData')` (cross-platform)
- [x] P0.2 — LOG_DIR (`logger.ts`) → `app.getPath('logs')` / `userData`
- [x] P0.3 — App icon (`main/index.ts`) → platform-specific path (`win32` `.ico`, `darwin` `.icns`, `linux` `.png`)
- [x] P0.4 — Supply-chain (`package.json`) → downgrade `@electron-forge/cli` to `6.4.2` — DONE; make/CI validado e merged em `main` (`v0.3.7-alpha`, 2026-09-26)
- [x] P0.5 — KDF bounds (`encryption.ts`/`store.ts`) → default `2^18` KiB (256 MiB); floor `2^16`, cap `2^20`; **corrected 2026-09-24** — original `2^21` (~2 GiB) SIGTRAP-crashed Argon2 on create; unlock no longer rejects legacy `2^16` drawers
- [x] P0.6 — Rate limiting (`ipc-handlers.ts`) → exponential backoff on `unlockDrawer`
- [x] P0.7 — Memory hygiene: AES keys (`encryption.ts`) → `Buffer.fill(0)` after `.final()`
- [x] P0.8 — Memory hygiene: passwords (`renderer` → `main`) → accept `Buffer`/`Uint8Array`, zero after derivation
- [x] P0.9 — Password in React state (`HomeScreen.tsx`) → clear after unmount; prefer `useRef`
- [x] P0.10 — Bundle size (`vite.config.mts`) → lazy-load `ViewDrawer`, chunk heavy deps (target <500 kB) — **DONE 2026-09-27** (main chunk 17 kB, all chunks <500 kB)
- [x] P0.11 — Timing side-channel (`ipc-handlers.ts`) — uniform error responses / constant-time comparison (`v0.4.0-beta`)
- [x] P0.12 — Size check before decrypt (`ipc-handlers.ts`) — validate encrypted file size before `decrypt` (`v0.4.0-beta`)
- [x] P1.13 — Argon2 parallelism (`encryption.ts`) → ≥4 threads
- [x] P1.14 — Trusted KDF re-validation (`unlockDrawer`) → re-check params at unlock time (bounded range `2^16`–`2^20`)
- [x] P1.15 — Import token timer cleanup (`ipc-handlers.ts`) → clear on `will-quit` / interval-based cleanup
- [x] P2.16 — Pervasive `any` (79 warnings) → `argon2` typed via `typeof import('argon2')`, strict `IpcDeps`/`IpcListener`, test handlers derived from `ElectronAPI` — **DONE 2026-10-02** (0 `any` warnings)
- [x] P2.17 — JSON.parse try/catch (`HomeScreen.tsx`) → wrap `iconData` parse — **DONE 2026-09-27**
- [x] P2.18 — RESTART_APP (`ipc-handlers.ts`) → `app.relaunch()` + `app.quit()` — **DONE 2026-09-27**
- [ ] P2.19 — Dirty-check back nav (`ViewDrawer`) → confirmation or auto-save draft
- [ ] P2.20 — Modal backdrop standardization → consistent click-to-close behavior
- [ ] P2.21 — Loading spinner (`ViewDrawer`) → spinner inside save button
- [x] P2.22 — Dynamic i18n messages in `ipc-handlers.ts` (`v0.4.0-beta`)
- [x] P2.23 — Typecheck the test suite → `tsconfig.test.json` + `typecheck:test` script + CI `quality` step — **DONE 2026-10-02** (surfaced `registers all expected channels` already failing on the working tree: the `check-update` handler was missing from the expected list)
- [x] P2.24 — Typecheck `src/renderer` + the `*.tsx` tests — **DONE 2026-10-04** (21 → **0** errors, 8 files, all edits type-level only). `tsconfig.test.json` extended (no new config, no new npm script, **no CI edit** — `quality` already ran `typecheck:test`): `include` += `src/renderer/**/*.ts`, `src/renderer/**/*.tsx`, `src/types/**/*`, `tests/**/*.tsx`; **`"src/renderer"` removed from `exclude`** (`exclude` silently beats `include` — the reason a first measurement falsely reported 0). Fixes: (a) `src/types/svgr.d.ts` += `declare module '*.svg?react'` mirroring `vite-plugin-svgr/client.d.ts` — the old `*.svg` block can't match the `?react` query; `types: ["vite/client"]` is unusable (`typeRoots` → TS2688). (b) `useFocusTrap`/`useModalKeyboard` params → `RefObject<HTMLElement | null>` (React 19 `useRef<T>(null)`); fixed in the hooks, no casts at the 8 call sites. (c) `CreditsModal` return type → `React.JSX.Element | null` (`lazy()` still accepts it). (d) `ToastProvider` − `reverseOrderFamilies` (react-hot-toast 2.6.0 dropped it; **completely inert** — 0 package matches, `reverseOrder` defaults `false`). (e) `HomeScreen.tsx` − phantom `SkeletonLoader` default import (no default export invented). (f) `HomeScreen.test.tsx` `restartApp` → `Promise<Result<void>>` + the 2 members the stub lacked (`getAppVersion`, `checkUpdate`); the missing-property error was **masked** by the inner one. (g) `ViewDrawer.test.tsx` 9 stubs + the `vi.fn` annotated `Promise<Result<void>>` so `ok` stays literal `true`. Gates: `typecheck` 0, `typecheck:test` 0, `lint` 0 problems, `86/86`, `build` OK. `--listFiles`: 13 renderer sources + 4 `.tsx` tests in the program, `tests/e2e` still out.
- [x] **P2.25 — PROVEN end-to-end at `v0.4.4-beta`** — DONE 2026-10-05. `v0.4.4-beta` published (tag `0508a47`, run `37331376460`, 4 jobs green, 6 assets), so `releases/latest` moved to `v0.4.4-beta`. Proof is an **A/B on the *published* `clavis-0.4.3-beta` AppImage** (130,071,032 bytes from GitHub Releases, driven with Playwright `_electron`, `app.getVersion()` asserted `0.4.3-beta` so it can't be confused with a local build):
  - **Negative control** (run while `latest` was still `v0.4.3-beta`): `BUTTON_SHOWN=false` — the as-latest case correctly stays silent, so the later positive cannot be a false positive.
  - **After the release**: `BUTTON_SHOWN=true`, `BUTTON_TEXT="Nova versão disponível: v0.4.4-beta"`, `href=.../releases/latest`, screenshot of the green button captured.
  - Chain now fully covered: main `https.get` → IPC → comparison → rendered link. Closes the `v0.4.2-beta` failure (renderer `fetch` CSP-blocked; its "user confirmed" note came from a local build).
  - Harness selector note: `t('label.credits_title')` is `Créditos` under PT-PT, so it matches `button[aria-label*="redit"], button[aria-label*="rédit"]`.
  - Plus `tests/CreditsModal.test.tsx` (13 tests, mutation-checked vs 7 deliberate breaks) closes part of P3.31. **User visually re-confirmed the button in the running AppImage (2026-10-05)** → P2.25 fully closed, automated + human evidence.
- [ ] P3.22 — ErrorBoundary accessibility (`ErrorBoundary.tsx`) → `role="alert"`, `aria-live="assertive"`, `aria-label` restart
- [ ] P3.23 — SkeletonLoader accessibility (`SkeletonLoader.tsx`) → `aria-hidden="true"`, `aria-busy="true"`
- [ ] P3.24 — CreditsModal i18n (`CreditsModal.tsx`) → extract 12 English strings
- [ ] P3.25 — ErrorBoundary i18n (`ErrorBoundary.tsx`) → add 4 i18n keys
- [ ] P3.26 — Toast messages i18n (`CreditsModal.tsx`) → add keys for copy success/error
- [ ] P3.27 — Unnecessary fallback patterns (`ViewDrawer.tsx`) → remove `|| 'fallback'` patterns
- [ ] P3.28 — In-app language selector (`src/i18n/index.ts`) → user override
- [ ] P3.29 — HomeScreen `useCallback` (`HomeScreen.tsx`) → memoize handlers
- [ ] P3.30 — POSIX permissions (`ipc-handlers.ts`) → document Windows limitation in README
- [ ] P3.31 — Testing gaps → 15 production files need tests (`main/index.ts`, `logger.ts`, `preload/index.ts`, `i18n/index.ts`, `CreateDrawerModal`, `ErrorBoundary`, `CreditsModal`, `DeleteConfirmModal`, `ToastProvider`, `SkeletonLoader`, `useFocusTrap`, `useModalKeyboard`, `types.ts`, `channels.ts`)
- [x] Duplicate drawer title → advisory warning (not a blocker) — **DONE 2026-10-03**: `CreateDrawerModal` takes `existingTitles?: string[]`; on trimmed + case-insensitive match it shows an inline `role="alert"` confirm step (`btn.create_anyway` / `btn.change_title`) instead of calling `createDrawer`. Renderer-only — no `src/main/**` change, no uniqueness validation, rename/import untouched, existing duplicates untouched. New `tests/CreateDrawerModal.test.tsx` (7 tests) closes the `CreateDrawerModal` gap listed in P3.31.

## Deferred (Post-MVP)

- [x] Auto-updater (electron-updater + GitHub Releases endpoint) — `electron-updater` instalado; `autoUpdater.setFeedURL({ provider: 'github', owner: 'ribaudequin', repo: 'clavis' })` + `checkForUpdatesAndNotify()` no `main/index.ts`; `if (app.isPackaged)` guardado — v0.1+
- [x] Flatpak manifest — `flatpak/com.github.marcelosalvador.Clavis.yaml` atualizado (`Clavis-0.3.1-alpha.AppImage`, E2E referência incluída, `tests/e2e/playwright.config.ts`); build validado (`AppImage` 245M)
- [x] i18n — IMPLEMENTED in v0.3.2-alpha (`05305b3`). See lines 17-19 and `SUMMARY.md`.
- [ ] Icon path standardization (cosmetic cleanup) — maintenance sprint
- [ ] Code signing (EV certs, Apple notarization) — post-v1.0 if needed

## Progress
- **Done**: All 23 audit-2026-08-30 findings fixed, full drawer flow (+ import UI), security hardening, store extraction. **v0.1.9.1-alpha** (2026-09-08): preload fix + CI artifact fix — preload runtime fix (inlined CHANNELS constants to fix `module not found: ../../shared/channels.js`), CI workflow artifact name fix (include version in artifact name `clavis-${os}-${tag}`). **v0.1.8-alpha** (2026-09-07): Phase 2 P0 a11y + ErrorBoundary fix — 3 P0 a11y blockers (focus indicator, drawer rows as buttons, credits modal focus trap) + 10 P1 quick wins + **Preload runtime fix** (inlined CHANNELS constants to fix `module not found: ../../shared/channels.js`). **ErrorBoundary.restartApp** end-to-end. **v0.1.7-alpha** (2026-09-07): IPC-layer hardening — B2 symlink rejection + strip `details: e`, B3 decrypt size cap 10 MB, B5 `CHANNELS` const (kills drift risk), doc sweep. **v0.1.6-alpha** (2026-09-04): P0 UX (toast system, focus traps, skeleton loaders, password visibility toggle, strength meter in CreateDrawerModal only). **v0.1.4-alpha** (2026-09-03): DeleteConfirmModal + `danger.svg`. **v0.1.3-alpha** (2026-09-03): first CI-built green run `33781273256`. **v0.1.2-alpha** baseline: import drawer button. **v0.1.1-alpha**: fixed `argon2` Win32 `PE32+` via `afterPack` + `scrypt` fallback, save/delete `Result` mismatch, Windows `confirm()` focus steal.
- [x] **Tested**: Encryption round-trip, wrong-password rejection, drawer CRUD, path-traversal rejection, import drawer flow, HomeScreen rendering, all build targets, ASAR content, AppImage runtime, Windows `PE32+` verified, save/delete `Result` flow, Windows modal focus after delete, CI-built `v0.1.3-alpha` (AppImage Linux + ZIP Windows 11), CI-built `v0.1.4-alpha` (AppImage delete-confirm UI), **v0.1.7-alpha (54/54 tests)** — symlink rejection, decrypt size cap, CHANNELS const, all 8 IPC handlers, **v0.1.8-alpha (58/58 tests)** — a11y fixes, preload fix, ErrorBoundary restartApp, **duplicate-title warning (86/86 tests)** — `CreateDrawerModal.test.tsx` 7/7, mutation-checked (fails 4/7 when detection is stubbed), **visually confirmed by the user in the local AppImage `0.4.2-beta` (250M)**: creating a drawer named "Notas" and submitting that same name again shows the inline confirm step
- [x] **Audit 2026-09-01**: 14 recommendations validated by 4 specialized sub-agents; consolidated into 4-phase roadmap (Phase 0-3, ~35h total; MVP target 18.75h)
- [x] **Audit 2026-09-07 (appsec)**: IPC layer review after P1.3 extraction — refactor regressions all PASS (A1-A7); 2 P2 soft-blocking (B2 symlink, B3 decrypt size) fixed in v0.1.7-alpha; 1 P3 hygiene (B5 CHANNELS const) bundled. `audits/audit_2026-09-07-appsec.md`.
- [x] **Code review 2026-09-07**: P1.2 + P1.3 confirmed correct, byte-identical extraction, no behavioral drift. Verdict WITH-MINOR-FIXES — all fixes bundled in v0.1.7-alpha. `audits/review_2026-09-07-code.md`.
- [x] **A11y audit 2026-09-07**: 3 P0 blockers fixed, 10 P1 quick wins, preload fix. `audits/audit_2026-09-07-a11y.md`.
- **Current focus**: Phase 3 P3.1 (renderer component tests, 8h) or Post-MVP (auto-updater / i18n / Flatpak). Phase 1 + Phase 2 P0 complete. Credits modal redesign complete (v0.3.5-alpha released).
- [x] **Sub-agent 3 (implementation & validation)** — completed 2026-09-09: PLANO.md edited (Note 2026-09-09 + Audit-Driven Action Plan 2026-09-09), consistency verified with SUMMARY.md (v0.2.0-alpha, 69/69) and TODO.md. No critical conflicts.
- **Released `v0.4.4-beta`** (2026-10-05, tag `0508a47`, run `37331376460` verde nos 4 jobs, 6 assets). **P2.25 fechado**: o botão "Nova versão" está finalmente observado a funcionar no binário **publicado**. Prova em A/B sobre o AppImage **publicado** da `v0.4.3-beta` (`app.getVersion()` = `0.4.3-beta`, conduzido com Playwright `_electron`): antes da release, `releases/latest` devolvia `v0.4.3-beta` e o botão estava **ausente** (controlo negativo); depois, o mesmo AppImage mostrou `Nova versão disponível: v0.4.4-beta` a apontar para `releases/latest`, com screenshot. Inclui também P2.24 (renderer + testes `.tsx` sob typecheck, 21 → 0) e `tests/CreditsModal.test.tsx` (13 testes, mutation-checked contra 7 quebras distintas). `99/99` testes. `npm run make` local **omitido** de propósito (decisão do utilizador) — o packaging assenta só no run do Actions. P2.25 fechado com evidência automatizada **e** confirmação visual do utilizador no AppImage a correr. Documentação sincronizada.
- **Released `v0.4.3-beta`** (2026-10-03, tag `a739b1e`, run `37128865586` verde nos 5 jobs, 6 assets). Dois bloqueadores apanhados na preparação: o import de `icons/svg/clavis.svg?react` (ficheiro nunca commitado, identificador nunca usado, Vite fazia tree-sake silencioso) e a descoberta de que a `v0.4.2-beta` **nunca** mostrou o botão de nova versão (fetch no renderer bloqueado pelo CSP `connect-src 'self'`; a nota de "user confirmed" vinha de um build local). `v0.4.3-beta` moveu o pedido para o main (HTTP 200 verificado), mas o caminho "botão aparece quando há versão mais recente" continua por provar → **P2.25**, a fazer ao cortar a `v0.4.4-beta`. AppImage publicado testado: arranca como `0.4.3-beta`, round-trip IPC, shutdown limpo, argon2 32-byte raw hash. Nota: AppImage do CI 124 MB vs 250 MB do build local do mesmo commit (compressão `mksquashfs` diferente entre a toolchain local e o `@reforged/maker-appimage`).
- **Current focus (2026-10-04):** **P2.24 done — the renderer and the `.tsx` tests are under typecheck for the first time.** 21 hidden errors → 0, across 8 files, every change type-level only (details in the P2.24 entry). Design choice: extend `tsconfig.test.json` rather than add a third config, so `typecheck:test` is the `noEmit` catch-all for everything the build config does not compile — which meant **zero changes to `.github/workflows/release.yml`**, since the `quality` job already ran it. Two traps worth remembering, both now in MEMORY.md Troubleshooting: `exclude` silently beats `include` (this is what made the very first measurement falsely report 0 errors), and an error inside an object literal masks that literal's missing-property error (so fixing `restartApp` surfaced a second wave: the stub had been missing `getAppVersion` and `checkUpdate` since the BS-06 update check landed). `src/types/**/*` in `include` is load-bearing, not decorative — the `.d.ts` files are ambient and TS never pulls them in via imports. Gates all green: `typecheck` 0, `typecheck:test` 0, `lint` 0 problems, `86/86` tests, `npm run build` OK. Next: P2.19–P2.21 UX, then P3.22–P3.31 i18n/a11y/tests. P2.25 still waits for the `v0.4.4-beta` cut.
- **Current focus (2026-10-03, later):** **Dead `postMake` hook found + `electron-updater` chain removed.** npm only fires `pre<name>`/`post<name>` hooks in **lower case** (verified with a minimal repro: `postmake` runs, `postMake` is silently skipped), so `scripts/generate-latest-yml.mjs` had never executed and the tracked `latest.yml` was frozen at `0.4.0-beta` pointing at a non-existent `0.3.8-alpha` AppImage. Since BS-06 replaced `electron-updater` with a manual GitHub Releases check and the package was referenced nowhere in code or CI, removed: `electron-updater` (`^6.8.9`), the script, the `postMake` hook, and `latest.yml`. Re-validated after removal — AppImage 250M + `.deb` 218M, `electron-updater` absent from the ASAR, headless boot OK. Docs corrected: `BUILD_MANUAL.md`, `docs/clavis-ci-cd-setup.md`, `docs/MILESTONES.md` (BS-06 closed), `PLANO.md`, `TODO.md`, `README.md`, `CONTRIBUTING.md`, `BUILD_TARGETS.md` (`forge.config.mts` and `.rpm` drift from the 2026-09-26 Forge 6.4.2 downgrade). P2.24 corrected from an estimated ~28 to a **measured 21** renderer type errors. `scripts/build-appimage-local.mjs` console output moved to English. `86/86`, lint 0 problems, both typechecks clean. Next: P2.19–P2.21 UX, P2.24 renderer typecheck, P3.22–P3.31 i18n/a11y/tests.
- **Current focus (2026-10-02)**: **P2.16 + P2.23 completed.** Zero `@typescript-eslint/no-explicit-any` warnings project-wide (was 78). `argon2` typed via `typeof import('argon2')`; `IpcDeps` uses strict `IpcListener` / `Pick<Dialog, 'showOpenDialog'>` (2 eslint-disable directives removed); `tests/ipc-handlers.test.ts` handlers are now derived from the `ElectronAPI` contract via an `API_BY_CHANNEL` map — preload↔main drift becomes a type error. New `tsconfig.test.json` + `npm run typecheck:test` + CI `quality` step make test types enforceable (tests were never typechecked before). Found & fixed a test already failing on the working tree (`registers all expected channels`: `check-update` handler missing from the expected list). Next: P2.19–P2.21 UX, P2.24 renderer typecheck, P3.22–P3.31 i18n/a11y/tests.
- **Current focus (2026-09-23)**: Audit `audit_2026-09-23.md` validated and integrated: PLANO.md updated (new "Audit-Driven Priorities — 2026-09-23" with P0 Security & Cross-Platform, P1 Memory/Session, P2 Code Quality, P3 UX/i18n/accessibility, + strategic recommendations); SUMMARY.md updated; MEMORY.md changelog updated; TODO.md expanded with 31 new audit items (P0–P3 + strategic). Confirmed 0 🔴 critical, 12 🟡 high, 18 💭 medium/low findings. Confirmed 74/74 tests pass, `tsc` strict, `lint` 0 errors, `vite build` OK. Next: implement P0 supply-chain downgrade (`@electron-forge` → 6.4.2), `DATA_DIR`/`LOG_DIR` cross-platform fix (`app.getPath`), KDF floor, memory hygiene (key zeroing + Buffer passwords), and rate limiting (`unlockDrawer`).
- [x] [P0.4.0] Downgrade @electron-forge 6.4.2 — **DONE e merged em `main` como `v0.3.7-alpha`** (2026-09-26):
  - `npm run make` funciona em Linux + macOS + Windows (GitHub Actions run `36249794554` no branch, `36250372485` na release).
  - Causa raiz 1: `forge.config.mts` é **ignorado** pelo forge 6.4.2 (`interpret` não tem extensão `.mts`); a fonte única é `package.json` → `config.forge.makers` (objetos `{name, platforms, config}`). `forge.config.mts` removido.
  - Causa raiz 2: workflow falhava em 0s por sintaxe inválida `${{ github.ref_name | replace('/', '-') }}` (GH Actions não tem `replace()`); e `upload-artifact@v4` rejeita `/` no nome. Fix: passo `Compute artifact name` (`${GITHUB_REF_NAME//\//-}`) + `release` só em tags `v*`.
  - Release `v0.3.7-alpha` publicada com 6 assets: `clavis_0.3.7.alpha_amd64.deb`, `clavis-0.3.7-alpha-x64.AppImage`, `clavis-0.3.7-alpha.Setup.exe`, `clavis-0.3.7-alpha-full.nupkg`, `clavis-win32-x64-0.3.7-alpha.zip`, `clavis.dmg`.
DECISÃO 2026-09-26: merge de `test/downgrade-forge-6.4.2` → `main` (fast-forward) e bump para `0.3.7-alpha`; tag `v0.3.6-alpha` mantida em 7.11.2 (`e1fb38b`). `main` agora tem `config.forge` no `package.json` (make corrigido). Artefactos de sessão (`SESSION_REPORT_2026-09-24.md`, `desktop-engineer-report.json`) removidos do repo e adicionados ao `.gitignore`.
- [x] Validação visual do `clavis-0.3.7-alpha-x64.AppImage` gerado pelo GitHub Actions — smoke test OK (2026-09-26).
- [x] `docs/MILESTONES.md` criado — milestones técnicos `v0.4.0-beta` e `v1.0`. Sessão fechada 2026-09-29.
