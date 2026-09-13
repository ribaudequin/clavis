# Contributing — Clavis

Thank you for your interest in contributing to Clavis!

## How to contribute

1. Open an issue on [GitHub](https://github.com/ribaudequin/clavis) to discuss the change before working on it.
2. Fork the repository.
3. Create a branch from `main`: `git checkout -b feature/my-change`.
4. Make changes with clear commits.
5. Open a Pull Request (PR) with a concise description of what was done and why.

## Code conventions

- **Language:** TypeScript (frontend + backend), `.mts` for configs (`forge.config.mts`, `vite.config.mts`, `vitest.config.mts`).
- **Style:** `prettier` + `eslint.config.cjs` (see root file).
- **Tests:** `npm run test` (Vitest + Playwright E2E). All tests must pass (`npm run lint`, `npm run typecheck`, `npm run test`).
- **Commits:** use short, descriptive messages (e.g., `feat(i18n): add EN fallback`). Check `CONVENTIONAL_COMMITS.md` if it exists.
- **Branch:** keep the branch updated with `main` before opening a PR (`git pull --rebase origin main`).

## Project structure

```
clavis/
├── src/
│   ├── main/          # Electron main process (store, encryption, IPC)
│   ├── renderer/      # React + Tailwind frontend
│   └── shared/        # Types, channels, validation
├── tests/
│   ├── ipc-handlers.test.ts
│   └── e2e/           # Playwright (clavis.spec.ts)
├── docs/             # Additional documentation
├── flatpak/          # Flatpak manifest
└── .github/workflows/ # CI (quality, build, release)
```

## PR requirements

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (51/51 or more)
- [ ] No `release/` or `dist/` files included (see `.gitignore`)
- [ ] `CHANGELOG.md` updated if the change is user-visible
- [ ] `SECURITY.md` reviewed if the change touches encryption, IPC, or validation

## Development environment

```bash
npm install
npm run build
npm start          # Dev mode (Electron + Vite)
npm run test       # Vitest
npm run make       # Build Linux targets (.deb, .AppImage, .rpm)
```

## Code of conduct

- Be respectful and constructive.
- Prioritize clarity and security (especially in encryption and IPC code).
- If unsure, ask in the issue before implementing.

---

*Updated 2026-09-12. See `PLANO.md` for roadmap and `SECURITY.md` for security model.*
