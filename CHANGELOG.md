# Changelog — Clavis

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
