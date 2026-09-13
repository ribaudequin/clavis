# ADR 008: Build System — Electron Forge (Single System Resolution)

## Status
Accepted (`v0.1.1-alpha` / `P1.1`). Dual build system resolved (`P1.2` `v0.1.7-alpha`).

## Context
Initial setup had both Electron Forge (`forge.config.mts`) and `electron-builder` (`package.json` scripts). Config files (`forge.config.ts`, `vite.config.ts`, `vitest.config.ts`) had `.ts` / `.mts` mismatch, causing ESM/CommonJS errors.

## Decision
- **Keep Electron Forge** (`electron-forge` 7.11.2) as canonical; remove `electron-builder` configs.
- Rename all config files to `.mts` (`forge.config.mts`, `vite.config.mts`, `vitest.config.mts`).
- `tsconfig.json` excludes `*.config.mts` (preserves CommonJS for `src/main` runtime).
- Add `@electron-forge/maker-rpm` (`P1.11`) for Linux `.rpm` target.

## Consequences
- `npm run build` + `npm run make` validates all Linux targets (`.deb`, `.AppImage`, `.rpm`).
- `npm run release` (CI) produces 6 targets (Linux ×3, Windows Portable + NSIS, macOS `.dmg` — macOS built on native CI runner, not Wine).
- `P1.4` (code signing) deferred; build artifacts remain unsigned.
