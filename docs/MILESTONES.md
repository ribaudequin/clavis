# Milestones — Alpha → Beta → v1.0

Status of the plan's milestones, checked against the code rather than against the plan. Every row states
what was measured and when; a row that cannot be verified is marked `❌` and says what is missing.

Last release: **`v1.0.0`** (2026-10-30, tag run `41105274767` — 9/9 jobs green, 6 assets, `prerelease: false`).
Next milestone: **post-1.0** — the Medium/Low findings in `audits/audit_2026-10-30.md`.

---

## v0.4.0-beta — Alpha → Beta (shipped 2026-09-30)

**Gate:** P0 and P1 resolved, P2.16/19/20/21 resolved, suite green, CI green.

| ID | Milestone | Status |
|---|---|---|
| P0.11 | Timing side-channel in `ipc-handlers.ts` — uniform error responses and a constant-time unlock path | ✅ Shipped `v0.4.0-beta` (`dummyDerive`) |
| P0.12 | Size check before `decrypt` — refuse an oversized payload instead of decrypting it | ✅ Shipped `v0.4.0-beta`; **hardened 2026-10-28**: the guard is now allocation-free and runs *before* the hex decode (`CiphertextTooLargeError`), and the post-decode check was deleted as unreachable |
| P1.13 | `argon2` parallelism ≥ 4 (`encryption.ts`) | ✅ `v0.3.8` |
| P1.14 | KDF re-validation on unlock (`store.ts`) — a drawer records its backend, and it wins over runtime availability | ✅ `v0.3.8` |
| P1.15 | Import token timer cleanup (`ipc-handlers.ts`) | ✅ `v0.3.8` |
| P2.16 | Pervasive `any` — 78 warnings project-wide | ✅ 2026-10-02: 78 → 0, `argon2` typed via `typeof import('argon2')`, test handlers derived from `ElectronAPI` |
| P2.17 | `JSON.parse` without `try/catch` (`HomeScreen.tsx`) | ✅ `v0.3.8` |
| P2.18 | `RESTART_APP` relaunches the app (`ipc-handlers.ts`) | ✅ `v0.3.8`; the renderer's discarded promise was fixed 2026-10-28 |
| P2.19 | Dirty-check on Back (`ViewDrawer`) — silent data loss | ✅ 2026-10-06, owner chose the three-way dialog (Cancel / Discard and leave / Save and leave) |
| P2.20 | Modal backdrop standardisation | ✅ **Closed 2026-10-30.** Unified all 5 modals to `bg-black bg-opacity-60` (Credits, Create, Password, Delete, Discard); removed `backdrop-blur-sm` from Credits. |
| P2.21 | Loading spinner while saving (`ViewDrawer`) | ✅ Renders the spinner only while `saving`, so a fast save does not flash |
| BS-06 | Auto-updater (`latest.yml` / `electron-updater`) or documented alternative | ✅ 2026-10-01: `electron-updater` removed, replaced by a manual GitHub Releases check in the main process (2026-10-28: redirects followed, body capped) |

**Beta release criterion as written:** all of the above closed, `lint` 0 errors, `typecheck` clean, `test` green,
`npm run make` producing `.deb` + `.AppImage`, CI green. **It shipped** — the one row that is not green is P2.20,
which was never a blocker for Beta and is carried into v1.0 below.

---

## v1.0 — Beta → Production

**Gate as written:** every P0–P2 closed, the critical P3 items done, P4 governance complete, no active `❌`, and
no 🔴 finding in the audit. The audit of 2026-10-17 closed every P0/P1/P2 it raised; what remains is listed at the
end of this file.

### P3 — UX / accessibility / i18n / tests

| ID | Milestone | Status |
|---|---|---|
| P3.22 | `ErrorBoundary` `role="alert"` / `aria-live` | ✅ 2026-10-13 (`a1fd5ab`) |
| P3.23 | `SkeletonLoader` `aria-hidden` / `aria-busy` | ✅ 2026-10-13 (`dde3c16`) |
| P3.24 | `CreditsModal` i18n (~19 strings) | ✅ 2026-10-05 (`ADR-009`) |
| P3.25 | `ErrorBoundary` i18n (4 strings) | ✅ 2026-10-05 |
| P3.26 | Toast messages i18n | ✅ 2026-10-05 |
| P3.27 | Redundant `\|\| 'fallback'` patterns removed | ✅ `ViewDrawer` and `DeleteConfirmModal` — `t()` returns the key, so the fallback could never fire |
| P3.28 | In-app language selector | ⛔ **Cancelled 2026-10-05** — the app follows the system language |
| P3.29 | `useCallback` in `HomeScreen` | ⛔ **Dropped 2026-10-28** — memoising handlers changes no commit while the children re-render with the parent |
| P3.30 | `0o600` on Windows documented honestly | ✅ 2026-10-16 — `README.md` and `SECURITY.md` state that the mode is POSIX-only and that a copied file keeps whatever mode it arrived with |
| P3.31 | Missing test modules (15 named files) | ✅ every named file has one; the suite is **577 tests across 60 files** (2026-10-30, `v1.0.0`) |
| P3.31b | Four of those are shape-only smoke tests | ✅ **Closed 2026-10-30** — `ToastProvider`, `SkeletonLoader`, `types` and `channels` now assert behaviour or real values, not `typeof mod.X` |

### P4 — Governance / documentation

| ID | Milestone | Status |
|---|---|---|
| P4.28 | `CHANGELOG.md` formalised | ✅ per-release sections back to `v0.4.7-beta`, back-filled where they were missing |
| P4.29 | `CONTRIBUTING.md` (setup, style, PR, commits) | ✅ |
| P4.30 | `SECURITY.md` (responsible disclosure) | ✅ |
| P4.31 | `.github/` templates | ✅ issue template since 2026-10; the PR template existed at `.github/template/pull_request_template.md`, which GitHub **does not discover** — moved to `.github/pull_request_template.md` on 2026-10-30 |
| P4.32 | ADRs in `docs/adr/` | ✅ 9 ADRs (build system, encryption, i18n, code signing, auto-update, Flatpak, channels) |
| P4.33 | User guide | ✅ `docs/user-guide.md` — drawers, import/export, and password recovery being impossible by design |

### Build / distribution

- **Forge config lives in `package.json` → `config.forge`.** `forge.config.mts` is gone: Forge 6.4.2 resolves
  config through `interpret`, whose map has no `.mts`, so the file was silently ignored. Do not re-introduce it.
- **No `.rpm`** — `rpmbuild` cannot strip the argon2 prebuilds, so Linux ships `.deb` + `.AppImage` only
  (documented in `BUILD_MANUAL.md`).
- **Flatpak** — **dropped 2026-10-30.** The manifest is pinned to `0.3.4-alpha`, never built, `npm run clean`
  deletes its source path, and it was never published to Flathub; `README.md`/`SECURITY.md` document the drop.
- **BS-16** — dependency review **audited 2026-10-30**: `npm audit` reports 43 dev-chain advisories (4 critical,
  32 high, 7 moderate) and no production advisory beyond `zod` (fixed in `v1.0.0`). The upgrade of the dev chain
  is deferred post-1.0; the pinned `@electron-forge` 6.4.2 is a deliberate supply-chain choice, not a stale pin.

---

## v1.0.0 — shipped 2026-10-30

| Item | Status |
|---|---|
| Tag and release | ✅ `v1.0.0` at `c4404d2`; tag run `41105274767` **9/9 green**; 6 assets, `prerelease: false`, `/releases/latest` = `v1.0.0` |
| Audit High findings | ✅ `QA-01`, `DATA-01`, `SEC-01`, `UX-01` closed (see `audits/verification_2026-10-30-blockers.md`) |
| Gates | ✅ lint 0 errors / 2 warnings · both typechecks 0 · **577/577** vitest in 60 files · e2e **14/14** on Linux, Windows and macOS |
| P2.20 / P3.31b / guard / artifacts / Flatpak | ✅ all closed before the tag |
| CI guard | ✅ `scripts/check-tag-version.sh` + `npm run check:tag` in `quality`; artifact names and SHA-256 verified before publishing |
| macOS `.dmg` | ✅ renamed `clavis-<version>.dmg`; the first tag run failed on the old unversioned name (run `41101945946`) |

**What comes after 1.0:** the 21 Medium and 20 Low findings in `audits/audit_2026-10-30.md` §5-6, tracked as
checkboxes in `TODO.md`. The first ones worth taking: the import TOCTOU/token cap (`SEC-04`), the save-path
schema parse (`DATA-02`), store errors rendering an empty vault (`DATA-03`), the crash hooks and backup policy
(`DATA-04`), coverage thresholds in CI (`QA-03`) and the release-workflow trust boundary (`REL-04`).
