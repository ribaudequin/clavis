# PLANO — the rest of REL-02: a cancellable, counted unlock wait

**Date:** 2026-10-19
**Closes:** **UX-08**, and makes **REL-02**'s fix reachable rather than a safety net.
**Owner decisions taken up front (2026-10-19):** cancelling is a **renderer-only** affair (the
main process finishes its wait and its derivation and the result is discarded — no new IPC to
abort it); the user cancels with **both** the Cancel button and Escape; **the remaining seconds
are shown**.

## The finding that makes this the next thing to do

REL-02 ("a cancelled unlock still opens the drawer") is fixed and shipped in `v0.6.7-beta`.
The fix is the attempt counter in `src/renderer/pages/HomeScreen.tsx`: the cancel side
invalidates the attempt and a result whose attempt is no longer current is dropped.

**But the cancel side never fires, because the prompt cannot be closed while the unlock is in
flight.** Measured in the packaged app during an unlock:

```
{"activeTag":"BODY","activeId":"","inputDisabled":true,"focusInsideModal":false}
```

Three facts compose into the trap:

1. The password input is `disabled` while the unlock runs (`PasswordModal.tsx:64`), so the
   browser moves the focus to `<body>`.
2. The Escape listener of `useModalKeyboard` is on the modal **container**
   (`useModalKeyboard.ts:26`), and a keydown dispatched on `<body>` propagates *upward* — it
   never reaches a descendant.
3. The Cancel button is `disabled` too (`PasswordModal.tsx:92`).

So the user has no way out, and the counter — the thing REL-02 shipped — has nothing to
invalidate. **The audit's premise was wrong**: it assumed the prompt can be dismissed while
the unlock is pending. It cannot, today.

**What the user experiences** is the rate limiter's delay, which is applied *before* the
derivation (`ipc-handlers.ts:210-213`) and is decided by `getUnlockDelay(id)`
(`ipc-handlers.ts:66-80`): 3 failures → 1 s, 5 → 5 s, 10 → 30 s, per drawer, reset after
2 min of inactivity. The 30 s tier needs **10 consecutive wrong passwords on the same
drawer** — a path that already costs the user ~37 s of their own time — and the user who
actually suffers is the one who *knows* the password and just failed 10 times for another
reason (caps lock, keyboard layout, a wrong autofill). Rare, expensive when it happens. The
common tiers (1 s at 3 attempts, 5 s at 5) are tolerable.

**This plan closes the trap and, in doing so, makes REL-02's counter load-bearing** — the
same path that is worth protecting becomes reachable.

## The work

### A. The main process has to tell the renderer how long the wait will be (`src/main/`)

The delay is a pure function of the in-memory counter, and the counter has exactly one
writer (the unlock handler). **It must be read from the same function the unlock path uses** —
the project has already been bitten by a policy written twice (`PLANO-PASSWORD-POLICY`:
HYG-22), and a countdown that is computed in the renderer from a duplicated ladder is a
countdown that lies the moment the two copies drift.

- **New read-only channel** `GET_UNLOCK_DELAY` (`src/shared/channels.ts` — 11 channels
  today), exposed through the preload (`src/main/preload/index.ts`) and typed in
  `ElectronAPI` (`src/shared/types.ts`).
- The handler returns the delay the *next* attempt on that drawer would get, computed by the
  same `getUnlockDelay` the unlock path calls. It is a **query**, not a decision: the unlock
  path still computes the delay itself at attempt time.
- **The query is exact**, and the reason is worth a comment in the code: between the
  renderer's query and the handler's own computation, nothing can change the counter — the
  only writer is a failed attempt, and the attempt in question is the one about to be made.
- `registerIpcHandlers` takes its dependencies by injection (`{ ipcMain, dialog }`), so the
  delay function joins that seam rather than becoming a module-level import the tests cannot
  stub.

### B. The renderer: a cancellable, counted wait (`src/renderer/`)

- **`PasswordModal` needs the drawer id** to ask for the delay. It currently receives only
  the title. Adding a `drawerId` prop is the smallest change that keeps the query next to
  the thing it is about.
- **Before submitting**, the modal asks the main process for the delay and starts the
  countdown. The order matters: `isLoading` is set first (so the waiting state is visible
  immediately), then the delay arrives, then the submit goes out.
- **The Cancel button stops being disabled during the wait** (`PasswordModal.tsx:92`). The
  submit button stays disabled, and the input stays disabled — the guard against a second
  attempt is `if (isLoading …)` in `handleSubmit`, not the button's `disabled`.
- **The focus has to stay inside the modal**, or the Escape listener never fires. The cheapest
  way is to move the focus to the now-enabled Cancel button when the wait starts: the focus
  is then inside the container, Escape works, and the focused control is precisely the one
  that lets the user escape. (`useFocusTrap` already keeps the focus inside the dialog; this
  is about *which* element holds it.)
- **The countdown** is shown while the wait is running: the seconds remaining, counting down
  from the delay the main process reported. A new i18n key in **both** catalogues —
  `tests/i18n.test.ts` enforces `pt-PT`↔`en` key parity and scans for Brazilian-only
  markers, so a one-sided string fails the suite.
- **The countdown must not go negative and must be cleared** when the attempt ends (success
  or failure), or a stale number survives into the next attempt.

### C. What REL-02's counter then does

Nothing changes in the fix — it is already correct. What changes is that it becomes
**reachable**: the user cancels, `closeUnlockModal` increments the counter, the pending
result is dropped, and the drawer stays closed. That is the behaviour REL-02 was always
about, and the e2e test that currently has to *simulate* the dismissal can use a real
keypress.

### D. The tests

- **Unit (renderer):** the Cancel button is enabled while the unlock is in flight; Escape
  closes the modal while it is in flight (the focus-trap/keyboard path, with the real
  hooks); the countdown shows the reported number of seconds and counts down; the delay is
  queried before the submit; the counter invalidates the attempt on cancel (the existing
  REL-02 tests, which become reachable rather than synthetic).
- **Unit (main):** the new channel returns the delay the unlock path would apply, and the
  two agree — a test that compares the channel's answer with the delay the handler actually
  sleeps for is what keeps the two from drifting.
- **E2E:** the existing `tests/e2e/rel02-cancelled-unlock.spec.ts` keeps its structure — the
  window built out of the application's own rate limiter, the control that opens the drawer
  without a dismissal — but the **synthetic keydown on the `[role="dialog"]` container
  becomes a real Escape press**, because the interface can now be dismissed. The spec's
  header has to be rewritten accordingly: the paragraph explaining why the dismissal is
  synthetic is no longer true, and a future reader must be able to tell that from the
  paragraph explaining why the window is built out of the rate limiter.
- **Mutation checks** for each: revert the guard, revert the cancel-enabling, revert the
  countdown, revert the new channel — and confirm the matching test goes red.

### E. What does **not** change

- The rate limiter's policy stays in the main process, with one owner.
- The unlock result is still **discarded**, not aborted: the main process completes its wait
  and its derivation (~600 ms of Argon2id) and hands back a result nobody reads. That is the
  owner's decision, and the cost is bounded and paid only by the user who chose to cancel.
- The password policy, the single-instance lock, the metadata schemas and everything else
  are untouched.

### F. The traps, recorded so the next session does not rediscover them

- **The delay must not be re-implemented in the renderer.** One owner per rule, or the
  countdown and the actual wait become two different numbers.
- **The focus is the whole problem.** A keydown on `<body>` never reaches the container's
  listener. Any change that lets the focus leave the modal re-breaks the Escape path, and
  nothing in the unit tests would notice unless they check the focus explicitly.
- **The channel is a query, not a decision.** The unlock path must keep computing the delay
  itself; if it started trusting the renderer's answer, a stale query would become a wrong
  wait.
- **Adding a channel touches four places**: `src/shared/channels.ts`,
  `src/shared/types.ts` (`ElectronAPI`), `src/main/preload/index.ts`, and the handler in
  `src/main/ipc-handlers.ts` — plus the two lists that are asserted rather than derived:
  `tests/ipc-handlers.test.ts` ("registers all expected channels", around line 1256) and
  `tests/preload.test.ts` (parity in **both** directions, so a key added to `ElectronAPI`
  and forgotten in the preload fails the suite).
- **A new i18n key needs both catalogues**, and the pt-PT one must pass the quarantine scan
  for Brazilian-only wording.

## The gates

`lint` (0 errors) · `typecheck` · `typecheck:test` · `vitest` · `build` · `package` ·
the e2e suite against `out/clavis-linux-x64` **and** against the AppImage, in **both**
locales, with the new spec run repeatedly to show it does not flake. The REL-02 e2e takes
~7 s to arm the rate limiter, so the suite grows by roughly half a minute per leg — worth
knowing before someone wonders why the e2e job got slower.
