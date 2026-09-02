# History — Clavis (partitioned from MEMORY.md)

> Older entries moved here when MEMORY.md exceeded 150 lines / 10 entries per section.
> MEMORY.md keeps only the 3 most recent entries per section. See MEMORY.md for current context.

## 🪵 Recent Updates Log (older)

- AUDIT 2026-08-30 (23 findings) addressed via 4 linear agency-subagent phases: P1 critical blockers, P2 security hardening, P3 unlock/UI feature, P4 testing+release.
- **Release: v0.0.1-alpha** tagged + pushed (commit 648774a). Packaging (AppImage/Portable/NSIS → release/), English-only UI, icons, version bump. Next pending: Flatpak, auto-updater, Forge+Vite dev workflow, UI polish.
- Phase 1: fixed IPC open-file-dialog (handle), import reads server-side, UUID path-traversal validation, installed Tailwind, vitest.config.ts, forge icon path, removed preload script tag.
- Phase 2: file modes 0o600/0o700, sandbox:true + devTools guard, CSP, nav guards, error logging, password min-length (8), export error guard.
- Phase 3: password modal + view/edit screen (ViewDrawer.tsx, PasswordModal.tsx) wired into HomeScreen.
- Phase 4: extracted src/main/store.ts, forward-compat KDF params, deriveKey length assert, await ensureDataDir, store/component tests, eslint tests block, forge signing/auto-update placeholders.
- Packaging: Linux .deb built via electron-forge `make`; removed duplicate `config.forge` block from package.json (was conflicting with `forge.config.ts`), removed maker-rpm (rpmbuild absent). Windows NSIS fixed.
- sub-agents: AUDIT → CONFIG → BUILD (linear). BUILD sub-agent crashed the machine (heavy builds). Re-ran builds directly. **AppImage + Portable built.** Key fix: `directories.output: "release"` — previously builds wrote artefacts into `dist/`, and `files:["dist/**/*"]` re-packaged them into ASAR → ">4.2GB asar" error. Separating output dir + cleaning `dist/` resolved it.
- Build outputs (all OK): `release/Clavis Setup 0.0.0-alpha.exe` (NSIS, 107MB), `release/Clavis Portable 0.0.0-alpha.exe` (Portable, 106MB), `release/Clavis-0.0.0-alpha.AppImage` (AppImage, 120MB).

## 📋 Changelog (older)

- **[2026-09-01]** [Release v0.0.3 — docs] Updated README `Credits & support` section to requested copy (intro + GitHub + Credits/Thanks + Support Ko-fi/ETH/SOL + footer *From Portugal, with love.*). Merged `feature/credits-modal` into `master` and promoted to `main` — both now at v0.0.3.
- **[2026-09-01]** [Release v0.0.3] Removed Electron menu (`Menu.setApplicationMenu(null)`). Added `icons/svg` via `vite-plugin-svgr` (`HeartIcon`, `GithubIcon`, `EthIcon`, `SolIcon`, `KoFiIcon` as `?react` components), sanitized Inkscape SVGs, updated Credits modal to `Credits & support` copy. `src/types/svgr.d.ts` added. 15/15 tests pass.
- **[2026-09-01]** [Menu removal + Credits button] Removed Electron menu system entirely (`Menu` import, `setupMenu()` function). Added heart-shaped button (SVG) in header next to "New Drawer" that opens an in-app CreditsModal with: maintenance info, design credits, icon system, security features list, architecture, and special thanks. Modal has close (×) button and OK button. Build/lint/tsc/tests all clean (15/15).
- **[2026-09-01]** [SVG icons fix] Replaced PNG image resources with `icons/svg` via `vite-plugin-svgr` — avoids ASAR resource loading issues. Fixed Menu removal with `Menu.setApplicationMenu(null)`. All icons now render reliably in packaged AppImage.
- **[2026-08-31]** [UI polish commit 4a07b83] Native window frame: `titleBarStyle: 'hidden'` → `'default'` (native close/min/max buttons); added app icon (`icons/linux/512x512.png`). Renderer: `<meta name="theme-color">`, `header { -webkit-app-region: no-drag; cursor: default }`. Modals (CreateDrawerModal, PasswordModal) got `role="dialog" aria-modal="true"` + Escape-to-close. `npm run build`/`make` unaffected. lint/tsc/15 tests pass.
- **[2026-08-31]** [Release v0.0.2-alpha] Version bumped 0.0.2-alpha; tag `v0.0.2-alpha` published on GitHub with 3 binaries in release/latest/: AppImage 119MB, NSIS 106MB, Portable 106MB. Fixed blank screen with Vite renderer bundling. `npm run release` = clean→tsc→copy:preload→vite build→electron-builder make→copy-latest.
- **[2026-08-31]** [Blank screen FIX — Vite] tsc compiled renderer to CommonJS (`require('react')`) → browser `require is not defined` → blank screen. Fixed: Vite bundles renderer→`dist/renderer` (ESM, no require); tsc compiles main+shared only; preload copied to dist/main/preload.js; index.html script `./index.tsx`; dev mode loads localhost:3000. lint/tsc/15 tests pass.
- **[2026-08-30]** [Initial scaffolding] Electron + TypeScript + React project structure created, encryption module implemented and tested, drawer store implemented, Home Screen UI built, app launches successfully.
- **[2026-08-30]** [Git/GitHub] Initialized local Git repo, created remote repository `ribaudequin/clavis` on GitHub, pushed initial commit; removed local-only .md files (AGENTS/MEMORY/PLANO/SUMMARY/TODO/IDEA) and wireframes from repo.
- **[2026-08-30]** [Audit] Completed full project audit with 3 Agency specialist subagents. Generated `audits/audit_2026-08-30.md` with 23 findings (4 🔴, 11 🟡, 8 💭).
- **[2026-08-31]** [Audit remediation] All 23 findings addressed via 4 linear agency phases (critical blockers, security hardening, unlock/UI feature, testing+release). Store extracted to testable module. 15/15 tests pass; tsc + eslint clean.
- **[2026-08-31]** [Release v0.0.1-alpha] Version bumped 0.0.0→0.0.1-alpha. Tag `v0.0.1-alpha` created and pushed to GitHub (commit `648774a`). Note: this was a **tag-only** release — no binaries published as GitHub release assets (AppImage/Portable/NSIS). The binaries now live in `dist/` and `release/` but were not attached to the GitHub tag.
- **[2026-08-31]** [UI Language] Confirmed and enforced **English-only UI** (decision added to PLANO.md). Translated all visible strings in PasswordModal, HomeScreen, ViewDrawer (and updated HomeScreen.test.tsx) from PT to EN. tsc/lint clean, 15/15 tests pass.
- **[2026-08-31]** [Blank screen FIX — Vite] Root cause: tsc compiled renderer to CommonJS (`require('react')`) but it ran in browser → `require is not defined` → blank screen. Fixed: Vite bundles renderer→`dist/renderer` (ESM, no require); tsc compiles main+shared only; preload copied to `dist/main/preload.js`; index.html script `./index.tsx`; dev mode loads localhost:3000. `npm run build` = clean→tsc→copy:preload→vite build. ASAR verified with all files + argon2 native. lint/tsc/15 tests pass.
