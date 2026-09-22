# ADR 007: IPC Channel Names — Bundled Preload Import (CHAN-01 Resolved)

## Status
Resolved (2026-09-14). Supersedes the inline-constants workaround used in `v0.1.7-alpha`–`v0.3.3-alpha`.

## Context
`preload/index.ts` originally imported `shared/channels`, which failed at runtime in packaged builds (`module not found: ../../shared/channels.js`), blocking exposure of `electronAPI`.

Two root causes:
1. `sandbox: true` (`src/main/index.ts:20`): a sandboxed preload cannot `require()` local modules — only a small set of Electron/built-in modules.
2. The old `copy:preload` step (`cp dist/main/preload/index.js dist/main/preload.js`) moved the emitted file one directory level up, so the relative specifier `../../shared/channels` no longer resolved to `dist/shared/`.

The initial workaround inlined a duplicate `CHANNELS` object in the preload, creating drift risk (B5 partial, CHAN-01).

## Decision
- Bundle the preload with Vite (`scripts/build-preload.mjs`) into a single self-contained CommonJS file at `dist/main/preload.js`, with `electron` kept external and `CHANNELS` inlined at build time from the single source of truth `src/shared/channels.ts`.
- `src/main/preload/index.ts` now imports `CHANNELS` from the shared module; no duplicate constants.
- `copy:preload` removed (also resolves `BS-17` — `cp` was Unix-only).

## Consequences
- No runtime require of app-local modules in the sandboxed preload; `electronAPI` exposes correctly in packaged builds (verified in `AppImage`, `v0.3.4-alpha`).
- Single source of truth restored: rename a channel in `src/shared/channels.ts` and both main and preload pick it up; TypeScript catches drift at compile time.
- Build pipeline gains a bundling step (`npm run build:preload`); `scripts/build-preload.mjs` also removes the now-redundant `dist/main/preload/` directory emitted by `tsc`.
