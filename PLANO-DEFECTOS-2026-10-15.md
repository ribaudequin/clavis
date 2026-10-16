# PLANO — Defect sweep (2026-10-15)

Defects found while closing the P3.31 testing gaps, plus three found by reviewing this plan.
**No release** — everything lands on `main`. Sequence is impact-first.

**Owner decisions already taken (2026-10-15):** delete the dead `onEnter` branch; land in `main`
without a release; keep the impact-first order.

> This plan went through a hostile review. Three of its original claims were **wrong** and are
> marked **[corrected]** below, each with the measurement that killed the original version. The
> corrections are load-bearing: two of them change what gets built, not how it is worded.

---

## Decisions needed before starting

| # | Question | Recommendation |
|---|---|---|
| **Q1** | A1: focus the **Restart button** or the **`<summary>`** (error details) on the crash screen? | **`<summary>`.** Restart is the only action, but focusing it means a stray Enter restarts the app — and a crash screen is exactly when someone reflexively hits Enter. The details toggle is safe and one Tab from Restart. This follows the *spirit* of `DESIGN.md` rule 9 ("focus goes where a stray Enter lands safely") more faithfully than focusing Restart does. |
| **Q2** | A2: ship the type widening **alone**, or type + `catch`? | **Both**, but on honest grounds — see A2. The `catch` changes no production behaviour. If you want the smallest correct diff, step 1 alone is coherent. |
| **Q3** | B1: change the shared `checkUpdate` type in `src/shared/types.ts`, or narrow inside the handler? | **Narrow inside the handler.** The shared type is hand-mirrored in `CreditsModal.tsx:30` and five test stubs; changing it is a 9-file diff for a defect no user can reach. |
| **Q4** | A3: fix only `danger.svg`, or all 13 unlabelled `CreditsModal` icons too? | **This sweep only `danger.svg`; the 13 become a TODO item.** `CreditsModal` is the screen most likely to churn under the pending brand work. |

---

## Block A — visible to the user

### A1. `ErrorBoundary` moves no focus

When the boundary swaps the tree, `document.activeElement` is `<body>` — measured, not assumed:
`{fallbackRendered: true, focusedTag: "BODY", focusOnRestart: false}`. The keyboard user must Tab
blind into an unknown page.

**[corrected] The original plan used `componentDidUpdate`. That is wrong, and the plan's own test
would have caught it.** Measured against React 19.2.8 with a class boundary:

| Throw site | Lifecycle observed |
|---|---|
| Initial mount | `componentDidMount` → `componentDidCatch` — **`componentDidUpdate` never fires** |
| Later update | `componentDidUpdate` → `componentDidCatch` |

`tests/ErrorBoundary.test.tsx` renders a fresh mount with an immediate throw — the case where
`componentDidUpdate` does not fire. The original plan's negative control ("remove the focus call →
that test goes red") was **impossible to perform**: the test would have started red and stayed red.

**Fix.** Focus from **`componentDidCatch`** — it fires on both paths, and the ref is already
populated and the fallback already in the DOM when it runs (verified by probe). `autoFocus` is not
the alternative: it appears **zero** times in `src/` and `tests/`, and the house convention for
mount focus is an explicit focus call (`DeleteConfirmModal.tsx:21-24`, `CreateDrawerModal`,
`PasswordModal`). Per **Q1**, focus the target decided there.

**Verify.** `tests/ErrorBoundary.test.tsx:269` — drop `.fails`, it becomes a normal test. Negative
control: remove the focus call → that test goes red. **Perform this control** — it is the one the
original plan could not.

**Note.** The boundary is not a modal: no hooks, no `role="dialog"`, no ESC. It does **not** belong
in the Mount-focus table, whose scope line (`DESIGN.md:505`) is about hooks binding on the
container. Document it as a separate rule instead.

### A2. `DeleteConfirmModal` — the type lie, then the catch

`onConfirm: () => void` (`DeleteConfirmModal.tsx:9`) admits any async function while **blocking
the idiomatic fix**: `onConfirm().catch(...)` is `Property 'catch' does not exist on type 'void'`.
That is almost certainly why `try/finally` was written instead. `npm run typecheck` cannot flag it
either — `tsconfig.json:11-20` **excludes `src/renderer`**, so the gate that covers this work is
`typecheck:test`. And `eslint.config.cjs` enables no promise rules at all.

**[corrected] The original plan traced `store → handler → preload` and concluded "unreachable",
while simultaneously calling the catchless `HomeScreen` handlers "a strictly larger exposure". Both
cannot be true of the same path — and the trace skipped the link where the two call sites differ.**

There are **two** production call sites:

| Call site | `onConfirm` | Has a catch? |
|---|---|---|
| `ViewDrawer.tsx:166` | `doDelete` (`:30-46`) | yes (`:41-42`) |
| `HomeScreen.tsx:337` | `confirmDelete` (`:104-127`) | **no** |

`confirmDelete` awaits `api().deleteDrawer(id)` (`:113`) **and** `await loadDrawers()` (`:120`);
`loadDrawers` (`:44-56`) is itself `try`/`finally` with no `catch`.

Below the caller, the chain is envelope-first: `store.deleteDrawer` returns a boolean and catches
(`store.ts:362-372`); the IPC handler returns a `Result<void>` on all four exits
(`ipc-handlers.ts:240-279`); the preload forwards the promise raw (`preload/index.ts:10`). So
`ipcRenderer.invoke` is the only link that can reject, and no-handler-registered is impossible
(`registerIpcHandlers` runs before `createWindow`, `main/index.ts:86-87`).

**Honest statement of what the fix buys:** the rejection is **not reachable in production today**,
and `catch { toast.error(...) }` changes **no observable behaviour** — the existing `finally`
already restores the buttons on every path, which `tests/DeleteConfirmModal.test.tsx:122-154`
already proves. Approve it as **defence-in-depth plus a testable statement**, not as a bug fix.
The type widening is the part that earns its keep: it removes the lie that hid this.

**Fix, in order:**
1. `onConfirm: () => void | Promise<void>` — `void |` not `Promise<void>`, because the test harness
   passes a sync callback (`:45`) and `DiscardChangesModal`'s sibling props are sync. Verified:
   bare `Promise<void>` breaks the harness with TS2322. Annotate
   `async function handleConfirm(): Promise<void>`.
2. `catch { toast.error(t('msg.error_delete')) }` between `try` and `finally`, matching
   `ViewDrawer.tsx:33-45` and `CreateDrawerModal.tsx:67-79`. Do not rethrow.

**Two things the original plan got wrong here:**
- **The toast needs no provider to emit.** `react-hot-toast` exports no `ToastProvider`; the repo's
  `src/renderer/components/ToastProvider.tsx` is a different thing with a colliding name.
  `toast.error()` dispatches to a module store — with no subscriber nothing renders and nothing
  throws. A provider is needed to **observe**, not to emit. Use `vi.mock('react-hot-toast')`:
  container-neutral, a sharper control, and it avoids injecting toast nodes into the same
  `container` that `container.querySelector('svg')` (`:214`) and `querySelectorAll('p')` (`:242`)
  query. No test in this repo has ever asserted a toast — this would be the first, so the mock
  keeps it cheap.
- **`msg.error_delete` ends in a colon** in both catalogues (`i18n/index.ts:31`, `:114`), so the
  toast reads "Error deleting:". Pre-existing, but A2 introduces a new user-visible toast with a
  dangling colon. Fix the key or accept it.

**Explicit deferral (make it a TODO item, do not silently drop it).** Five sibling handlers share
the `try/finally`-no-`catch` shape — `PasswordModal.tsx:29-38`, `HomeScreen.tsx:44-56`, `:79-98`,
`:104-127`, `:129-152` — and five un-awaited call sites in `HomeScreen` (`:59`, `:215`, `:316`,
`:284`, `:234`) let rejections reach the **global** handler. `:292 handleDelete` is `async` with no
`await`, so it cannot reject. Those are a separate change with their own review; widening this diff
past the defect sweep it belongs to would be the wrong call.

### A3. `danger.svg` is not hidden from assistive tech

`DeleteConfirmModal.tsx:47` renders `<DangerIcon className="w-12 h-12" />` with no `aria-hidden`
and no `role="presentation"`. It is decorative beside a visible `<h2>`. The convention exists at
`CreditsModal.tsx:179`, `EyeIcons.tsx:15,41`, `HomeScreen.tsx:279`. This is the BR-8f class.

**[corrected] The original plan named a negative control that would not have failed.** Once
`aria-hidden="true"` is on the icon, `computeAccessibleName` returns `""` unconditionally
(`dom-accessibility-api`, accname step 2A returns `""` for hidden nodes), and
`queryByRole('img')` also excludes `aria-hidden` subtrees. So under the named mutation — adding
`role="img" aria-label="biohazard"` — **both** the existing `not.toHaveAccessibleName()` (`:217`)
and `queryByRole('img')` being null (`:218`) **still pass**. The fix would have destroyed the
discriminating power of the very test named as its guard.

**Fix.** One attribute — plus **change the guard to an attribute assertion**:
`expect(icon).toHaveAttribute('aria-hidden', 'true')`, which does fail on removal. Keep the
existing name assertions too; they cost nothing and pin the case where `aria-hidden` is missing.

**Scope.** **[corrected]** The original plan said the convention exists "in three places" and
implied the class was done. `grep aria-hidden src/` returns 5 hits, and `CreditsModal` alone
renders **13** icons with none (`:120`, `:143`, `:189`, `:194`, `:207-208`, `:217`, `:226`, `:237`,
`:252`, `:256`, `:259`, `:265`, `:274`). "Fixed twice already" is true of the *sweeps*, not of the
*code*. Per **Q4** this sweep touches `danger.svg` only; the 13 become a TODO item.

### A4. **[new]** `check-update` can hang forever

Found by review, and it is Block A material: user-visible, and B1's Zod fix does not touch it.

`ipc-handlers.ts:460-472` attaches `.on('error', …)` to the **request** but not to the **response**,
and has no timeout and no `req.destroy()`. If the response stream errors or stalls after headers,
the `new Promise` **never settles** → `CreditsModal.tsx:77`'s `Promise.allSettled` never resolves →
`setAppVersion` (`:80`) never runs → the About card silently omits its version line, permanently.
Separately, **no HTTP status is checked**, so a GitHub 403/5xx parses fine and yields a tag-less
body that the UI reads as "no update available" — indistinguishable from "up to date".

**Fix.** `res.on('error', …)` alongside the request handler; a timeout that destroys the request;
and treat a non-2xx status as "no information" rather than parsing the body.

**Verify.** New `ipc-handlers.test.ts` cases: response emits `error` → resolves `null`; non-2xx →
resolves `null`; the promise settles in every path. Without a timeout test, the hang stays
invisible — a promise that never settles does not fail a test that does not await it.

---

## Block B — type honesty

### B1. `check-update` returns a value its own type forbids

`ipc-handlers.ts:467` — `resolve({ tag_name: json.tag_name || null })` against a declared
`Promise<{ tag_name?: string } | null>`. `null` is neither `string` nor `undefined`. It compiles
only because `JSON.parse` returns `any`. **Confirmed causal claim:** with a typed `json` under
`tsc --strict`, the same line is `TS2322: Type 'string | null' is not assignable to type
'string | undefined'`.

**Fix, per Q3.** Parse the payload with Zod (`src/main/validation.ts` exists and every other
handler uses it) so `tag_name` is a validated `string`, and resolve the honest shape **inside the
handler** — `src/shared/types.ts:62` stays untouched.

**Verify.** New handler tests: `{"tag_name":"v9.9.9"}` → the tag; `{}` → no tag; `{"tag_name":42}` →
rejected, not silently stringified.

### B2. Three handlers have no test at all

`CHECK_UPDATE`, `RESTART_APP` and `GET_APP_VERSION` are the only channels without a `describe`
block in `tests/ipc-handlers.test.ts`. `CHECK_UPDATE` is the one that talks to the network, and A4
lives inside it.

**Requires a harness change the plan must name.** `tests/ipc-handlers.test.ts:4-8` mocks electron as
`{ ipcMain, dialog, app: { quit: vi.fn() } }` — **no `app.getVersion`, no `app.relaunch`**. Both
handlers throw until that is extended. And `RESTART_APP`'s `setImmediate(() => app.quit())` fires
**after** the test body returns, so the immediate must be flushed or the leak accepted deliberately.

> **[corrected]** The original heading said "three handlers have no test at all". True of *handlers*.
> `TODO.md:211` lists files still untested: `main/index.ts`, `logger.ts`, `ToastProvider`,
> `SkeletonLoader`, `types.ts`, `channels.ts`. `preload/index.ts` is now covered by this sweep.
> `ToastProvider` is untested **and A2 is about to make a test depend on it** — which is a further
> argument for the `vi.mock` route over wrapping it.

---

## Block C — dead code and leftovers

### C1. Delete the dead `onEnter` branch (owner decision)

11 of `useModalKeyboard`'s 40 lines have zero callers; all five modals pass `{ onEscape }` only.
Deleting it also removes the unguarded `e.target as HTMLElement` cast (line 24), which would throw
on a keydown originating on an SVG child.

**[corrected] The original plan claimed the ESC tests would be "untouched". They cannot be.**
`onEnter` is threaded through `tests/useModalKeyboard.test.tsx` well outside the Enter describe —
`PanelProps.onEnter` (`:22`), the `Panel` options builder (`:26`, `:32-33`),
`UnattachedRefPanel` (`:42-44`), and three tests outside the Enter block (`:95-103`,
`:105-119` ×2, `:146-156`). `tsconfig.test.json` includes `tests/**/*.tsx`, so all of them **stop
compiling** the moment the option leaves the interface.

**Full change set — four files, not two:**
1. `src/renderer/hooks/useModalKeyboard.ts` — remove the `onEnter` branch, its option, and the dep.
2. `tests/useModalKeyboard.test.tsx` — the Enter describe (6 executions) plus the threading above
   and the file header (`:6-8`).
3. `tests/PasswordModal.integration.test.tsx:1-8` — the header documents "no `onEnter` is
   registered" as the guard against a duplicate-submit bug that "can only reach the hook's
   `onEnter`". After C1 that bug cannot reach anything, so the rationale is nonsense and the
   assertion becomes vacuous. Decide: keep it as a harmless pin, or drop it with the sentence.
4. `DESIGN.md:579` ("sole owner of Escape **and Enter**") and `:620` ("lists `onEscape` and
   `onEnter` as ordinary dependencies") — both become false.

**Verify.** ESC tests still green — that is the proof the deletion was scoped, now stated as a
consequence of the edit rather than an untouched-file claim.

### C2. `DeleteConfirmModal.tsx:56` — P3.27 leftover

`{t('msg.irreversible') || 'This action is irreversible.'}`. `t()` returns the key when the key is
missing, never `''`, so the fallback can never fire. P3.27 was declared done for `ViewDrawer.tsx`
only. Drop the `|| '…'`. **Folded into A2** — it is a one-token edit that cannot move any
assertion, because `tests/DeleteConfirmModal.test.tsx:246-256` already pins the text to
`t('msg.irreversible')` and already asserts it is not `''`. Not worth a full-suite run of its own.

---

## Block D — documentation drift

### D1. `DESIGN.md` reports a closed gap as open — in **three** places

**[corrected] The original plan named two. The third is the worst one.**

| Location | Says |
|---|---|
| `DESIGN.md:514` (Mount-focus table) | `CreditsModal \| nothing \| no` |
| `DESIGN.md:525` | "**`CreditsModal` has no mount focus at all.** … This is a live gap" |
| **`DESIGN.md:832`** (Known-gaps table) | "Live. **Add the mount `focus()` + `window.focus()` the other four have.**" |

That last row is a **remediation instruction for a fix that already exists** — it would send the
next implementer to redo finished work, which is the exact failure D1 exists to prevent.

**[corrected] The original plan also described the mechanism wrongly, in the one word that
matters.** It said "mount effect". `CreditsModal.tsx:92-96` is
`useEffect(() => { if (!isOpen) return; … }, [isOpen])`, and `HomeScreen.tsx:348` mounts
`CreditsModal` permanently, passing `isOpen` as a prop. The rule is **focus on open, not on
mount**. A rewrite that says "mount" teaches the wrong rule and produces a broken sixth modal —
in the document this plan calls "the authority the a11y rules are read from".

**[new] D1 cannot satisfy the project's own rule as written.** `tests/CreditsModal.test.tsx` has 35
tests and **zero** references to focus or `activeElement`. `escapeSingleInvocation.test.tsx:12-13`
imports only `DeleteConfirmModal` and `DiscardChangesModal`. **The behaviour D1 calls "already
closed" has no automated guard at all** — after the doc edit, deleting `CreditsModal.tsx:92-96`
changes nothing observable and **no negative control is possible**.

**So D1 needs a mount-focus test first**, or it is a doc edit asserting an untested fact. Write
that test as part of D1, negative-controlled by removing the effect.

**Also in DESIGN.md:** fold in the two lines C1 makes false (`:579`, `:620`), and A1's new rule
(the boundary's focus is **not** the Mount-focus table — it has no hooks, no `role="dialog"`, no
ESC). All DESIGN.md work happens **once, at the end**, so A1 and D1 do not edit the same file seven
steps apart.

---

## Sequencing and gates

| Step | Work | Files |
|---|---|---|
| 1 | **A1** focus in `componentDidCatch` (per Q1) + flip `it.fails` | `ErrorBoundary.tsx`, `ErrorBoundary.test.tsx` |
| 2 | **A2** type widening + `catch`; **C2** folded in | `DeleteConfirmModal.tsx`, `DeleteConfirmModal.test.tsx` |
| 3 | **A3** `aria-hidden` + guard becomes an attribute assertion | `DeleteConfirmModal.tsx`, `DeleteConfirmModal.test.tsx` |
| 4 | **A4** response error handler, timeout, status check | `ipc-handlers.ts` |
| 5 | **B1** Zod-parse + honest shape; **B2** harness extend + 3 describes | `ipc-handlers.ts`, `validation.ts`, `ipc-handlers.test.ts` |
| 6 | **C1** delete `onEnter` | `useModalKeyboard.ts` + 3 test/doc files |
| 7 | **D1** all `DESIGN.md` work, incl. a mount-focus test for `CreditsModal` | `DESIGN.md`, `CreditsModal.test.tsx` |
| 8 | MEMORY.md → TODO.md → SUMMARY.md, then `npm run memory:snapshot` | — |

**[corrected] Gates.** The original plan gated step 8 on a "brand checker" exit 0. **There is no
`brand/` or `band/` directory, no `ABOUT.md` anywhere in the worktree or in `git ls-files`, and no
`.py` file in the repo at all.** It was a stale artifact of an older session. A gate that has never
been run is worse than no gate. It is gone.

The real gates, matching `.github/workflows/release.yml:34-44`:

```
npm run test            # 265 passed | 1 expected fail (266)
npm run typecheck:test  # the ONLY gate that covers src/renderer
npm run typecheck
npm run lint
```

**`npm run typecheck` inspects zero files touched by A1, A2, A3 or C1** — `tsconfig.json:11-20`
excludes `src/renderer`. It still runs, but it is not the gate for this work.

**Counts.** 265 → **266** after A1 (the `it.fails` becomes a pass) → **260** after C1, which
deletes 6. B2 adds more.

**Every fix is negative-controlled before it is called done** — reintroduce the defect, watch the
specific test go red, restore from a `/tmp` backup. A fix that ships with a green suite and no
control has not been shown to work.

**Not in scope:** `P3.29` (`useCallback`) — still the open question of whether the item survives at
all, given the 2026-10-06 note that it was tried on `ViewDrawer` and rejected; `BR-13`, `BR-14` —
deferred or outside this agent's scope; `tests/e2e/clavis.spec.ts` — `npm run test:e2e` exists and
covers none of A1/A3/D1, which is worth a line in the TODO rather than a silent omission.