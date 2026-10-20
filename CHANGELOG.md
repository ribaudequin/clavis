# Changelog — Clavis

## v0.6.8-beta (2026-10-20)

**The password policy now accepts a passphrase — and the floor is still 12 characters, not 20.**
**The unlock wait is now cancellable and counted, so the prompt is no longer a trap.**

### Changed

- **UX-08 — the unlock prompt could not be closed while the unlock was in flight.** The password
  input was `disabled` for the duration, so the browser moved the focus to `<body>`, and the
  Escape listener lives on the modal *container* — a keydown that starts on `<body>` travels upward
  and never reaches a descendant. Under the rate limiter (3 failures → 1 s, 5 → 5 s, 10 → 30 s,
  per drawer) the prompt was therefore frozen for up to 30 seconds with no way out, and the
  attempt counter that REL-02 shipped had nothing to invalidate. The **Cancel button is no longer
  disabled** during the wait and **the focus moves to it**, so a real Escape press reaches the
  listener; the focus returns to the input when the attempt ends. The remaining seconds are shown,
  counted down from a deadline, and the number is announced once rather than every second.
- **SEC-08 — a 30-character passphrase was refused.** The create-time policy required an
  upper-case letter, a lower-case letter, a digit and a symbol, and nothing else was accepted, so
  a user who already had a passphrase had to apply a deterministic transformation to it —
  `correct horse battery staple1!` — that an attacker's rules dictionary already enumerates. The
  policy is now **two alternatives**: **at least 20 characters of any mix**, or **at least 12
  characters with an upper-case letter, a lower-case letter, a digit and a symbol** (maximum 128).
  **The floor is 12, not 20:** a 19-character mixed password is accepted, and the app does not
  require 20 characters as such.
- **Length is counted in code points**, not in UTF-16 code units, so an astral character counts
  once. The policy's minimum and the schema's 128-character maximum are now measured in the same
  unit, and ten emoji are ten characters rather than a twenty-character passphrase.
- **One module owns the rule, and the renderer calls it.** `src/shared/password-policy.ts` owns
  the two thresholds, the check, the wording and the strength meter's scoring. The main process
  enforces it (`CreateDrawerSchema` and the store) and the renderer applies the same module to the
  create form, so the form and the schema cannot disagree.
- **The strength meter's labels are translated** (UX-02). They were hardcoded Portuguese in an
  otherwise fully translated component, and they now go through `t()` in both catalogues.
- **Nothing on disk changes.** The policy is not stored in the `.clavis` file — the file records
  the drawer's `keyDerivation` parameters, not the rule that was applied to it — so there is no
  migration, no format bump, and no drawer written by any version is affected. Almost every password
  the previous policy accepted is still accepted — the one exception is a password carrying an
  astral character, because the previous rule counted UTF-16 units and this one counts code
  points, and such a drawer still opens and still saves. The rule stays create-time only: a save
  can only re-use the password that already opens the drawer.
- **The Windows executable carried Electron's default icon — and so did the macOS `.app`, and the
  window icon everywhere.** The packager resolves the platform's icon format by rewriting the
  extension of the configured path in place, and `config.forge.packagerConfig.icon` pointed at
  `icons/linux/512x512.png`, whose `.ico` and `.icns` siblings did not exist. The packager skipped
  the icon — **silently**, because Forge hardcodes `quiet: true` and electron-packager's
  `common.warning()` prints nothing under it, so the "Could not find icon" line never reached the
  build log, local or on CI. Separately, the window icon's runtime path
  (`path.join(__dirname, '..', 'icons', …)`) resolved to `<app root>/dist/icons/…`, which no build
  produces: the icons sit at `<app root>/icons`, a sibling of `dist`, so the path needed two levels
  up. **Fixed by a layout** — the three formats now sit side by side with the same basename
  (`icons/clavis.png`, `icons/clavis.ico`, `icons/clavis.icns`), which is what the extension rewrite
  needs — and by the corrected runtime path. **New guard:** `tests/packaging-icon.test.ts` calls
  the packager's own resolution and asserts that each platform's format resolves to a file that
  exists, that the makers' local icons exist, and that the runtime path climbs the right number of
  levels.
- **The documentation now states the rule the code enforces.** `SECURITY.md` describes both
  branches and the floor of 12, says why length is checked before shape, and adds a known
  limitation for what the rule is *not*: a length-and-shape gate, not an entropy check, with no
  common-password blocklist. `README.md`, `PLANO.md` and `docs/user-guide.md` were still carrying
  an 8-character minimum that had not been true since HYG-22, and now carry the real rule.

### Verified

- `lint` 0 errors / 2 pre-existing warnings · `typecheck` 0 · `typecheck:test` 0 · **478/478** vitest
  across 46 files · `npm run make` OK (deb + AppImage) · e2e **14/14** against
  `out/clavis-linux-x64` **and** **14/14** against the AppImage, in **both** locales — the
  packaged binary, not the source tree.
- **The icon fix was proved on the real Windows executable, not asserted.** The Windows target was
  cross-compiled with Wine: the fixed build embeds **all nine PNG sizes** of the Clavis icon in
  `clavis.exe` (searched byte-for-byte — the `.ico` is PNG-based), and the **control build with
  the old configuration embeds none of them**.
- The e2e fixture password is now **22 characters and carries all four character classes**, so it
  satisfies both branches of the policy instead of leaning on the composition branch alone.
- **Mutations, measured** (the project's standing negative control): dropping the 20-character
  branch → 9 tests red · dropping the 12+4 branch → 40 · dropping one required class → 9 ·
  counting the length in UTF-16 units → 4 · the policy wording losing the 20-character path → 1
  (**before this change: none** — the negative control the 2026-10-18 plan claimed and never had) ·
  re-inlining the old rule in the renderer → 6 · re-inlining the new rule faithfully → 2, the
  structural guards only · the meter scoring on its own → 4.

## v0.6.7-beta (2026-10-19)

**A cancelled unlock no longer opens the drawer — and the measurement behind it says the
current interface cannot reach that state anyway.**

### Fixed

- **REL-02 — a cancelled unlock still opened the drawer.** The unlock prompt and the unlock
  are two different clocks: the prompt can be dismissed while the main process is still
  deriving the key (the rate limiter sleeps *before* the derivation, up to 30 s), and the
  result then arrives long after the user closed it — and it opened the drawer anyway. The
  renderer now gives each unlock attempt a number, the cancel side invalidates it, and a
  result whose attempt is no longer current is dropped instead of opening a drawer the user
  refused. The same guard covers the failure paths, so a cancelled attempt's error cannot
  land on whichever drawer the user opened next.
- **This is a safety net, and the measurement says so.** While the unlock runs the password
  input is `disabled`, the focus moves to `<body>`, and the Escape listener is on the modal
  **container** — so a real keypress cannot dismiss the prompt, and no user can reach the
  state the defect is about today. Measured in the packaged app: the dialog stays on screen
  after an Escape press during an unlock. The consequence is filed separately as **UX-08**:
  under the rate limiter the prompt is frozen for up to 30 s with no way out, and it should
  show a countdown and be dismissible — which is what this fix makes safe.

### Verified

- `lint` 0 errors / 2 pre-existing warnings · `typecheck` 0 · `typecheck:test` 0 · **415/415**
  vitest across 43 files, including 6 new tests for the cancelled unlock · `build` OK ·
  `package` OK · e2e **14/14** against `out/clavis-linux-x64` and **14/14** against the
  AppImage, in both locales.
- The end-to-end proof builds its window out of the application's own rate limiter — five
  wrong passwords, the 5 s tier, sleeping before the derivation — and dismisses the prompt
  with a keydown dispatched on the container that owns the listener, which the spec states
  plainly as a simulation. **A control runs the identical flow without the dismissal, and
  the drawer opens** — that is what makes "the drawer did not open" mean something.
  **Mutation-verified:** reverting the counter and the guard fails the first test and
  leaves the control green.
- **CI, in the order the discipline requires:** `main` pushed alone (run `39303981628` —
  `quality` + both `e2e` legs green, `build`/`release` skipped), then tagged (run
  `39304464489` — **7 jobs green**, 6 artifacts). `/releases/latest` answers `v0.6.7-beta`,
  `prerelease: false`.

## v0.6.6-beta (2026-10-19)

**Two Clavis processes could open the same data directory, and the second one silently discarded
the first one's save.**

### Fixed

- **SEC-09 — no single-instance lock.** `saveDrawer` is a read-modify-write with no lock of its
  own, so two processes on the same `userData` directory would both load a drawer and the last
  write would win, discarding the other change. The main process now takes Chromium's
  single-instance lock (`app.requestSingleInstanceLock()`) at startup, **before** `app.whenReady()`:
  a second process on the same profile writes the refusal to the log file and quits without
  creating a window, registering the IPC handlers or touching the drawer store, while the
  instance holding the lock is brought forward (a minimized window is restored and focused).
  The lock is per data directory, so a second instance with a different profile is an
  independent application and is unaffected.
  The decision lives in `src/main/single-instance.ts`; `src/main/index.ts` only wires it up.

### Changed

- `SECURITY.md` now documents the single-instance lock under *Process and window hardening*.
  Two stale claims in the same file were corrected while it was open: the password policy was
  still described as a minimum of 8 characters (it is 12 plus four character classes, and a
  create-time rule only), and the "renderer and main process disagree on password length" note
  no longer describes anything — both sides now apply the same rule.

### Verified

- `lint` 0 errors / 2 pre-existing warnings · `typecheck` 0 · `typecheck:test` 0 · **409/409**
  vitest across 42 files, including 9 new unit tests for the lock · `build` OK · `package` OK ·
  e2e **12/12** against `out/clavis-linux-x64` (10 existing + 2 new).
- The same **12/12** against the **AppImage** (`clavis-0.6.6-beta-x64.AppImage`, 136 MB), in
  both locales. The AppImage is the artifact users download, and it takes a different spawn shape
  (its own path has to be passed as `argv[1]` as well as the executable), so the release artifact
  is now the one that was measured. The asar inside it carries the lock, and the package
  whitelist still holds — `/dist`, `/icons`, `/node_modules`, `/package.json` and nothing else.
- The end-to-end proof runs against the **packaged** binary: a second instance on the same
  profile exits by itself (code 0, ~450 ms) while the primary keeps running, and a negative
  control on a private profile must keep running. Four mutations were measured — removing the
  lock call, removing the quit, letting the loser reach `whenReady()`, and taking the lock on a
  machine-wide path instead of the profile's. The last one leaves the first test green and
  breaks only the control.
- **CI, in the order the discipline requires.** `main` was pushed alone first (run `39292417218`)
  and **it failed** — the two new e2e tests died of `SIGTRAP` before reaching the lock, because
  the spawned instance was not launched the way Playwright launches the first one (Chromium's
  SUID sandbox, which the CI runner's AppArmor policy makes mandatory). The failure was
  reproduced locally with `unshare --user` before anything was changed, fixed in `9a4f4ab`
  (`--no-sandbox`, where Playwright puts it), and `main` was pushed again (run `39293681716`:
  `quality` + both `e2e` legs green, `build`/`release` skipped). Only then was the tag cut (run
  `39294150563`: **7 jobs green**, 6 artifacts). `/releases/latest` answers `v0.6.6-beta`,
  `prerelease: false`.

## v0.6.5-beta (2026-10-19)

**Corrupt drawer metadata is now a named failure instead of a wrong password, and CI runs on the
Node 24 action runtime.**

### Fixed

- **SEC-07 — malformed or oversized metadata reached the renderer.** `listDrawers()` now validates
  every file with the same schema used at import and skips invalid entries (logging the reason),
  including files whose internal `id` disagrees with the filename. An object `title` or an
  `iconData` array with a million entries can no longer be forwarded to `renderIcon()`/React.
- **SEC-05 — a damaged crypto field was reported as a wrong password.** `salt`/`iv`/`authTag` must
  now be 32 hex characters and `encryptedData` must be even-length hex (empty is valid); the schema
  also bounds `iconData` to a JSON array of at most 64 strings. `unlockDrawer()` returns the new
  `corrupt_metadata` reason **before** touching `keyDerivation` or any crypto field. It maps to
  `INVALID_JSON` and is deliberately excluded from the rate limiter, so eight damaged-file attempts
  do not park on a timer. `keyDerivation.algorithm` stays optional so legacy drawers still validate.
- **The derived key could survive a decrypt failure.** `createDecipheriv`/`setAuthTag` moved inside
  the zeroing path, so a malformed IV no longer throws with the key still in memory.

### Changed

- **CI runs on Node 24.** GitHub retired the Node 20 action runtime on 2026-09-23 and now forces
  actions onto Node 24, which produced a deprecation annotation on every run. Bumped to the Node 24
  majors: `actions/checkout@v5`, `actions/setup-node@v5`, `actions/upload-artifact@v6`,
  `actions/download-artifact@v7`, `softprops/action-gh-release@v3`. The CI `node-version` moved from
  22 to 24 to match the development machine. Each action tag was verified to declare
  `using: node24`. This project never used Node 24 in CI — it started at 20 and was bumped 20→22 on
  2026-09-03 because Electron 44 requires ≥22.12; the security-motivated downgrade in this repo was
  `@electron-forge` 7.11.2→6.4.2, which is unaffected.
- `README.md`, `BUILD_MANUAL.md` and `docs/clavis-ci-cd-setup.md` now state the real floor
  (Node 22+) and the current CI version (24). The CI reference doc also gained the `e2e` job it had
  been missing.

### Verified

- `lint` 0 errors / 2 pre-existing warnings · `typecheck` 0 · `typecheck:test` 0 · **400/400**
  vitest across 41 files, including 12 new metadata tests and 2 new IPC tests · `build` OK ·
  `package` OK · e2e **10/10** against `out/clavis-linux-x64` on Node v24.21.0.
- **CI, in the order the discipline requires:** `main` pushed alone (run `39256677933` —
  `quality` + both `e2e` legs green, `build`/`release` skipped), then tagged (run `39257105778` —
  **7 jobs green**, 6 artifacts). The Node 20 deprecation annotation is gone; the only remaining
  annotations are the two pre-existing `no-explicit-any` warnings and GitHub's Ubuntu 26 migration
  notice. `/releases/latest` answers `v0.6.5-beta`, `prerelease: false`.

## v0.6.4-beta (2026-10-19)

**SEC-01 was only half-fixed, and the test that was supposed to prove it is what exposed that.**
A drawer recorded which KDF backend derived its key, but the value was never read back: decryption
picked a backend from runtime availability instead of from the file.

### Fixed

- **SEC-01 — a drawer would not open on a build different from the one that created it.** A drawer
  created with the scrypt fallback (a build where the native `argon2` module failed to load, most
  often a cross-compiled Windows build) stored `algorithm: "scrypt"` and then refused to open on any
  machine where `argon2` *did* load: the password was correct, the KDF was not, and the app reported
  `wrong_password`. Measured, not inferred — a hand-built scrypt drawer with the right password
  returned `{ ok: false, reason: 'wrong_password' }` on an argon2 build. Decryption and re-encryption
  now use the backend recorded in `keyDerivation.algorithm`, so a scrypt drawer opens anywhere and a
  save keeps the recorded backend instead of silently re-encrypting with a different one.
- **A drawer that needs `argon2id` on a build without it now fails honestly.** It returns the new
  `KDF_UNAVAILABLE` error instead of `WRONG_PASSWORD`, so a correct password is not reported as wrong
  and the attempt does not count against the unlock rate limiter. Files created before the field
  existed keep the previous behaviour.
- **The scrypt fallback could not create a drawer at the default parameters.** `2^18 KiB` maps to
  `N = 2^16`, which needs 64 MiB of memory, while Node's default `maxmem` is 32 MiB — so derivation
  threw `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`. An explicit `maxmem` is now passed.

### Changed

- **HYG-21 (assertions that no longer assert), sub-items 1, 2 and 4.** `countCodePoints` is now
  observed through `String.prototype[Symbol.iterator]` (zero calls, where the spread form would call
  it once), the `ViewDrawer` test spreads the real limits module instead of reimplementing it, and
  the SEC-01 metadata test now goes through `store`. The cross-backend fixture is built with Node's
  `crypto.scrypt` directly and checked against a reference key — building it with `encrypt()` on both
  sides let one bug hide behind the other.

### Verified

- Locally, before tagging: the AppImage built from these commits passed e2e **10/10** with
  `LANGUAGE=en` and **10/10** with `LANGUAGE=pt`, and its `app.asar` was inspected to confirm the fix
  is actually inside the artifact — `KdfBackendUnavailableError`, `kdf_backend_unavailable`,
  `KDF_UNAVAILABLE` and the scrypt `maxmem` are all present, the archive still contains only
  `dist/`, `icons/`, `node_modules/` and `package.json`, and `argon2.glibc.node` is unpacked.
- `main` pushed alone first, so the tag could not publish an unproven commit: run `39239211155` —
  `quality`, `e2e (en)` and `e2e (pt)` green, `build`/`release` **skipped**. Then the tag: run
  `39239619463`, **7 jobs green**, 6 artifacts, AppImage 123 MB.
- The release page is the part a user can observe: **`v0.6.4-beta` carries the `Latest` badge and
  `prerelease: false`**, and `GET /repos/ribaudequin/clavis/releases/latest` answers it.

## v0.6.3-beta (2026-10-18)

**The first round in a while that changes shipped behaviour rather than tests** — and it fixes
something users could see: until now every beta since v0.5.1 was published as a *pre-release*,
so the app's update check kept telling everyone they were current.

### Fixed

- **The app told users they were up to date when they were not.** The update check reads
  GitHub's `/releases/latest`, which returns the newest release that is **not** a pre-release.
  `v0.6.0-beta`, `v0.6.1-beta` and `v0.6.2-beta` were all published as pre-releases, so that
  endpoint still answered `v0.5.1-beta` — the release that shipped before the `prerelease:`
  flag was restored. Three releases existed and none of them was "latest". `beta` is now
  published as a normal release; `alpha` and `pre` remain pre-releases.
- **HYG-25 — the shipped application contained the entire project directory.** `packagerConfig`
  had no file filter, so `electron-packager` copied everything not on its built-in ignore list:
  the TypeScript source, the whole test suite, `docs/`, `scripts/`, and — because a local
  `flatpak-make` had been run — a **119 MB** `repo/` directory that is 74% of the asar. It also
  carried `MEMORY.md`, `SUMMARY.md`, `TODO.md` and the `PLANO-*.md` notes (7.3 MB), which are
  gitignored and were never meant to ship. The filter is a whitelist now: only `dist/`,
  `node_modules/`, `package.json` and `icons/` are packaged. **Note the earlier entry in MEMORY
  attributing the local-vs-CI size gap to `mksquashfs` compression was wrong** — the CI artifact
  is built from a clean checkout and never contained `repo/`.

### Verified

- `main` pushed alone first, so the tag could not publish an unproven commit: run
  `39156850554` — `quality`, `e2e (en)` and `e2e (pt)` green, `build`/`release` **skipped**.
  Then the tag, run `39157060048` — **7 jobs green**, 6 artifacts.
- The release page is the proof that mattered: **`v0.6.3-beta` carries the `Latest` badge and
  `prerelease: false`**, and `GET /repos/ribaudequin/clavis/releases/latest` now answers
  `{"tag": "v0.6.3-beta", "prerelease": false}` — where it answered `v0.5.1-beta` an hour
  earlier. That endpoint is the only input the app's update check has, so this is the change a
  user can observe.
- AppImage: **123 MB** on CI, 131 MB locally, against 253 MB before this release — the 119 MB
  `repo/` is gone from the shipped archive.

### Changed

HYG-22 — SEC-03's two halves plus the residue of REL-01. Spec:
`PLANO-PASSWORD-POLICY-2026-10-18.md`.

### Changed

- **One password policy, one module.** New `src/main/password-policy.ts` owns the minimum
  length, the four character classes, the check and the wording. Both `.min(8)` in
  `validation.ts` and the store's private `isPasswordStrong` are gone — the schema the
  project called its validation authority was not the rule that applied. The policy is now a
  `refine`, so a violation arrives as one Zod issue on `password` instead of passing the schema
  and being rejected by a substring match on a thrown message.
- **A weak password now reaches the UI as "password is too weak", not "failed to create
  drawer".** Before this the only thing that recognised it was
  `e.message.includes('Password must be at least 12 characters')`, so rewording either side
  silently degraded the create path to `WRITE_FAILED`. It is classified by `issue.path` +
  `issue.code` now.
- **Save and unlock keep sanity bounds only, deliberately.** There is no change-password
  channel, so a save can only re-use the password that already opens the drawer. Enforcing the
  12-character rule on save would make every pre-policy drawer unlockable but unwritable —
  SEC-02, reopening. The reason is in a code comment and pinned by a test that saves a hand-made
  legacy 8-character `.clavis`.
- **Drawer writes no longer unlink the live file.** `.prev` is removed entirely: it was read by
  nothing in the app, and keeping it required renaming the live drawer away before the
  replacement landed, which left a window in which no `.clavis` existed at all. A crash in that
  window destroyed the drawer's only file. `atomicWrite` now does one `rename`, cleans up its
  temp file if the rename fails, and fsyncs the directory afterwards — without that the rename
  is not durable across a power cut and the staging step is cosmetic.
- **No message sniffing remains in `src/main`.** The import handler caught
  `FileTooLargeError` and `DrawerAlreadyExistsError` by matching their text even though the store
  re-threw them by type, with the comment "Propagate to ipc-handlers for explicit message"
  sitting directly above. They are classified with `instanceof` now.

### Fixed

- **The staging filename was `Date.now()`, which is not unique enough.** Two saves of the same
  drawer inside one millisecond resolved to the same temp path, so their writes interleaved and
  one renamed a half-written file over the good one — the corruption `atomicWrite` exists to
  prevent, reintroduced through its own staging step. Now `crypto.randomUUID()`.
- **`password_too_weak` was unreachable and two tests asserted it.** Deleted from
  `SaveFailureReason` and `SAVE_ERRORS`; `wrong_password` is in the reason list now, and
  `ErrorCode.WRONG_PASSWORD` has coverage for the first time (it appeared zero times in
  `tests/` before).

### Verification

- `vitest` **379/379** across 40 files (was 348/348 across 39).
- `lint` 0 errors / 2 pre-existing warnings, both typechecks 0.
- e2e **10/10** under `LANGUAGE=en` and **10/10** under `LANGUAGE=pt`, both against a freshly
  built package.
- Negative controls re-run here rather than taken on the sub-agents' word: schema relaxed to
  `.min(8)` → **8 failures**; import sniffs restored → **2 failures**; `Date.now()` staging name
  → **1 failure**.
- **A test written for the `Date.now()` collision passed with the bug present**, because two
  concurrent saves never interleave inside `atomicWrite` — the argon2id derivation ahead of it
  takes ~300ms, so the write/rename sections run one after the other and sequential writes cannot
  collide even with a shared name. It is rewritten to observe the staging paths and now fails
  correctly. A test that passes for a timing reason is a test that cannot fail.

## v0.6.2-beta (2026-10-18)

The e2e suite now runs, and it is a gate. **No user-facing behaviour change** — no product
code was modified in this round, except that nothing was found needing it. What changed is
that `tests/e2e` is trustworthy enough to block a release.

### Added

- **`tests/e2e` is in CI for the first time.** It was never in a workflow, in any commit, on any
  branch (`git log --all -S "playwright" -- .github/` is empty) — which is why the four commits
  whose message says *"skip e2e to prevent CI breakage"* prevented nothing. New `e2e` job on
  every push and pull request: `electron-forge package` (~9s, no squashfs or deb step) under
  `xvfb-run`, with a **`language: [en, pt]` matrix** because every selector in the suite is a
  two-locale pattern and only one of them would otherwise ever be exercised. It is its own job
  because `build` is gated on `refs/tags/v` and never runs on a pull request at all.
- **The release binary is exercised before it is published.** The Linux `build` job now runs the
  same suite against the AppImage after `npm run make` and before `upload-artifact`, and
  `release` needs `build`, so a release cannot ship an artifact the flow test has not driven.
- **`tests/e2e/clavis.spec.ts` rewritten — 10 stale tests into 8 real ones, plus a 10th.**
  The old file launched the source tree with `args: ['.']`, which cannot render the app at all:
  `main/index.ts:41` calls `loadURL('http://localhost:3000')` when `app.isPackaged` is false and
  no npm script starts that server. Measured before any change — the window came up as
  `Cannot GET /`. The replacement drives the packaged build and covers Escape, Enter, Ctrl+S,
  the delete confirmation's focus trap, unsaved-changes handling, and an export → delete →
  import → unlock round trip. "Discard and leave" is now covered end to end; it is the
  destructive button in the unsaved-changes dialog and had no end-to-end test.
- New `tests/e2e/launch.ts` (isolated launcher, shared bilingual name matching, download
  capture, native-dialog stub) and `tests/e2e/artifact.ts`, which locates either an AppImage or
  the `electron-forge package` output. `npm run package` added.

### Fixed

- **A test reported as passing was reading the developer's real drawers.**
  `appimage-validation.spec.ts` launched with `args: [appImage]` and no `--user-data-dir`. Every
  e2e launch now goes through `launch.ts`, which **asserts** the isolation — it compares
  `app.getPath('userData')` against the temporary directory and refuses to run if they differ —
  rather than requesting it in a comment.
- **Three of the never-run tests asserted things that are not true.** One required a `Ctrl+N`
  shortcut; the only keyboard shortcut in the whole of `src/` is Ctrl+S. Three others "tested"
  import by clicking the button and confirming the word "Clavis" was still on screen, which is
  true before the click, after it, and on a failure. They are replaced by the round trip.
- **`tests/e2e` had no timeout budget of its own.** Playwright's 30s default covers a whole
  test and the per-expectation timeouts draw from it rather than adding to it. Each unlock
  derives a key with argon2id at 256 MiB, so this is the setting that stops the first red CI run
  from being the runner rather than a bug. Now 120s, with `timeout-minutes` on both jobs so a
  hung Electron cannot hold a release for the six-hour default.

### Known issues still open

- **The password policy is still defined in two places** (`validation.ts` accepts 8 characters,
  `store.ts` requires 12 plus four character classes), and `ipc-handlers.ts` still classifies a
  Zod failure by sniffing `e.message`. The store is authoritative, so the app is safe, but the
  two rule sets can drift. HYG-22.
- **`atomicWrite` renames the live file to `.prev` before the replacement lands**, so a crash
  between the two renames leaves no `.clavis` at all. `.prev` files are also never cleaned up.
- **Four assertions that no longer assert** (HYG-21): a test that claims to prove `countCodePoints`
  allocates nothing passes if it is reverted to `[...value].length`; `password_too_weak` is
  unreachable yet two tests still assert it while `wrong_password` appears zero times in `tests/`.
- **The e2e gate is Linux-only.** It has now run on Actions for this release (both locale legs,
  first execution, both green), but it has never run on Windows or macOS.

### Verified

- `main` pushed alone first, so the tag could not publish an unproven commit: run
  `39148169911` — `quality`, `e2e (en)` and `e2e (pt)` green, `build`/`release` **skipped**.
  Then the tag, run `39148385652` — **7 jobs green**, 6 artifacts, `prerelease: true`.
- The Linux `build` job's step order is the guarantee, and it is visible in the log rather
  than asserted here: `Package binaries` → `End-to-end tests against the packaged AppImage` →
  `Upload artifacts`.

## v0.6.1-beta (2026-10-18)

A test-suite audit round. **No user-facing behaviour change** — the app is byte-for-byte
the same as v0.6.0-beta. What changed is that the suite can once again be believed.

### Fixed

- **Three tests had been disabled, and one of them was hiding a guard that guarded nothing.**
  `label.at_limit` was reworded from `"Limit: …"` to `"Save blocked — BYTE limit: …"`, two
  `ViewDrawer` tests hardcoded the old English copy, and they were skipped rather than
  updated. The skip had a side effect nobody noticed: three *live* negative guards asserted
  `queryByText(/^Limit: …/)` → `null`, anchored on a prefix the reword had already deleted, so
  they matched nothing. Mutating the at-limit condition so the red "save blocked" line renders
  on **every keystroke** passed the suite **25/25**. It now fails two tests. Both assertions
  interpolate the template from the translation dictionary instead of typing English copy, so
  a future reword cannot break them the same way.
- **`npm run test:e2e` collected 42 files instead of 3.** The Playwright config sat at
  `tests/e2e/playwright.config.ts` with `testDir: './tests/e2e'`, which resolves relative to
  the config and therefore pointed at `tests/e2e/tests/e2e`; nothing passed `--config`, so it
  was an orphan. With no config found, Playwright fell back to a default `testMatch` that also
  matches `*.test.ts` and swept in all 39 vitest files. Config moved to the root with an
  explicit `testMatch` and `testIgnore`.
- **The `macOS Safari` Playwright project pointed WebKit at the Electron binary.** It declared
  no `launchOptions`, so it inherited the `executablePath` set for the Electron project while
  its device descriptor selects webkit. Removed — there is no web target to run it against.

### Changed

- **The packaged-app flow test is real again.** `tests/playwright/functional-flow.spec.ts` had
  five independent defects in 12 lines: it drove a browser page against `http://localhost:3000`
  with nothing serving that origin (the recorded failure was `Cannot GET /`), read the artifact
  through a hardcoded `/home/…` path, called `require()` in an ESM TypeScript file, passed a
  `--user-data-dir` that isolated nothing, and was skipped. Rewritten on `_electron.launch`
  against the AppImage — Electron has no baseURL; the window comes from `app.firstWindow()` —
  running create → unlock (including a **rejected** wrong password) → edit → save → **reopen** →
  delete. The reopen is the step that earns it: everything before it happens inside one
  decrypted session and would pass even if saving did nothing.

### Known issues (unchanged from v0.6.0-beta, filed as HYG-20/21/22)

Named rather than left for a user to discover:

- **`tests/e2e/clavis.spec.ts` (10 tests) has never run and does not pass.** Selectors from the
  pre-0.6.0 UI, fixtures the new password policy rejects, and it launches with `args: ['.']`
  against the developer's **real** user profile. Deliberately left failing rather than skipped.
- **Nothing runs e2e in CI.** The `quality` job covers lint, both typechecks and vitest only.
- **The password policy is still defined in two places.** `validation.ts` accepts 8 characters;
  `store.ts` requires 12 plus four character classes. The store is authoritative, so the app is
  safe, but the two rule sets can drift.
- **`atomicWrite` renames the live file to `.prev` before the replacement lands**, so a crash
  between the two renames leaves no `.clavis` at all. `.prev` files are also never cleaned up.

## v0.6.0-beta (2026-10-17)

An audit round against v0.5.1-beta. Five High and twelve Medium findings; the ones that changed
behaviour are below. **This release was tagged without its notes being written** — the entry was
reconstructed afterwards from the commits, so treat the wording as a summary rather than as a
contemporaneous record.

### Fixed

- **SEC-01 — a drawer created on a machine where `argon2` failed to load could become permanently
  unopenable.** The KDF fallback wrote `algorithm: "argon2id"` into the metadata regardless of
  which backend actually ran, so the drawer recorded a promise the file could not keep. The
  metadata now records the backend that was really used, and `SECURITY.md` — which asserted the
  opposite — was corrected.
- **SEC-04 — `saveDrawer` overwrote ciphertext without checking the password.** It now verifies
  the supplied password against the existing ciphertext first and refuses with `wrong_password`
  on mismatch, leaving the file untouched.
- **SEC-07 — imported drawers were not schema-validated**, so a malformed `.clavis` could be
  written into the store and fail later at read time. Import now validates with
  `EncryptedDrawerSchema`.
- **QA-01/QA-02 — the password policy contradicted itself.** It is now one rule, stated in one
  place and enforced in the store: **at least 12 characters with an uppercase letter, a
  lowercase letter, a digit and a symbol.**

### Changed

- **SEC-02 — legacy passwords remain savable.** The policy check was removed from `saveDrawer`
  so an existing drawer created under an older, weaker policy can still be edited and saved.
  This cannot weaken any drawer: `saveDrawer` only succeeds if the supplied password already
  decrypts the stored ciphertext, so a non-compliant password can be *reused* but never
  *established*, on a new drawer or an old one.
- **REL-01 — writes are atomic and keep the previous version.** Content is written to a
  temporary file and renamed into place, with the prior ciphertext retained as `.prev`.
- **The `prerelease` flag is computed from the tag name**, so beta tags publish as prereleases
  instead of being badged "Latest".

## v0.5.1-beta (2026-10-17)

The capacity counter used to state two limits, and one of them could never be the limit that
refuses a save. `303 -> 320` tests, 20 files, all four gates green and — for the first time — lint
with no warnings at all. Every fix below is negative-controlled: the defect was reintroduced and the
specific test watched failing before the fix was called done, and the two mutations that no test can
catch are named rather than implied.

### Fixed

- **The character counter was shown against a ceiling that provably never refuses anything.** Every
  code point costs 1-4 UTF-8 bytes, so `bytes >= codePoints` always and `bytes <= 10 000 000` *implies*
  `codePoints <= 10 000 000`. The byte cap is always the binding one and Zod's `.max()` is
  defence-in-depth — yet the count was presented against the code-point ceiling and escalated colour at
  the same 90%/100% thresholds, so accented Portuguese rendered `5 000 000 / 10 000 000 caracteres`,
  "half full", beside a full red bar and a "Limite" line. That is every non-ASCII note, and it follows
  from the units rather than from the content. The row now states one limit:
  `<caracteres> · [barra] <pct>% · <bytes> / <tecto> bytes`, with the risk colour on the bar and the byte
  count only.
- **The ceiling was written in five places, one of them inside the text the user reads.** `10000000`
  appeared in `validation.ts`, `encryption.ts` and twice in `ViewDrawer`, and — worst — as literal text
  in the `label.at_limit` dictionary value, where no constant can reach it, so raising the limit would
  have left the UI claiming a ceiling it no longer enforced. All four now derive from a new
  `src/shared/limits.ts`, exporting `MAX_CONTENT_CODE_POINTS` and `MAX_PLAINTEXT_BYTES`: equal in value,
  **deliberately different in unit**, because merging them would hide the unit and turn the next limit
  change into silent data loss.
- **The counter counted the wrong unit under a label naming a third one.** It measured grapheme
  clusters while comparing them against a limit expressed in code points, under `label.tokens` — and an
  LLM token is roughly four characters, so it was not that either. Now counts code points, renamed
  `label.characters`.
- **Digits were never localised.** `String(n)` put `10000000` in front of the user in both locales. A new
  `formatNumber()` lives in `src/i18n/index.ts` **beside `detectLocale()`** rather than in the
  component, so it does not become a second locale decision — the project already carries a scar for
  that. Measured on this machine's ICU: pt-PT groups with U+00A0 from five digits and writes four-digit
  numbers bare; en groups with a comma from four. Confirmed again in the packaged AppImage.
- **`cpPct` was computed and never read**, while `Intl.Segmenter` walked the entire content string on
  every keystroke of a controlled textarea to feed it. Deleted, and both counts are memoised.
- **The bar and its own label could disagree.** The bar width was the unrounded percentage beside a
  rounded label — `44.5%` next to `45%`, two numbers for one quantity. Rounded once now and shared.
- **`--user-data-dir` did not isolate a run.** `store.ts` hardcoded `OLD_DATA_DIR` from `os.homedir()`
  and `migrateOldData()` copied from there into `getDrawersPath()`, with no relationship to
  `app.getPath('userData')`. A "clean" test profile therefore came up holding the real user's drawers —
  measured: ten of them, private ones included. There was no way to run the AppImage against a throwaway
  profile without first moving the real legacy directory aside. The migration is now skipped when the
  userData path was overridden.
- **The only AppImage gate was green while validating the wrong artefact.**
  `appimage-validation.spec.ts` asserted `0.4.9-beta` against a `package.json` that said
  `0.5.0-beta`, passing only because a binary sixteen minutes older than the version bump was still in
  `out/`. It now reads the version from `package.json` and locates the artefact by glob, so a version
  bump cannot break it, and it **fails** against a stale binary instead of validating it. Verified by
  mutation: pointing the manifest at `9.9.9-inexistente` fails with `Expected "9.9.9-inexistente" /
  Received "0.5.0-beta"`. With no artefact at all it fails with a message telling you to run
  `npm run make` — never a silent skip.
- **A dead string sniff was misclassifying validation failures.** `ipc-handlers` decided whether a Zod
  error was a size violation with `iss.code === 'too_big' || message.includes('maximum')`. Zod tags every
  `.max()` violation with `too_big` regardless of the message, so the second clause never fired — and
  any validation message containing the word "maximum" would have been reported as
  `CONTENT_TOO_LARGE`. Removed, which also dropped the last `any` in the main process: **lint is now
  clean, with no warnings.**

### Added

- **13 tests for the capacity counter, then two more.** Thresholds at 90% and 100%, bar colours, the
  limit line in both locales, and the assertion that the unit is code points rather than graphemes —
  written with explicit escapes (`'a\u0303'`, a regional-indicator pair), because an invisible combining
  mark typed straight into a source file is a character nobody reviewing the diff can see. The renderer
  suite mocks the two ceilings as **deliberately unequal**, because equal values make a unit swap
  invisible and because it makes 90%/100% reachable as `'x'.repeat(900)` instead of ten-megabyte
  allocations.
- **Coverage for the Zod branch of the save handler, which had none.** The message
  `Content exceeds the maximum size` is emitted by two different branches — the `SaveFailureReason` map
  and the Zod ceiling check — and the existing test only exercised the first, so mutating
  `iss.code === 'too_big'` to a wrong string left all 56 tests green. A test now drives one violation of
  each kind and asserts the two classifications differ.

### Removed

- **Three scratch Playwright scripts, tracked at the repository root, none of which could run.**
  `ciclo-teste.ts`, `contador-validate.ts` and `visual-validate.ts` each hardcoded
  `clavis-0.4.9-beta-x64.AppImage` (a path `npm run clean` deletes and the current build no longer
  produces), each imported `path` unused, all sat outside both tsconfig `include` lists so none was
  typechecked, and all carried pt-PT comments. `ciclo-teste.ts` mixed `require()` into an ESM module and
  guessed userData as `~/.local/share/clavis` — the legacy path, not `~/.config/clavis` — and its
  "confirm the list is empty" step was a `waitForTimeout(500)` followed by a `console.log` with no
  assertion. Deleted rather than converted: converting a script whose assertions are all no-ops is
  writing the tests from scratch, and the AppImage case is already covered properly in `tests/e2e/`.
- **`test-results/` is no longer versioned**, and is ignored alongside `coverage/` and `.nyc_output/`.

### Documented

- **The storage-limits docs claimed the drawer-size defect was unfixed when it had been fixed.** Both
  `docs/DRAWER-CAPACITY.md` and `SECURITY.md` still said `Partially fixed`, and the capacity doc's
  round-trip section asserted that import "never checks its length" — false since the ciphertext check
  landed. Corrected, with what genuinely remains stated plainly: a drawer written *before* the guards
  existed cannot be opened, because no guard helps bytes already on disk. The app now names that
  correctly and no longer counts it as a failed password attempt, but there is no rescue code.
- **`ff4efb7`, cited as the commit that implemented the storage limits across five files, is an orphaned
  duplicate.** `git cat-file` resolves it — same message, same tree except one line of
  `.github/FUNDING.yml` — but it is unreachable from any ref; the commit on `main` is `d2bdb98`. A
  reader following the citation would have found the change missing from history. Line references the
  fix itself moved were corrected too.
- **A test count that was never a count of any tree.** `281/281` appeared in three files, recorded as a
  *delta* ("277 -> 281") on a total that had itself drifted. `git diff d2bdb98..HEAD -- tests/` touches
  no vitest test, so that tree measures the same as `HEAD`: `303/303`. Corrected in place and marked,
  not rewritten — **a delta is the form of a count nobody re-measures.**

### Known, deliberately not fixed here

- **Two mutations cannot be caught by any test.** Detaching either ceiling to a hand-written literal
  *of the same value* leaves every run green, because at equal values the wiring is observationally
  identical. Only a lint rule would close it, and that rule is not written.
- **`[...value].length` allocates an array of one-code-point strings.** At the worst case the schema
  admits that is roughly ten million elements on the UI thread. Not a regression — `Intl.Segmenter`
  built an array of segment objects, which is worse — and not measured. A `for…of` counter would
  allocate nothing.
- **There is no rescue path for a drawer that is already too large to open.** Not a validation problem
  and not fixable by one; the open question is what the app should *offer* such a user.
- **`tests/e2e` is in no gate.** It is excluded from both tsconfigs, so the AppImage spec typechecks
  only under an ad-hoc invocation nothing enforces.

## v0.5.0-beta (2026-10-16)

Landed on `main` first without a release, on the owner's decision, and tagged afterwards. `184 -> 277`
tests, 20 files, all four gates green. Every change below is negative-controlled — the defect was
reintroduced and the specific test watched failing before the fix was called done.

### Fixed

- **Export → import round trip broken above ~5.5 MB.** `importDrawerRaw()` capped the `.clavis` *file* at
  11 000 000 characters while the save path capped *text* at 10 000 000, and the constant's own comment
  claimed it sat "slightly above MAX_DECRYPTED_SIZE to allow JSON overhead" — arithmetic that holds for
  base64 and not for the hex payload `encrypt()` returns, which costs two characters per byte. Anything
  over ~5.5 MB exported cleanly and then failed to import, with no warning at any point. The cap is now
  derived from `MAX_DECRYPTED_SIZE` so the two constants cannot drift apart again. The same constant had
  also bounded the *unlock* path, where the quantity is decoded bytes rather than file characters — raising
  it would have left the P0.12 pre-decrypt guard unreachable, so that bound moved to `MAX_DECRYPTED_SIZE`.
- **`check-update` could hang forever.** The `.on('error')` handler sat on the *request*, never on the
  *response*, and there was no timeout. A response stream that stalled after the headers left the
  promise unsettled forever, so `CreditsModal`'s `Promise.allSettled` never resolved and the About
  card silently dropped its version line for the rest of the session. It also parsed non-2xx bodies,
  which made a GitHub 403/5xx indistinguishable from "up to date". Now: `res.on('error')`, a **5 s**
  deadline that destroys the request, and non-2xx treated as *no information*.
- **`check-update` returned a value its own type forbids.** `resolve({ tag_name: json.tag_name || null })`
  against a declared `Promise<{ tag_name?: string } | null>`, compiling only because `JSON.parse`
  returns `any`. The payload is now Zod-parsed, so `tag_name` is a validated string.
- **The crash screen was unreachable by keyboard.** When `ErrorBoundary` replaces the tree,
  `document.activeElement` is left on `<body>`. It now focuses the Error-details `<summary>` — not
  Restart, because a crash screen is exactly when someone reflexively hits Enter and Enter on
  Restart relaunches the app. Done in `componentDidCatch`, which is the only lifecycle method that
  fires on both the mount and the update path.
- **`danger.svg` was not hidden from assistive tech** in `DeleteConfirmModal`, unlike every other
  decorative icon in the app.
- **`DeleteConfirmModal`'s `onConfirm: () => void` was a type lie.** It admitted any async function
  while blocking `onConfirm().catch(...)` — which is why `try/finally` was written instead of
  `try/catch/finally`. Widened to `() => void | Promise<void>` and a `catch` added. The rejection
  is unreachable in production today, so this is defence in depth, not a bug fix.
- **Three IPC channels had no test at all** — `CHECK_UPDATE`, `RESTART_APP` and `GET_APP_VERSION`
  were the only ones without a `describe` block. 13 tests, and the electron mock had to grow
  `app.getVersion` / `app.relaunch` before any of them could run.
- `DeleteConfirmModal.tsx`'s `|| 'This action is irreversible.'` removed — the P3.27 pattern, which
  had been closed for `ViewDrawer.tsx` only.

### Removed

- **The dead `onEnter` branch in `useModalKeyboard`** — 11 of the hook's 40 lines, with zero callers
  across all five modals. Deleting it also removed an unguarded `e.target as HTMLElement` cast that
  would throw on a keydown originating from an SVG child.

### Added

- `docs/DRAWER-CAPACITY.md` — how much text a drawer holds, in bytes, characters and pages, for five scripts.

- Four test files closing the P3.31 gaps: `useModalKeyboard` (the sole owner of Escape since
  2026-10-07, untested until now), `DeleteConfirmModal`, `ErrorBoundary`, and `preload` — the last
  pinning `ElectronAPI` parity in both directions and the argument order per method. Transposing
  `saveDrawer`'s `title` and `content` fails exactly one test; `typecheck` is satisfied by both
  orderings because both are `string`, and it would otherwise surface only as silent corruption.
- `msg.error_delete_failed` in both locales, so the new toast reads a complete sentence instead of
  inheriting the trailing colon from the `msg.error_delete` prefix.

### Documented

- **P3.30** — the file-permission documentation was overstating its control. `fs.writeFile`'s `mode`
  applies only at creation, so an existing `0644` drawer keeps those permissions across every save
  (**on Linux and macOS too, not only Windows**), and **exported `.clavis` files get no `0o600` at
  all** because a Chromium `<a download>` writes them. Filed as a Known Limitation; the exposure is
  metadata — title, timestamps, icon colours — not content, since the body is ciphertext.
- `SECURITY.md`'s network posture now states the check's 5-second bound and its fail-closed paths.
- `DESIGN.md` reported a closed gap as open in three places, the worst being a remediation
  instruction for work already done. Corrected, and the rule is now **focus on open** rather than
  mount focus.

## v0.4.9-beta (2026-10-13)

All changes measured in a locally built AppImage (`out/make/AppImage/x64/`, 252 MB) rather than estimated in jsdom. `173/173` -> `184/184` tests, green under `CI=true`, both typechecks and lint clean, brand checker exits 0. `CHANGELOG.md` itself records the measurement of every new surface pair, so there is no gap between what the document claims and what the binary paints.

- The X profile link's label reads `@banduastudio` instead of `X`. Cut into the next release rather than
  folded into `v0.4.8-beta`: that one was already published, with six assets, while this was still being
  decided, and moving its tag would make the provenance of a downloaded artefact ambiguous.
- The page language is measured in a locally built AppImage under three system locales:
  `pt-PT` → `lang="pt-PT"`, `pt-BR` → `lang="pt-PT"` (the single-lusophone-locale rule, ADR-009),
  `en-GB` → `lang="en"` — each with the UI rendering in the matching language. Note for the next
  reader: `LANG=`/`LC_ALL=` and Electron's `--lang` do **not** move `navigator.language` in this
  build, so the non-pt cases need the value stubbed before the app boots.
- `::placeholder` fixed: `gray-400` (#9ca3af, 2.54:1) replaced by `text-gray-500` (#6b7280, 4.83:1) with `opacity: 1` in `src/renderer/index.css`. `DESIGN.md` records `gray-400` as banned for body text.
- `danger.svg` invisible `#131112` removed — now `fill:#f32929` only, measured 4.62:1 on `red-50`.
- `<html lang>` is set from the locale the app actually renders instead of the hardcoded `en` that
  shipped since the beginning — WCAG 3.1.1 Language of Page (AA). `DESIGN.md` records the rule.

### The GitHub mark, chosen per surface — two 1.4.11 failures closed

The mark shipped as one `#2ba1fd` file used in two places, and it failed WCAG 1.4.11 in both: **2.70:1**
on the repository chip's `#fffdf3` surface, and **1.20:1** on the `green-600` update button. The blue
is not even the GitHub brand colour, and neither failure was visible to the eye — which is why the
second one survived from 2026-10-06 and the first was never recorded at all.

The mark cannot be recoloured without ceasing to be the GitHub mark, so the fix is two files and one
import each: `github-dark.svg` on the light chip and `github-light.svg` on the dark button. Both bake
their fill — `#000` and `#fff` — rather than relying on the SVG default, which an ancestor `fill`
would silently override. `github.svg` is now imported by nothing and has been **archived** to
`icons/archive/github-badge-2ba1fd.svg` — `icons/archive/` is gitignored, so the file leaves the
repository and stays on disk. `icons/svg/` now contains nothing without an importer.

**Measured in a locally built AppImage**, by sampling the pixels the packaged app actually paints:

| Mark | Surface | Before | After |
|---|---|---|---|
| Repository chip | `#fffdf3` (`bg-amber-50/60` over the white panel) | 2.70:1 | **20.60:1** |
| Update button | `#16a34a` (`green-600`) | 1.20:1 | **3.30:1** |

Two tests pin which mark sits on which surface. Because the two assets share one outline and differ
only in the baked fill, a path-data assertion catches a return to the old blue badge but is blind to
a swapped pair — the resolved fill is what asserts the pairing, and both are negative-controlled.
`173/173` tests, green under `CI=true`, typecheck and lint clean.

**Two things a future reader needs to know.** `brand/ABOUT.md` §6 pins the line numbers of the ETH
and SOL addresses inside `CreditsModal.tsx`, and the brand checker reads them literally, so the second
import moved all six and §6 was re-synced to 233, 234, 238, 239, 247, 251 — lint, typecheck and CI
would all have passed while the checker went red. And `window.electronAPI` is frozen by `contextBridge`
and non-configurable, so a test harness cannot stub the update check from the renderer at all: the
only way to see that button in a real build is to make the main process believe there is a newer
release.

### The page language now follows the locale the app renders (WCAG 3.1.1)

`index.html` shipped `<html lang="en">` as a literal while every string rendered in Portuguese for
any `pt*` system locale, so a screen reader pronounced the whole application with an English voice
on every screen. It was measured on the **published** `v0.4.5-beta` AppImage
(`document.documentElement.lang === "en"` under a `pt-PT` locale) and survived because nothing
asserted the attribute.

`detectLocale()` was already the single locale decision; it is now also the single writer of the
attribute. The mapping moved into a pure exported `resolveLocale(navigatorLanguage)` — same
behaviour, `pt-BR` still cannot return — and a new `applyDocumentLanguage()` writes its result to
`document.documentElement.lang`. The `process.env.CI` short-circuit stays in the runtime resolver so
the pure function answers the same question in a test as in the app. It is called **once**, from
`src/renderer/index.tsx` immediately before `createRoot(...).render(...)`.

`lang="en"` stays in the markup as the **pre-JavaScript default**, which is the correct value for
the English locale; a rule in `DESIGN.md` says so, so the next reader
does not "fix" it back into a constant.

`tests/i18n.test.ts` grows from 14 to 24 tests. The assertion that closes the bug is on the
attribute, not on the mapping function — a test of the mapping alone passes while the page stays
wrong. One test imports the renderer entry, so **removing the startup call fails the suite** rather
than passing quietly. `183/183` tests, green under `CI=true`.

## v0.4.8-beta (2026-10-12)

### About / Credits screen — brought into line with the Bandua Studio brand rules

The About screen is the only place inside the app where the user meets the studio, and it was
missing four of the eight elements the brand requires: the application name, **the version**, the
licence, and any studio identity at all. `getAppVersion()` was already being called every time the
dialog opened — purely to compare against the release tag — and its result was discarded, so the one
piece of information that screen exists to state was never displayed.

- **The app name is shown**, as shipped: `clavis`, lowercase, identical in both locales. It is data,
  not prose, so it is never translated — and that is now asserted.
- **The version is shown**, read from `app.getVersion()` at runtime, never typed into the markup.
- **The version no longer depends on the update check.** Both requests start together and settle
  separately, so an unreachable GitHub endpoint can no longer blank it. A test covers exactly that:
  the update check rejects, the version still renders.
- **`Licença: MIT`** links to the repository's `LICENSE` file.
- **The studio identity line** — *A Bandua Studio app · by Marcelo Salvador* — with the Bandua
  **Pixel Arc** beside it, shipped as a local asset at the brand's 32 px minimum with one block of
  clear space.
- **The studio's X and LinkedIn profiles** sit with that line rather than in the navigation row:
  they are the studio's channels, while the repository and the two block explorers are the
  project's.
- **Patreon** joins Ko-fi as a support channel, as the brand requires of every About screen.
- **The Credits card is now exactly two centred rows** — the identity line and the profiles. The
  role line (*Concept, design & development: Marcelo Salvador*) sat directly above *… · by Marcelo
  Salvador* and said the same thing twice; the thanks line added a third sentence to a card read
  once and never again. Neither took a required element with them.

**The app's palette stays the app's own.** The studio contributes the mark, the line and the links —
never a colour. This is also the only defensible reading of the brand's own contrast rules, where
one accent fails 4.5:1 on the light background and the primary fails even 3:1 on the dark one.

### Accessibility — a live failure closed, and two avoided

- **1.4.11 — the Ko-fi icon on the support button.** The old circular badge's blue cup measured
  **2.66:1** against its own white disc, and its red **3.03:1** — both at or under the 3:1 that a
  graphic carrying meaning requires. Replaced with the flat white glyph, which measures **5.02:1**
  on the button and **7.09:1** on its hover state, and which also makes both support buttons the
  same kind of mark instead of a badge beside a glyph.
- **Avoided by measurement:** the flat black mark reads 4.18:1 on the button but falls to **2.96:1**
  on hover, so both glyphs ship light. The upstream icon sources also carry `role` and `<title>`,
  which would have given the links the accessible names "Ko-fi Ko-fi" and "Patreon Patreon"; both
  are stripped, and re-adding one fails the suite.
- **Avoided by measurement:** with two equal-width buttons, the previous label *Paga-me um café* had
  116 px of room and needed 119, so it wrapped and left the buttons different heights. The labels are
  now the platform names — data, identical in both locales — and the ask is one short line above
  the buttons.

### Layout

The support link row overflowed its panel: five chips against a 433 px content box measured
`scrollWidth` 455, putting a horizontal scrollbar under the copy buttons. Restructured rather than
wrapped — the two support channels became buttons and the row below them is GitHub · ETH · SOL,
spread so both rows share the same edges. No unit test could have caught this; jsdom has no layout.

### Known, deliberately not fixed here

The GitHub mark shipped in `#2ba1fd`, a blue that is not the GitHub brand colour, and failed 1.4.11
in two places: **2.76:1** on the white chip row — a failure that was not recorded anywhere before —
and **1.20:1** on the update button's `green-600` fill. Correct variants were already in
`icons/svg/` and were staged for a follow-up release. **Fixed under `Unreleased`.**

### Verification

169/169 tests (green under `CI=true` too), `typecheck`/`typecheck:test`/`lint` clean. Every new
assertion was negative-controlled: six layout mutations, two accessible-name mutations and two
copy mutations all fail as they should, and one of the brand-side checks caught a defect in the
checker itself. All layout and contrast figures above were measured in a locally built AppImage
rather than in jsdom.

## v0.4.7-beta (2026-10-07)

### Accessibility — four live WCAG AA failures closed

- **1.4.3** — `PasswordModal` error text was `text-red-500` at 3.76:1, below the 4.5:1 that 12px text needs. Now `text-red-700` at 6.47:1.
- **1.4.11** — every form control boundary used bare `border` (`#e5e7eb`) at 1.24:1. New token `--border-input` (`#8a8a8a`) reaches 3.45:1 on white, 3.30:1 on `gray-50` and 3.14:1 on `gray-100`. `gray-400` was rejected at 2.54:1 (still failing) and `gray-500` at 4.83:1 (visibly heavy on every form).
- **1.4.11** — the duplicate-title alert's `border-yellow-300` measured 1.39:1 against `yellow-50` (previously recorded as 1.27:1; `yellow-300` is `#fcd34d`, not `#fde047`). Now `border-yellow-700` at 4.76:1 — `yellow-600` would have been 2.84:1, so the ramp could not be fixed one step up.

### Fixes

- **Escape fired twice per keypress.** `useFocusTrap` and `useModalKeyboard` each attached a `keydown` listener for it on the same container ref. It stayed invisible only because every `onEscape` was an idempotent `setState(false)`. `useFocusTrap` no longer handles Escape — Escape is modal-keyboard behaviour, not focus-containment — so `useModalKeyboard` is the sole owner. The `[containerRef, isActive]` dependency remains load-bearing: its cleanup restores focus to the pre-modal element.
- **Errors shown in the wrong language.** The renderer surfaced `result.error.message`, the main process's English diagnostic string, at 8 sites — a wrong password read "Incorrect password or drawer not found" inside a fully Portuguese UI, and the `msg.error_*` prefixes produced mixed text. Errors are now resolved from `AppError.code` via `tError()`; the main-process message is log text only.

### Verification

152/152 tests (green under `CI=true` too), `typecheck`/`typecheck:test`/`lint` clean. Both fixes validated in a locally built AppImage with an isolated `userData` — the accessibility fixes by runtime computed style (10/10) and the i18n fix by rendering the real wrong-password flow under `navigator.language` pt-PT (5/5). The Escape fix carries a negative control: `tests/escapeSingleInvocation.test.tsx` uses non-idempotent handlers and fails 4 of 5 tests at a 2:1 ratio when the duplicate handler is reintroduced.

## v0.3.4-alpha (2026-09-14)
- `CHAN-01` resolved: preload imports `CHANNELS` from `src/shared/channels.ts` (single source of truth)
- Preload bundled via Vite (`scripts/build-preload.mjs`) — self-contained `dist/main/preload.js`, `electron` external, `CHANNELS` inlined
- `BS-17` resolved: `copy:preload` (Unix-only `cp`) removed; bundling is cross-platform
- Verified in packaged AppImage: `electronAPI` exposed (`Drawers listed count:5`)
- 74/74 tests pass; typecheck clean; lint 0 errors

## v0.3.2-alpha (2026-09-12)
- i18n implemented (PT-PT / PT-BR / EN fallback) (`src/i18n/index.ts`)
- PROMPT.md removed
- P3.2 E2E Playwright interactive complete (macOS Safari, keyboard, modal events, 3 error paths)
- Local build validated (`npm run build` + `make`)
- `CHAN-01` remains reverted/deferred (`inline CHANNELS`)

## v0.3.1-alpha (2026-09-09)
- P3.1 renderer component tests: 69/69 passing
- Flatpak manifest updated (`v0.3.1-alpha` AppImage)

## v0.2.0-alpha (2026-09-07)
- P3.2 E2E interactive started
- P1.2 ESM/CommonJS fix (`.mts` configs)

## v0.1.9.1-alpha (2026-09-08)
- Preload runtime fix (CHANNELS inline)
- CI workflow artifact fix (`clavis-${os}-${tag}`)

## v0.1.8-alpha (2026-09-07)
- Phase 2 P0 a11y complete (focus indicator, drawer rows `<button>`, credits modal focus trap)
- P1.10–P1.16: keyboard shortcuts, aria-live, empty state, skeleton loaders, password visibility, strength meter, transitions, backdrop close, responsive breakpoints, copy-to-clipboard
- ErrorBoundary `restartApp` end-to-end
- 58/58 tests pass

## v0.1.7-alpha (2026-09-07)
- IPC-layer hardening: symlink rejection, error envelope sanitization, decrypt size cap (10 MB), CHANNELS const (`src/shared/channels.ts`)
- AppSec audit fixed (P2 soft-blocking)
- 54/54 tests pass

## v0.1.4-alpha (2026-09-03)
- DeleteConfirmModal (red background, `danger.svg` biohazard icon)
- Import drawer UI button

## v0.1.3-alpha (2026-09-03)
- First CI-built green run (`33781273256`)

## v0.1.1-alpha (2026-09-02)
- `argon2` Win32 `PE32+` fix (`afterPack` + `scrypt` fallback)
- Windows `confirm()` focus steal fixed
- Save/delete `Result` mismatch fixed

## v0.1.0-alpha (baseline)
- Electron + TypeScript + React scaffold
- AES-256-GCM + Argon2id encryption module (6 unit tests)
- Drawer store (create/list/save/delete/export/import `.clavis`)
- Deterministic 3×3 icon generator
- Main process IPC bridge (sandbox, CSP, UUID validation, nav guards)
- Renderer: Home screen + View drawer + Create modal + Password unlock
- Electron Forge build (deb, AppImage, NSIS, Portable)

---

*Formatting based on `MEMORY.md` changelog + git tags. Updated 2026-09-12.*
## v0.5.1-beta (2026-10-17) — 321/321 tests, lint 0, AppImage rebuilt, HYG-7/8/10/11/12/13/14 closed, BR-13 verified, P3.31 smoke tests added
