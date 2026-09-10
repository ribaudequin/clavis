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
  - **Planned (later, post-alpha):** Internationalization (i18n) with automatic locale detection — PT-PT and PT-BR when the system is Portuguese; English as the default/fallback for all other locales. Not implemented yet to keep maintenance low during alpha. Revisit with Flatpak/auto-updater/UI-polish.
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

## Audit-Driven Priorities (2026-09-03)

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

## Audit-Driven Action Plan — 2026-09-09

**State:** v0.2.0-alpha | 69 tests pass | 0 P0 blockers | 5 🟡 High (F1, F3, F12, BS-03/BS-12) | 10 🟡 Medium | 22 P1/P2 remaining. Security baseline 8.5/10; UX 7/10; Build 7/10.

### Action Plan — 17 Recommendations (grouped)
**P0 Security:** CSP-01 | ERR-01 | CHAN-01
**P1 Type/Test:** F1 | F5 | F12
**P2 Build:** BS-06 | BS-03 | BS-09
**P3 UX:** C1 | C4 | C6 | C8 | C3
**P4 Code Quality:** F4 | F9 | F13

### Note on CHAN-01 (Reverted)
- `CHAN-01` deferred due to runtime regression (`preload/index.ts` fails to resolve `shared/channels` import in Electron ASAR). Inline `CHANNELS` accepted as stable solution.

### Strategic Post-Audit
- **Differentiation:** `Differentiation.md` exists. Missing: `COMPETITORS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/` templates, `docs/adr/`.
- **Distribution:** Auto-updater implemented; `latest.yml` pending (BS-06); Flatpak Flathub publish pending.
- **Roadmap:** i18n deferred; sync protocol design doc needed; mobile strategy (Capacitor / PWA / React Native) undecided.

## References
- Wireframe docs: see `wireframes/` directory for full specs.
- Audit reports: `audits/audit_2026-09-03-ui-ux.md`, `audits/audit_2026-09-03.md`