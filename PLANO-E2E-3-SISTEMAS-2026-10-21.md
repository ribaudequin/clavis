# PLANO — E2E nos três sistemas: correr a suite no Windows e no macOS

**Date:** 2026-10-21
**Closes:** the "**e2e nos três sistemas**" structural gap (TODO.md) — the second of the two
structural gaps the sessions have been carrying.
**Owner decisions (2026-10-21):** the Windows and macOS legs run **only on tags**; the
single-instance spec **runs on macOS and we read what it says** rather than excluding it
up front; **the macOS bundle is signed AD-HOC** — free, no certificate, no Apple account,
no money — so the macOS leg is **expected to be green**, while a paid Apple Developer ID
certificate and **notarisation stay out of scope** (no budget), which means the Gatekeeper
"downloaded from the internet" warning remains; the cross job is **informational, not a
gate**; **plan first**, implementation after this document.

---

## The gap

The app is **built** for three platforms and **run** on one.

| | Linux | Windows | macOS |
|---|---|---|---|
| built by CI | yes (`build` job) | yes (`build` job) | yes (`build` job) |
| **executed by anything** | **yes** — every push | **never** | **never** |

The `e2e` job is `runs-on: ubuntu-latest` (`.github/workflows/release.yml:61`) and the `build`
job's e2e step is `if: runner.os == 'Linux'` (`:170`). The published `clavis-win32-x64-*.zip`,
the Squirrel `Setup.exe` and the `clavis.dmg` have **never been executed by a single process**.
They are downloaded by users and they are *believed* to work.

**What this plan buys** — three questions that cannot be answered any other way:

1. **Does the argon2 win32 prebuild actually load?** `src/main/encryption.ts:36-41` catches the
   native-module failure and falls back to Node's scrypt, **silently** (a `logger.warn`, no
   user-visible signal). Nobody knows which KDF the Windows build uses. It matters: a drawer
   written by a scrypt build must still open on an argon2id build (`src/main/encryption.ts:79-81`
   `resolveKdfBackend`, and the `algorithm` field in the stored metadata).
2. **Does the single-instance lock behave on the two platforms where its mechanism differs?**
   Chromium's `ProcessSingleton` has two implementations: a **named mutex** on Windows and a
   **POSIX lock file plus a unix socket** on every POSIX platform — macOS included, so
   macOS uses the *same* mechanism as Linux. The `second-instance` handler's
   `restore()`/`focus()` half is platform-sensitive too (on macOS `focus()` does not reliably
   raise a window).
3. **Does the app run at all on macOS?** The `.app` bundle used to be **never signed**
   (`package.json` → `config.forge.packagerConfig` has no `osxSign`; `electron-packager`'s
   `signAppIfSpecified()` is a no-op without it, and the packager's `renameElectron()` /
   `renameAppAndHelpers()` invalidate Electron's own signature). On arm64 macOS an invalid
   signature is a SIGKILL. **That part is now fixed** — the bundle is signed **ad-hoc** by a
   local Forge plugin (`scripts/forge-plugin-adhoc-sign.js`, owner decision 2026-10-21), so
   the question the macOS leg answers is no longer *"does an unsigned bundle launch"* but
   *"does an ad-hoc-signed bundle launch, and does the rest of the harness behave there"*.
   The **expectation** is that it does launch; a red macOS leg is a finding, not a
   prediction.

---

## What the audit found — the work is already scoped

A full read of `tests/e2e/` (8 files) and `playwright.config.ts` produced this map. The suite
has **15 tests** across 6 spec files.

| Spec | Tests | Windows | macOS |
|---|---|---|---|
| `artifact-launch.spec.ts` | 1 | works as is | blocked by the locator |
| `clavis.spec.ts` | 8 | works as is | blocked by the locator |
| `functional-flow.spec.ts` | 1 | works as is | blocked by the locator |
| `kdf-backend.spec.ts` | 1 | works as is | blocked by the locator |
| `rel02-cancelled-unlock.spec.ts` | 2 | works as is | **log escapes the profile** |
| `single-instance.spec.ts` | 2 | 3 small changes | **log + kill + `--no-sandbox`** |

**Thirteen of the fifteen tests are structurally platform-neutral.** There is no `which`, no
`chmod`, no `pkill`, no `xdotool`, no POSIX shell and no hardcoded `/tmp` anywhere in
`tests/e2e/`. `launch.ts:113-122` already canonicalises paths with `fs.realpathSync` for exactly
the macOS `/var/folders` vs `/private/var/folders` trap. The blockers are in the **shared
helpers**, not in the specs — which is why this is a bounded piece of work.

---

## The blockers, in the order they will bite

**B3 is already resolved** — owner decision (2026-10-21): the macOS bundle is signed **ad-hoc**.
It is kept below, in its place, because it is the blocker that decided whether the macOS leg
could ever be green at all.

### B1 — 🔴 macOS: the locator cannot find **any** macOS build

`tests/e2e/artifact.ts:48` probes a hardcoded list — `['clavis-linux-x64', 'clavis-win32-x64',
'clavis-darwin-x64']` — for a **flat file** at the root of the platform directory. Two
independent failures on macOS:

- the runner is **arm64** (`macos-latest` is Apple Silicon), so the packager writes
  `out/clavis-darwin-arm64/`; the list has no `arm64` entry at all;
- even on an x64 Mac the layout is a **bundle**, not a flat file:
  `out/clavis-darwin-<arch>/clavis.app/Contents/MacOS/clavis` (`productName` is lowercase
  `clavis`, `package.json:3`).

`resolveTarget()` therefore throws `No built application found` (`artifact.ts:94-97`) and **all
fifteen tests fail at launch**. Windows is fine by accident: `clavis-win32-x64` + `clavis.exe`
is in the list.

**Fix:** derive the platform directory from `process.platform` / `process.arch` and probe the
real per-platform layout. The search must also be **scoped to the host platform** — today a
stray `out/clavis-linux-x64` on a macOS runner would win.

### B2 — 🔴 macOS: the log file escapes the throwaway profile

`src/main/logger.ts:6` writes to `app.getPath('logs')`. Per Electron's own docs, the default
log directory is **inside `userData` on Linux and Windows** but **`~/Library/Logs/<app name>` on
macOS**. So under `--user-data-dir=<profile>` the log lands at
`~/Library/Logs/clavis/Clavis/main.log` on macOS — **outside** the profile, **shared** by every
Clavis process on the machine.

That breaks `single-instance.spec.ts` in two places:

- `:253` — "the refusal line must be **absent** beforehand" → a refusal written by any earlier
  run on that machine fails the test;
- `:302-307` — "**exactly one** `'Clavis started'` line" → the control instance
  (`:320`) starts a *second* primary instance, and so does every other spec in the same job, so
  the count exceeds 1 and the test fails for a reason that has nothing to do with the lock.

`rel02-cancelled-unlock.spec.ts` is scoped by drawer id (`:117`) and therefore survives, but it
reads and re-reads a file that grows without bound.

**Fix (Design A — Electron-native, one line, no test changes):** call
`app.setAppLogsPath(path.join(app.getPath('userData'), 'logs'))` in `src/main/index.ts` when
`--user-data-dir` is present, immediately before `initializeLogger()` (`:18`). Then
`app.getPath('logs')` **stays truthful** — which is what the specs read — and the log lands in
the profile on macOS exactly as it already does on Linux and Windows. On Linux and Windows this
is a **no-op**: the path is the same one Electron already reports.

The alternative (the logger computes its own path and the specs ask the app where it really
wrote) is worse: it forks the truth into two places and forces both specs to change.

### B3 — 🔴 macOS: the bundle is never signed → **FIXED: ad-hoc signing**

`electron-packager/src/mac.js:336-358` — `signAppIfSpecified()` only signs when `opts.osxSign`
is set, and `config.forge.packagerConfig` sets nothing. The packager's `create()` order is
`renameElectron()` → `renameAppAndHelpers()` → `copyIcon()` → **sign** — so the renames happen
*before* the (absent) signing, and Electron's own signature is invalidated by them.

**Owner decision (2026-10-21, revised the same day): the macOS bundle is signed AD-HOC.**
The first decision was that the project would not sign at all — an Apple Developer ID
certificate costs $99/year and the project has no funding. That reasoning still holds for the
certificate, and it is why **notarisation stays out of scope**. But it does not hold for
**ad-hoc signing**, which needs **no certificate, no Apple account and no money**: it is what
Electron itself ships with, and it is exactly what makes the bundle launchable on arm64
(an invalid signature is a SIGKILL at launch). So the bundle is now signed, and the macOS leg
is expected to be **green**.

**What was done.** A local Forge plugin, `scripts/forge-plugin-adhoc-sign.js`, registered in
`config.forge.plugins`. Its `postPackage` hook runs after the packager has written the bundle
to disk, and for every macOS application bundle in the packaged output it runs:

```
codesign --force --deep --sign - "<app path>"     # the ad-hoc identity: no certificate
codesign --verify --deep "<app path>"             # the signature is checked, not assumed
```

**One correction to what this plan assumed about the hook's argument.** The hook receives the
packager's output paths, and electron-packager resolves those to the **platform directory**
(`out/clavis-darwin-arm64`) — **not** to the bundle inside it (`out/clavis-darwin-arm64/clavis.app`).
A plugin that only signed paths *ending* in `.app` would therefore have signed **nothing** and
the macOS leg would still be red. The plugin accepts both shapes: a path that **is** a bundle,
and a directory that **contains** one.

**Why `codesign` directly and not `osxSign`.** `osxSign: { identity: null }` does **not** do
ad-hoc signing with the installed `@electron/osx-sign` 1.3.3: `identity: null` is falsy, so
`sign.js:294-333` takes the "no identity was passed" branch, looks for a `Developer ID
Application` certificate in the keychain, finds none, and throws `No identity found for
signing.` — and Forge hardcodes `quiet: true`, so the failure would be invisible in the build
log. `codesign` is on every macOS machine, needs no arguments beyond the identity, and its
failure is loud.

**Why a failure fails the build.** The hook throws, with the command, the exit code and
`codesign`'s own stderr in the message. The alternative — warning and carrying on — ships a
`.dmg` whose app cannot launch on arm64, which is the exact bug this change exists to prevent.

**Why a plugin and not a hook.** `config.forge.hooks` entries must be functions, and
`package.json` cannot hold one; a plugin can. Forge's own resolver (`require-search.js`)
resolves `path.resolve(dir, pluginName)`, so `"name": "./scripts/forge-plugin-adhoc-sign.js"`
loads a local file with **no new dependency**. (Forge's plugin interface requires a plugin
entry to have **both** `name` and `config`, so the entry carries an empty `config`.)

**The ordering is right.** `api/make.js:132` runs the **package** step — which is what fires
`postPackage` — *before* the makers read the packaged directory at `:173-178`, so the signed
`.app` is the one that goes into the `.dmg`. The `e2e` job's `npm run package` is signed too,
which is what the macOS e2e leg needs.

**What is still out of scope: notarisation.** Notarisation is what removes the Gatekeeper
"downloaded from the internet" warning, and it requires the paid Apple Developer ID
certificate. **That part is unchanged** — the ad-hoc-signed bundle still shows the quarantine
warning to a user who downloads it. It is a budget matter, not a defect.

**Consequence for users, worth knowing:** the `.dmg` **already published** carries the
**unsigned** bundle — it was cut before this change — so it does not run on Apple Silicon. The
next release's `.dmg` carries the ad-hoc-signed bundle.

### B4 — 🟠 Windows: the teardown can fail on a file still held open

`fs.rmSync(dir, { recursive: true, force: true })` defaults to **`maxRetries: 0`**. On Windows,
a file still held open by a live Chromium child (`Local Storage/leveldb/*`, `Cache/*`,
`SingletonLock`) fails with `EBUSY`/`EPERM`, which `force: true` does **not** suppress. The
exception is thrown from `test.afterEach` (`clavis.spec.ts:39-42`, `rel02:58-61`,
`single-instance:215-229`) and **fails the test it just ran**.

Affected: `launch.ts:109-110` (profile + download dirs) and `single-instance.spec.ts:226`
(control profile — the highest risk, because that instance was force-killed and may still have
live children).

**Fix:** one shared `removeDir()` helper in `launch.ts` with `maxRetries` / `retryDelay` and a
try/catch that reports rather than throws.

### B5 — 🟠 Windows: the kill escalation is POSIX-only

`single-instance.spec.ts:198-209` — `child.kill('SIGTERM')` then `child.kill('SIGKILL')`.
Node's documented Windows behaviour: *"'SIGKILL', 'SIGTERM', 'SIGINT' and 'SIGQUIT' terminate
the process forcefully and abruptly (similar to 'SIGKILL')"* — so the two-step escalation
**collapses into one unconditional kill** and the `SIGKILL` branch is dead code there.

Worse: `TerminateProcess` kills only the browser process. Unlike POSIX (where Chromium's
children notice the parent's death), the renderer/GPU children **survive** — an orphaned
`clavis.exe` holding the profile's `SingletonLock`, which is exactly the hazard the teardown
comment at `:216-218` exists to prevent. `signalCode` is also always `null` on Windows (`:200`).

**Fix:** branch on `process.platform === 'win32'` and kill the **tree**
(`taskkill /PID <pid> /T /F`); keep SIGTERM→SIGKILL on POSIX.

### B6 — 🟠 Windows/macOS: `--no-sandbox` makes the two instances different programs

`single-instance.spec.ts:135` passes `--no-sandbox` **unconditionally**, with a comment
(`:107-115`) saying the point is to make the spawned instance "comparable to the first one".
But Playwright's Electron launcher adds that flag **only on Linux** —
`playwright-core/lib/coreBundle.js:45669-45671`:

```js
if (import_os14.default.platform() === "linux") {
  if (!options.chromiumSandbox && electronArguments.indexOf("--no-sandbox") === -1)
    electronArguments.unshift("--no-sandbox");
}
```

So on Windows/macOS the spawned second instance runs **with** `--no-sandbox` while the
Playwright-launched first instance runs **without** it: the two are not the same program, and
the test stops measuring what it claims to measure.

**Fix:** make the flag conditional on `process.platform === 'linux'` — derived from the same
rule Playwright uses.

### B7 — 🟡 Windows/macOS: the `language` matrix leg would be a **no-op**

The `e2e` job's `language: [en, pt]` matrix (`:75`, `:108`) sets the **`LANGUAGE`** environment
variable, and the workflow's own comment (`:63-67`) says Chromium reads `LANGUAGE` and not
`LANG`/`LC_ALL`. That is a **Linux-only** behaviour: on Windows the UI locale comes from
`GetUserDefaultUILanguage` and on macOS from `[NSLocale preferredLanguages]` — both `en-US` on
the runners. The `pt` leg would therefore render **English** and still pass, leaving the pt-PT
half of every two-locale regex in `launch.ts:45-64` permanently unexercised — exactly the blind
spot the matrix exists to close.

**The Chromium `--lang` switch does not work here.** Measured on the packaged AppImage: neither
`LANG`/`LC_ALL` nor Electron's `--lang` moves `navigator.language` in this build. The lever
that *was* proven is stubbing `navigator.language` **before the app boots**
(`addInitScript` + reload).

**Sequencing:** this is a **separate, later step**, not part of the first cross run. The first
cross run is English-only on Windows/macOS and its job is to answer *"does the app run there
at all"*. The portable locale lever (`addInitScript` stub) has to be **proven on Linux first**,
where it is measurable locally, before it replaces the `LANGUAGE` env var.

### B8 — 🟡 macOS: ⌘S is never exercised

`clavis.spec.ts:128` presses `Control+s`; the app handles `(e.ctrlKey || e.metaKey) && e.key
=== 's'` (`src/renderer/pages/ViewDrawer.tsx:103`). On macOS the press fires the handler, so
the test passes — but the product's accelerator on macOS is ⌘S, and the suite's only shortcut
test would never cover it.

**Fix:** use Playwright's `ControlOrMeta`, or add a macOS-only ⌘S case.

---

## The CI design

### The job

A **separate** job, not a matrix dimension of the existing `e2e` job. The reason is the
owner's decision (tags only): the Linux `e2e` job runs on **every push and pull request** and
must stay that way (it is cheap and it is the per-push gate), while the cross legs run only
when a release is being cut.

```yaml
  # The Windows and macOS legs. Tags only (owner decision, 2026-10-21).
  e2e-cross:
    needs: quality
    # The same condition as `build`, plus the manual dispatch channel. Nothing depends
    # on this job — it is informational — so a skipped run here skips nothing else.
    if: startsWith(github.ref, 'refs/tags/v') || github.ref == 'refs/heads/test/downgrade-forge-6.4.2' || github.event_name == 'workflow_dispatch'
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 30
    steps:
      - name: Checkout code
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm

      # Windows — skip the native rebuild, use the shipped prebuilds (same as the
      # `build` job). The argon2 prebuild for win32-x64 ships in the tarball.
      - name: Install dependencies (Windows)
        if: runner.os == 'Windows'
        run: npm ci --ignore-scripts

      - name: Install dependencies (macOS)
        if: runner.os == 'macOS'
        run: npm ci

      - name: Build application
        run: npm run build

      # `electron-forge package` with no --platform packages for the HOST, which
      # is what is wanted: a native build for the runner it will run on.
      - name: Package application
        run: npm run package

      # No xvfb: Windows and macOS runners have a desktop session. The Linux leg
      # keeps `xvfb-run -a`.
      - name: End-to-end tests
        run: npm run test:e2e
```

**No `CLAVIS_E2E_TARGET`** in this job: once the locator is platform-scoped (B1) it finds the
native build by itself, and hard-coding `out/clavis-darwin-arm64/...` in YAML would bake today's
runner architecture into the workflow.

**`build` does NOT gain `e2e-cross` in its `needs`, and neither does `release`. The cross job is
informational — it measures, it does not gate.**

**Why (owner decision, 2026-10-21):** the macOS bundle is **ad-hoc signed** — free, and enough
to make the bundle launchable on arm64 (see B3) — so the macOS leg **can** pass, and it is
**expected to be green**. The cross job stays **informational** for a different reason now: the
legs run **only on tags** (plus the manual dispatch), so a release must not depend on whether a
Windows or macOS runner happened to be available when the tag was pushed. `build` therefore
keeps `needs: [quality, e2e]`, and `release` keeps `needs: build`.

**What the job is worth:** **measurement**. It turns *"nobody knows"* into *"the runner says so"*,
and the release keeps shipping while that happens. The Windows leg is expected to be **green**
(there is no signing problem on Windows), so a red Windows leg is a genuine finding — visible in
the same job, and it does not need a gate to be noticed. The macOS leg is expected to be
**green** too, now that the bundle is signed; a red macOS leg is likewise a genuine finding.

### The iteration path — the tension, stated plainly

"Only on tags" and "must be verifiable" pull against each other: **you cannot iterate on a
tag**, and pushing a throwaway tag to test a workflow is exactly the kind of thing that ends
up publishing something.

**Proposal:** give the workflow a `workflow_dispatch` trigger. A manual dispatch runs the
cross legs against any ref, and the `release` job stays `if: startsWith(github.ref,
'refs/tags/v') && github.event_name == 'push'` — **a dispatch publishes nothing**, not even when
the ref picked in the dropdown is a tag. The tag-only rule then governs what
happens *automatically*, and the manual trigger is the *verification* channel. The cost is one
extra trigger on the workflow.

### The locale matrix, first run

The cross legs run **English-only** in the first pass (B7 is deferred). The `language` matrix
dimension stays on the Linux job exactly as it is. This is deliberate: the first cross run is
about *"does the app run and does the lock work"*, and mixing in a locale change would make a
failure ambiguous between "the app does not run on macOS" and "the locale stub is wrong".

---

## What we expect to learn — and what would make us stop

| Question | How the answer arrives | What would make us stop |
|---|---|---|
| does the app launch on macOS? | the first test's failure message, or the job log | the bundle is **ad-hoc signed** (owner decision, 2026-10-21), so a red macOS leg is a **finding**, not the expected measurement — and it does not block the release either way |
| does the argon2 prebuild load on win32? | a **new** assertion (below) | — |
| does the single-instance lock work on win32/darwin? | `single-instance.spec.ts` on both runners | a refusal that does not happen, or a second instance that takes the lock anyway — the spec's premise is not in question on macOS, which uses the same POSIX lock file as Linux (see the out-of-scope note below) |
| does the log follow the profile on macOS? | B2's fix, verified by the log-reading specs | — |

**The new assertion** (this is the point of the whole exercise, so it is a deliverable, not a
by-product): the drawer file records the KDF backend — `keyDerivation.algorithm` is
`'argon2id' | 'scrypt'` (`src/main/store.ts:369`, `:645-649`). A new e2e test reads the drawer
the suite just created and asserts `keyDerivation.algorithm === 'argon2id'`. Today **nothing
asserts which KDF ran**, and the fallback is silent (`encryption.ts:36-41`), so a Windows build
silently using scrypt would be invisible. With the assertion, the runner says so out loud.

**A deliberate non-goal: notarisation.** The macOS bundle is **ad-hoc signed**, which is free
and is enough to make it launchable on arm64. **Notarisation is out of scope** (owner decision,
2026-10-21 — it needs the paid Apple Developer ID certificate; the reason is recorded in the
project's memory and in `SECURITY.md`), so the **Gatekeeper "downloaded from the internet"
warning remains** on the `.dmg` a user downloads. That warning is a **trust** signal, not a
**launch** signal: the ad-hoc-signed app runs, it is simply not *notarised*. A notarised,
trusted bundle is a future item that costs money.

**An out-of-scope case, recorded because it was asked:** *does macOS hand the second instance
off at the OS level?* **No — and this change does not answer that question.** The handoff is
LaunchServices' behaviour when an application is opened through the Finder or `open`, and
this harness never goes through LaunchServices: the locator execs
`clavis.app/Contents/MacOS/clavis` directly and `single-instance.spec.ts` spawns the raw
binary. So what the macOS leg proves is narrower than it first looks: that the app runs
there, that the refusal branch works and that the `second-instance` handler fires — with the
**same** POSIX lock-file mechanism Linux uses, plus the macOS-specific window and `focus()`
behaviour. The OS-level handoff would need `open -a` / `open -n`, which is a different
harness and a different question, and is out of scope here.

---

## The work list

| # | Change | Files | Verified by |
|---|---|---|---|
| 1 | platform-scoped artifact locator | `tests/e2e/artifact.ts` | a unit test over the locator, per platform |
| 2 | the log follows the profile | `src/main/index.ts` (1 line + comment) | the log-reading specs, on the macOS runner |
| 3 | retry-safe directory removal | `tests/e2e/launch.ts` (+ 3 call sites) | the Windows runner |
| 4 | Windows tree-kill | `tests/e2e/single-instance.spec.ts` | the Windows runner |
| 5 | conditional `--no-sandbox` | `tests/e2e/single-instance.spec.ts` | the Windows/macOS runners |
| 6 | the new KDF assertion | a new spec | the Windows runner — **this is the headline** |
| 7 | the `e2e-cross` job — **informational, it does not gate the release** | `.github/workflows/release.yml` | the tag run — a red **macOS** leg is now a **finding** (the bundle is ad-hoc signed), and a red **Windows** leg is a real finding |
| 8 | `workflow_dispatch` trigger | `.github/workflows/release.yml` | a manual dispatch |
| 9 | ⌘S coverage | `tests/e2e/clavis.spec.ts` | the macOS runner |
| 10 | the portable locale lever (**deferred**) | `tests/e2e/launch.ts` + the workflow | proven on **Linux**, locally, first |

**Gates before this is called done:** lint 0 errors · both typechecks 0 · the full vitest suite
green · the Linux e2e suite still 15/15 in **both** locales · and the cross legs **run** on their
runners — which, by construction, can only be established by pushing. **"Run", not "green":**
the bar is that the runners produced a verdict at all. Both legs are now **expected to be
green** — the macOS bundle is ad-hoc signed (B3) and Windows has no signing problem — so a red
leg on either runner is a **finding** to write down, not a known quantity to plan around.

---

## What this plan does **not** do

- It does **not** change what is built. The artefact matrix (x64 Windows, arm64-only macOS,
  x64 Linux) is unchanged — the **arm64-only macOS** gap is a separate item and is not
  addressed here.
- It does **not** run the e2e suite against the **maker** output on Windows/macOS (the Squirrel
  installer, the `.dmg`). It runs against `electron-forge package` output — the same artifact
  the Linux leg validates — because the maker output is a packaging problem, not a behaviour
  problem. The AppImage leg stays where it is, in the `build` job.
- It does **not** touch the product's behaviour beyond the one-line log path. Everything else
  lives in the test harness.
- It does **not** **notarise** the macOS bundle. It signs it **ad-hoc** (free, and enough to
  make it launch on arm64); notarisation needs the paid Apple Developer ID certificate and
  stays out of scope, so the Gatekeeper quarantine warning remains.
