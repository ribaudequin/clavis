# Milestones — Alfa → Beta → v1.0

## v0.4.0-beta (Alfa → Beta)

**Gates (técnicos):** P0 resolvido, P1 resolvido, P2.16/19/20/21 resolvidos, testes verdes, build CI verde.

| ID | Milestone | Ref | Estado atual |
|---|---|---|---|
| P0.11 | Timing side-channel (`ipc-handlers.ts`) — respostas uniformes / comparação constante | `PLANO.md` P0.11 | ❌ Pendente |
| P0.12 | Size check antes de `decrypt` (`ipc-handlers.ts`) | `PLANO.md` P0.12 | ❌ Pendente |
| P1.13 | Argon2 parallelism ≥4 (`encryption.ts`) | `PLANO.md` P1.13 | ✅ Feito (`v0.3.8`) |
| P1.14 | KDF re-validation no unlock (`store.ts`) | `PLANO.md` P1.14 | ✅ Feito (`v0.3.8`) |
| P1.15 | Import token timer cleanup (`ipc-handlers.ts`) | `PLANO.md` P1.15 | ✅ Feito (`v0.3.8`) |
| P2.16 | `any` types — 78 warnings (`types.ts`, `ipc-handlers.ts`, etc.) | `TODO.md` P2.16 | ❌ Pendente |
| P2.17 | `JSON.parse` try/catch (`HomeScreen.tsx`) | `TODO.md` P2.17 | ✅ Feito (`v0.3.8`) |
| P2.18 | `RESTART_APP` relaunch (`ipc-handlers.ts`) | `TODO.md` P2.18 | ✅ Feito (`v0.3.8`) |
| P2.19 | Dirty-check back nav (`ViewDrawer`) | `TODO.md` P2.19 | ❌ Pendente |
| P2.20 | Modal backdrop standardization | `TODO.md` P2.20 | ❌ Pendente |
| P2.21 | Loading spinner (`ViewDrawer` save) | `TODO.md` P2.21 | ❌ Pendente |
| BS-06 | Auto-updater `latest.yml` (`electron-updater`) ou documentado | `PLANO.md` P1.11 / `TODO.md` | ❌ Pendente (404) |

**Critério de release beta:** Todos os itens acima fechados + `npm run lint` 0 erros + `npm run typecheck` ✅ + `npm run test` 79/79 ✅ + `npm run make` Linux `.deb` + `.AppImage` OK + CI `.github/workflows/release.yml` verde (`needs: quality` passa).

---

## v1.0 (Beta → Produção)

**Gates (técnicos):** Todos os P0–P2 fechados; P3 críticos concluídos; P4 governança completa; nenhum `❌` ativo; audit 0 🔴 Critical.

### P3 — UX / Acessibilidade / i18n / Testes

| ID | Milestone | Ref |
|---|---|---|
| P3.22 | `ErrorBoundary` `role="alert"`, `aria-live` (`ErrorBoundary.tsx`) | `PLANO.md` P3.22 |
| P3.23 | `SkeletonLoader` `aria-hidden`, `aria-busy` (`SkeletonLoader.tsx`) | `PLANO.md` P3.23 |
| P3.24 | `CreditsModal` i18n — 12 strings (`pt-PT`, `pt-BR`, `en`) | `PLANO.md` P3.24 |
| P3.25 | `ErrorBoundary` i18n — 4 strings | `PLANO.md` P3.25 |
| P3.26 | Toast messages i18n (`CreditsModal.tsx`) | `PLANO.md` P3.26 |
| P3.27 | Remover `|| 'fallback'` redundante (`ViewDrawer.tsx`) | `PLANO.md` P3.27 |
| P3.28 | Language selector (`src/i18n/index.ts`) | `PLANO.md` P3.28 |
| P3.29 | `useCallback` (`HomeScreen.tsx`) | `PLANO.md` P3.29 |
| P3.30 | Documentar `0o600` Windows (`README`) | `PLANO.md` P3.30 |
| P3.31 | Testes: 15 ficheiros (`main/index`, `logger`, `preload`, `i18n`, `CreateDrawerModal`, `ErrorBoundary`, `CreditsModal`, `DeleteConfirmModal`, `ToastProvider`, `SkeletonLoader`, `useFocusTrap`, `useModalKeyboard`, `types`, `channels`) | `TODO.md` P3.31 |

### P4 — Governança / Documentação

| ID | Milestone | Ref |
|---|---|---|
| P4.28 | `CHANGELOG.md` formalizado (tags + `MEMORY.md`) | `PLANO.md` P4.28 |
| P4.29 | `CONTRIBUTING.md` (setup, style, PR, commits) | `PLANO.md` P4.29 |
| P4.30 | `SECURITY.md` (responsible disclosure) | `PLANO.md` P4.30 |
| P4.31 | `.github/` templates (issue, PR) | `PLANO.md` P4.31 |
| P4.32 | ADRs formalizados (`docs/adr/`) | `PLANO.md` P4.32 |
| P4.33 | User guide (drawers, import/export, password recovery — by design not possible) | `PLANO.md` P4.33 |

### Build / Distribuição

- `forge.config.mts` removido; `package.json` `config.forge` é a fonte única (resolvido `v0.3.7`).
- Flatpak manifest versão corrigida (`0.3.7` vs `0.3.2`) — `BS-09` / `P3`.
- `BS-03` (`@electron-forge/maker-rpm`) — documentar omissão intencional se não for implementado.
- `BS-16` — atualizar dependências (`electron`, `react`, `typescript`, etc.) — avaliar risco antes de v1.

---

## Ordem de execução sugerida

1. **Beta (`v0.4.0-beta`):** `P0.11` → `P0.12` → `P2.16` → `P2.19–21` → `BS-06` (documentar se não resolver). Release quando tudo `✅`.
2. **v1.0:** `P3.22–31` (testes + a11y + i18n) → `P4.28–33` (docs) → `BS-09` (Flatpak) → final audit + tag `v1.0.0`.
