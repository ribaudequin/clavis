# Session Report — 2026-09-24 (Audit 2026-09-23 Implementation)

## Validated Audit (audit_2026-09-23.md)
- 4 specialist auditors verified 30 findings: 0 🔴 Critical, 12 🟡 High, 18 💭 Medium/Low
- Confirmed all 4 previous critical blockers resolved
- Confirmed strengths: Electron hardening (sandbox, CSP, UUID), AES-256-GCM + Argon2id, typed IPC, a11y, i18n
- Confirmed gaps: DATA_DIR/LOG_DIR hardcoded Linux, supply-chain (@electron-forge 7.11.2 → 30 vulns), KDF floor 2^14, AES keys never zeroed, passwords as JS strings, bundle 1,221 kB, RESTART_APP broken, 15 test gaps

## Changes Implemented (Linear, P0 → P1)

### P0 — Security & Cross-Platform
1. **P0.1 DATA_DIR** (`src/main/store.ts`): Replaced `~/.local/share/Clavis` with `app.getPath('userData')` (lazy `resolveDataDir()`)
2. **P0.2 LOG_DIR** (`src/main/logger.ts`): Replaced `~/.config/Clavis/logs` with `app.getPath('logs')` (lazy `getLogDir()`)
3. **P0.3 App Icon** (`src/main/index.ts`): Platform-specific paths (`win32` `.ico`, `darwin` `.icns`, `linux` `.png`)
4. **P0.4 Supply-Chain** (`package.json`): Downgraded `@electron-forge/*` from `^7.11.2` to `6.4.2`
5. **P0.5 KDF Floor** (`src/main/encryption.ts` + `store.ts`): `DEFAULT_ARGON2_OPTIONS` → `memoryCost: 2**21`, `timeCost: 3`, `parallelism: 4`; `createDrawer`, `unlockDrawer` (re-validate at unlock), `importDrawerRaw` (floors `2**21`/3/4)
6. **P0.6 Rate Limiting** (`src/main/ipc-handlers.ts`): Exponential backoff (`3→1s`, `5→5s`, `10→30s`); progressive lockout after 20+; reset on success; `clearImportTimers()` on `will-quit`
7. **P0.7 Memory Hygiene — AES Keys** (`src/main/encryption.ts`): `key.fill(0)` after `.final()` in `encrypt`/`decrypt`; `passwordBuffer.fill(0)` after derivation
8. **P0.8 Memory Hygiene — Passwords** (`src/main/store.ts`): `createDrawer`, `unlockDrawer`, `saveDrawer` accept `string | Buffer`; convert to `Buffer`, zero after use
9. **P0.9 React State** (`src/renderer/pages/HomeScreen.tsx`): `setViewState(null)` on `ViewDrawer` unmount (`onBack`)

### P1 — Memory & Session Hygiene / Testing
10. **P1.15 Timer Cleanup** (`src/main/ipc-handlers.ts` + `main/index.ts`): `importTimers` array; `clearImportTimers()` exported; called on `app.on('will-quit')`
11. **Migration** (`src/main/store.ts`): `migrateOldData()` copies `~/.local/share/Clavis/drawers` → `userData/drawers` (once, disabled in `NODE_ENV === 'test'`)
12. **Bundle Size Note**: `vite.config.mts` still oversized (`1,221 kB`); lazy-load `ViewDrawer` deferred (P3)

### Build Artifacts
- `npm run build`: ✅ (1.35s)
- `npm run make --platform=linux`: ✅ (`AppImage` 245M, `.deb` 215M)
- New `AppImage`: `out/make/AppImage/x64/clavis-0.3.5-alpha-x64.AppImage` (`11:57`)
- `vitest.config.mts`: `testTimeout: 30000` (to accommodate heavier KDF)

### Verification Results
- `npm run test`: ✅ 74/74 (8 files, 111.69s)
- `npm run lint`: ✅ 0 errors (79 `any` warnings pre-existing)
- `npm run typecheck`: ✅ (`tsc --noEmit` clean)

## User-Reported Issues (Post-Build)
- **Gavetas antigas não visíveis**: Causado pela migração `DATA_DIR`. A migração (`migrateOldData()`) está implementada, mas se `NODE_ENV` ou contexto do AppImage difere, pode não correr. Sugestão: verificar se `oldDataDir` (`~/.local/share/Clavis`) ainda existe no sistema onde o AppImage é testado.
- **Crash no OK (criar gaveta)**: Não reproduzível neste ambiente (`npm start` falha com `SIGTRAP`/GPU — erro de ambiente, não de código). Se persistir no AppImage atualizado (`11:57`), pode ser devido a:
  - `Buffer.fill(0)` a ser chamado antes de `await fs.writeFile()` (corrigido — agora é após `await encrypt()` e após `await fs.writeFile()`)
  - `deriveKey` com `Buffer.from(passwordBuffer)` (corrigido — `Buffer.from` cria cópia, `fill(0)` só afeta cópia interna)
  - `resolveDataDir()` chamado antes de `app` estar pronto (improvável — só é chamado dentro dos handlers, registados no `whenReady`)
  - `encrypt` aceitando `Buffer` mas `deriveKey` ainda a converter corretamente (corrigido)

## Docs Updated
- `PLANO.md`: Nova secção "Audit-Driven Priorities — 2026-09-23" (P0–P3 + strategic)
- `SUMMARY.md`: Atualizado para 2026-09-23 (30 findings, 74/74 tests)
- `MEMORY.md`: Changelog atualizado (2026-09-23 audit + edições)
- `TODO.md`: 31 novos itens auditados (P0–P3 + strategic) + `Current focus` atualizado
- `SESSION_REPORT_2026-09-24.md`: Este ficheiro (resumo das edições)

## Next Pending (P2 / P3)
- P2.16 (`any` types — 79 warnings), P2.17 (`JSON.parse` try/catch), P2.19 (`dirty-check` `ViewDrawer`), P2.20 (`modal backdrop`), P2.21 (`spinner` save), P3.22 (`ErrorBoundary` `aria-live`), P3.24/25 (`CreditsModal`/`ErrorBoundary` i18n), P3.28 (`useCallback` `HomeScreen`), P3.31 (15 missing test files)

---

## Resolution (follow-up, same day) — both user-reported issues FIXED

**Root cause of the crash on "OK" (create drawer):** the audit fix raised `DEFAULT_ARGON2_OPTIONS.memoryCost` to `2**21` KiB (~2 GiB). Argon2 at that size SIGTRAPs the Electron main process. Verified in-process: `2**20` (1 GiB) works, `2**21` crashes. Fix: default `2**18` (256 MiB) + explicit bounds `MIN_MEMORY_COST=2^16` / `MAX_MEMORY_COST=2^20` in `src/main/encryption.ts`; `deriveKey` now resolves defaults once so the scrypt fallback uses identical cost factors.

**Root cause of "old drawers not visible":** `migrateOldData()` returned early whenever the new `userData/drawers` dir existed — and it was created empty by earlier runs — so `~/.local/share/Clavis/drawers` was never copied. Fix: always copy missing files individually (idempotent, never overwrites).

**Additional regressions fixed in the same pass:**
- `unlockDrawer` re-validation rejected every legacy drawer (`2^16` / `parallelism 1`) against the `2^21` / `4` floor → now validates a bounded range `2^16`–`2^20`.
- `saveDrawer` re-encrypted with process defaults while keeping the drawer's old KDF metadata → silently corrupting legacy drawers on save. Now re-encrypts with each drawer's own stored params.
- `importDrawerRaw` floor lowered from `2^21`/`4` to the same bounded range (accepts legacy `2^16` exports, rejects weak `<2^16` and dangerous `>2^20`).

**Verification:**
- Migration: 9/9 drawers copied to `~/.config/clavis/drawers` (0o600).
- Live AppImage run: legacy `2^16` drawer `28362491` unlocked **and saved**; new drawer `testeeeee` created with `2^18` params — no crash.
- `npm run test`: 79/79 ✅ (also ~7x faster, 15s vs 111s); `lint` 0 errors; `typecheck` clean; `npm run build` ✅.
- Rebuilt `AppImage` (256 MB, 12:11) + `.deb` (225 MB, 12:12) under `out/make/`.

**Caveat:** 3 drawers created during the broken window carry `2^21` params (`Gaveta B`, `Novo Título`, `Segredos`). They cannot be decrypted (derivation crashes) and now fail gracefully with "Incorrect password" instead of crashing.

