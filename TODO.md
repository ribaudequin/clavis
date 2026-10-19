# TODO — Clavis

## Code audit 2026-10-17 — `audits/audit_2026-10-17.md`

- [ ] **QA-01/QA-02 (P0):** make the gates green again — `vitest` currently 46/346 failing (5 files) and `typecheck:test` 4 errors; update password fixtures, `limits` mock (`countCodePoints`), `password_too_weak`, Vitest `importActual` typing, `AppError` access.
- [ ] **SEC-01 (P0):** KDF fallback writes `algorithm: "argon2id"` without recording the backend → drawers created on a scrypt build are unopenable once argon2 returns. Choose fail-closed or store the backend; correct `SECURITY.md`.
- [ ] **SEC-02 (P0):** legacy 8-char drawers unlock but cannot save (`password_too_weak`); apply the 12-char policy only to new passwords or add a change-password flow.
- [ ] **REL-01 (P0):** non-atomic drawer writes — add temp file + `fsync` + `rename` and keep one previous version.
- [ ] **QA-03/QA-04 (P0):** exclude `tests/e2e/**` from Vitest; fix Playwright config/`testDir` and the `test:e2e` script.
- [ ] **SEC-03 (P1):** one shared password-policy module; typed weak-password failure; remove the dead `"8 characters"` IPC branch.
- [ ] **SEC-04 (P1):** verify the current password (decrypt existing ciphertext) before `saveDrawer` overwrites it.
- [x] **SEC-05/SEC-07 (P1):** validate crypto field lengths and the full drawer metadata schema at import/list/unlock — DONE 2026-10-19. `salt`/`iv`/`authTag` must be 32 hex chars, `encryptedData` even-length hex; `iconData` bounded to 64 strings; `listDrawers`/`unlockDrawer` validate with the same schema and skip/return `corrupt_metadata` (`INVALID_JSON`, no rate-limit increment); filename/id mismatch is skipped; `decrypt()` zeroes the key when `createDecipheriv`/`setAuthTag` throw.
- [x] **SEC-09 (P1):** single-instance lock (`app.requestSingleInstanceLock`) — **released as `v0.6.6-beta`** (tag run `39294150563`, 7 jobs green, 6 artifacts). `src/main/single-instance.ts` holds the decision, `src/main/index.ts` requests the lock at module scope before `app.whenReady()` and quits on refusal, `tests/single-instance.test.ts` has 9 unit tests, and `tests/e2e/single-instance.spec.ts` proves it on the packaged binary: the second instance on the same profile exits 0 in ~450ms while the primary stays alive, and a control on a private profile must keep running.
- [x] **REL-02 (P1):** a cancelled unlock still opens the drawer — invalidate pending attempts on close — **released as `v0.6.7-beta`** (tag run `39304464489`, 7 jobs green, 6 artifacts). The attempt counter in `src/renderer/pages/HomeScreen.tsx` lets the cancel side invalidate the attempt and the stale result is dropped; `tests/rel02-cancelled-unlock.test.tsx` covers it in jsdom; `tests/e2e/rel02-cancelled-unlock.spec.ts` proves it on the **packaged** binary — the window is built out of the application's own rate limiter (5 wrong passwords → the 5 s tier, sleeping *before* the derivation), the prompt is dismissed with a synthetic keydown on the `[role="dialog"]` container (a real Escape cannot reach the listener while the input is disabled — the file's header says so), and a control with the identical flow opens the drawer. **Mutation-verified:** reverting the counter and the guard fails Test 1 and leaves the control green. **Owner decision:** ships as the safety net it is — the state is unreachable in the current interface (measured), and the consequence is **UX-08**.
- [ ] **UX-08 (P2) — NEXT SESSION'S PRIORITY:** the unlock wait is not cancellable and has no countdown. **Planned in `PLANO-REL-02-CANCELABLE-UNLOCK-2026-10-19.md`; the owner decisions are taken (2026-10-19):** cancelling is a **renderer-only** affair (the main process finishes its wait and its derivation and the result is discarded — no new IPC to abort it), the user cancels with **both** the Cancel button and Escape, and the **remaining seconds are shown**. This is also what makes **REL-02's** shipped fix reachable instead of a safety net. **Found while fixing REL-02, and measured rather than assumed.** The unlock prompt cannot be closed while the unlock is in flight: the password input is `disabled` (`PasswordModal.tsx:64`), the browser moves the focus to `<body>`, and the Escape listener of `useModalKeyboard` is on the modal **container** (`useModalKeyboard.ts:26`) — a keydown on `<body>` propagates upward and never reaches a descendant. Measured in the packaged app during an unlock: `{"activeTag":"BODY","inputDisabled":true,"focusInsideModal":false}`, and an Escape press left the dialog on screen. The Cancel button is disabled too (`PasswordModal.tsx:92`). Under the rate limiter (`ipc-handlers.ts:66-80`, 3 failures → 1 s, 5 → 5 s, 10 → 30 s, per drawer, reset after 2 min of inactivity) the prompt is therefore **frozen for up to 30 s** with no way out. **How likely, measured:** the 30 s tier needs **10 consecutive wrong passwords on the same drawer**, a path that already costs ~37 s of the user's own time (10 derivations ≈ 10 s plus 27 s of prior delays) and still fits inside the 2-minute window. The 1 s tier (3 attempts) is a plain typo and is imperceptible; the 5 s tier (5 attempts) is plausible and mildly annoying. The user who actually suffers is the one who **knows** the password and just failed 10 times for another reason (caps lock, keyboard layout, a wrong autofill) — rare, but the cost is 30 s. A user who has forgotten the password reaches the 30 s tier almost certainly, but the wait changes nothing for them. **Not a silent freeze:** the button reads "Decrypting" (`btn.decrypting`), so there is feedback — what is missing is a countdown and the ability to cancel. **Owner decision 2026-10-19:** REL-02 ships as the safety net it is; this is a separate UX item, and it is the next session's priority.
- [ ] **P2:** dynamic focus trap (UX-01), i18n strength labels (UX-02), debounced counters (UX-07), key zeroing on error paths (SEC-06), caught IPC rejections (REL-03), timer cleanup (REL-04), repair or delete stale e2e specs (QA-05), dev-dependency advisories (QA-06), passphrase policy review (SEC-08).

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
- [x] P1.7: Add keyboard shortcuts (Ctrl+N, Escape, Enter, Ctrl+S) — 1h — ⚠️ **partly false, corrected
  2026-10-18.** Escape (`useModalKeyboard.ts:17`) and Ctrl+S (`ViewDrawer.tsx:103`) exist and are now
  covered end to end; **Ctrl+S is the only shortcut in all of `src/`**. Enter works as native form
  submission rather than a handler. **`Ctrl+N` does not exist** — proved by
  `grep -rn "ctrlKey|metaKey|globalShortcut|accelerator|KeyDown" src/`, and by a never-run e2e test that
  had been asserting it for months. Implement it or drop it from this line; not decided yet.
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
- [x] **P2.19 — Dirty-check no Back do `ViewDrawer` → PERDA SILENCIOSA DE DADOS (PRIORIDADE MÁXIMA)** — **DONE 2026-10-06, opção (c) escolhida pelo owner e implementada**: novo `src/renderer/components/DiscardChangesModal.tsx` (3 acções: "Guardar e sair" primária + focada no mount, "Descartar e sair", Cancelar), `isDirty = title !== initialTitle || content !== initialContent`, Back passa por `handleBack()` e só abre o diálogo quando sujo. 4 chaves i18n novas em `pt-PT`+`en` (`msg.unsaved_changes_title`, `msg.unsaved_changes_desc`, `btn.save_and_leave`, `btn.discard_and_leave`). `140/140` testes. **CONFIRMADO 2026-10-05**: o botão "← Back" (`ViewDrawer.tsx:69`) chama `onBack()` → `HomeScreen.tsx:212-216` faz `setViewState(null)` e o componente desmonta. **Não existe `isDirty`, nem confirmação, nem auto-save** — `title` e `content` em estado local desaparecem sem aviso. Num app cujo pitch é guardar palavras-passe, PINs e dados bancários, escrever uma credencial e tocar Back por acidente é a pior classe de bug possível aqui. Opções: (a) **auto-save ao sair** — zero cliques, zero perda, padrão Notes/Obsidian/Notion, mas o Back passa a demorar 1-2s porque o Argon2id a 2^18 KiB torna cada `saveDrawer` lento (e o P2.21 existe porque isso é visível); (b) **confirmação só quando `title !== initialTitle || content !== initialContent`** — Back instantâneo no caso comum, mas um misclick continua a perder dados se o utilizador confirmar; (c) **diálogo com "Guardar e sair" como acção primária** — só quando sujo, sem desperdiçar um auto-save lento, sem caminho de perda silenciosa. **Recomendação: (c).** Nota: a linha 71 tem o padrão redundante `t('btn.back') || 'Back'` que é o **P3.27**.
- [x] **P3.32 (NOVO, 2026-10-05) — `<html lang>` fixo em `en`** → WCAG 3.1.1 (Language of Page, AA). **Confirmado no binário publicado**: o harness sobre o AppImage da `v0.4.5-beta` leu `document.documentElement.lang === "en"` com **toda** a UI em português, porque `src/renderer/index.html` tem `<html lang="en">` hardcoded. Um leitor de ecrã pronuncia a app inteira com voz inglesa para todos os utilizadores pt-PT. Correcção: definir a partir do locale que a app já resolve (o mesmo que `t()` usa). — **DONE 2026-10-13**. `detectLocale()` is now the single locale decision: it was extracted into a **pure exported** `resolveLocale(navigatorLanguage)` — same trim / `_`→`-` / primary-subtag / lowercase / `pt`→`pt-PT` / else `en`, **two locales only, `pt-BR` still cannot return** — and a new `applyDocumentLanguage()` writes `detectLocale()` onto `document.documentElement.lang`. The CI short-circuit stays in `detectLocale()` so the pure function answers identically with and without an env stub. Called **once** from `src/renderer/index.tsx`, the entry that calls `createRoot`, immediately before the render — not in a component, not in the HTML. `lang="en"` stays in `index.html` **as the pre-JavaScript default**, now with a comment saying so and the rule written into `DESIGN.md` ("The page language is the locale the app renders, not a constant"), because that file is the one a future reader is most likely to "fix" back to a constant.
  **The assertion that closes the bug is on the attribute, not on the mapping function.** `tests/i18n.test.ts` grew from 14 to 24 tests: the pure resolver pinned on `pt-PT`/`pt-BR`/`pt`/`en-US`/`en` and on 7 malformed/empty tags; `applyDocumentLanguage()` asserted to actually write `pt-PT` and `en` onto the document; an agreement test that derives the expected attribute from what `t()` returned, so the two consumers of the locale cannot diverge. `183/183` no total.
  **The guard against "exported but never called" imports the renderer entry** (`src/renderer/index.tsx`, React mocked out) rather than reading its source: removing the `applyDocumentLanguage()` call **fails 3 tests** and leaves the other 21 green, including every test that checks the attribute in isolation. That is the difference between testing the function and testing the wiring. A tenth test pins the order — `['applyDocumentLanguage', 'render']` — and moving the call below `createRoot().render()` fails **only** that one, which is how it is known to be observing order rather than merely observing that both ran.
  **Medido no AppImage empacotado sob três locales de sistema:** `pt-PT` → `lang="pt-PT"`, `pt-BR` → `lang="pt-PT"`
  (a regra de locale lusófono único, ADR-009), `en-GB` → `lang="en"` — cada um com a UI a renderizar na língua
  correspondente. **Armadilha do harness:** `LANG=`/`LC_ALL=` e o switch `--lang` do Electron **não** movem
  `navigator.language` neste build, portanto os casos não-pt só se provam com o valor stubado **antes** do arranque
  (`addInitScript` + reload).
  **One trap hit while writing the tests, worth keeping:** a second `vi.doMock('react-dom/client', …)` does **not** replace the first one, so the ordering test's first version recorded no `'render'` and failed for the wrong reason. The render hook is now a parameter of the shared mock helper. **A mistyped mock is a mutation that applies to the test instead of the source.**

- [x] **Bug 2 (P2.19 adjacente) — `useFocusTrap` re-executava porque `onEscape` estava nas deps** — **DONE 2026-10-06, e a nota anterior estava errada em pontos essenciais.** Diagnóstico real: com um `onEscape` inline, cada re-render do pai re-executava o effect; o *cleanup* restaurava o foco a `previouslyFocused` (o elemento **anterior**, fora do diálogo) e voltava a subscrever os listeners — resultado: **o foco saía do diálogo a cada re-render**,apsar a abertura. Confirmado com um teste de traço que imprimiu `document.activeElement` em cada passo: `in dialog: true → false → false`. Correcção na raiz (`useFocusTrap.ts`): o effect principal passou a depender só de `[containerRef, isActive]` e o `onEscape` passou para um **ref latest-value** atualizado num effect separado — assim o callback pode mudar de identidade livremente sem invalidar o trap. `useCallback` no `ViewDrawer` foi experimentado e **rejeitado**: `onBack` também é nova a cada render, portanto não resolvia nada; a correcção tem de viver no hook partilhado para beneficiar os 4 modais.
  **Duas correcções ao diagnóstico anterior desta nota, ambas verificadas:** (1) a nota previa que um patch latest-ref *congelaria* `previouslyFocused` capturado no momento errado em 3 dos 4 modais — **não acontece**: `previouslyFocused` continua a ser capturado no efeito do trap, uma vez por montagem, exactamente como antes; o ref só impede que o `onEscape` novo force a recaptura. (2) O problema nunca foi "precisava de testes com os hooks reais" como bloqueio, mas sim **falta de um teste que exercitasse os hooks reais** — era esse o custo, e está pago. **Armadilha encontrada ao escrever esse teste:** a primeira versão passava *com o bug presente*; só o detectava se o elemento previamente focado fosse focável, porque o cleanup só consegue mover o foco para um alvo que aceite `.focus()`. Com `previouslyFocused` = `body`, o falsh passava. O teste tem de fazer `title.focus()` **antes** de abrir o diálogo. Validado por controlo negativo: reintroduzi o bug e o teste falhou; corrigi e passou. Novo `tests/useFocusTrap.test.tsx` (3 testes, hooks reais, sem mocks) — é este o ficheiro que impede a regressão.
- [x] **4 falhas WCAG AA NOVAS, encontradas ao escrever o DESIGN.md (2026-10-06)** — **FECHADAS 2026-10-07, `v0.4.7-beta`** (`3a28688`, run `37649421652`). Valores medidos e verificados no AppImage real, não só em jsdom. (a) `PasswordModal` `text-red-500` 3.76:1 → `text-red-700` **6.47:1**; (b) fronteiras dos inputs `border` nu 1.24:1 → novo token **`--border-input` `#8a8a8a`** = **3.45:1** em branco / 3.30:1 em `gray-50` / 3.14:1 em `gray-100`; (c) borda do alerta `border-yellow-300` → `border-yellow-700` **4.76:1**; (d) ESC deixou de ter dois donos — `useFocusTrap` **não trata ESC** (ESC é comportamento de teclado de modal, não de contenção de foco), `useModalKeyboard` é o dono único. **Duas armadilhas que teriam passado em silêncio:** `border-input` define **só a cor** e o preflight do Tailwind põe `border-width: 0`, por isso a forma correcta é **`border border-input`** — a leitura literal produzia inputs **sem fronteira visível**; e `getComputedStyle().borderWidth` devolve **0.8px** em runtime apesar do CSS declarar `1px`, porque `devicePixelRatio` é 1.25 e o Chromium reporta pixels físicos (por isso o assert tem de mirar a regra que declara, não o valor). **Correções a valores registados:** o "antes" do alerta era **1.39:1**, não 1.27:1 (`yellow-300` é `#fcd34d`, não `#fde047`) — a falha era real, o número errado; e "ESC era benigno" era verdade mas desvalorizava. **`WRITE_FAILED` ficou deliberadamente genérico** porque o main reutiliza esse código em create/save/export/delete/import/restart. `152/152` testes. **Continua aberto:** o `CreditsModal` **não foca nada no mount**, logo o ESC não faz nada até o utilizador clicar ou tabular para dentro.
, todas medidas antes e depois com a fórmula de luminância relativa da WCAG. (a) Botão Ko-fi: `bg-amber-500` com texto branco a **2.15:1 FAIL** → `amber-700` a **5.02:1 PASS** (hover 7.09:1); (b) "Create anyway": `bg-yellow-600` a **2.94:1 FAIL** → `yellow-700` a **4.92:1 PASS**; (c) anel de foco global `#2563eb` media **2.84:1** contra `gray-800` (**FAIL** dos 3:1 exigidos a um indicador não-textual) → `#3b82f6`, que passa em branco (3.68), gray-800 (3.99) e gray-900 (4.82). **Correção a uma premissa minha**: o anel NÃO estava a 50% de opacidade — tailwindcss 3.4.19 emite `--tw-ring-opacity:1` para uma cor de ring sem classe `ring-opacity-*`, confirmado no CSS compilado; o `0.5` do `ringOpacity.DEFAULT` do config JS não é o fallback. O `1.19:1` era artefacto desse pressuposto. **O defeito (a) tinha outra causa**: `ring-offset-2` empurrava o anel para *fora* da face do botão, para o painel branco onde passava, enquanto contra a face azul media **1.41:1**. Corrigido com anel branco **inset** (5.17:1 contra a face, e o outline global mantém 3.68:1 contra o painel). **Regra que daí resulta, e que é registada no DESIGN.md**: nenhuma cor passa 3:1 contra branco **e** `blue-600` em simultâneo, logo um indicador de foco sobre botão colorido precisa de duas partes. O `::placeholder` a 2.54:1 do preflight do Tailwind ficou por resolver (não foi medido nem tocado neste passe).
- [x] **9 classes `text-*` mortas — DONE 2026-10-06 (commit `5ad6892`)**: 4 resolveram-se passando o SVG a `currentColor` (`heart.svg`, que passa a seguir o contexto — **mudança visível**, deixou de ser o salmão único), e 5 foram **removidas** por serem marcas de marca (Ko-fi, GitHub, ETH, SOL) cujas cores assadas *são* a marca — recolorá-las a cinza destruiria o reconhecimento, e cada uma tem dois `fill`, o que faz disto uma edição de asset e não um token. **Correção à mecânica**: a causa não é precedência de `presentation attribute` vs classe Tailwind. Uma classe `text-*` define a propriedade `color`, e um `fill` literal **nunca lê `color`** — por isso as classes eram inertes por qualquer via, e `heart.svg`/`danger.svg` usam `style="fill:…"` (estilo inline) enquanto as marcas usam `fill="#hex"` (atributo de apresentação). A regra no DESIGN.md está escrita sobre a causa verdadeira, senão mandava a pessoa para a reparação errada. Duas das 4 classes precisaram de ser *subidas* para ficar válidas: a cor originalmente pedida pelo autor falharia a 2.11:1 e 1.47:1.
- [x] **P2.21 — Loading spinner (`ViewDrawer`)** — `msg.saving` já existia; agora renderiza um `animate-spin` SVG apenas quando `saving` é `true`, evitando flash em saves rápidos (`t('btn.save_and_back')` preservado quando `!saving`). Verificado: `tests/ViewDrawer.test.tsx` 12/12 (era 11), incluindo `keyDown` `Ctrl+S` (C6-N16, mesmo passe). `184/184` testes.
- [x] P2.22 — Dynamic i18n messages in `ipc-handlers.ts` (`v0.4.0-beta`)
- [x] P2.23 — Typecheck the test suite → `tsconfig.test.json` + `typecheck:test` script + CI `quality` step — **DONE 2026-10-02** (surfaced `registers all expected channels` already failing on the working tree: the `check-update` handler was missing from the expected list)
- [x] P2.24 — Typecheck `src/renderer` + the `*.tsx` tests — **DONE 2026-10-04** (21 → **0** errors, 8 files, all edits type-level only). `tsconfig.test.json` extended (no new config, no new npm script, **no CI edit** — `quality` already ran `typecheck:test`): `include` += `src/renderer/**/*.ts`, `src/renderer/**/*.tsx`, `src/types/**/*`, `tests/**/*.tsx`; **`"src/renderer"` removed from `exclude`** (`exclude` silently beats `include` — the reason a first measurement falsely reported 0). Fixes: (a) `src/types/svgr.d.ts` += `declare module '*.svg?react'` mirroring `vite-plugin-svgr/client.d.ts` — the old `*.svg` block can't match the `?react` query; `types: ["vite/client"]` is unusable (`typeRoots` → TS2688). (b) `useFocusTrap`/`useModalKeyboard` params → `RefObject<HTMLElement | null>` (React 19 `useRef<T>(null)`); fixed in the hooks, no casts at the 8 call sites. (c) `CreditsModal` return type → `React.JSX.Element | null` (`lazy()` still accepts it). (d) `ToastProvider` − `reverseOrderFamilies` (react-hot-toast 2.6.0 dropped it; **completely inert** — 0 package matches, `reverseOrder` defaults `false`). (e) `HomeScreen.tsx` − phantom `SkeletonLoader` default import (no default export invented). (f) `HomeScreen.test.tsx` `restartApp` → `Promise<Result<void>>` + the 2 members the stub lacked (`getAppVersion`, `checkUpdate`); the missing-property error was **masked** by the inner one. (g) `ViewDrawer.test.tsx` 9 stubs + the `vi.fn` annotated `Promise<Result<void>>` so `ok` stays literal `true`. Gates: `typecheck` 0, `typecheck:test` 0, `lint` 0 problems, `86/86`, `build` OK. `--listFiles`: 13 renderer sources + 4 `.tsx` tests in the program, `tests/e2e` still out. **⚠️ The "`tests/e2e` still out" half of that sentence was wrong** — `tsconfig.test.json` has `include: ["tests/**/*.ts", …]` and `exclude: ["node_modules","dist","out"]`, so the Playwright specs have been inside the `typecheck:test` program all along. Re-measured 2026-10-19 while adding the SEC-09 e2e spec: `--listFiles` lists the 6 files under `tests/e2e/`, and a deliberate `const x: number = "str"` planted in that directory is reported as TS2322 by `npm run typecheck:test`. The claim survived for weeks in this file and in `MEMORY.md`, and it misled a session into believing the e2e specs were untyped and needed a separate manual `tsc`.
- [x] **P2.25 — PROVEN end-to-end at `v0.4.4-beta`** — DONE 2026-10-05. `v0.4.4-beta` published (tag `0508a47`, run `37331376460`, 4 jobs green, 6 assets), so `releases/latest` moved to `v0.4.4-beta`. Proof is an **A/B on the *published* `clavis-0.4.3-beta` AppImage** (130,071,032 bytes from GitHub Releases, driven with Playwright `_electron`, `app.getVersion()` asserted `0.4.3-beta` so it can't be confused with a local build):
  - **Negative control** (run while `latest` was still `v0.4.3-beta`): `BUTTON_SHOWN=false` — the as-latest case correctly stays silent, so the later positive cannot be a false positive.
  - **After the release**: `BUTTON_SHOWN=true`, `BUTTON_TEXT="Nova versão disponível: v0.4.4-beta"`, `href=.../releases/latest`, screenshot of the green button captured.
  - Chain now fully covered: main `https.get` → IPC → comparison → rendered link. Closes the `v0.4.2-beta` failure (renderer `fetch` CSP-blocked; its "user confirmed" note came from a local build).
  - Harness selector note: `t('label.credits_title')` is `Créditos` under PT-PT, so it matches `button[aria-label*="redit"], button[aria-label*="rédit"]`.
  - Plus `tests/CreditsModal.test.tsx` (13 tests, mutation-checked vs 7 deliberate breaks) closes part of P3.31. **User visually re-confirmed the button in the running AppImage (2026-10-05)** → P2.25 fully closed, automated + human evidence.
- [x] P3.22 — ErrorBoundary `role="alert"`, `aria-live="assertive"`, `aria-label` — **DONE 2026-10-13** (`a1fd5ab`).
- [x] P3.23 — SkeletonLoader `aria-hidden="true"`, `aria-busy="true"` — **DONE 2026-10-13** (`dde3c16`).
- [x] P3.24 — CreditsModal i18n (`CreditsModal.tsx`) → **DONE 2026-10-05**: ~19 user-facing strings routed through `t()` (About / description / source / Credits / role / thanks / Support / Ko-fi CTA / Cryptocurrency / EVM hint / footer / Copy button). Data deliberately **not** translated: crypto addresses, `ETH`/`SOL` tickers, `GitHub`/`Ko-fi` brand names, URLs, author name, `console.error`, error dumps. 21 new keys, 2 locales. See `ADR-009`.
- [x] P3.25 — ErrorBoundary i18n (`ErrorBoundary.tsx`) → **DONE 2026-10-05**: 4 keys (`label.error_title`, `msg.error_restart_hint`, `label.error_details`, `btn.restart`).
- [x] P3.26 — Toast messages i18n (`CreditsModal.tsx`) → **DONE 2026-10-05**: `msg.address_copied`, `msg.copy_failed`.
- [x] **i18n model change (owner decision, 2026-10-05)** → **`pt-BR` removed.** Rule: *any* lusophone system language renders **PT-PT**; everything else renders English. Two locales only (`pt-PT`, `en`), 69 keys each. `detectLocale()` now compares the **BCP-47 primary subtag** instead of a prefix: `lang.trim().replace(/_/g,'-').split('-')[0].toLowerCase() === 'pt'`, because `startsWith('pt')` was case-sensitive (`PT-br` → English) and over-matched (`ptx`, `ptt`). `t()` gained an optional `params` arg for `{token}` substitution (`msg.update_available`). New `docs/adr/ADR-009-i18n-single-lusophone-locale.md` supersedes ADR-003's fallback chain (ADR-003 kept as history with a pointer). Guards in `tests/i18n.test.ts`: `pt-PT`↔`en` key parity, `pt-BR` cannot return, routing of 8 lusophone + 8 non-lusophone + 7 malformed tags, and a quarantine scan for Brazilian-only markers in `pt-PT` values (`senhas`, `aplicativo`, `Excluir`, `Salvar`, `Arquivo`, "Me pague um café"). `SkeletonLoader`'s `aria-label` also i18n'd (it's screen-reader text). `114/114` tests, also green under `CI=true`. ⚠️ `src/main/ipc-handlers.ts` keeps an **independent** `getLocale()` reading `LANG` env vars for main-process error messages — consistent today, but a second locale decision that can drift. → **RESOLVIDO 2026-10-07 (`5269aa6`, `v0.4.7-beta`)**, e o diagnóstico estava incompleto: `getLocale()` é usado por **2** das 25 mensagens; as outras **23 nem sequer tinham locale**. O renderer expunha `result.error.message` (o texto inglês de diagnóstico do main) em **8 sítios**, cinco deles concatenando um prefixo traduzido ("Falha ao guardar Incorrect password or drawer not found"), e o `CreateDrawerModal` tinha um prefixo inglês `Error:` hardcoded num ecrã pt-PT. **Confirmado visualmente no AppImage:** senha errada mostrava "Incorrect password or drawer not found" numa UI portuguesa. **Corrigido traduzindo por `AppError.code`, que já existia** — nova `tError()` em `src/i18n/index.ts` mapeia os 7 `ErrorCode` para chaves `error.*` novas nos dois locales; `src/main/**` intocado e as **17** asserções de `tests/ipc-handlers.test.ts` sobre a string inglesa continuam a passar, porque essa mensagem passou a ser só de log. **Invariante com guarda de compilação:** `ERROR_MESSAGE_KEYS` é `Record<ErrorCode, string>`, logo um `ErrorCode` novo sem tradução é erro de build, não texto inglês em runtime; e `tError()` **rejeita um miss do dicionário** (`translated !== key`), senão mostraria a chave literal `error.decrypt_failed` ao utilizador. `HomeScreen.tsx:165` e `:180` discordavam — o `catch` buscava `t('label.incorrect_password')`, que só dispara em excepção e **nunca** em `result.ok === false`, ou seja nunca corria no caso de senha errada; ambos passam por `tError()` e a chave morta foi removida dos dois dicionários.
- [x] **P3.27 — Fallback patterns (`ViewDrawer.tsx`)** — `|| 'Back'` e `|| 'Content'` removidos; `t()` devolve a chave se ausente, portanto o fallback nunca dispara e apenas polui o código.
- [x] P3.28 — In-app language selector → **CANCELLED 2026-10-05 (owner decision)**: o app segue a **lingua do sistema**, sem override. Registado em `ADR-009`. Não implementar.
- [ ] P3.29 — HomeScreen `useCallback` (`HomeScreen.tsx`) → memoize handlers. **Still an open question of whether the item survives at all:** the 2026-10-06 entry records `useCallback` tried on `ViewDrawer` and **rejected**, because `onBack` is also new on every render so it fixed nothing. Decide keep-or-drop before spending time on it.
- [x] **P3.30 — POSIX permissions → documentation made honest — DONE 2026-10-16.** The TODO named the wrong file: the calls are in `src/main/store.ts`, not `ipc-handlers.ts`. The real defect was that the docs **overstated** the control. Three facts, all verified empirically (`umask-created: 600`, `after rewrite of a 644 file: 644`, `copyFile carries perms: 644`):
  - **`fs.writeFile`'s `mode` only applies at creation** — an existing `0644` drawer stays `0644` across every save. **True on Linux and macOS too, not a Windows-only gap.**
  - `fs.copyFile` carries the source's permissions, which is exactly why the old-data migration's `fs.chmod(dst, 0o600)` at `store.ts:116-117` is load-bearing. Migrated drawers are tightened; nothing else is.
  - **Exported `.clavis` files get none of it.** `HomeScreen.handleExport` builds a `Blob` and fires a Chromium `<a download>`, so the `0o600` never reaches the destination — on POSIX it lands at the process default, commonly `0o644`. Filed as `SECURITY.md` **Known Limitations item 3**, because the README's closing line promises the limitations live there. Content is ciphertext, so what a readable export discloses is **metadata, not content**: the plaintext title, timestamps and icon colour data.
- [ ] P3.31 — Testing gaps → **remaining untested files**: `main/index.ts`, `logger.ts`, `ToastProvider`, `SkeletonLoader`, `types.ts`, `channels.ts`. **Closed this session**: `preload/index.ts` ✅ (41 tests — `ElectronAPI` parity in both directions, per-method channel, argument order, promise identity), `DeleteConfirmModal` ✅ (15), `ErrorBoundary` ✅ (11), `useModalKeyboard` ✅ (9 after C1), plus `useFocusTrap` ✅ and `CreditsModal` ✅ (earlier). Also closed: `CHECK_UPDATE` / `RESTART_APP` / `GET_APP_VERSION` — the only three IPC channels that had **no `describe` block at all** (13 tests, and the electron mock had to grow `app.getVersion`/`app.relaunch` first). `i18n/index.ts` ✅ 2026-10-05 via `tests/i18n.test.ts`. `CreateDrawerModal` ✅ 2026-10-03.
- [x] Duplicate drawer title → advisory warning (not a blocker) — **DONE 2026-10-03**: `CreateDrawerModal` takes `existingTitles?: string[]`; on trimmed + case-insensitive match it shows an inline `role="alert"` confirm step (`btn.create_anyway` / `btn.change_title`) instead of calling `createDrawer`. Renderer-only — no `src/main/**` change, no uniqueness validation, rename/import untouched, existing duplicates untouched. New `tests/CreateDrawerModal.test.tsx` (7 tests) closes the `CreateDrawerModal` gap listed in P3.31.

## Defect sweep 2026-10-16 — `PLANO-DEFECTOS-2026-10-15.md`

Found while closing the P3.31 testing gaps, then fixed. Owner decisions taken up front: **delete the
dead `onEnter` branch**, **land in `main` with no release**, **impact-first order**. All seven steps
negative-controlled. `184 → 277` tests.

- [x] **A1 — `ErrorBoundary` moved no focus.** After the tree is replaced `document.activeElement` is
      `<body>`, so the crash screen was unreachable by keyboard. Now focuses the Error-details
      `<summary>` from **`componentDidCatch`** — not `componentDidUpdate`, which **never fires when
      the error occurs on the initial mount** (measured against React 19.2.8: mount →
      `componentDidMount → componentDidCatch`; update → `componentDidUpdate → componentDidCatch`),
      and the project's own test renders a fresh mount. Not Restart, per owner decision: a crash
      screen is exactly when someone reflexively hits Enter, and Enter on Restart relaunches the app.
      The `it.fails` became a real test; `DESIGN.md` gained rule 11 and an `### Error boundaries` section.
- [x] **A2 — `DeleteConfirmModal`'s `onConfirm: () => void` type lie.** It admitted any async function
      while **blocking** `onConfirm().catch(…)` (`Property 'catch' does not exist on type 'void'`),
      which is almost certainly why `try/finally` was written instead. Widened to
      `() => void | Promise<void>` (bare `Promise<void>` breaks the test harness with TS2322) and a
      `catch` added. **The rejection is unreachable in production today and the `catch` changes no
      observable behaviour** — approved as defence-in-depth plus a testable statement, and the source
      comment says so.
- [x] **A3 — `danger.svg` had no `aria-hidden`** in `DeleteConfirmModal`. The guard had to become
      `toHaveAttribute('aria-hidden','true')`: with the attribute present, `computeAccessibleName`
      returns `""` and `queryByRole('img')` excludes the subtree, so **both** existing assertions stay
      green under the planned mutation. Verified — without the new assertion the whole file is blind to it.
- [x] **A4 — `check-update` could hang forever.** Found while reviewing the plan. `.on('error')` was on
      the **request**, not the response, with no timeout: a stalled response stream meant the promise
      never settled → `CreditsModal`'s `Promise.allSettled` never resolved → the About card silently
      omitted its version line, permanently. No HTTP status check either, so a GitHub 403/5xx read as
      "no update available" — indistinguishable from "up to date". Now: `res.on('error')`, a **5 s**
      timeout that destroys the request, non-2xx → `null`.
- [x] **B1 — `check-update` returned a value its own type forbids.** `resolve({ tag_name: json.tag_name || null })`
      against `Promise<{ tag_name?: string } | null>`, compiling only because `JSON.parse` returns
      `any`. Now Zod-parsed. Confirmed causally: with a typed `json` under `tsc --strict` the same
      line is `TS2322: Type 'string | null' is not assignable to type 'string | undefined'`.
- [x] **B2 — three IPC channels had no `describe` block at all**: `CHECK_UPDATE`, `RESTART_APP`,
      `GET_APP_VERSION`. 13 tests. The electron mock had to grow `app.getVersion`/`app.relaunch` first,
      and `RESTART_APP`'s `setImmediate(() => app.quit())` is flushed inside its own test.
- [x] **C1 — deleted the dead `onEnter` branch.** 11 of `useModalKeyboard`'s 40 lines, zero callers,
      plus the unguarded `e.target as HTMLElement` cast that would throw on a keydown from an SVG
      child. 40 → 27 lines, 279 → 273 tests. **Four files**, not two: the hook, `useModalKeyboard.test.tsx`
      (the option is threaded through three tests *outside* the Enter describe), `PasswordModal.integration.test.tsx`
      (its "can only reach the hook's onEnter" rationale became false), and two `DESIGN.md` lines.
- [x] **C2 — `DeleteConfirmModal.tsx:56`'s `|| 'This action is irreversible.'`** — the P3.27 pattern,
      which had been closed for `ViewDrawer.tsx` only.
- [x] **D1 — `DESIGN.md` reported a closed gap as open in three places**, the worst being a Known-gaps
      row reading *"Live. **Add the mount `focus()` + `window.focus()` the other four have.**"* — a
      remediation instruction for work already done. Corrected, and the rule is now **focus on open**,
      not mount focus: `HomeScreen.tsx:346` renders `{showCreditsModal && …}`, so mount and open
      coincide only by accident of structure and the prop flip is the wider contract. A
      `CreditsModal` focus test was written first (4 tests), because the "already closed" behaviour
      had **no automated guard at all** and the doc edit would otherwise have been unfalsifiable.
- [ ] **A2-deferred — 5 sibling `try/finally`-without-`catch` handlers**: `PasswordModal.tsx:29-38`,
      `HomeScreen.tsx:44-56`, `:79-98`, `:104-127`, `:129-152`. Plus **5 un-awaited call sites** in
      `HomeScreen` (`:59`, `:215`, `:316`, `:284`, `:234`) whose rejections reach the **global** handler —
      a strictly larger exposure than `DeleteConfirmModal`'s own discarded return value. (`:292
      handleDelete` is `async` with no `await`, so it cannot reject.) A separate change with its own review.
- [ ] **13 `CreditsModal` icons have no `aria-hidden`** (`:120`, `:143`, `:189`, `:194`, `:207-208`, `:217`,
      `:226`, `:237`, `:252`, `:256`, `:259`, `:265`, `:274`). **Owner deferred 2026-10-16** — `CreditsModal`
      is the screen most likely to churn under the pending brand work. `grep aria-hidden src/` returns
      5 hits, so "fixed twice already" was true of the sweeps, not of the code.
- [ ] **`ErrorBoundary.tsx:29` discards the `restartApp` promise** — `window.electronAPI.restartApp?.()`
      is neither awaited nor handled. Same shape as A2 and absent from its scope note.
- [ ] **`msg.error_delete` ends in a colon** in both catalogues (`i18n/index.ts:31`, `:114`), so A2's new
      toast renders "Error deleting:". The key is shaped as a prefix for a detail the callers own, and
      they already surface it via `toast.error(tError(result.error))`. Options: a second key (recommended —
      additive), an interpolation with nothing to pass, or change the key and lose the colon at its
      existing prefix-style call sites. **Copy decision, left to the owner.**
- [ ] **`check-update` follows no redirects** (a 3xx from a renamed repo reads as "no information") and
      has **no response size cap** (`data` accumulates without bound; not reachable today, GitHub's
      `/releases/latest` is ~5 KB).
- [ ] **`DESIGN.md:474`** — the "contract to follow when adding a sixth" snippet reads
      `useFocusTrap(modalRef, { isActive: true })`. A sixth modal mounted once and opened by prop needs
      `{ isActive: isOpen }`; the literal `true` teaches the wrong thing, the same mount-vs-open trap D1 fixed.
- [ ] **`DESIGN.md:826`** — "These are live." above the Known-gaps table is now wrong twice: it already
      carried one `**Fixed 2026-10-13**` row and D1 added a second. `DESIGN.md:829` also has a malformed
      `danger.svg` row (4 cells in a 3-column table).

- [x] **DOS-02 — export → import round trip broken above ~5.5 MB — DONE 2026-10-16.** Found while writing
      `docs/DRAWER-CAPACITY.md`, not by reading the code. `importDrawerRaw()` capped the `.clavis` **file** at
      11 000 000 characters while the save path caps **text** at 10 000 000, and `MAX_IMPORT_FILE_SIZE`'s own
      comment claimed it sat "slightly above MAX_DECRYPTED_SIZE to allow JSON overhead" — arithmetic that holds for
      base64 and not for the hex payload `encrypt()` returns (`encryption.ts:122`, 2 chars per byte). Anything over
      **~5.5 MB** exported cleanly and then failed to import, silently. **Owner decision: raise the limit, do not
      change the storage format** — hex→base64 would halve the files but changes the on-disk format of every
      existing drawer, and the content is irreversibly encrypted, so a bad migration means permanent data loss.
      The cap is now **derived** (`MAX_DECRYPTED_SIZE * 2 + 4_096`) so the two constants cannot drift apart again,
      and the misleading comment records the cause. **A second bug hid inside the fix:** the same constant was the
      bound on the *unlock* path, where the quantity is decoded bytes rather than file characters — raising it would
      have left the P0.12 pre-decrypt guard permanently unreachable, a security regression introduced while fixing a
      functional one. That bound moved to `MAX_DECRYPTED_SIZE`, which is **exactly tight** because GCM ciphertext
      equals plaintext length (the tag is returned separately, never concatenated). 4 tests, incl. a real 10 MB
      `createDrawer → saveDrawer → readDrawerRaw → deleteDrawer → importDrawerRaw → unlockDrawer` round trip (1.4 s;
      Argon2id at 2^18 KiB costs ~310 ms here, so nothing had to be faked). The guard test spies on `logger.warn`
      because `unlockDrawer` returns `null` for an oversized payload **and** for garbage alike — asserting `null`
      passed under the mutation and proved nothing. `281/281`.
- [ ] **The unlock guard allocates before it checks.** `Buffer.from(drawer.encryptedData, 'hex')` runs one line
      *before* the size comparison, so a 500 MB `encryptedData` string is fully decoded into a 250 MB buffer before
      anything is refused. `unlockDrawer` also has no cap on the file it reads — `fs.readFile(filePath, 'utf8')`
      parses a JSON file of any size from the data directory first. The guard bounds the key derivation and the
      decrypted output (what P0.12 asked for) but is not a memory guard on the path to it. Allocation-free form:
      check `drawer.encryptedData.length / 2` before decoding. Separate hardening edit with its own edge cases
      (odd-length hex, non-hex input).
- [ ] **Raising the import cap doubles the worst case `importDrawerRaw` will parse**, from ~22 MB to ~40 MB of
      JSON. Still local-only and user-initiated on a file they picked, so practical risk is small — recorded in
      the constant's comment and in `docs/DRAWER-CAPACITY.md` rather than left implicit.

## Storage limits hardening — `PLANO-STORAGE-LIMITS-2026-10-16.md`

Surfaced by researching what keeping the 20 MB import cap exposed. **All fixed in `d2bdb98`.**
> **Reading the entries below:** the `store.ts` / `encryption.ts` line numbers they quote are as of the
> **pre-fix** tree (`d2bdb98~1`), because the fix itself moved them. The narrative of each entry is the
> historical review and is left as written; current locations are in `docs/DRAWER-CAPACITY.md`.
The owner decision on record: **keep 20 MB**. Two hostile reviews have run; the second killed every
load-bearing claim in the first draft, and the corrections are recorded in the plan.

- [x] **SAV-01 — a drawer can be saved and then never opened again. THREE doors, two need no attacker.**
      Implementado em `d2bdb98` (0a): `isCiphertextOverCap()` + rejeição no import (`store.ts:593`).
      Door 1 (save) fechado por `SAV-03` (`encrypt()` guard); Door 2 (import) fechado; Door 3 (migração) fechado (`migrateDrawersFrom` com `stat.size`).
      `unlockDrawer` refuses any drawer whose `encryptedData` decodes above `MAX_DECRYPTED_SIZE`
      (`store.ts:271-278`) and returns `null`, which `ipc-handlers.ts:167-180` reports as
      `DECRYPT_FAILED` → **"Incorrect password or drawer not found"**, *and increments the rate
      limiter* — so retrying walks into the 1s/5s/30s lockout with the correct password.
      - **Door 1 (save):** `SaveDrawerSchema.content.max(10_000_000)` counts **code points** (Zod 4.5.4,
        `util.codePointLength`); the cap counts **UTF-8 bytes**. Worst case 4 bytes per counted unit.
        `store.ts:344` calls `encrypt()` with no byte check and `store.ts:356` writes the result.
      - **Door 2 (import), and the cheapest — NOT in the first draft of the plan:** `importDrawerRaw`
        checks that `encryptedData` *exists* and is a string (`store.ts:419-422`) but **never its
        length**. Verified: 20 002 000 hex chars → file ~20 002 900 (under the 20 004 096 cap) →
        imports → listed under its plaintext title → can never be opened.
      - **Door 3 (legacy migration):** `store.ts:116` `fs.copyFile`s any `*.clavis` from
        `~/.local/share/Clavis/drawers` with no size check, no parse, every startup.
      - **The trigger is any note over 10 000 000 UTF-8 bytes:** `'x'.repeat(9_999_998) + '😀'` =
        9 999 999 code points, **10 000 002 bytes** → schema accepts, unlock refuses. Verified.
        Minimum astral form is 2 500 001 code points. **[corrected]** this line previously read
        "four emoji in a 9.9 MB note" — that is 9 900 016 bytes and is **not** triggered; the
        4-bytes-per-code-point fact had been mis-transcribed into an example. The realistic case
        is not emoji: `'ã'.repeat(10_000_000)` = 10 M code points, 20 MB of UTF-8, also accepted
        then refused — ordinary accented Portuguese bricks.
      - **Corrections to the first draft of the plan, each measured:** (a) `decrypt()` **never runs** —
        `store.ts:278` returns before `:281`, so the byte cap at `encryption.ts:149` is unreachable
        through the application and survives only via a direct unit test; (b) "cannot be backed up"
        is **false** for most of the range — at 10 000 004 bytes the file is 20 000 611 chars, under
        the cap, so export→delete→import **succeeds** and still yields an unopenable drawer.
- [x] **SAV-02 — `unlockDrawer` retorna `{ok,reason}` (`SAV-02`, `store.ts`).** Feito (`d2bdb98`).
      causes return `null` — invalid id (`:231`), read failure (`:238`), parse failure (`:239`), KDF
      out of bounds (`:255`), ciphertext over cap (`:278`), wrong password (`:281`) — and
      `ipc-handlers.ts:167-180` collapses all six into one message *and* one rate-limiter increment.
      A `{ ok: false, reason }` return fixes all six, is smaller than special-casing, and **rescues
      drawers already bricked in the wild** — which no guard can, because the bytes are on disk.
- [x] **SAV-03 — `encrypt()` byte guard + a legible error.** Mirror `decrypt()`'s guard into
      `encrypt()`. **Two traps:** (a) a throw there is swallowed by `saveDrawer`'s `boolean` contract
      (`store.ts:360`) and surfaces as *"Failed to save drawer (invalid ID or password)"* — the
      password again, and not loud; (b) **no existing `ErrorCode` can carry a legible message** —
      `tError` falls back to `error.message` only when the dictionary key is missing, and every
      `error.*` key exists, so `WRITE_FAILED` renders the generic copy and discards the message.
      There is already a dead instance: `ipc-handlers.ts:417` builds a `"File too large."` the user
      never sees. A new `ErrorCode` member is the only route; `tests/errorTranslation.test.tsx:130-141`
      goes red until **both** dictionary entries exist.
      **`tests/encryption.test.ts:61-70` must be rewritten in the same commit** — it calls
      `encrypt()` with an oversized payload at `:65` and will throw once the guard exists.
- [x] **SAV-04 — reject oversized ciphertext at import (`store.ts:419`).** One line, closes door 2.
      `Math.floor(drawer.encryptedData.length / 2) > MAX_DECRYPTED_SIZE`. Sound because
      `Buffer.from(s,'hex').length <= Math.floor(s.length/2)` always holds (Node stops at the first
      invalid pair) and the floor is exact, not rounded. Verified against odd-length, non-hex and astral input.
- [x] **SAV-05 — read guards run after the allocation they exist to prevent.** `unlockDrawer` (`:238`),
      `saveDrawer` (`:323`), `readDrawerRaw` (`:383`, and it crosses IPC into a renderer `Blob`),
      `importDrawerRaw` (read at `ipc-handlers.ts:396`, capped at `store.ts:407` — downstream),
      and **`listDrawers` (`:149-150`), which needs no user gesture**: it reads and parses every
      `*.clavis` on every app open, and `HomeScreen` re-runs it after every save, delete, import and
      back-navigation. `ipc-handlers.ts:385` already holds the `Stats` from `fs.lstat` and **discards
      `stat.size`**. Also: `store.ts:270` allocates the full decoded buffer one line before `:271`
      compares its length, and `encryption.ts:140` decodes the same string a second time — handing
      the buffer over makes the check free and halves the per-unlock allocation.
      **The migration row needs its own fix:** `fs.copyFile` has no read to bound, so it needs a
      `stat.size` check *before the copy*, not a read guard.
      **The test shape matters:** `tests/ipc-handlers.test.ts` mocks `readFile` (`:35-43`) and the whole
      store module (`:14-23`), so nothing today observes read size. A call-shape assertion cannot fail
      on the real defect — make `fs.stat` resolve an over-cap size, make `readFile` **throw if called**,
      and assert the operation refused.
- [x] **SAV-06 — the import-cap coupling. Owner decision: keep 20 MB.** A4, recommended:
      `MAX_IMPORT_FILE_SIZE = Math.min(MAX_DECRYPTED_SIZE * 2 + IMPORT_ENVELOPE_OVERHEAD, ABSOLUTE_IMPORT_CEILING)`
      with `ABSOLUTE_IMPORT_CEILING = 20_004_096`. Keeps the relationship correct **by construction**
      and pins the DoS bound so raising the text limit cannot move it. **No new test needed** — the
      existing round-trip test (`tests/store.test.ts:255-286`) goes red with a real exported file.
      Rejected: **A2** (decouple + invariant test) asserts a *lower bound* while the derivation makes
      the violating case inexpressible, and needs a new export since the constant is module-private;
      **A3** (two values, no test). **Do not "fix" `tests/store.test.ts:270, 303, 305`** — the
      hardcoded `4096` there encodes the coupling as behaviour and is not drift risk.

## Deferred (Post-MVP)

- [x] Auto-updater (electron-updater + GitHub Releases endpoint) — `electron-updater` instalado; `autoUpdater.setFeedURL({ provider: 'github', owner: 'ribaudequin', repo: 'clavis' })` + `checkForUpdatesAndNotify()` no `main/index.ts`; `if (app.isPackaged)` guardado — v0.1+
- [x] Flatpak manifest — `flatpak/com.github.marcelosalvador.Clavis.yaml` atualizado (`Clavis-0.3.1-alpha.AppImage`, E2E referência incluída, `tests/e2e/playwright.config.ts`); build validado (`AppImage` 245M)
- [x] i18n — IMPLEMENTED in v0.3.2-alpha (`05305b3`). See lines 17-19 and `SUMMARY.md`.
- [ ] Icon path standardization (cosmetic cleanup) — maintenance sprint
- [ ] Code signing (EV certs, Apple notarization) — post-v1.0 if needed

## Brand alignment — About / Credits screen (2026-10-12)

Requested as "make the About screen follow the brand rules". Authority: `~/Hermes/Bandua Studio/brand/ABOUT.md`
(§3.1 required elements), with two standing constraints from the owner: **this agent is clavis-only**, and
**an app's colour palette is the app's own** — the Bandua palette never enters product UI.

- [x] **BR-1** Application name shown, as shipped (`clavis`, lowercase) — §3.1. Was absent entirely.
- [x] **BR-2** Version shown, read at runtime — §3.1, §8. `getAppVersion()` was already called on every open and
      the value discarded, so the one thing this screen exists to state was never displayed.
- [x] **BR-3** Version made **independent of the update check** — one effect, `Promise.allSettled`, each request
      called exactly once. A rejected update check must not blank the version; a test pins that.
- [x] **BR-4** Licence shown: `Licença: MIT`, linking to the repository `LICENSE` (verified 200) — §3.1.
- [x] **BR-5** Studio identity line, required by §3.5: `A Bandua Studio app · by Marcelo Salvador`, frame from the
      locale dictionary, `Bandua Studio` / `Marcelo Salvador` identical in both locales and asserted as such.
- [x] **BR-6** Pixel Arc shipped beside it — `icons/svg/bandua.svg`, byte-identical copy of
      `brand/bandua-icon-dark.svg`, `w-8 h-8` (32.00 × 32.00 px measured at dpr 1.25, the §4.4 minimum), 8 px clear space.
- [x] **BR-7** Patreon added to the support links — §4.2 / open decision 1. `icons/svg/patreon.svg` with **no**
      `role` and **no** `<title>`, or the link's accessible name becomes "Patreon Patreon".
- [x] **BR-8** Support links restructured — **regression found in the real AppImage**, not by tests: five chips
      overflowed the `max-w-md` panel, `scrollWidth` 455 vs `clientWidth` 433, SOL 7 px past the edge, producing a
      horizontal scrollbar. jsdom has no layout, so no unit test can see this.
- [x] **BR-8b** Reworked again after the owner's visual review: `flex-wrap` stopped the overflow but left **one chip
      stranded alone on a second line**, which is not an acceptable fix. Now **two CTA buttons on one row** —
      Ko-fi left, Patreon right (`ml-auto`), identical styling so neither channel outranks the other — and the chip
      row reduced to **GitHub · ETH · SOL**. Three chips ≈ 188 px on one line; 433 = 433 in the rebuilt AppImage.
- [x] **BR-8c** `icons/svg/patreon.svg` filled **white**, measured: black is 4.18:1 on the `amber-700` fill but
      **2.96:1 on the `amber-800` hover**, under the 3:1 of WCAG 1.4.11. White gives 5.02:1 / 6.62:1.
- [x] **BR-8d** Ko-fi icon reworked to the white glyph, which **closed** the pre-existing failure the previous pass
      had only diagnosed: the old circular badge's blue cup measured **2.66:1** on its own white disc and its red
      **3.03:1**, both at or under the 3:1 of WCAG 1.4.11. The white glyph gives **5.02:1** on `amber-700` and
      **7.09:1** on hover, and makes both CTAs the same kind of mark.
- [x] **BR-8e** `kofi-dark.svg` / `kofi-light.svg` were **named backwards** — "dark" held white, "light" held black,
      the opposite of `BRAND.md` §4.3 where the suffix names the mark's colour relative to the surface. Contents
      swapped, and the convention written into `DESIGN.md` and `ABOUT.md` after it had already been got wrong once.
- [x] **BR-8f** Both icon glyphs stripped of `role="img"` and `<title>` — the upstream `simple-icons` sources ship
      both, and with them the link's accessible name became "Ko-fi Ko-fi". Negative-controlled: re-adding the
      `<title>` fails two tests.
- [x] **BR-15** Studio X and LinkedIn profiles added (`ABOUT.md` §4.1) — **these were missing and §3.1 never
      required them, which is why they went unnoticed.** They now sit under the identity line in the Credits card,
      not in the chip row: they are the *studio's* channels while that row is the *project's* repository and
      explorers. The chip row also has no room — three chips already use 242px of 351px.
- [x] **BR-16** §3.1 now **requires** both profiles, and `check-about-references.py` enforces them. Writing the
      check exposed that it could not tell a *declared* URL from a *linked* one: `const X_URL = '...'` satisfied
      the substring search even with the `href` hardcoded to somewhere else. Added a usage needle per constant.
- [x] **BR-18b** Credits card reduced to **two centred rows** — the identity line with the Pixel Arc, and the X
      and LinkedIn profiles. Both `Concept, design & development: Marcelo Salvador` and the thanks line removed:
      the role line sat directly above *… · por Marcelo Salvador* and said the same thing twice. Owner call.
      No required element was lost — §3.1 still requires the author, §3.5 still names them. Dead keys
      `label.credits_role` and `msg.thanks_contributors` deleted from both locales rather than left live-looking.
      Measured in the AppImage: both rows centred at x=435, the card's exact centre.
- [x] **BR-19** X label changed from `X` to `@banduastudio`. The logo already *is* the letter, so "X" beside it
      repeated the icon; `x.com` would have named the platform rather than the account, and two accounts share
      that domain. LinkedIn keeps its platform name because its handle is long enough to unbalance a two-link row.
      Both mutations negative-controlled. **Lands after `v0.4.8-beta`, so it ships in the next release.**
- [x] **BR-17** `text-pretty` on the identity line — without it "Marcelo / Salvador" split across lines.
- [x] **BR-18** GitHub mark — **closed 2026-10-13.** The repository chip now uses `github-dark.svg` (black) and the update
      button `github-light.svg` (white), under distinct identifiers, with sizing, spacing and layout untouched.
      The chip goes from **2.76:1** to **21.00:1**; the button from **1.20:1** to **3.30:1** (hover `green-700` 5.02).
      Both were live 1.4.11 failures and only one was ever recorded. `github-dark.svg` also gained a baked
      `fill:#000`, so neither variant can inherit an ancestor `fill`. `github.svg` is now imported by nothing —
      **archived** on the owner's decision, to `icons/archive/github-badge-2ba1fd.svg` (BR-8g).
      **The negative control contradicted the brief, and the correction is the point:** `github-dark.svg` and
      `github-light.svg` carry **identical path data**, so comparing the rendered `d` against the file on disk
      pins *which glyph* sits where (it catches the old blue badge) but **cannot** catch a swapped pair. Verified,
      not assumed: the swap fails the fill test and leaves the geometry test green. Colour placement is pinned by
      the resolved fill alone, and the test says so rather than implying more than it checks.
      A third control stripped `fill:#000` and the test failed on `''` — precisely the inheritance trap.
      The Known-gaps row is **deleted**, not amended. **`173/173`** tests, both typechecks and lint clean.
      **Both marks measured in a locally built AppImage**, by sampling the pixels the packaged app paints —
      chip `#000000` on `#fffdf3` at **20.60:1** and button `#ffffff` on `#16a34a` at **3.30:1**. The chip's
      surface is `bg-amber-50/60` over the white panel, not white, so **2.70:1** is the retired mark's real
      figure there and **2.76:1** is its figure on white; both are now on record.
      **Two imports where there was one shifted every line below them, and the brand checker pins line numbers.**
      `brand/ABOUT.md` §6 listed `CreditsModal.tsx` 232, 233, 237, 238, 246, 250 and the checker reads
      `content[line_no - 1]` literally, so the checker went red on a change lint, typecheck and CI all passed.
      Fixed the way **BR-11** fixed the same trap before: the imports were split onto two lines and §6 plus the
      checker's `INVENTORY` re-synced together to **233, 234, 238, 239, 247, 251**. `ABOUT.md` §10 and §7.1 now
      record the rule, so the next reader knows an edit above line 233 means re-syncing §6 in the same pass.
      **A harness fact worth keeping:** `window.electronAPI` is frozen by `contextBridge` and non-configurable,
      so a renderer-side stub of the update check is impossible — `--host-resolver-rules` does not intercept it
      either, because `checkUpdate` leaves the **main** process through Node's `https.get`, not Chromium's stack.
      Seeing that button in a real build means making the main process believe there is a newer release.
- [x] **BR-8g** `icons/svg/ko-fi.svg` (the old badge) was imported by nothing. **Archived 2026-10-13**, on the owner's
      decision: moved to `icons/archive/ko-fi-badge.svg`. `icons/archive/` is gitignored, so the file leaves the
      repository and stays on disk. **Joined by three orphans nobody had noticed** — `kofi-dark.svg` (the mis-named
      black twin of `kofi-light.svg`), `x-light.svg` and `linkedin-light.svg` (the white marks, with no dark mode in
      the app to sit on). `icons/svg/github.svg` went the same way, to `icons/archive/github-badge-2ba1fd.svg`,
      named for the `#2ba1fd` it carried. **Every file now in `icons/svg/` has exactly one importer**, verified by
      counting them, which turns "is this asset dead?" from a question buried in a design document into something
      `ls` answers. Restorable with `git checkout HEAD -- icons/svg/<name>` if a dark mode ever needs them.
- [x] **BR-9** Contrast measured for all six new text/surface pairs; tightest is the MIT link at **4.62:1** on
      `indigo-50`, identical to the GitHub link beside it. Recorded in `DESIGN.md`.
- [x] **BR-10** `DESIGN.md` updated — the two new brand marks registered, the About card's tinted surface measured,
      and the `flex-wrap` constraint written down with its numbers.
- [x] **BR-11** `band/ABOUT.md` updated — §3.1 gained the studio line, §3.2 got a **scoped exemption** for the
      version check instead of the ban being quietly ignored, §3.7 records palette independence, §6 line numbers
      corrected 176 → 203, §7.1 documents the reference implementation, §10 marks decisions 1 and 3 settled.
- [x] **BR-12b** 2 further tests pin the layout decision (same parent **and that parent is `flex`**; one link per
      channel; chip row is exactly ETH + SOL). Both negative-controlled — and the first versions of them were **too
      weak and had to be rewritten**: one passed with `flex` removed, and one mutation silently failed to apply
      because the search string omitted `className="`, so the green run was reporting nothing.
- [x] **BR-12** `check-about-references.py` gained four checks (§3.1 elements, prose keys in **both** locales,
      Pixel Arc still byte-identical, no brand colour in `src/renderer`). All negative-controlled by hand; one of
      them caught a defect in the checker itself on first run — it looked for prose in the component instead of the
      locale dictionary.
- [x] **BR-13** Re-verify the bandua copy after any change to the brand icons. The checker fails if they drift, but
      the copy has to be refreshed deliberately — `ABOUT.md` §3.5, same rule as `BRAND.md` §4.3's `assets/`.
- [ ] **BR-14** Not done, and deliberately: EPUBShelf and ValidadorPT About screens. Open decisions 2 and 4 in
      `ABOUT.md` §10 stay open — outside this agent's scope.

## Repo hygiene + capacity counter — `HYG-1…HYG-6` (2026-10-17)

Surfaced by reconciling `SUMMARY.md` / `MEMORY.md` / `TODO.md` with `main` after `v0.5.0-beta`.
**HYG-1…HYG-5 closed.** Gates: lint **0 errors / 1 warning** (pre-existing `ipc-handlers.ts:268` `any`),
`typecheck` clean, `typecheck:test` clean, **`316/316`** across 20 files (`303 → 316`).

- [x] **HYG-1 — the three root-level scratch scripts are deleted.** `ciclo-teste.ts`, `contador-validate.ts`,
      `visual-validate.ts` — all three hardcoded `clavis-0.4.9-beta-x64.AppImage` (a path `npm run clean`
      deletes and the current build does not produce), imported `path` unused, sat outside **both** tsconfig
      `include` lists, and carried pt-PT comments. `ciclo-teste.ts` additionally mixed `require()` into ESM and
      read the **legacy** `~/.local/share/clavis` instead of `~/.config/clavis`, and its "confirm the list is
      empty" step was a `waitForTimeout(500)` plus a `console.log` with no assertion. Deleted rather than
      converted: converting a script whose assertions are all no-ops is writing the tests from scratch, and
      `tests/e2e/appimage-validation.spec.ts` already covers the AppImage-launch case.
- [x] **HYG-2 — `test-results/` gitignored and `test-results/.last-run.json` untracked** (kept on disk).
- [x] **HYG-3 — the capacity counter now has 13 tests, and four real defects fixed behind them.** The counter
      had **zero** assertions on its thresholds, its numbers or its copy. Now, in `tests/ViewDrawer.test.tsx`
      (`capacity counter`), plus one wiring guard each in `tests/encryption.test.ts` and
      `tests/validation.test.ts`:
      - **Unit fixed:** counted **grapheme clusters** while comparing them against a Zod `.max()` that counts
        **code points**. Now `[...value].length`. The suite mocks the ceilings as deliberately **unequal**
        (`2_000` cp vs `1_000` bytes) so 90%/100% are reachable as `'x'.repeat(900)` instead of 10 MB
        allocations — and because **equal values make a unit swap invisible**.
      - **Key renamed:** `label.tokens` → `label.characters` (both locales). A token is ~4 characters; a
        grapheme is one; neither is what was being counted.
      - **Copy un-embedded:** `label.at_limit` had `10 000 000` **written into the dictionary string** — a fifth
        copy of the ceiling, in user-facing copy, where no constant can reach it. Both locales now use the
        `{max}` the component was already passing and ignoring.
      - **One literal:** all four sites derive from `src/shared/limits.ts`. The two exports are equal in value
        and **deliberately different in unit** (`MAX_CONTENT_CODE_POINTS` = schema, `MAX_PLAINTEXT_BYTES` =
        `encrypt()`), because that gap **is** SAV-01. `MAX_DECRYPTED_SIZE = MAX_PLAINTEXT_BYTES` keeps the name
        so `store.ts` does not churn. **Merging them would hide the unit.**
      - Two mutations are **provably undetectable** and are not claimed as caught: detaching either site to a
        literal *of the same value* leaves every run green.
- [x] **HYG-4 — per-keystroke work ended.** `Intl.Segmenter().segment()` ran over the whole content string on
      every render of a controlled textarea, feeding the dead `cpPct` and a label. Both counts are now
      `useMemo`'d on `content` and `cpPct` is deleted.
- [x] **HYG-5 — MEMORY.md partitioned.** 3 entries kept per section, the rest moved to `/MEMORY/HISTORY.md`.
- [x] **HYG-6 — the `281/281` figure corrected, not rewritten.** It was recorded as a **delta** ("277 → 281")
      on a total that had itself drifted. `303/303` was the measured figure and is now `316/316`.

### Left open, from the same work

- [ ] **HYG-7 — two mutations are undetectable by construction.** Detaching `MAX_DECRYPTED_SIZE` or the Zod
      `.max()` to a hand-written `10_000_000` leaves every run green, because at equal values the wiring is
      observationally identical. Only a lint rule (ban numeric literals equal to the ceiling in those files)
      would close it. **Decide whether that rule is worth its cost.**
- [ ] **HYG-8 — `[...value].length` allocates an N-element array.** At the worst case the schema admits
      (`'ã'.repeat(10_000_000)`) that is ~10 M short strings on the UI thread, alongside the 10 MB
      `TextEncoder` buffer. Not a regression — `Intl.Segmenter` built an array of segment objects, which is
      worse — but a `for…of` counter allocates nothing. **Not measured.** Decide, do not silently change.
- [x] **HYG-9 — `ipc-handlers.ts:268` classifies a Zod failure by `iss.code === 'too_big' ||
      message.includes('maximum')`.** The code check makes the string sniff redundant, but the new
      `validation.ts` message keeps the word "maximum" so the fallback stays correct — so the coupling is now
      load-bearing across two files. Drop the sniff, or keep it and say why in both.
- [ ] **HYG-10 — the counter shows two equal maxima, and the UI never says which cap refuses the save.** A
      user stopped by the byte cap sees the character counter sitting at exactly its own limit. Correct as
      specified, and `docs/DRAWER-CAPACITY.md` explains it — the screen does not.
- [ ] **HYG-11 — the e2e suite is in no gate.** `tests/e2e` is excluded from both tsconfigs, so the edited
      `appimage-validation.spec.ts` typechecks only under an ad-hoc `tsc` invocation that nothing enforces.
      It also **now fails** against the stale binary on disk, correctly. It was **not run** in this session: a
      real run needs `npm run make`.
- [ ] **HYG-12 — `tests/e2e/clavis.spec.ts` launches `args: ['.']` in 11 places**, and `src/main/index.ts:41`
      hardcodes `localhost:3000`, which this machine's WhatsApp bridge occupies — so on this box the e2e
      suite is testing another process's page. Untouched; pre-existing.
- [x] **HYG-15 — the capacity numbers are now formatted for the active locale.** `String(n)` put
      `10000000` in front of the user in **both** locales. `formatNumber()` was added to `src/i18n/index.ts`
      **beside `detectLocale()`**, not in the component, precisely so it does not become the second locale
      decision the project already has a scar for (`getLocale()` in `ipc-handlers.ts`). Measured on this box:
      pt-PT uses **U+00A0** and groups from 5 digits (`10 000 000`), and writes 4-digit numbers bare
      (`2000`); en uses a comma and groups at 4 (`2,000`, `10,000,000`) — **the two locales disagree at
      4 digits and agree at 7**, which is the pt-PT `minimumGroupingDigits` rule, not a bug.
      Two tests added, and **the first version of the grouping test passed a mutation that removed the
      formatting entirely**, because every value it used (1, 2, 8, 10) is below 1000 where `formatNumber(n)`
      and `String(n)` are the same string. The live counter had to be pushed to 2000 characters before the
      test could see the difference. Now M1 (live count → `String`) fails 1, M2 (byte ceiling → `String`)
      fails 6, M3 (`formatNumber` hardcoded to `'en'`) fails 2. Asserted on raw `textContent`, because
      `getByText`'s normaliser collapses `\s+` and `\s` matches U+00A0 — a normalised assertion pins
      nothing about the separator.
- [x] **HYG-16 — `--user-data-dir` did not isolate a run; the legacy migration ignored it.** Found while
      validating the AppImage. **Fixed** (`770f68e`): the migration is now skipped when
      `app.commandLine.hasSwitch('user-data-dir')`, and the consequence below no longer exists. `store.ts:137` hardcodes
      `OLD_DATA_DIR = path.join(os.homedir(), '.local', 'share', 'Clavis')` and `migrateOldData()`
      (`:175-192`) copies from there into `getDrawersPath()`. **The source is derived from `os.homedir()`
      and has no relationship to `app.getPath('userData')`**, so launching the packaged app with
      `--user-data-dir=/tmp/whatever` starts from an empty profile and then **copies the user's real legacy
      drawers into it** — measured on this box: a "clean" test profile came up holding 10 of the user's
      drawers, including private ones. Consequence: there is no way to run the AppImage against a throwaway
      profile without first moving the real legacy directory aside, which nobody testing this app would
      think to do. The copies are `0o600` and the originals are untouched (verified: real profile still 14
      drawers, 0 created, legacy still 9), so this is a testing-safety hazard rather than data loss.
      **Decide:** honour `--user-data-dir` for the migration source too, gate the migration on an explicit
      opt-out env var, or skip migration entirely when the destination was overridden. Also worth asking why
      `~/.local/share/Clavis` is still populated at all — the migration copies but never removes, so the
      user's drawers now exist in two places indefinitely.
- [x] **HYG-10 + HYG-15b — the character counter is a count again, not a limit.** It was presented
      against the code-point ceiling and escalated colour at 90%/100% exactly like the byte counter,
      which produced a screen that said "half full" beside a full red bar. **The ceiling it was shown
      against can never refuse a save:** every code point costs 1-4 UTF-8 bytes, so `bytes >= codePoints`
      always and `bytes <= 10 000 000` implies `codePoints <= 10 000 000`. The byte cap is provably the
      binding one; the Zod `.max()` is defence-in-depth. So the layout now states only one limit:
      `<chars> · [bar] <pct>% · <bytes> / <ceiling> bytes`, with the risk colour on the byte count and
      the bar alone. `label.characters` lost its `{max}` (asserted absent per locale — a stray placeholder
      is how the misleading layout came back), `label.percent` added, `MAX_CONTENT_CODE_POINTS` no longer
      reaches the view. Percentage rounded **once** and shared by the bar width and the label, after a
      test caught them disagreeing (bar `44.5%`, label `45%`).
      Five negative controls: reintroducing the character ceiling fails 6, colouring the character count
      fails 1, un-rounding the bar width fails 1, `ceil` fails 1 and `floor` fails 1. **`ceil` survived the
      first attempt at that test**, because the only boundary value used was exactly 44.5% where `round`
      and `ceil` agree — the same blindness as the formatting test, one layer up. Now pinned from both
      sides (44.1% and 44.9%).
- [x] **HYG-17 — the Zod branch of the save handler had no coverage at all.** Found by mutating
      `iss.code === 'too_big'` while fixing HYG-9: all 56 tests stayed green. The message
      `Content exceeds the maximum size` is emitted by **two** branches — the `SaveFailureReason` map
      and the Zod ceiling check — and the existing test only exercised the first, so no assertion could
      tell them apart. A new test drives one violation of each kind and asserts the two classifications
      differ; both mutations now fail it.
- [x] **HYG-18 — `package-lock.json` was two releases behind.** Still at `0.4.8-beta` while the manifest
      said `0.5.0-beta`. `npm ci` does not care, but the file should agree with the manifest. Corrected
      in the `v0.5.1-beta` bump, a 2-line diff with no dependency churn.
- [x] **HYG-19 — `CHANGELOG.md` never dated the v0.5.0-beta release.** Its content sat under "Unreleased"
      with the text "landed on main without a release", true when written and false once tagged. The
      section was dated and today's work written up, including the four things deliberately left open.
      Note the release notes on GitHub are generated from commits (`generate_release_notes: true`) and do
      not read this file — it is kept deliberately, not because the pipeline needs it.
- [x] **HYG-14 — blocked by design (decision: user must shrink content to save).** `unlockDrawer` correctly
      refuses them with `too_large` → `CONTENT_TOO_LARGE`, and correctly does **not** count that as a failed
      password attempt, but nothing can open them: there is no re-encrypt, shrink or salvage code in
      `store.ts` (searched). No guard can help bytes already on disk, so this is the one residue of SAV-01
      that is genuinely unfixable by validation. **Decide what the app should *offer* such a user** — a named
      error that explains it is permanent, a path to re-import content from an older backup, or a documented
      "rebuild from backup" instruction. Today it says "too large" and stops.
- [x] **HYG-11 — the e2e suite is in no gate — CLOSED 2026-10-18.** It was never in one:
      `git log --all -S "playwright" -- .github/` is **empty** — no workflow, any commit, any branch.
      **Job graph is now `quality` → `e2e` → `build` → `release`.** The `e2e` job runs **on every push
      and pull request**, which is why it is its own job and not a step in `build`: `build`'s `if:` is
      `startsWith(github.ref, 'refs/tags/v') || github.ref == 'refs/heads/test/downgrade-forge-6.4.2'`,
      so it never runs on a PR at all. `electron-forge package` instead of `npm run make` (~9s, no
      squashfs or deb), `xvfb-run -a`, no Playwright browser download (`_electron` drives the app's own
      Chromium), `timeout-minutes: 20`. `build` additionally runs the suite **against the AppImage after
      `npm run make` and before `upload-artifact`** (`APPIMAGE_EXTRACT_AND_RUN=1`, xvfb added to its
      Linux tool install), so "the released binary passed the flow" is structural — `release` needs
      `build`. `build` also gained `timeout-minutes: 45`: a hung Electron burns the 6-hour default with
      the release blocked behind it.
      **`language: [en, pt]` matrix, added because the pt leg was never running.** Every selector in the
      suite is a two-locale pattern, but GitHub runners set no `LANGUAGE`, so CI would have exercised
      only the English half — a one-sided reword of a pt-PT string would ship green. Chromium honours
      `LANGUAGE`, not `LANG`/`LC_ALL` (measured: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` still rendered
      pt-PT; `LANGUAGE=en` switched it). The matrix **found a real spec bug on its first run** — 4
      failures, see HYG-20. Running both locales locally before adding the leg was the point: a gate
      that has never been run is worse than no gate.
      `playwright.config.ts` also gained `timeout: 120_000`. The 30s default is a **whole-test** budget
      that the per-expectation `{ timeout: 15000 }` values draw from rather than add to, and argon2id at
      2^18 KiB (256 MiB) per unlock makes the round trip ~10s on 8 cores and several times that on a
      2-vCPU runner. This is the setting that stops the first red run from being the runner.
- [x] **HYG-20 — `tests/e2e/clavis.spec.ts` (10 tests) had never run and was stale — CLOSED 2026-10-18.**
      **The root cause was not stale selectors, and fixing selectors would not have fixed it.** Measured
      before changing anything: `electron.launch({ args: ['.'] })` renders Chromium's `Cannot GET /`,
      title "Error", zero `#root`. `main/index.ts:41` calls `loadURL('http://localhost:3000')` when
      `app.isPackaged` is false, and **no npm script starts that server** (`build:renderer` is
      `vite build`). All ten tests died at their first locator. Owner decision: point the spec at the
      **packaged build** rather than resurrect a source launch.
      **Three of the ten tests encoded things that were not true.** `Ctrl+N creates drawer` asserted a
      shortcut that does not exist — `grep -rn "ctrlKey\|metaKey\|globalShortcut" src/` returns only
      `ViewDrawer.tsx:103` (Ctrl+S) and `useModalKeyboard.ts:17` (Escape), so **P1.7 below is wrong
      about Ctrl+N**; deleted rather than implemented. Three tests "tested" import by clicking the
      button and asserting the word "Clavis" was still on screen — true before, after and on failure;
      replaced by one export → delete → import → unlock round trip. The create modal **has no content
      field**, which two of them filled.
      **The dangerous file was a different one.** `appimage-validation.spec.ts` launched with
      `args: [appImage]` and **no `--user-data-dir`** — the suite believed to be green was reading the
      developer's real drawers. Isolation is now asserted in `tests/e2e/launch.ts` (compares
      `app.getPath('userData')` to the temp dir and throws before any test runs), negative-controlled by
      removing the switch: the suite goes red with a refusal rather than proceeding.
      **10 real tests now** (8 rewritten + "discard and leave", which had no e2e coverage at all — the
      destructive button in the unsaved-changes modal). New `launch.ts` and `artifact.ts` (renamed from
      `appimage.ts`); `appimage-validation.spec.ts` → `artifact-launch.spec.ts`, since it does not
      always test an AppImage.
      **Verified in three configurations, not one:** AppImage 10/10, packaged + `LANGUAGE=en` 10/10,
      packaged + `LANGUAGE=pt` 10/10. The Portuguese leg found a bug the English leg could not: four
      tests asserted `getByRole('list')` in the state where `HomeScreen` renders a call to action
      instead of a `<ul role="list">` (`HomeScreen.tsx:254-267`).
- [x] **HYG-21 — assertions that no longer assert — CLOSED 2026-10-19 (sub-items 1, 2 and 4; 3 closed 2026-10-18).**
      **(1)** `tests/store-limit.allocation.test.ts` rewritten. The two `@ts-ignore` are gone, and the
      allocation claim is now observable: `vi.spyOn(String.prototype, Symbol.iterator)` stays at
      **zero calls** for the astral string and for the 10 M ceiling, while `[...value].length` calls it
      **once**. Negative control: reverting `countCodePoints` to the spread form fails **3** tests.
      The vacuous `TextEncoder` test became an explicit "accepted cost" test instead of pretending to
      assert storage.
      **(4)** `tests/ViewDrawer.test.tsx` no longer reimplements `countCodePoints` in the mock factory:
      it spreads the real module via `importOriginal` and overrides only the two ceilings. A new test
      imports the actual module and asserts the iterator is never touched. Negative control: the spread
      mutation fails the new test.
      **(2)** `tests/sec01-kdf-metadata.test.ts` rewritten — and writing it honestly **reopened SEC-01**.
      The metadata half worked (`store.ts` wrote `encrypted.algorithm`), but `deriveKey()` never
      received it: it chose the backend from runtime availability. Measured: a hand-built scrypt
      drawer with the correct password returned `wrong_password` on this argon2 build. The scrypt
      fallback was also broken at the default cost — `2^18` KiB maps to `N = 2^16`, needing 64 MiB
      against Node's 32 MiB default `maxmem`, so `createDrawer` threw
      `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` on any build without argon2.
      **Owner decision: honour the recorded backend.** `KDFParams` gained `algorithm`; `deriveKey()`
      uses it and throws `KdfBackendUnavailableError` when `argon2id` is requested but absent;
      `store.ts` passes the stored value on unlock **and** on save, and rewrites the label from the
      backend that actually re-encrypted; scrypt now gets an explicit `maxmem`. New
      `ErrorCode.KDF_UNAVAILABLE` (pt/en) so a correct password is no longer reported as wrong. Legacy
      files without `algorithm` keep the old availability behaviour.
      **Regression proof:** four tests in the file, including a fixture built with **`crypto.scrypt`
      directly** and a reference-key equality check. That fixture is load-bearing: an earlier version
      built the drawer with `encrypt()`, and the "ignore `algorithm`" mutation left the suite **5/5
      green**, because both sides then used the same wrong KDF and agreed with each other. Mutation
      controls now fail as intended: ignore `algorithm` → 3 red; remove `maxmem` → 1 red; re-encrypt
      with defaults on save → 1 red.
      Gates: **386/386** vitest across 40 files · lint 0 errors / 2 pre-existing warnings · both
      typechecks 0 · `build` OK · e2e **10/10** against a freshly packaged build. `SECURITY.md`
      corrected: it previously claimed decryption used the recorded backend, which was false until now.
- [x] **HYG-22 — SEC-03 never landed, in either half — CLOSED 2026-10-18.** See
      `PLANO-PASSWORD-POLICY-2026-10-18.md`. All three defects fixed, plus two found on the way.
      **(a) One policy, one module.** New `src/main/password-policy.ts` owns the constant, the four
      character classes, `isPasswordCompliant` and `describePasswordPolicy`; `store.ts`'s private copy
      is deleted, and both `.min(8)` in `validation.ts` are gone. The policy is a `refine`, not a
      `.min()/.regex` chain, so a violation arrives as **one** Zod issue on `password` that can be
      classified by path. **`SaveDrawerSchema` and `UnlockDrawerSchema` deliberately keep sanity bounds
      only** — the reason is in a code comment and it is not negotiable: there is no change-password
      channel in `CHANNELS`, so a save can only re-use the password that already opens the drawer, and
      enforcing it on save re-opens SEC-02. A regression test writes a hand-made legacy 8-character
      `.clavis` and saves it.
      **(b) No message sniffing left anywhere in `src/main`** (`grep -e.message.includes` → empty). The
      create path classifies by `issue.path` + `issue.code`; a weak password reaches the renderer as
      `ErrorCode.PASSWORD_TOO_SHORT`, which it did not before — it used to fall through to the generic
      `VALIDATION_ERROR`. `password_too_weak` removed from `SaveFailureReason` and `SAVE_ERRORS` as
      unreachable (closes the matching HYG-21 sub-item), and the test that pinned the coupling by
      comparing two hardcoded copies of the message is replaced by one that rewrites the message and
      asserts the classification survives.
      **(c) `atomicWrite` no longer unlinks the live file.** `.prev` eliminated by owner decision — it
      was read by nothing in `src/`, `tests/` or `docs/`. One `rename(tmp, filePath)` replaces the live
      inode, so the path is never absent; the temp file is removed if the rename fails, and the
      **directory** is fsynced after the rename (without that the rename itself is not durable, which
      would make the staging cosmetic). Windows cannot fsync a directory; the refusal is swallowed
      deliberately, because propagating it would report a landed save as failed.
      **Two defects found while fixing these, both by the sub-agents:** the staging filename was built
      from `Date.now()`, so two writes in the same millisecond shared one temp file and could rename a
      half-written file over the good one — the corruption the function exists to prevent,
      reintroduced through its own staging step (now `crypto.randomUUID()`). And the import handler
      caught `FileTooLargeError` / `DrawerAlreadyExistsError` **by message text** even though the store
      re-threw them by type with the comment "Propagate to ipc-handlers for explicit message" — the same
      defect class, left standing in the file this work was cleaning.
- [x] **HYG-13 — absolute boundary (`10_000_000`) in `tests/encryption.test.ts`** — DONE (2026-10-17)
- [ ] **HYG-13b — the byte-cap boundaries are still asserted only *relative to* the constant.**
- [x] **HYG-25 — the shipped asar contained the whole project directory — CLOSED 2026-10-18.**
      Found by extracting `app.asar` out of the locally built AppImage to verify the HYG-22 fixes
      were really in the binary. They were — and so was everything else. `packagerConfig` had **no
      file filter**, so `electron-packager` copied everything not on its built-in ignore list. Inside
      a 160 MB asar: **119 MB of `/repo/**`** (output of a local `flatpak-make`, gitignored, 74% of
      the archive), the full TypeScript source, the whole test suite, `docs/`, `scripts/`, and
      **7.3 MB of gitignored internal notes** — `MEMORY.md`, `SUMMARY.md`, `TODO.md`, `PLANO-*.md`,
      `AGENTS.md` — inside a public binary, including the owner's name and location.
      **This also corrects a claim this file carried:** the local-vs-CI AppImage size gap (253 MB vs
      124 MB) was recorded as `mksquashfs` compression. It was not — the CI artifact is built from a
      clean checkout and never contained `repo/`.
      **The filter is a whitelist, not a deny-list**, which is the only shape that cannot drift:
      `^\/(?!dist($|\/)|node_modules($|\/)|package\.json$|icons($|\/)).+`. Verified: the
      repackaged asar's top level is exactly `dist`, `icons`, `node_modules`, `package.json`, with
      `dist/main/index.js`, `dist/main/preload.js`, `dist/renderer/index.html` and the unpacked
      `argon2` all present, and e2e 10/10 in both locales against it.
      **The first attempt silently did nothing, and that is the transferable part:** the obvious fix
      is a `files` key, but `@electron/packager` has no such option — the filter is `ignore`, and
      its entries must be **bare regex sources**, not `/.../ ` literals, because the packager calls
      `file.match(entry)` and the delimiters become part of the pattern.
- [ ] **HYG-23 — `detectLocale()`'s `if (process.env.CI) return 'en'` is dead code in every packaged
      build.** Vite rewrites `process.env` to `{}`, so the shipped bundle reads
      `function f(){return {}.CI?\`en\`:d(navigator.language||\`en\`)}` — a constant `undefined`. It
      stabilises `tests/i18n.test.ts` and nothing else. Harmless today (the product is meant to follow
      the system language) but it reads like a CI override, and an e2e comment here once claimed
      `CI=1` pinned the packaged UI to English when it does nothing. **Decide:** delete the branch, or
      accept it as test-only and say so where it is written.
- [ ] **HYG-24 — `HomeScreen.tsx:92` revokes the export blob synchronously right after `a.click()`.**
      It works because the download starts in the same task, which is a race the platform has not lost
      yet. The e2e round trip exercises it, but only through the artificial `setSavePath` path that pins
      the transfer, so a Chromium bump turning the race real would surface as a download timeout
      pointing at the test harness rather than at this line. Move the revoke into the download's
      completion, or document why it is safe.
- [x] **HYG-26 — CI still declared Node 20-era action runtimes — CLOSED 2026-10-19.** GitHub retired
      the Node 20 action runtime on 2026-09-23; every run now emits a deprecation annotation for
      `actions/checkout@v4` and `actions/setup-node@v4`. Bumped to the Node 24 majors —
      `checkout@v5`, `setup-node@v5`, `upload-artifact@v6`, `download-artifact@v7`,
      `softprops/action-gh-release@v3` (each verified to declare `using: node24`) — and the CI
      `node-version` from 22 to 24, which is what the dev machine already runs (v24.21.0) with
      lint/typecheck/400 tests/build/package/e2e green. **History corrected:** this project never used
      Node 24 in CI; the workflow started at 20 and was bumped 20→22 on 2026-09-03 because Electron 44
      requires ≥22.12. The security-motivated downgrade here was `@electron-forge` 7.11.2→6.4.2, not
      Node. `README.md`, `BUILD_MANUAL.md` and `docs/clavis-ci-cd-setup.md` synced. Verified locally:
      YAML parses, all 5 action tags resolve remotely, zero stale `@v2`/`@v4` refs. Not yet exercised
      on GitHub — the first push is the real gate.
- [ ] **e2e does not run on Windows or macOS.** The gate is Linux-only (`xvfb` + AppImage), and
      `artifact.ts` knows how to locate the win32/darwin packager output, so the suite could run on all
      three — at the cost of minutes per push and the Windows focus quirks this app has already been
      bitten by. Not decided; recorded so the omission is a choice rather than an oversight. Every
      boundary test builds its input as `'x'.repeat(MAX_DECRYPTED_SIZE + 1)`, so retargeting the constant
      keeps them green. One absolute guard was added to `encryption.test.ts`; the rest are still relative.


## Progress
- **Next session's priority (2026-10-19): the rest of REL-02 — a cancellable, counted unlock wait (`PLANO-REL-02-CANCELABLE-UNLOCK-2026-10-19.md`).**
  REL-02 shipped in `v0.6.7-beta` (tag run `39304464489`, **7 jobs green**, 6 artifacts) **as a safety net**, because the state it protects against is not reachable in the current interface: while the unlock runs the input is `disabled`, the focus moves to `<body>`, and the Escape listener is on the modal **container** — so the prompt cannot be closed and the counter has nothing to invalidate. **The plan closes that**, and in doing so makes the shipped fix load-bearing instead of a safety net.
  **Owner decisions, already taken (2026-10-19), so the next session starts with them and not with questions:** cancelling is a **renderer-only** affair (the main process finishes its wait and its derivation; the result is discarded — no new IPC to abort it), the user cancels with **both** the Cancel button and Escape, and the **remaining seconds are shown**.
  **The shape of the work:** a new read-only `GET_UNLOCK_DELAY` channel, so the countdown reads the delay from **the same function the unlock path uses** (a ladder re-implemented in the renderer is a countdown that lies); the modal asks for it before submitting and starts the countdown; the Cancel button stops being disabled during the wait; the focus moves to that button, because **the focus is the whole problem** — a keydown on `<body>` never reaches the container's listener; the existing REL-02 e2e then uses a **real Escape** instead of the synthetic dispatch, and its header has to be rewritten accordingly.
  **The gates for it:** lint · both typechecks · vitest · build · package · the e2e suite against `out/clavis-linux-x64` **and** the AppImage, in both locales, with the new spec repeated to show it does not flake. The REL-02 e2e arms the rate limiter (~7 s), so the suite grows by roughly half a minute per leg.
- **Previous (2026-10-19, v0.6.7-beta released) — REL-02 shipped, and the measurement behind it says the interface cannot reach the state it protects against.**
  `main` pushed alone first (run `39303981628`: `quality` + both `e2e` legs green, `build`/`release` skipped), then tagged
  `v0.6.7-beta` (run `39304464489`: **7 jobs green**, 6 artifacts). `/releases/latest` answers `v0.6.7-beta`, `prerelease: false`.
  The fix is the attempt counter in `src/renderer/pages/HomeScreen.tsx`: the cancel side invalidates the attempt and the stale
  result is dropped, on the success path and on all three failure paths. 6 unit tests, 2 e2e tests against the packaged binary.
  **The finding that matters more than the fix:** the audit's premise was wrong. While the unlock runs the password input is
  `disabled`, the focus moves to `<body>`, and the Escape listener is on the modal **container** — so a real keypress cannot
  dismiss the prompt, and no user can reach the state REL-02 is about. Measured in the packaged app: `{"activeTag":"BODY",
  "inputDisabled":true,"focusInsideModal":false}`, and an Escape press left the dialog on screen. **So the fix ships as a safety
  net, and the real consequence is filed as UX-08:** under the rate limiter (3 → 1 s, 5 → 5 s, 10 → 30 s, per drawer) the prompt
  is frozen for up to 30 s with no way out. **How likely, measured:** the 30 s tier needs 10 consecutive wrong passwords on the
  same drawer — a path that already costs ~37 s of the user's own time — and the user who actually suffers is the one who
  *knows* the password and just failed 10 times for another reason (caps lock, layout, autofill). Rare, but expensive when it
  happens; the common tiers (1 s at 3 attempts, 5 s at 5) are tolerable. **Owner decision:** ship REL-02 as the safety net, open
  UX-08 with the analysis, decide the countdown and the cancellable wait separately.
- **Previous (2026-10-19, v0.6.6-beta released) — SEC-09 shipped: the app takes a single-instance lock.**
  `main` pushed alone first (run `39292417218` — **it failed**, see below), then the fix (`9a4f4ab`, run `39293681716`:
  `quality` + both `e2e` legs green, `build`/`release` skipped), then tagged `v0.6.6-beta` (run `39294150563`: **7 jobs
  green**, 6 artifacts). `/releases/latest` answers `v0.6.6-beta`, `prerelease: false`. The only annotations left are the
  two pre-existing lint warnings and GitHub's `ubuntu-latest` → Ubuntu 26 migration notice.
  **The failed run was worth having.** The two new e2e tests died of `SIGTRAP` before ever reaching the lock: the spawned
  second instance was not launched the way Playwright launches the first one, so on the CI runner (whose AppArmor policy
  refuses unprivileged user namespaces) Chromium insisted on the SUID sandbox, found `chrome-sandbox` owned by the runner
  user with mode 755 instead of 4755, and aborted. **The lock was never the problem, and the ten pre-existing e2e tests
  passed** — that asymmetry is what identified it as the new test's problem. Reproduced locally with `unshare --user`
  before changing anything, then fixed by passing `--no-sandbox`, exactly where Playwright puts it. **A suite that only ever
  runs where it was developed is a suite that has not been tested.**
- **Previous (2026-10-19) — SEC-09 is coded and proven end to end; it needs a release.**
  The single-instance lock is requested at module scope in `src/main/index.ts` (before `app.whenReady()`, so the loser never
  creates a window, never registers the IPC handlers and never touches the store), the decision lives in
  `src/main/single-instance.ts`, and there are two proof layers: 9 unit tests (`tests/single-instance.test.ts`) and 2
  end-to-end tests (`tests/e2e/single-instance.spec.ts`) against the **packaged** artifact.
  **The e2e proof is the interesting part.** The second instance is a plain `child_process.spawn` — Playwright's
  `_electron.launch` cannot be used, because it waits for a window and the whole point of the refusal is that there is none.
  It must share the first instance's `--user-data-dir`, because that is where Chromium's `SingletonLock` lives, and it must
  exit **0** by itself while the primary keeps answering. The second test is the negative control: the same spawn on a
  private profile must **not** exit, which is what stops the first test from passing for a broken spawn or a crash.
  **Four mutations, all measured** (the artifact was repackaged for each — `npm run build:main` alone is invisible to the
  e2e suite, the code lives in the asar): removing the lock call and removing `app.quit()` from the losing branch each break
  the first test on a 30s timeout; making the loser still reach `whenReady()` breaks it on the startup-line count; and **a lock
  taken on a machine-wide path instead of the profile's leaves the first test GREEN and breaks only the control** — the
  control is not redundant.
  **Gates:** lint 0 errors / 2 pre-existing warnings · both typechecks 0 · **409/409** vitest across 42 files · e2e **12/12**
  against `out/clavis-linux-x64` (10 existing + 2 new) and **20/20** for the new spec over 10 repeats, no flake.
  **Not verified:** the Windows/macOS lock semantics (the lock is Chromium's `ProcessSingleton`, which differs per platform).
  **The AppImage was built afterwards and is now the artifact that was measured:** `npm run make` → `clavis-0.6.6-beta-x64.AppImage`
  (136 MB), e2e **12/12** in both locales against it, and the asar inside carries the lock with the package whitelist still
  holding (`/dist`, `/icons`, `/node_modules`, `/package.json` only). The AppImage is not a cosmetic variant: it takes a
  different spawn shape — its own path must also be `argv[1]` — so it exercises a path the packager output never touches.
- **Previous (2026-10-19, v0.6.5-beta released) — SEC-05/SEC-07 shipped, and CI runs on the Node 24 action runtime.**
  `main` pushed alone first (run `39256677933`: `quality` + both `e2e` legs green, `build`/`release`
  skipped), then tagged (run `39257105778`: **7 jobs green**, 6 artifacts). `/releases/latest`
  answers `v0.6.5-beta`, `prerelease: false`. The Node 20 deprecation annotation is gone; the only
  annotations left are the two pre-existing lint warnings and GitHub's `ubuntu-latest` → Ubuntu 26
  migration notice. Action bumps: `checkout@v5`, `setup-node@v5`, `upload-artifact@v6`,
  `download-artifact@v7`, `action-gh-release@v3`; CI `node-version` 22→24.
- **Previous (2026-10-19, SEC-05/SEC-07) — metadata is validated at import, list and unlock, and corrupt metadata no longer counts as a password guess.** `EncryptedDrawerSchema` now enforces the crypto field widths (`salt`/`iv`/`authTag` = 32 hex chars, `encryptedData` even-length hex, empty allowed) and bounds `iconData` to a JSON array of ≤64 strings; `keyDerivation.algorithm` became optional so legacy drawers still validate. `listDrawers()` skips invalid files and files whose internal id disagrees with the filename; `unlockDrawer()` returns the new `corrupt_metadata` (`INVALID_JSON`, never rate-limited) before touching any crypto field. `decrypt()` now zeroes the derived key when `createDecipheriv`/`setAuthTag` throw. `importDrawerRaw()` keeps returning false for malformed metadata and now accepts an empty ciphertext, which is what an empty drawer actually stores.
  **Tests:** new `tests/sec05-sec07-metadata.test.ts` (12 tests: 2-byte IV, odd-length ciphertext, uppercase/empty acceptance, object title, 1M-entry iconData, filename/id mismatch, corrupt metadata reasons) and 2 IPC tests (INVALID_JSON mapping; 8 corrupt attempts never park on a limiter timer). One existing store fixture was moved from invalid placeholders (`'s'`, `'i'`, `'a'`, `'e'`) to valid hex so it still tests KDF bounds instead of schema rejection.
  **Gates:** lint 0 errors / 2 pre-existing warnings · both typechecks 0 · **400/400** vitest across 41 files · `build` OK · e2e **10/10** against the packaged build (`npm run package` → `out/clavis-linux-x64`).
- **Previous (2026-10-19, release) — v0.6.4-beta: SEC-01 was only half-fixed, and writing the
  test that was supposed to prove it is what exposed that. HYG-21 sub-items 1, 2 and 4 closed too.**
  **The recorded backend was written and never read.** `store.ts` put `keyDerivation.algorithm` in
  every drawer; `decrypt()` chose a backend from runtime availability instead. Measured, not
  inferred: a hand-built scrypt drawer with the correct password returned `{ ok: false, reason:
  'wrong_password' }` on an argon2 build. Owner decision: honour the stored backend. `KDFParams`
  gained `algorithm`, `deriveKey()` uses it and throws `KdfBackendUnavailableError` when `argon2id`
  is requested but absent, `store.ts` forwards it on unlock and re-encrypts with it on save (and
  rewrites the label), and scrypt now gets an explicit `maxmem`. New `ErrorCode.KDF_UNAVAILABLE`
  (pt/en) so a correct password is never reported as wrong.
  **The scrypt fallback had a second defect:** `2^18 KiB` maps to `N = 2^16`, needing 64 MiB against
  Node's 32 MiB default `maxmem`, so a build without argon2 could not create a drawer at all.
  **The lesson, ninth time: a green mutation is not a control.** The first cross-backend fixture
  built the scrypt drawer with `encrypt()`; mutating `deriveKey` to ignore `algorithm` left the file
  **5/5 green**, because both sides then used the same wrong KDF and agreed with each other. Rebuilt
  with `crypto.scrypt` directly and a reference-key equality check, the mutation fails **3** tests.
  Also measured: `vi.mock('argon2')` does **not** intercept the `require('argon2')` in
  `encryption.ts`, so the absent-backend path is covered through the typed error and the
  `KDF_UNAVAILABLE` mapping rather than by simulating absence.
  **Gates:** lint 0 errors / 2 pre-existing warnings, both typechecks 0, **386/386** across 40 files,
  build OK, e2e **10/10** in both locales against the locally built AppImage.
  **Released.** `main` pushed alone first (run `39239211155` — `quality` + both `e2e` legs green,
  `build`/`release` skipped), then the tag (run `39239619463` — **7 jobs green**, 6 artifacts).
  `v0.6.4-beta` carries the `Latest` badge, `prerelease: false`, and `/releases/latest` answers it.
  The artifact was checked before tagging: the asar contains the fix's symbols and still only
  `dist/`, `icons/`, `node_modules/`, `package.json`.

- **Previous focus (2026-10-18, release) — v0.6.3-beta: `beta` stops being a prerelease, and the
  shipped app stops containing the project directory. HYG-25 closed too.**
  **The user's report was the whole brief, and it was exactly right.** "A última foi a v0.5.1-beta"
  was not a memory lapse: `/releases/latest` really did still answer `v0.5.1-beta`, because
  `v0.6.0-beta`, `v0.6.1-beta` and `v0.6.2-beta` had all been published as **pre-releases** — and the
  app's update check reads that endpoint. Three releases existed; none was "latest"; every user was
  told they were current. Owner decision: `beta` is a normal release now, `alpha`/`pre` stay
  pre-releases. The workflow carries a comment saying why, because the flag is derived from the tag
  name and that derivation is invisible from the release page.
  **HYG-25 came out of doing what was asked, not out of planning.** Creating the local AppImage to
  test meant extracting `app.asar` to confirm the HYG-22 fixes were in the binary — they were, and
  so was everything else: the source, the tests, and a **119 MB `repo/`** from a local
  `flatpak-make`, 74% of the asar, plus 7.3 MB of gitignored internal notes in a public binary. The
  fix is a single-whitelist `ignore` regex, so a new project directory cannot silently ship.
  **The first attempt at that fix did nothing at all** — `@electron/packager` has no `files` option
  and `ignore` entries must be bare regex sources — and finding that out required repackaging and
  inspecting, not reading the docs.
  **Gates:** lint 0 errors / 2 pre-existing warnings, both typechecks 0, **379/379** across 40 files,
  e2e 10/10 in both locales against the repackaged app and the AppImage.
  **Released.** `main` pushed alone first (run `39156850554` — `quality` + both `e2e` legs green,
  `build`/`release` skipped), then the tag (run `39157060048` — **7 jobs green**, 6 artifacts).
  The release page is the proof that mattered: **`v0.6.3-beta` carries the `Latest` badge,
  `prerelease: false`, and `/releases/latest` answers it** — where it answered `v0.5.1-beta` before.
  That endpoint is the app's entire input for "is there a new version", so this is the part a user
  can see.

- **Previous focus (2026-10-18, end of day) — HYG-22 closed: one password policy, no message sniffing
  anywhere, and an `atomicWrite` that never unlinks the live drawer. Two sub-agents in parallel with
  explicit file boundaries, because both owned one region of `src/main/store.ts`.**
  **The design was forced by a fact, not a preference: `CHANNELS` has no change-password member.** A save
  can therefore only re-use a password that already opens the drawer, so the strong policy is a
  **create-time** rule and `SaveDrawerSchema` had to keep sanity bounds. Putting it on save re-opens
  SEC-02. A regression test writes a hand-made legacy 8-character `.clavis` and saves it, because the
  reason is otherwise invisible to the next reader.
  **A weak password now reaches the renderer as `ErrorCode.PASSWORD_TOO_SHORT`.** Before this it fell
  through to the generic `VALIDATION_ERROR`, because the only thing that recognised it was a substring
  match against a message thrown by the store. Two more sniffs of the same kind were standing in the
  import handler — and the store re-threw those errors **by type** with the comment "Propagate to
  ipc-handlers for explicit message", so the type was provided and ignored. `grep e.message.includes
  src/main` is now empty, which is an invariant worth keeping rather than a coincidence.
  **The sub-agent found a corruption bug in the function I was fixing:** the staging filename was
  `Date.now()`, so two writes in one millisecond shared a temp file and could rename a half-written file
  over the good one. Now `crypto.randomUUID()`.
  **The project's lesson arrived an eighth time, to me.** A test I wrote for that collision — two
  concurrent `saveDrawer` calls with the clock frozen — **passed with the bug present**. Two argon2id
  derivations ahead of the write take ~300ms each and finish far enough apart that the write/rename
  sections never interleave, and sequential writes cannot collide even with a shared name. It is
  rewritten to observe the staging paths instead of racing them, and now fails with `expected 1 to be 2`
  when `Date.now()` goes back. **A test that passes for a timing reason is a test that cannot fail.**
  **My own change broke two tests before I noticed**, which is the other half of the lesson: converting
  the import sniffs to `instanceof` made the `vi.mock` factory in `tests/ipc-handlers.test.ts` incomplete,
  and `instanceof undefined` throws inside the catch block. Fixed by spreading the real module in the
  mock, which also makes the assertion non-tautological — a mock defining its own error classes would
  have the handler and the test comparing the same fake against itself.
  Gates: lint 0 errors / 2 pre-existing warnings, both typechecks 0, **379/379** across 40 files (was
  348/39), e2e **10/10** under `LANGUAGE=en` and **10/10** under `LANGUAGE=pt`, both against a freshly
  built package. Negative controls re-run by me rather than taken on the sub-agents' word: schema relaxed
  to `.min(8)` → **8 failures**; import sniffs restored → **2 failures**; `Date.now()` staging name →
  **1 failure**.
  **Not committed and not released** — `CHANGELOG.md` has no v0.6.3-beta section yet, and this is the
  first round in a while that changes shipped behaviour rather than tests.

- **Previous focus (2026-10-18) — HYG-20 + HYG-11 closed: the e2e suite runs, and it is a gate.
  Owner decisions: point the stale spec at the packaged build rather than resurrect a source launch;
  delete the phantom Ctrl+N test rather than implement the shortcut.**
  **HYG-20's cause was not the stale selectors.** `electron.launch({ args: ['.'] })` cannot render the
  app at all — `main/index.ts:41` does `loadURL('http://localhost:3000')` when unpackaged, and no npm
  script starts that server. Measured first: `Cannot GET /`, title "Error", zero `#root`. All ten tests
  died at their first locator; three of them also asserted behaviour that does not exist (`Ctrl+N`), or
  asserted nothing at all (three "import" tests that only checked the word "Clavis" was on screen).
  **The file nobody suspected was the dangerous one:** `appimage-validation.spec.ts` had no
  `--user-data-dir` and was reading the developer's real drawers while reported as green. Isolation is
  now asserted in `launch.ts`, negative-controlled by removing the switch.
  **A hostile review of the finished work caught more than the green run did — including two of my own
  comments being false.** `UI.back` was unanchored and in pt-PT matched the save button too ("Guardar e
  voltar" also ends in "voltar"), masked by `.first()`; the "Escape cancels the delete" test asserted
  `getByRole('list')` on a screen with no list, so it passed on a blank window; the focus-trap test
  passed whether or not `useFocusTrap` existed, because the modal focuses Cancel from its own effect —
  it now Tabs past the last button first. My claims about a single-instance lock and about
  `artifact.ts`'s preference order were both wrong and are corrected.
  **The `language: [en, pt]` matrix found a real bug on its first run:** 4 tests asserted
  `getByRole('list')` where `HomeScreen` renders the empty-state call to action instead. All 10 had
  passed in English. **A control at the product level, not just on the tests:** deleting the Ctrl+S
  branch from `ViewDrawer.tsx`, rebuilding and repackaging turned that test red; restoring it turned it
  green. Gates: lint 0 errors / 2 pre-existing warnings, both typechecks 0, **348/348**, e2e **10/10**
  against the AppImage, and 10/10 against the packaged build in each of `LANGUAGE=en` and `LANGUAGE=pt`.
  New: HYG-23 (the `process.env.CI` branch is dead in packaged builds), HYG-24 (the export blob's
  synchronous revoke), and a note that e2e is Linux-only by choice. **Released as `v0.6.2-beta`**
  (tag on `bdff981`), and the new gate was **proved on Actions in the order the discipline requires**:
  push of `main` alone first, run `39148169911` — `quality` + `e2e (en)` + `e2e (pt)` green,
  `build`/`release` **skipped**; only then the tag, run `39148385652` — **7 jobs green**,
  6 artifacts, `prerelease: true`. The job log shows the intended ordering rather than asserting it:
  `Package binaries` → `End-to-end tests against the packaged AppImage` → `Upload artifacts`, so the
  released binary is the one the flow test drove. **Both locale legs passed on their first execution**,
  which the local runs predicted — and the pt leg's local failure had already been fixed before the
  matrix went in.

- **Previous focus (2026-10-18) — test-suite audit after the v0.6.0-beta "CI fixes". The suite was green
  partly because it had been made so; the three skips are now real tests again (`348/348`, zero skipped).**
  **e2e was never in CI at all** — `git log --all -S "playwright" -- .github/` is empty — so the four
  commits skipping tests *"to prevent CI breakage"* prevented a local `npm test` failure, not a CI one.
  **The skipped tests hid a vacuous guard, proven by mutation:** `ViewDrawer.tsx:172` `bytePct >= 1` → `>= 0`
  (red at-limit line on every keystroke) passed **`25/25`**, because the live negative guards matched a
  `/^Limit: …/` prefix the 0.6.0 copy reword had deleted. Both ViewDrawer tests now interpolate
  `label.at_limit` from `translations[locale]` instead of hardcoding English copy; the same mutation now
  fails 2 tests. `functional-flow.spec.ts` rewritten onto `_electron.launch` (it had `page.goto` against
  an origin nothing serves, a hardcoded home-directory artifact path, and `require()` in ESM) — passes
  11.8s and catches an unsaved edit on reopen.
  **Verified no security regression was hidden:** SEC-02 and SEC-04 are correct, checked empirically by
  driving the compiled `dist/main`. The code is safer than the suite certifies.
  **Newly open, and deliberately not skipped:** HYG-20 (`clavis.spec.ts`'s 10 tests have never run, are
  stale, and point `args: ['.']` at the real user profile), HYG-21 (four assertion sets that no longer
  assert), HYG-22 (SEC-03's single policy module and the removal of the `e.message` sniff, both never
  done), HYG-13b (byte-cap boundaries asserted only relative to the constant). HYG-11 is partly closed —
  e2e is runnable, but nothing gates it yet.
  Gates: lint 0 errors / 2 pre-existing warnings, both typechecks clean, `348/348`, e2e `13 in 3 files`.

- **Previous focus (2026-10-17, session end) — `v0.5.1-beta` published. `321/321`, lint 0, AppImage validated.** Closed: HYG-7/8/13, password policy (≥12 mixed), i18n UI PT fix, `prerelease:` workflow.
  then tagged — `build`/`release` only run on a tag, so tagging over red CI would publish binaries from
  unproven code. Release live with 6 artifacts across Linux/Windows/macOS, all four jobs green.
  **HYG-9:** the `message.includes('maximum')` sniff in `ipc-handlers` was dead (Zod always tags `.max()`
  with `too_big`) and actively harmful — any validation message containing that word became
  `CONTENT_TOO_LARGE`. Removed, and with the `(iss: any)` cast went **lint 0 errors / 0 warnings**, the
  first time. I had written "maximum" into the schema message on purpose today to satisfy that sniff.
  **HYG-16:** `--user-data-dir` did not isolate anything — `store.ts` hardcoded `OLD_DATA_DIR` from
  `os.homedir()`, so a "clean" profile came up with **10 of the user's real drawers**. Fixed, and verified
  both ways against a rebuilt AppImage: 0 drawers with the override, migration still runs without it, real
  profile untouched (14 drawers, 0 created).
  **HYG-16 then exposed HYG-17:** the Zod branch of the save handler had **no coverage at all**, because
  its message is byte-identical to the `SaveFailureReason` map's and the existing test only touched the
  latter. Mutating `too_big` to a wrong string left all 56 tests green. Both branches are now asserted to
  classify differently. Also HYG-18 (`package-lock.json` two releases behind) and HYG-19 (`CHANGELOG`
  never dated the v0.5.0-beta release).
  **Left open deliberately, and named in the CHANGELOG rather than implied:** HYG-7 (two mutations no
  test can catch — detaching a ceiling to a literal of the same value), HYG-8 (`[...value].length` allocs
  ~10 M elements at the worst case, unmeasured), HYG-11 (`tests/e2e` in no gate), HYG-12 (`clavis.spec.ts`
  launches `args: ['.']` against a hardcoded `:3000`), HYG-13 (byte-cap boundaries asserted only relative
  to the constant), HYG-14 (no rescue path — a product decision, not a bug), and one thing found while
  publishing: **releases are not marked prerelease**, so `pre: false` on every beta and `check-update`
  treats a beta as the latest stable. Not a regression — the workflow never passed `prerelease:`.
  **[corrected 2026-10-18 — this was already wrong. `release.yml:143` computes `prerelease:` from the tag
  name (`contains(ref_name, 'beta')`), restored by `28f1928` whose subject literally reads "prerelease
  flag". `v0.6.1-beta` published with `isPrerelease: true`, confirmed via `gh release view`. This note
  sat "open" for a day because it was never re-read against the file.]**

- **Previous (2026-10-16) — the P3.31 testing sweep and a 7-step defect sweep, both landed on `main` with no release.**
  `184 -> 277` tests across 20 files, every new test negative-controlled; `lint`, `typecheck` and `typecheck:test` all 0.
  New test files: `useModalKeyboard` (9), `DeleteConfirmModal` (15), `ErrorBoundary` (11), `preload` (41).
  `P3.30` closed by making `README.md` + `SECURITY.md` honest about file permissions, including the fact that
  **exported `.clavis` files get none of the `0o600`** because a Chromium `<a download>` writes them.
  `PLANO-DEFECTOS-2026-10-15.md` then landed A1 (ErrorBoundary focus), A2 (the `onConfirm: () => void` type lie),
  A3 (`danger.svg` `aria-hidden`), A4 (`check-update` could hang forever), B1 (Zod-parse the payload), B2
  (3 untested IPC channels), C1 (delete the dead `onEnter` branch), C2 (the P3.27 leftover), D1 (`DESIGN.md` drift).
  **The lesson, and it is new: a hostile review of the PLAN caught more than the tests did.** Three claims were
  wrong, each killed by a measurement. `componentDidUpdate` never fires on an initial-mount throw, so A1's
  test would have stayed red *with* the fix and its negative control was impossible to perform. Adding
  `aria-hidden` would have blinded the very test named as A3's guard. And a gate was quoted as "exits 0" for a
  **brand checker that does not exist** -- no `brand/`, no `ABOUT.md`, no `.py` file in the repo at all.
  **A gate that has never been run is worse than no gate, because it looks like evidence.**
  **A new toolchain fact worth carrying:** `npm run typecheck` inspects **zero** files under `src/renderer`
  (`tsconfig.json` excludes it), so `typecheck:test` is the gate that actually covers renderer work.
- **Previous (2026-10-13) — BR-18 closed: the GitHub mark ships the variant that matches its surface.** Both 1.4.11
  failures are gone — chip **2.70:1 → 20.60:1** on its real `#fffdf3` surface, update button **1.20:1 → 3.30:1** —
  measured by sampling pixels in a locally built AppImage, and the Known-gaps row is deleted rather than amended,
  because that table is specified as live gaps only. `github.svg` is orphaned and **archived** (BR-8g). `173/173` tests (was 171), green under `CI=true`, both typechecks and lint clean, brand
  checker exits 0.
  **The negative control contradicted the plan, and that is the lesson of the session.** The brief required asserting the
  rendered path `d` against the asset on disk *because* that pins which mark is where. It does not: the two variants carry
  **identical path data** and differ only in the baked fill, so a swapped pair leaves every `d` assertion green — confirmed
  by running the swap, which failed the fill test and passed the geometry one. Geometry still earns its place (it catches
  a return to the old blue badge), but colour placement is pinned by the resolved fill alone. The test now states that
  limitation in a comment instead of implying more than it checks. **A control that contradicts the brief is worth more
  than one that confirms it — this is the first time that sentence has applied to a test's own design.**
  **The brand checker caught its fourth class of trap: it pins line numbers.** `brand/ABOUT.md` §6 fixes the ETH and SOL
  address lines in `CreditsModal.tsx`, so a second import shifts all six and the gate goes red while lint, typecheck and
  CI stay green. Re-synced the way BR-11 did — two proper import lines, §6 and the checker's `INVENTORY` both moved to
  233, 234, 238, 239, 247, 251, and `ABOUT.md` §10 and §7.1 now record the rule.
  **The untracked-asset trap bit again, and it is why the two new SVGs are committed with the change.** They existed
  on disk and the local build was green, while a fresh `actions/checkout` would not have had them at all — a release
  cut would have failed on an unresolved import with nothing locally to warn of it.
- **Current focus (2026-10-12) — the Credits/About screen aligned with the Bandua Studio brand rules, and the alignment was only real because it was measured in the packaged AppImage.** Four of the eight elements `brand/ABOUT.md` §3.1 requires were missing (app name, version, licence, studio identity), plus Patreon. All closed — see **BR-1…BR-14** above, plus the layout rework in **BR-8b/BR-8e/BR-8f** and the studio profiles in **BR-15…BR-19**. `171/171` tests (was 152), green under `CI=true`, both typechecks and lint clean.
  **The rule that governs all of it: an app's palette is the app's own.** The studio contributes the mark, the line and the links — never a colour. Now `ABOUT.md` §3.7 and an enforced check, because it is also the only defensible reading of `BRAND.md` §5: Moss fails 4.5:1 on Mist and Teal on Deep fails even 3:1, and those numbers only hold on a 4-swatch brandboard.
  **Fourth time the same lesson: a green suite is not evidence — and this time the suite was what hid a regression I introduced.** All 26 `CreditsModal` tests passed while the support row overflowed its panel (455 vs 433). Found by driving the real AppImage with Playwright on `DISPLAY=:0`, fixed with `flex-wrap`.
  **A naive implementation of the version change was wrong and the suite caught it:** a second `useEffect` calls `getAppVersion` twice, and the existing `toHaveBeenCalledTimes(1)` failed immediately. The fix is one effect with `Promise.allSettled`, so neither request can cancel the other. One existing assertion changed on purpose — it asserted `getAppVersion` was *not* called when the update check rejects, which was true only because the two calls were sequential.
  **Two traps:** the simple-icons Patreon SVG carries `role="img"` + `<title>`, which next to the link text makes the accessible name "Patreon Patreon"; and `settle()` in the test file was one microtask deep, which stopped being enough once `allSettled` added a tick — one full-suite run failed right after a bulk file restore, was not reproducible in 13 subsequent full runs, and rather than dismiss it the timing assumption was removed.
  **A mistake of mine:** `git checkout scripts/check-about-references.py`, to undo a temporary mutation, discarded the session's work on that file. **Undo a mutation with a file copy, never with `git checkout` on a file you have been editing.**
  **Still open:** P3.22 (`ErrorBoundary` `role="alert"`) · P3.23 (`SkeletonLoader` `aria-hidden`) · P3.29 (`useCallback`) · P3.30 (`POSIX` docs) · P3.31 (`main/index` + `preload` tests) · `BR-14` (deliberately: EPUBShelf + ValidadorPT About screens). Housekeeping: o `private vulnerability reporting` precisa de confirmação (`gh api`) — se desativado, `SECURITY.md` documenta um fallback.

- **Done**: All 23 audit-2026-08-30 findings fixed, full drawer flow (+ import UI), security hardening, store extraction. **v0.1.9.1-alpha** (2026-09-08): preload fix + CI artifact fix — preload runtime fix (inlined CHANNELS constants to fix `module not found: ../../shared/channels.js`), CI workflow artifact name fix (include version in artifact name `clavis-${os}-${tag}`). **v0.1.8-alpha** (2026-09-07): Phase 2 P0 a11y + ErrorBoundary fix — 3 P0 a11y blockers (focus indicator, drawer rows as buttons, credits modal focus trap) + 10 P1 quick wins + **Preload runtime fix** (inlined CHANNELS constants to fix `module not found: ../../shared/channels.js`). **ErrorBoundary.restartApp** end-to-end. **v0.1.7-alpha** (2026-09-07): IPC-layer hardening — B2 symlink rejection + strip `details: e`, B3 decrypt size cap 10 MB, B5 `CHANNELS` const (kills drift risk), doc sweep. **v0.1.6-alpha** (2026-09-04): P0 UX (toast system, focus traps, skeleton loaders, password visibility toggle, strength meter in CreateDrawerModal only). **v0.1.4-alpha** (2026-09-03): DeleteConfirmModal + `danger.svg`. **v0.1.3-alpha** (2026-09-03): first CI-built green run `33781273256`. **v0.1.2-alpha** baseline: import drawer button. **v0.1.1-alpha**: fixed `argon2` Win32 `PE32+` via `afterPack` + `scrypt` fallback, save/delete `Result` mismatch, Windows `confirm()` focus steal.
- [x] **Tested**: Encryption round-trip, wrong-password rejection, drawer CRUD, path-traversal rejection, import drawer flow, HomeScreen rendering, all build targets, ASAR content, AppImage runtime, Windows `PE32+` verified, save/delete `Result` flow, Windows modal focus after delete, CI-built `v0.1.3-alpha` (AppImage Linux + ZIP Windows 11), CI-built `v0.1.4-alpha` (AppImage delete-confirm UI), **v0.1.7-alpha (54/54 tests)** — symlink rejection, decrypt size cap, CHANNELS const, all 8 IPC handlers, **v0.1.8-alpha (58/58 tests)** — a11y fixes, preload fix, ErrorBoundary restartApp, **duplicate-title warning (86/86 tests)** — `CreateDrawerModal.test.tsx` 7/7, mutation-checked (fails 4/7 when detection is stubbed), **visually confirmed by the user in the local AppImage `0.4.2-beta` (250M)**: creating a drawer named "Notas" and submitting that same name again shows the inline confirm step
- [x] **Audit 2026-09-01**: 14 recommendations validated by 4 specialized sub-agents; consolidated into 4-phase roadmap (Phase 0-3, ~35h total; MVP target 18.75h)
- [x] **Audit 2026-09-07 (appsec)**: IPC layer review after P1.3 extraction — refactor regressions all PASS (A1-A7); 2 P2 soft-blocking (B2 symlink, B3 decrypt size) fixed in v0.1.7-alpha; 1 P3 hygiene (B5 CHANNELS const) bundled. `audits/audit_2026-09-07-appsec.md`.
- [x] **Code review 2026-09-07**: P1.2 + P1.3 confirmed correct, byte-identical extraction, no behavioral drift. Verdict WITH-MINOR-FIXES — all fixes bundled in v0.1.7-alpha. `audits/review_2026-09-07-code.md`.
- [x] **A11y audit 2026-09-07**: 3 P0 blockers fixed, 10 P1 quick wins, preload fix. `audits/audit_2026-09-07-a11y.md`.
- **Cor do coração (2026-10-06, commit `e919761`) — o owner reviu e rejeitou o "segue o contexto".** O passe de design tinha tornado o coração controlável via `currentColor` e depois usado esse controlo para o deixar=background-dependente (vermelho no tile, âmbar no apoio, cinzento no rodapé, cinzento no HomeScreen). O owner viu e disse que o vermelho era mais chamativo e que não sabia qual era esteticamente melhor — **tinha razão, e a medição explica**: uma cor repetida é uma assinatura; uma cor que combina com o fundo não é. **O badge é load-bearing, não decorativo**: pintar o coração directamente em `#e11d48` não atinge 4.5:1 em **nenhum** dos fundos onde assenta (3.85:1 no `red-100` do tile, 4.27:1 em `gray-100`, e `red-50` só dá 4.29:1), e o salmão assado anterior media 2.63–3.21:1 — falhando mesmo os 3:1 de um ícone com significado. Invertido (superfície corada, glifo branco), os quatro sítios dão exactamente **4.70:1**. `--heart-surface: #e11d48` + `--heart-on-surface: #ffffff` em `:root`. **O resultado é mais chamativo do que o original**: o tile do cabeçalho passou de coração vermelho sobre vermelho pálido para quadrado rosa sólido. Regra registada no `DESIGN.md` → *The heart accent*, com a ressalva explícita de que o badge é o que torna o tom único possível.
- **Current focus (2026-10-07, fim do dia) — `v0.4.7-beta` publicada; as 4 falhas WCAG AA fechadas e um bug de i18n visível ao utilizador corrigido.** Quatro commits: `3a28688` (correcções a11y + testes), `6b5f9d1` (DESIGN.md), `5269aa6` (i18n), `7a7d498` (bump + CHANGELOG). Tag `v0.4.7-beta` em `7a7d498`, run `37649421652`, 5 jobs verdes, 6 assets. **Push em duas etapas de propósito:** primeiro `main` para o job `quality` correr **antes** de a tag existir, depois a tag — assim "a release não pode publicar um commit não validado" é estrutural, não hábito. `152/152` testes, verdes também com `CI=true`.
  **Armadilhas que teriam passado em silêncio, ambas registadas:** `border-input` define **só a cor** (o preflight do Tailwind põe `border-width: 0`), logo a forma correcta é **`border border-input`** e a leitura literal produzia inputs sem fronteira visível; e `getComputedStyle().borderWidth` devolve **0.8px** apesar do CSS declarar `1px`, porque `devicePixelRatio` é 1.25 — qualquer assert sobre esse valor seria instável entre ecãs.
  **Correções a factos previamente registados:** o "antes" do alerta era **1.39:1**, não 1.27:1 (`yellow-300` é `#fcd34d`); e **este ambiente Consegue mostrar UI** — não há Xvfb e o `--headless=new` do Electron continua a morrer, mas `DISPLAY=:0` é um X server real e o **Playwright `_electron.launch()` conduz o binário empacotado** (15 checks validados assim). Sempre com `--user-data-dir` isolado: `store.ts:116` tem uma migração `fs.copyFile` one-shot de `~/.local/share/Clavis`, por isso os drawers reais são **copiados** para o `userData` passado e aparecem no fundo (os originais nunca são movidos — mtime ainda 2026-09-24).
  **Lição recorrente, agora pela terceira vez: uma suite verde não é prova.** Reintroduzir o double-fire do ESC deixou `useFocusTrap.test.tsx` (3) e `PasswordModal.integration.test.tsx` (12) **completamente verdes**, porque ambos mockam os hooks. O guard teve de usar handlers **não-idempotentes** (um `setState(false)` idempotente não observa um double fire) e foi negative-controlled à mão. Mesma causa raiz do defeito de foco e do submit duplicado: **a convenção de mockar os hooks de acessibilidade é o que torna estes defeitos invisíveis.**
  **Restante:** P2.21 (spinner) · C6-N16 (Ctrl+S) · P3.27 (`|| 'fallback'`) · P3.32 (`lang="en"` com UI pt-PT, WCAG 3.1.1) · gaps ainda abertos no `DESIGN.md`: `danger.svg` com o `#131112` invisível, marca do GitHub a 1.20:1 sobre `green-600`, `::placeholder` a 2.54:1, `CreditsModal` sem focus no mount. Duas coisas de fundo: o **`AGENTS.md` referencia um `DESIGN.md` que não existia** até 2026-10-06, e o **private vulnerability reporting do repo precisa de confirmação** (`gh api` expirou nesta sessão) — se estiver desativado, o link de advisories no SECURITY.md dá nowhere, e o próprio SECURITY.md já documenta um fallback.

- **Current focus (archived 2026-09):** Phase 3 P3.1 (renderer component tests, 8h) or Post-MVP (auto-updater / i18n / Flatpak). Phase 1 + Phase 2 P0 complete. Credits modal redesign complete (v0.3.5-alpha released).
- [x] **Sub-agent 3 (implementation & validation)** — completed 2026-09-09: PLANO.md edited (Note 2026-09-09 + Audit-Driven Action Plan 2026-09-09), consistency verified with SUMMARY.md (v0.2.0-alpha, 69/69) and TODO.md. No critical conflicts.
- **Released `v0.4.6-beta`** (2026-10-06, tag `v0.4.6-beta` on `a5e584a`, run `37499064694` verde nos 5 jobs — quality + 3 builds + release, 6 assets: AppImage 124M, `.deb` 95M, `Setup.exe` 151M, portable `.zip` 156M, `.nupkg` 150M, `.dmg` 126M). Conteúdo: **P2.19** (diálogo de confirmação ao sair com edições por guardar) + **Bug 2** (`useFocusTrap`) + o script de snapshot da memória. `143/143` testes.
  - **Validado em três níveis, não só em jsdom**: (1) `app.asar` do AppImage local extraído e lido directamente — `ViewDrawer.tsx` traz `isDirty` + `handleBack` + o `DiscardChangesModal`, `useFocusTrap.ts` traz o `onEscapeRef`, e o `argon2.glibc.node` de `linux-x64` está desempacotado; (2) o AppImage arrancou headless e listou 16 gavetas (`Clavis started`, `Drawers listed count:16`) — o main process, argon2 e IPC funcionaram no binário real; (3) **o owner confirmou visualmente o diálogo no AppImage descarregado do GitHub**, ou seja o artefacto que os utilizadores instalam e não o build local. Este é o nível mais forte dos três: fecha o ciclo porque foi o CI que produziu a release, não o pipeline local. (O bump em vez de re-tagging do `0.4.5-beta` evita ambiguidade no artefacto já publicado.)
- **Sessão 2026-10-05 (fim de dia) — 2 releases cortadas, 4 itens fechados.** `v0.4.4-beta` (`0508a47`, run `37331376460`) e `v0.4.5-beta` (`2b8cd63`, run `37360244608`), ambas com 4 jobs verdes e 6 assets. Fechados: **P2.24** (renderer + testes `.tsx` sob typecheck, 21 → 0 erros), **P2.25** (botão de nova versão provado no binário publicado, com controlo negativo A/B), **P3.24–P3.26** (i18n completo, ~24 strings), e o **submit duplicado no `PasswordModal`**. `126/126` testes, ambos os typechecks e lint verdes, `build` OK, árvore limpa e tudo pushado.
  - **O i18n foi validado no artefacto, não só em jsdom**: o AppImage publicado sob locale `pt-PT` renderiza o Credits inteiramente em português europeu com `EN_MARKERS_FOUND=[]`, contra o screenshot da `v0.4.3-beta` do mesmo ecrã em inglês ao lado do "Fechar" traduzido. **A validação mediu um defeito novo**: `document.documentElement.lang === "en"` com a UI toda em português → **P3.32** (WCAG 3.1.1).
  - **Próxima sessão começa pelo P2.19** (perda silenciosa de dados no `ViewDrawer`) — **mas a decisão de design (auto-save / confirmação / diálogo com "Guardar e sair") continua aberta e é do owner.** Depois: Bug 2 (foco), P3.32, as três falhas WCAG AA, e as 9 classes mortas dos SVGs. `DESIGN.md` continua referenciado no `AGENTS.md` sem existir.
- **Released `v0.4.5-beta`** (2026-10-05, tag `2b8cd63`, run `37360244608` verde nos 4 jobs, 6 assets). Conteúdo: i18n completo + modelo de locale lusófono único (`ADR-009`), correcção do submit duplicado no `PasswordModal`, e o label correcto do botão de desbloquear. **O i18n foi validado no binário publicado, não só em jsdom**: o AppImage da `v0.4.5-beta` conduzido com Playwright sob locale `pt-PT` renderiza o Credits **inteiramente em português europeu** ("SOBRE", "CRÉDITOS", "APOIAR ESTE PROJETO", "Criptomoeda", "Paga-me um café", "De Portugal, com amor.") com `EN_MARKERS_FOUND=[]` — contrastando com o screenshot da `v0.4.3-beta` no mesmo tipo de binário e mesmo locale, onde o mesmo modal lia "About"/"Credits"/"Cryptocurrency"/"Buy me a coffee" em inglês ao lado do "Fechar" traduzido. **A validação encontrou um defeito novo e medido**: `document.documentElement.lang` é `en` com a UI toda em português (`index.html` tem `lang="en"` hardcoded) → WCAG 3.1.1, registado como **P3.32**. `126/126` testes.
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
- [x] SEC-01 KDF fallback metadata (audit 2026-10-17) — **reopened and re-closed 2026-10-19**: the
  metadata was written but never read by `deriveKey`; now the stored `algorithm` is honoured on unlock
  and save, with `KDF_UNAVAILABLE` when the required backend is absent (see HYG-21 above).
- [x] SEC-02 legacy passwords savable
- [x] REL-01 atomic writes
--- Audit 2026-10-17 — pendentes (pós-SEC-01/02/REL-01) ---
- [x] SEC-07 — Zod import validation (top-5 #5) — closed 2026-10-19 (schema applied at import/list/unlock)
- [x] SEC-04 — save proves password before overwrite — closed in the 2026-10-19 SEC-01 session
- [x] SEC-05 — malformed crypto metadata not rate-limited — closed 2026-10-19 (`corrupt_metadata` → `INVALID_JSON`)
- [ ] SEC-08 — composition rules / strong passphrases
- [x] SEC-09 — single-instance lock — closed 2026-10-19 (lock at module scope; unit tests green; e2e proof on the packaged binary, with a negative control) — **released as `v0.6.6-beta`**
- [x] REL-02 — closed 2026-10-19 (attempt counter + guard in `HomeScreen.tsx`; unit test green; **e2e proof on the packaged binary with a control**, mutation-verified) — **released as `v0.6.7-beta`**
- [ ] UX-01 / UX-02 / UX-07
[x] Sessão encerrada — SEC-01/02/03/07 + REL-01 + SEC-04 + AppImage