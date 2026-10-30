# Contributing — Clavis

Thank you for your interest in contributing to Clavis!

## How to contribute

1. Open an issue on [GitHub](https://github.com/ribaudequin/clavis) to discuss the change before working on it.
2. Fork the repository.
3. Create a branch from `main`: `git checkout -b feature/my-change`.
4. Make changes with clear commits.
5. Open a Pull Request (PR) with a concise description of what was done and why.

## Code conventions

- **Language:** TypeScript (frontend + backend), `.mts` for configs (`vite.config.mts`, `vitest.config.mts`). Electron Forge config lives in `package.json` → `config.forge` (Forge 6.4.2 ignores `forge.config.mts`).
- **Style:** ESLint via `eslint.config.js` (flat config), plus `prettier` where configured.
- **Tests:** `npm run test` (Vitest) and `npm run test:e2e` (Playwright, against the packaged build). The four gates CI runs are `npm run lint`, `npm run typecheck`, `npm run typecheck:test` and `npm run test`; all must pass.
- **Commits:** use short, descriptive messages (e.g., `feat(i18n): add EN fallback`). Check `CONVENTIONAL_COMMITS.md` if it exists.
- **Branch:** keep the branch updated with `main` before opening a PR (`git pull --rebase origin main`).

## Project structure

```
clavis/
├── src/
│   ├── main/          # Electron main process (store, encryption, IPC)
│   ├── renderer/      # React + Tailwind frontend
│   └── shared/        # Types, channels, validation
├── tests/             # Vitest suites, *.test.ts(x)
│   └── e2e/           # Playwright specs, *.spec.ts (packaged build only)
├── docs/              # ADRs, milestones, user guide, capacity notes
├── flatpak/           # Flatpak manifest (experimental, does not build today)
└── .github/workflows/ # CI: quality -> e2e -> e2e-cross -> build -> release
```

## PR requirements

- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run typecheck` and `npm run typecheck:test` pass
- [ ] `npm run test` passes — **568 tests in 57 files** as of `v0.6.15-beta` (the count only goes up; it is not a target)
- [ ] No `release/` or `dist/` files included (see `.gitignore`)
- [ ] `CHANGELOG.md` updated if the change is user-visible
- [ ] `SECURITY.md` reviewed if the change touches encryption, IPC, or validation

## Development environment

```bash
npm install
npm run build
npm start          # Needs a Vite server on :3000 first; there is no `dev` script
npm run test       # Vitest
npm run typecheck && npm run typecheck:test && npm run lint
npm run make       # Build Linux targets (.deb, .AppImage)
```

## Code of conduct

- Be respectful and constructive.
- Prioritize clarity and security (especially in encryption and IPC code).
- If unsure, ask in the issue before implementing.

---

*Updated 2026-10-30. See `TODO.md` for what is open, `docs/MILESTONES.md` for the v1.0 gate, and `SECURITY.md` for the security model.*
