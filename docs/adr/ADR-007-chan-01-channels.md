# ADR 007: IPC Channel Names — Inline CHANNELS (CHAN-01 Deferred)

## Status
Accepted as stable solution (`v0.1.7-alpha` through `v0.3.2-alpha`). `CHAN-01` deferred.

## Context
`preload/index.ts` failed to resolve `shared/channels` import in Electron ASAR (`module not found: ../../shared/channels.js`). Runtime regression blocked preload exposure of `electronAPI`.

## Decision
- Inline `CHANNELS` constants directly in `src/main/preload/index.ts` (kills import dependency).
- Central source of truth preserved in `src/shared/channels.ts` (for main process and tests).
- `CHAN-01` (original external import) deferred; inline approach accepted as stable.

## Consequences
- No runtime regression in packaged builds (`AppImage` verified with 1043 ASAR files).
- All 8 IPC handlers (`handleIPC`) covered by 34 tests (`tests/ipc-handlers.test.ts`).
- If preload needs new channels, add to both `shared/channels.ts` and inline preload (manual sync required until `CHAN-01` revisited).
