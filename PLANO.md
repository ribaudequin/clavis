# PLAN — Clavis

Encrypted notes desktop application (passwords, PINs, bank data, safe codes) organized in "drawers" — each encrypted with its own unique password (or optional global password).

## Goal
- Cross-platform encrypted notes app for sensitive data (bank details, PINs, passwords, safe codes, door codes).
- Organize data in "drawers" — each drawer has its own unique password (or optional global password).
- Easy backup of encrypted data — export/import drawer files securely.

## Decisions
- **Desktop Stack**: Electron + TypeScript — proven multi-platform tooling, good packaging story for AppImage / Windows (NSIS + Portable) / Flatpak.
- **Frontend**: React + Tailwind CSS (consistent with Electron ecosystem, fast UI iteration).
- **UI Language**: The application UI (user-facing text, labels, messages) is in **English**. (Documentation/comms with the user may be in PT-PT; the app itself is English.)
  - **Internationalization (i18n):** IMPLEMENTED in v0.3.2-alpha. Auto-detect `navigator.language` (PT-PT / PT-BR / EN fallback); `src/i18n/index.ts` + translated components (`HomeScreen`, `CreateDrawerModal`, `PasswordModal`, `DeleteConfirmModal`, `ViewDrawer`). See `TODO.md` lines 17-19. Completed: no longer post-alpha.
- **Encryption**: AES-256-GCM per drawer; key derivation via **Argon2id** (memory-hard, OWASP-recommended).
- **Global vs Per-Drawer Password**: Support both — a global master password (optional) unlocks all drawers; otherwise each drawer has its own password. Stored metadata (titles, icons) is unencrypted; only drawer content is encrypted.
- **Persistence**: Drawers stored as encrypted JSON files (`*.clavis`) in a user-data directory (`~/.local/share/Clavis` on Linux). Icons generated deterministically from a hash of the drawer title.
- **Packaging**: Electron Forge — multi-platform builds (AppImage, NSIS, Portable, Flatpak manifest). **Dual build system resolved**: electron-builder config removed; Forge is canonical.
- **Build System**: ESM (`"type": "module"`) for consistency with Vite/TypeScript config files. Preload will remain CommonJS (`.js`) initially, then convert to TypeScript (`.ts`) per DX improvements roadmap.
- **Input Validation**: Runtime schema validation via **Zod** on all IPC handler entry points (create-drawer, save-drawer, import-drawer, unlock-drawer, etc.) to prevent DoS and injection.
- **Password Strength**: Minimum 8 characters enforced in both UI and backend (store.ts). Backend check added to defend against compromised renderer.
- **IPC Security**: `import-drawer` file path validation via session-based token whitelist (no arbitrary file reads from renderer). All handlers return structured `Result<T, E>` types.
- **Logging**: Centralized structured logging via `electron-log` in main process; persistent logs in `~/.config/Clavis/logs/main.log`.
- **Error Handling**: IPC handlers return `Result<T, AppError>` with error codes (INVALID_ID, DECRYPT_FAILED, WRITE_FAILED, etc.) for typed error recovery in renderer.
- **Code Signing**: **Deliberately skipped** — EV certificate cost (~$200–500/year) not justified for open-source project. Users warned about Gatekeeper/SmartScreen on first launch.
- **Auto-Update**: Planned post-MVP (v0.1+) using `electron-updater` with GitHub Releases as update endpoint. Current placeholder config deactivated.
- **Versioning**: `A.B.C.D` — A=major (upgrade), B=feature, C=bugfix (resets B), D=code (resets C).

## Validation Registry (Audit 2026-09-13 — Existing + New)

All validations derived from `audit_2026-09-13.md`. Status mapped to PLANO decisions.

### Existing Validations (Verified / Updated)
| ID | Domain | Validation | Status (2026-09-13) | PLANO Ref |
|---|---|---|---|---|
| CSP-01 | Security | CSP directives complete (`object-src`, `base-uri`, `form-action`, `frame-ancestors`, `connect-src`) | ✅ Fixed | Security baseline |
| ERR-01 | Security | Error envelopes use `details: undefined`; no raw exceptions cross IPC | ✅ Fixed | Error Handling |
| CHAN-01 | Security | Preload `CHANNELS` duplicates `shared/channels` — runtime drift risk remains | ⚠️ Open / Deferred | IPC Security |
| B2 | Security | `fs.lstat()` + `isSymbolicLink()` symlink rejection | ✅ Fixed | IPC Security |
| B3 | Security | Decrypted content size cap (`MAX_DECRYPTED_SIZE = 10_000_000`) | ✅ Fixed | Persistence |
| B5 | Security | Channel constants (`channels.ts`) | ⚠️ Partial (`preload` still hardcodes) | IPC Security |
| ZOD | Input | Zod schema validation on all IPC handlers | ✅ Active | Input Validation |

### New Validations (Audit 2026-09-13 — Added to Plan)
| ID | Severity | Description | Action in Plan |
|---|---|---|---|
| VALID-01 | P3 | `importDrawerRaw` doesn't validate `encryptedData`, `salt`, `iv`, `authTag`, `keyDerivation` fields | Add import validation rules to `store.ts` |
| TEST-01 | P3 | No test validates `SaveDrawerSchema.content.max(10_000_000)` on write side | Add direct Zod schema test (`validation.test.ts`) |
| DOS-01 | P3 | `importDrawerRaw` reads file without size limit — memory exhaustion risk | Add size cap before import read |
| OVERWRITE-01 | P3 | Import doesn't check for existing drawer ID — silent overwrite | Add overwrite guard or confirmation |
| KDF-01 | P3 | KDF parameters read from imported file without minimum validation | Add KDF param floor checks |
| TYPE-01 | P3 | `restartApp` typed `Promise<void>` but handler returns `Promise<Result<void>>` | Align type in `types.ts` |
| DEAD-01 | P3 | `createCreditsWindow()` (37 lines) defined but never called | Remove or wire to menu |
| LOG-01 | P3 | `isDev` double-negation in `logger.ts` | Simplify logic |
| LOG-02 | P3 | Logger includes user-controlled `title` in context (sensitive descriptor leak) | Sanitize/context-reduce log fields |

## Audit-Driven Priorities (2026-09-13)

### P0 — Critical UX (Blocks User Trust)
1. **Replace all `alert()` with toast/notification system** — non-blocking, dismissible, accessible (`aria-live="polite"`)
2. **Add focus trap to all modals** — use `focus-trap-react` or custom `useFocusTrap` hook (PasswordModal, CreateDrawerModal, DeleteConfirmModal, CreditsModal)
3. **Implement skeleton loaders for drawer list** — replace "Loading..." text with shimmer animation cards

### P1 — High Impact UX & Build Blockers
4. **Add password visibility toggle + strength meter** to `PasswordModal`
5. **Extract `CreateDrawerModal` and `CreditsModal`** to separate components
6. **Add keyboard shortcuts**: `Ctrl+N` (new), `Escape` (close modal), `Enter` (confirm focused), `Ctrl+S` (save in ViewDrawer)
7. **Add `aria-live` regions** for loading states, errors, list updates
8. **Empty state illustration + CTA** — "Create your first drawer" button
9. **Fix ESM/CommonJS mismatch** — Choose Option A (`"type": "module"`) or B (CommonJS configs) for forge.config.ts, vite.config.ts, vitest.config.ts
10. **Add `@electron-forge/maker-rpm`** to `forge.config.ts` for Linux RPM target
11. **Implement auto-update** — Add `electron-updater`, configure GitHub provider, add check logic
12. **Add quality gates to CI** — Run `lint`, `typecheck`, `test` before `build`/`make`

### P2 — CI/CD Reliability & Polish
13. **Fix CI certificate handling** — Remove cert secrets or make them optional in Forge config
14. **Add `typecheck` script** to `package.json`
15. **Add `release/` to `.gitignore`**
16. **Fix Flatpak manifest version** — Parameterize or script version injection
17. **Add Flatpak build to CI** (optional, separate job)
18. **Add transitions/animations** to modals (fade-in, scale)
19. **Click backdrop to close** modals (optional, with `onClose` prop)
20. **Portals for modals** — `ReactDOM.createPortal` to avoid stacking issues
21. **Responsive breakpoints** — `max-w-[90vw]` on modals, `sm:`/`md:` on containers
22. **Copy-to-clipboard** for crypto addresses in Credits
23. **Consistent icon system** — Move Credits close icon to `vite-plugin-svgr`

### P3 — Architecture & Code Quality
24. **Extract `useModalKeyboard` / `useFocusTrap` hooks** — Eliminate duplicate focus/Escape logic
25. **Extract `DrawerIcon` component** — Memoize icon rendering
26. **Add `resetErrorBoundary`** to `ErrorBoundary` for programmatic recovery
27. **Unify error display** — Delete error modal pattern for all async errors

### P4 — Documentation & Governance
28. **Create `CHANGELOG.md`** — From `MEMORY.md` changelog + git tags
29. **Create `CONTRIBUTING.md`** — Setup, code style, PR process, commit conventions
30. **Create `SECURITY.md`** — Responsible disclosure, vulnerability reporting
31. **Add issue/PR templates** to `.github/`
32. **Formalize ADRs** — Move key decisions from PLANO/MEMORY to `docs/adr/`
33. **Create user guide** — Creating drawers, importing/exporting, password recovery (not possible by design)

**Note (2026-09-09):** Priorities revised based on audit 2026-09-09 (37 findings: 0 P0, 5 🟡 High, 10 🟡 Medium, 22 P1/P2). Updated action plan follows; this section retained for reference.

## Structure
```
clavis/
├── AGENTS.md
├── MEMORY.md
├── PLANO.md
├── TODO.md
├── SUMMARY.md
├── wireframes/          # Existing: images + markdown wireframes
├── package.json
├── tsconfig.json
├── forge.config.ts       # Electron Forge
├── src/
│   ├── main/             # Electron main process
│   │   ├── encryption.ts  # AES-256-GCM + Argon2id
│   │   ├── store.ts       # Drawer file management
│   │   └── index.ts       # Main process entry
│   ├── renderer/         # React frontend
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom hooks
│   │   └── pages/        # Screens (home, create, view)
│   └── shared/           # Types, constants
├── assets/              # Icons
├── tests/               # Jest / Playwright tests
└── releases/            # Build outputs
```

## 🛡️ Backup and Remote
- Remote configured: No (local-first app)
- Backup: Manual export of encrypted `.clavis` files (drag-out / drag-in import). Each drawer is self-contained.

## Audit-Driven Action Plan — 2026-09-13

**State:** v0.3.2-alpha | 69 tests pass | 0 P0 blockers | 0 🔴 Critical | 10 🟡 High | 15 🔵 Medium | 25 💭 Low | 1 P1 (UI) + 19 P2 (UI) | Security baseline 8.5/10; Code quality 7/10; Build 6.5/10; UX 6.5/10.

### Action Plan — 70 Findings (grouped by domain, from audit_2026-09-13.md)

**P0 — Security & Drift Prevention (same release / deferred):**
- ~~CHAN-01 (P2): Import CHANNELS from `../../shared/channels.js` in `preload/index.ts` (or document inline as stable).~~ **RESOLVED 2026-09-14** — preload bundled via Vite, imports `CHANNELS` from `src/shared/channels.ts` (see ADR-007).
- TYPE-01 / N2 (High): Align `restartApp` type in `types.ts:60` to `Promise<Result<void>>`.
- DEAD-01 / N3 (High): Remove `createCreditsWindow()` or wire to a menu item.
- VALID-01 (P3): Add import field validation (`encryptedData`, `salt`, `iv`, `authTag`, `keyDerivation`) to `store.ts`.
- DOS-01 (P3): Add file-size cap before `importDrawerRaw` reads file.
- OVERWRITE-01 (P3): Check existing drawer ID before import; confirm or block overwrite.
- KDF-01 (P3): Add KDF parameter floor validation on import.

**P1 — Type Safety & Test Coverage:**
- F1 / N1 (High): Remove `src/renderer` from `tsconfig.json` exclude; consider `tsconfig.renderer.json`.
- F5 / N5 (Medium): Add tests for untested modules (`CreateDrawerModal`, `useFocusTrap`, `useModalKeyboard`, `ErrorBoundary`).
- F13 / N13 (Medium): Add `tsconfig.test.json` for test file typechecking.
- F14 / N22 (Medium): Create `tests/validation.test.ts` with direct Zod schema tests (covers TEST-01).
- F15 / N2 (High): Fix `restartApp` return type mismatch.

**P2 — Build & Release:**
- BS-06 (High): Configure `electron-updater` publisher (`latest.yml` generation) or document non-functional state.
- BS-09 (High): Fix Flatpak manifest version (`0.3.2-alpha`) and source path (`out/make/`).
- BS-03 (High): Add `@electron-forge/maker-rpm` or document intentional omission.
- BS-13 (High): Remove test files (`playwright.config.ts`) from Flatpak manifest production bundle.
- BS-14 (Medium): Add `prerelease: true` to `.github/workflows/release.yml`.
- BS-15 (Medium): Add `ci` script (`lint` + `typecheck` + `test`) to `package.json`.
- BS-16 (Medium): Update outdated dependencies (`electron`, `react`, `typescript`, `vite`, `vitest`, `zod`, `uuid`).
- ~~BS-17 (Medium): Make `copy:preload` cross-platform (not Unix-only `cp`).~~ **RESOLVED 2026-09-14** — `copy:preload` removed; preload bundled by `scripts/build-preload.mjs` (Node, cross-platform).
- BS-18 (Medium): Fix Playwright Safari project for CI (`ubuntu-latest` lacks Safari).

**P3 — UX & Accessibility (P1 / P2):**
- N1 (P1): Add `aria-live="polite"` to `ToastProvider` container.
- C1 / N20 (P2): Add initial focus move to credits modal close button.
- C4 / N17 (P2): Update `document.title` dynamically in `ViewDrawer`.
- C6 / N16 (P2): Add `Ctrl+S` keyboard shortcut in `ViewDrawer`.
- C8 / N18 (P2): Add `unhandledrejection` listener to `ErrorBoundary`.
- C3 / N14 (P2): Fix `useModalKeyboard` to allow `Enter` in `<textarea>` elements.
- C7 / N12 (P2): Add dirty-state tracking + confirmation before back navigation in `ViewDrawer`.
- N4–N7 (P2): Add overlay click-to-close to all 4 modals (`CreateDrawerModal`, `DeleteConfirmModal`, `PasswordModal`, `CreditsModal`).
- C2 / N26 (P2): Remove emoji icons from `ToastProvider` (or add `aria-label` / `role` alternatives).
- C5 / N15 (P2): Increase Export/Delete button touch targets to 44×44 px.
- Additional P2 UX: `prefers-reduced-motion`, `lang` attribute, focus restoration, skip-nav link, responsive title update.

**P4 — Code Quality:**
- F4 / N7 (Medium): Extract `CreditsModal` from inline `HomeScreen.tsx` (90 lines).
- F9 / N6 (Medium): Extract `wrapHandler()` helper to reduce ~120 lines duplicated try/catch boilerplate in `ipc-handlers.ts`.
- F10 / N23 (Medium): Add `restart-app` handler test.
- F11 / N16 (Medium): Create `usePostDialogFocus()` hook for focus recovery.
- F7 / N14 (Low): Simplify `isDev` double-negation in `logger.ts`.
- LOG-01 / LOG-02 (P3): Fix `isDev` logic and sanitize log context fields.
- DEAD-01 / N20 (Medium): Clean icon imports if `createCreditsWindow()` removed.

### Note on CHAN-01 (Resolved — 2026-09-14)
- `CHAN-01` resolved. Root cause was two-fold: `sandbox: true` prevents a sandboxed preload from `require()`-ing app-local modules, and the old `copy:preload` step shifted the relative path depth. Fix: bundle the preload with Vite (`scripts/build-preload.mjs`), keeping `electron` external and inlining `CHANNELS` from `src/shared/channels.ts` at build time. Verified in the packaged `AppImage` (`v0.3.3-alpha`): `Clavis started` → `IPC handler called list-drawers` → `Drawers listed count:5`. See ADR-007.

### Note on Validation Gaps (New from 2026-09-13)
- Import validation (`VALID-01`, `DOS-01`, `OVERWRITE-01`, `KDF-01`) is the highest security gap after CHAN-01. Recommend P0 inclusion before any Flathub publish or auto-updater activation.
- Build validation (`TEST-01`) requires direct Zod tests (`tests/validation.test.ts`) — missing file noted in audit.
- Type validation (`TYPE-01`) is low-risk but affects typed error handling contract.

### Strategic Post-Audit (2026-09-13)
- **Differentiation:** `Differentiation.md` exists. **P4 Governance:** `CONTRIBUTING.md`, `SECURITY.md`, `.github/` templates, `docs/adr/`, `CHANGELOG.md`, user guide still missing. `COMPETITORS.md` optional.
- **Distribution:** Auto-updater implemented but non-functional (`latest.yml` missing); Flatpak manifest version mismatch (`0.3.1` vs `0.3.2`); `COMPETITORS.md` optional.
- **Roadmap:** i18n completed (v0.3.2-alpha); sync protocol design doc pending; mobile strategy (Capacitor / PWA / React Native) undecided; build validation (`TEST-01`) now prioritized.
- **Security:** 8.5/10 baseline maintained; new P3 validation gaps (`VALID-01`, `DOS-01`, `OVERWRITE-01`, `KDF-01`) lower practical score to ~8.0 until resolved.

## References
- Wireframe docs: see `wireframes/` directory for full specs.
- Audit reports: `audits/audit_2026-09-03-ui-ux.md`, `audits/audit_2026-09-03.md`, `audits/audit_2026-09-07-appsec.md`, `audits/audit_2026-09-07-a11y.md`, `audits/audit_2026-09-09.md`, `audits/review_2026-09-07-code.md`, `audits/audit_2026-09-13.md` (current — 70 findings, 0 🔴, 10 🟡, 15 🔵, 25 💭, 1 P1 + 19 P2).