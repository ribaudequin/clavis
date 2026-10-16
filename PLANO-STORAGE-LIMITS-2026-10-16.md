# PLANO — Storage limits hardening (2026-10-16)

Follow-on to `PLANO-DEFECTOS-2026-10-15.md`. **The 20 MB import cap stays** — owner decision, not
reopened. What that decision exposed is addressed here.

> This plan went through a hostile review and **every one of its load-bearing claims was wrong**.
> Corrections are marked **[corrected]**, each with the measurement that killed the original. The
> plan you are reading is the second version; the first is not worth reconstructing.

---

## Block 0 — A drawer can be saved and then never opened again

**Three doors. No attacker needed for the first two. The outcome is permanent and the message is
a lie.**

A drawer whose `encryptedData` decodes to more than `MAX_DECRYPTED_SIZE` bytes can never be
unlocked. `unlockDrawer` refuses it (`store.ts:271-278`) and returns `null`, which
`ipc-handlers.ts:167-180` reports as `DECRYPT_FAILED` → **"Incorrect password or drawer not found"**
— while incrementing the rate limiter (`:167-171`), so retrying walks into the 1 s / 5 s / 30 s lockout.

### [corrected] The mechanism is not what the first version said

The first plan claimed `decrypt()` throws at `encryption.ts:149` and a blanket catch swallows it.
**Neither happens.** `store.ts:278` returns `null` inside the `try`, before `decrypt()` at `:281`
is ever called:

```ts
store.ts:271   if (encryptedBuffer.length > MAX_DECRYPTED_SIZE) {
store.ts:278       return null;                    // ← returns here
store.ts:281   const decryptedContent = await decrypt(   // ← never reached
```

So the byte cap inside `decrypt()` is **unreachable through the application**. It survives only
because `tests/encryption.test.ts:61-70` calls `decrypt()` directly. The user-visible outcome is
the same; the fix has to touch `store.ts`, not `encryption.ts`.

### [corrected] The trigger is far smaller than "10 million emoji"

The binding limit is **UTF-8 bytes**, not code points. Any content whose UTF-8 encoding exceeds
10 000 000 bytes does it. Verified:

| Input | Code points (what Zod counts) | UTF-8 bytes (what the cap counts) | Schema accepts | Unlock |
|---|---|---|---|---|
| `'x'.repeat(9_999_998) + '😀'` | 9 999 999 | **10 000 002** | **yes** | **refused** |
| `'😀'.repeat(2_500_001)` | 2 500 001 | 10 000 004 | **yes** | **refused** |

One paste, no malice, no attacker. Zod 4.5.4's `.max()` counts **code points**, and each counted
unit may be up to 4 UTF-8 bytes, so the schema's ceiling is worth up to 40 MB of UTF-8.

**[corrected] The prose here previously said "four emoji pasted into a 9.9 MB note".** That was
wrong twice over, and the table directly above it already said so: the smallest trigger needs the
note to exceed 10 000 000 UTF-8 bytes, and 9.9 MB + 4 emoji is 9 900 016 bytes — **under** the cap,
so it is not bricked. "Four emoji" was the 4-bytes-per-code-point *fact* mis-transcribed into an
*example*. The verified minimum is one emoji appended to 9 999 998 ASCII characters.

The realistic case is not emoji at all: **`'ã'.repeat(10_000_000)` — ten million accented
Portuguese characters — is 10 000 000 code points (accepted) and 20 MB of UTF-8 (refused).** For a
Portuguese-speaking user, an ordinary long note bricks.

### [corrected] "Cannot be backed up either" is wrong for most of the range

Measured: at 10 000 004 plaintext bytes the file is 20 000 611 chars, which is **under** the
20 004 096 import cap. So export → delete → import **succeeds** and still yields a drawer that
cannot be opened. That is worse than "cannot be backed up", not better — the round trip looks
fine and the user still cannot read their own data. The plan must not promise a bound it does
not provide.

### The three doors

| # | Door | Cost to trigger | In the first plan? |
|---|---|---|---|
| 1 | **Save** — `store.ts:344` calls `encrypt()` with no byte check; `encryption.ts:115` produces 40 MB; `store.ts:356` writes it | 10 MB of text | yes |
| 2 | **Import** — `importDrawerRaw` checks that `encryptedData` **exists** and is a string (`store.ts:419-422`) but never its **length** | **a hand-written JSON file.** Verified: 20 002 000 hex chars → file ~20 002 900, under the cap → imports → appears in the list under its plaintext title → never opens | **no** |
| 3 | **Legacy migration** — `store.ts:116` `fs.copyFile`s any `*.clavis` from `~/.local/share/Clavis/drawers` with no size check, no parse, every startup | drop a file there | no |

Door 2 is the cheapest and the first plan missed it entirely. **A fix in `encrypt()` closes door 1
only.**

### Fixes, cheapest first

**0a — Reject at import (one line).** The predicate the plan already validated for the unlock
path, applied at `store.ts:419`:

```ts
if (Math.floor(drawer.encryptedData.length / 2) > MAX_DECRYPTED_SIZE) return false;
```

`Buffer.from(s, 'hex').length <= Math.floor(s.length / 2)` holds always — Node's hex decoder stops
at the first invalid pair — so this is a sound upper bound and the floor is exact, not rounded.
Verified against odd-length, non-hex and astral input. **Closes door 2 and door 3** (migration
routes through the same on-disk shape, and 0a's check applies on the read path too).

**0b — Mirror the guard into `encrypt()`.** Closes door 1, and every future caller. Keep it.

> **[corrected] The first plan assumed a throw here would surface to the user. It does not.**
> `saveDrawer` catches at `store.ts:360` and returns `false`, which `ipc-handlers.ts:214-220`
> renders as *"Failed to save drawer (invalid ID or password)"* — the password again, and not
> loud. `saveDrawer`'s `boolean` contract is what swallows it. That must be addressed in the same
> step or the guard is invisible.

> **[corrected] Reusing an existing `ErrorCode` cannot produce a legible message.** `tError`
> (`i18n/index.ts:213-221`) falls back to `error.message` **only when the dictionary key is
> missing**, and every `error.*` key exists — so `WRITE_FAILED` renders the generic *"The operation
> could not be completed."* and discards the message. There is already a dead instance of this:
> `ipc-handlers.ts:417` builds a `"File too large."` message the user never sees. **A new
> `ErrorCode` member is the only route.** Adding one makes `tests/errorTranslation.test.tsx:130-141`
> go red until **both** dictionary entries exist — that is the guard working, not a problem.

**0c — Fix the root cause, which is not a missing guard.** `unlockDrawer` returns `null` for six
distinct causes — invalid id (`:231`), read failure (`:238`), parse failure (`:239`), KDF out of
bounds (`:255`), ciphertext over cap (`:278`), wrong password (`:281`) — and
`ipc-handlers.ts:167-180` collapses all six into one message **and** one rate-limiter increment.
Special-casing the size error fixes one instance. **A `{ ok: false, reason }` return fixes all
six, is smaller than the special-casing, and also rescues drawers already bricked in the wild** —
which no guard can, because the bytes are already on disk.

**Verify.** A test that saves content whose UTF-8 exceeds the cap and asserts the save is
**refused with a size reason**, not a password one. Negative control: remove the `encrypt()`
guard and confirm the test goes red on a *refusal* assertion rather than on a message change.
Rewriting `tests/encryption.test.ts:61-70` is **required** in the same commit — it calls
`encrypt()` with an oversized payload at `:65` and will throw once the guard exists. Build the
oversized ciphertext without `encrypt()` instead (hex-concat, as `tests/store.test.ts:250-253`
already does), so decrypt-side coverage survives.

---

## Block A — The coupling (what the owner asked about)

`MAX_IMPORT_FILE_SIZE = MAX_DECRYPTED_SIZE * 2 + 4_096` means raising the text limit silently
doubles the import DoS guard.

| Option | | |
|---|---|---|
| A1 | Keep the derivation + a warning comment | Cheapest; does not help. `MAX_DECRYPTED_SIZE` is exported and will be edited by someone with no reason to read `store.ts`. |
| A2 | Decouple into two values, pin the relationship with a test | **Weakens the guarantee.** An invariant test asserts a *lower bound*; the derivation makes the violating case **inexpressible**. Decoupling is also what invites someone to type an independent literal. And `MAX_IMPORT_FILE_SIZE` is module-private, so the test would need a new export. |
| A3 | Two values, no test | Strictly worse than A2. |
| **A4** | **Keep the derivation *and* pin an absolute ceiling** | **Recommended** |

```ts
const ABSOLUTE_IMPORT_CEILING = 20_004_096;   // the DoS bound, independent of text size
const MAX_IMPORT_FILE_SIZE = Math.min(
  MAX_DECRYPTED_SIZE * 2 + IMPORT_ENVELOPE_OVERHEAD,
  ABSOLUTE_IMPORT_CEILING
);
```

A4 dominates the others: the relationship stays correct **by construction** (A1's warning becomes
enforced), and the DoS bound **cannot move** when someone raises the text limit — which was A2's
actual goal, achieved without weakening anything. If the text limit does rise, `Math.min` pins
the cap and the **existing** round-trip test (`tests/store.test.ts:255-286`) goes red with a real
exported file in hand, rather than a new test asserting a tautology. **No new test required.**

**Do not "fix" `tests/store.test.ts:270, 303, 305`.** The first plan flagged their hardcoded
`4096` as drift risk. They are the opposite — they already encode the coupling as *behaviour*, and
a real exported file is in hand when they fail.

---

## Block B — The guards are downstream of the allocations they exist to prevent

| Read | File:line | Bounded? | Needs a user gesture? |
|---|---|---|---|
| **`listDrawers`** | `store.ts:149-150` | **No**, per file | **No — fires on every app open** |
| `unlockDrawer` | `store.ts:238` | No | yes |
| `saveDrawer` | `store.ts:323` | No | yes |
| `readDrawerRaw` (export) | `store.ts:383` | No — and it crosses IPC into a renderer `Blob` | yes |
| import | `ipc-handlers.ts:396` | Cap at `store.ts:407` runs on a string already read at `:396` | yes |

**`listDrawers` is the one that needs no user action** — it reads and parses every `*.clavis` on
every open, and `HomeScreen` re-runs it after every save, delete, import and back-navigation. The
first plan ranked it fifth; it is first.

`ipc-handlers.ts:385` already holds the `Stats` object from `fs.lstat` and **discards `stat.size`**.

**Recommended: `stat.size` before each read** — refuse before allocating, no new helper, no
streaming. Rejects `stat` over `lstat` for size are irrelevant here (symlinks are already refused
on the import path at `:386`), and the residual TOCTOU is a local-file race between `stat` and
`read`, which is disproportionate today. `O_NOFOLLOW` would close it; out of scope.

**[corrected] Two things the first plan promised and did not deliver:**
- It listed the legacy migration row in its table but `fs.copyFile` has no read to bound — that row
  needs a `stat.size` check *before the copy*, or an explicit exclusion. As written the plan
  promised coverage it did not have.
- Its proposed test — mock `readFile`, assert `stat.size` was consulted — **cannot fail** on the
  real defect. A call-shape assertion stays green if the comparison uses the wrong constant or
  lands on another branch. **Correct shape: make `fs.stat` resolve an over-cap size, make
  `readFile` throw if called, and assert the operation refused.** Then reintroducing the unbounded
  read reddens on the actual defect. `tests/ipc-handlers.test.ts` mocks `readFile` outright
  (`:35-43`) and mocks the whole store module (`:14-23`), so nothing today observes this at all.

**Also cheap:** move the hex decode behind its own check (`store.ts:270` allocates the full buffer
one line before `:271` compares its length). Passing the already-decoded buffer into `decrypt()`
instead of re-decoding it — `encryption.ts:140` decodes the same string a second time — makes the
check free and halves the per-unlock allocation.

---

## Block C — Two documents written in this session are wrong

> **Partly resolved 2026-10-16 — the factual errors are fixed, the reshape is not.** The corrections
> below are marked ✔. What remains is the *post-fix* shape, which cannot be written until the code
> is fixed: today the documents are accurate about a bug, and after SAV-01…SAV-06 they will need to
> describe a single limit in bytes.

`docs/DRAWER-CAPACITY.md` and `SECURITY.md` both said Zod's `.max()` counts UTF-16 code units. It
counts **code points** — `util.codePointLength` folds surrogate pairs
(`node_modules/zod/v4/core/checks.cjs:413-419`). Both attributed the refusal to `decrypt()`; it is
`store.ts:271`. Both claimed measurement provenance the numbers did not support.

✔ **Fixed.** `DRAWER-CAPACITY.md`'s limits table now carries four rows in three units, names
`store.ts:271` as the guard that actually fires, and states that `decrypt()`'s own byte cap is
unreachable through the application. `SECURITY.md`'s content-limits section carries the same three
corrections plus the `null`-contract and import-length defects.

✔ **The envelope measurements were wrong too, and in the opposite direction to what was claimed.**
Measured against the exact serialised shape (payload held constant, subtracted):

| Title | Envelope | Previously claimed |
|---|---|---|
| 1 character | **393** | ~560 |
| 255 ASCII | **647** | ~815 |
| 255 emoji | 902 | — |
| 255 × `U+0001` | **1 922** | "worst case ~1 100" |

So the 4 096 allowance leaves 2 174 characters of headroom — **1.1×**, not the "roughly 3×" the
document claimed. The cap is still sound; the confidence in it was not. Note the file is written with
`JSON.stringify(drawer, null, 2)`, and the indentation is a real part of the cost. `iconData` is
derived from the drawer id, so it does not scale with user input.

**[corrected] The first plan asked for a unit correction. After step 0b the shape of the document
changes**, so a unit-only edit would produce a document that is accurate about a limit which no
longer binds in that place — deferred until the code is fixed:

- `DRAWER-CAPACITY.md:12` "Text you can save in a drawer | 10 MB" — false today (40 MB saves). ✔ now
  rewritten to name both ceilings.
- `:13` "Text that survives an export → import round trip | the same 10 MB" — false today above
  10 000 000 UTF-8 bytes. ✔ now states that a completed round trip proves nothing.
- **`:143-144` "Anything Clavis can save can also be exported and restored. There is no smaller
  ceiling to plan around."** — **false**, and this is the sentence that turns Block 0 from a
  curiosity into a data-integrity defect. ✔ replaced.
- `:26`'s "Measures: UTF-16 code units" row should be **deleted, not re-worded** — after the fix
  there is one limit in bytes. ⏳ kept for now, with the mismatch stated explicitly.
- `:32`'s "~3.7 M bytes' worth" conflates bytes-per-character with the cap; the threshold is
  10 000 000 bytes. ✔ removed.
- The emoji row's "~5 400 pages" is incoherent against the CJK row's 2 200. ✔ removed.

**One correction the plan itself got wrong, found while fixing the documents.** The "four emoji in a
9.9 MB note" trigger had already propagated from this plan into `TODO.md`, `SUMMARY.md` and
`MEMORY.md`, each citing the others. 9.9 MB + 4 emoji is 9 900 016 bytes — under the cap, not
triggered. The *table* in this plan was right all along; only the prose beneath it was wrong. **A
wrong number copied between four documents acquires the appearance of independent confirmation**,
because each file cites the others rather than the measurement.

`SECURITY.md` needs the same unit and attribution fix. Its `ipc-handlers.ts:417` dead "File too
large." message is worth a note — it is the second instance of Block 0's failure shape, where a
size error exists in code but the user never sees it.

---

## Sequencing

| # | Step | Gate |
|---|---|---|
| 1 | **0a** — reject oversized ciphertext at import (`store.ts:419`) | full suite |
| 2 | **0c** — `unlockDrawer` returns a reason instead of `null`; `ipc-handlers.ts` maps it; rate limiter only counts wrong passwords | full suite + a wrong-password test still locks out |
| 3 | **0b** — `encrypt()` byte guard + new `ErrorCode` + both dictionary entries + `saveDrawer`'s boolean contract | full suite + `tests/encryption.test.ts:61-70` rewritten |
| 4 | **B** — hex pre-check / buffer handoff, then `stat.size` on all five reads incl. `listDrawers`, then the migration `stat.size` | full suite + the refuse-before-read test |
| 5 | **A4** — `Math.min(derived, ABSOLUTE_IMPORT_CEILING)` | existing round-trip test must stay green |
| 6 | **C** — documents, describing post-fix behaviour | doc review |
| 7 | MEMORY.md → TODO.md → SUMMARY.md → snapshot | — |

Step 1 first because it is one line and closes the cheapest door. Step 2 before 3 because it is
what makes 3's error visible.

**Interaction worth stating:** steps 1 and 3 together make the largest file the app can write
**2 × 10 000 000 + 1 922 = 20 001 922** chars, so the 20 004 096 read cap becomes provably
non-binding for app-written files rather than an estimate. The 1 922 is the **measured** worst-case
envelope (a 255-code-point title of `U+0001`, which JSON-escapes to 6 characters each) — this
figure was previously 860, taken from an unmeasured claim, and the margin is correspondingly
tighter than the plan used to state: **2 174 characters of headroom, not 3 235**. Step 4's read
guard therefore cannot break the round-trip guarantee, but the margin is ~1.1×, which is worth
knowing before anyone raises either constant.

**Note on A4:** `ABSOLUTE_IMPORT_CEILING` is `20_004_096` and the derived value is *also*
`20_004_096` today (`10 000 000 × 2 + 4 096`), so the `Math.min` is currently a **no-op**. Its
purpose is prospective: it becomes load-bearing the moment someone raises `MAX_DECRYPTED_SIZE`,
which is exactly the scenario the owner asked about. This should be said plainly in the code
comment so the next reader does not "simplify" the `Math.min` away as redundant.

## Not in scope

- `check-update` accumulates an unbounded response body (`ipc-handlers.ts:498`). Excluded because
  `ipc-handlers.ts:486` pins `https://api.github.com/…` over TLS, so a hostile body needs someone
  who already holds a cert for that host — **not** because it is "network-sourced", which would
  equally excuse the import path, which *is* attacker-reachable.
- `listDrawers` pushes unvalidated `id`/`title`/`iconData` into the renderer (`store.ts:151-155`).
  Real, and it wants a Zod schema for `EncryptedDrawer` — which does not exist anywhere today.
  Worth its own item.