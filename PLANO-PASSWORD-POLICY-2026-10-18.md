# PLANO — HYG-22: one password policy, no message sniffing, atomic writes

**Date:** 2026-10-18
**Closes:** HYG-22, which is SEC-03's two halves plus the residue of REL-01.
**Owner decisions taken up front:** eliminate `.prev` rather than make it safe; the strong
password policy applies to **create only**, because the app has no change-password flow.

## The three defects

1. **The policy is written twice, and the two copies disagree.** `validation.ts:6` and `:16`
   say `.min(8)`. `store.ts:277-285` (`isPasswordStrong`) says 12 characters plus all four
   character classes. Both are on the same code path: an 8-to-11 character password passes
   Zod and is then rejected by the store, so the schema the project calls its validation
   authority is not the rule that applies.

2. **The rejection is classified by matching an error message.**
   `ipc-handlers.ts:161` does `e.message.includes('Password must be at least 12 characters')`
   against a string thrown as a bare `Error` by `store.ts:295`. Reword either side and the
   create path degrades to `ErrorCode.WRONG`-adjacent noise: specifically `WRITE_FAILED`,
   "Failed to create drawer" — a different failure told to the user for the same cause.
   `tests/ipc-handlers.test.ts` then pins the coupling by mocking the store and comparing
   **two hardcoded copies** of the message, so it stays green through exactly that reword.
   The related `password_too_weak` entry in `SAVE_ERRORS` is **unreachable**: `saveDrawer`
   never calls `isPasswordStrong` (`store.ts`), which is correct and deliberate (below), so
   two tests assert a failure the store cannot produce.

3. **`atomicWrite` renames the live file away before the replacement lands.**
   `store.ts:19-21` does `rename(filePath, filePath + '.prev')` and only then
   `rename(tmp, filePath)`. Between the two there is **no `.clavis` at the path**: a crash,
   a kill, or a power cut in that window loses the drawer's only file. `.prev` is also never
   read (nothing in `src/`, `tests/` or `docs/` references it) and never cleaned up.

## Why save must keep accepting weak passwords

`CHANNELS` has no change-password member — confirmed by reading `src/shared/channels.ts`,
all 11 channels. A save can therefore only re-use the password that already opens the
drawer, and drawers created before the 12-character rule still open with 8-character
passwords. Enforcing the strong policy on save would re-open SEC-02 ("legacy 8-character
drawers unlock but cannot save"), which was closed by *not* enforcing it there. **The policy
is therefore a create-time rule and must be written as one.**

## The work

### A. One module owns the policy — `src/main/password-policy.ts` (new)

- `PASSWORD_MIN_LENGTH = 12`, plus the four required character classes.
- `isPasswordCompliant(p: string | Buffer): boolean` — the single implementation.
- `describePasswordPolicy(): string` — the single message, imported by the schema so the
  schema and the log cannot drift into two wordings.
- `SaveDrawerSchema` and `UnlockDrawerSchema` keep **sanity bounds only** (`.min(1)`, not
  `.min(8)`, not the policy) with a comment recording the reason above, because
  `UnlockDrawerSchema` already has to accept any legacy password and both schemas are read
  together as "what may arrive".
- `store.ts` drops its private `isPasswordStrong` and imports the shared one, keeping the
  call as defence-in-depth for any non-IPC caller.

### B. Typed failure, no string matching — `src/main/ipc-handlers.ts`

- The create schema expresses the policy with `refine`/`superRefine` so a weak password is a
  **Zod issue**, not a thrown string.
- The handler maps issues to codes by `issue.path` + `issue.code`, never by message text.
  A password-policy violation must reach the renderer as `ErrorCode.PASSWORD_TOO_SHORT` (the
  code `tError()` already has a translation for) instead of the generic
  `VALIDATION_ERROR` it gets today.
- Delete the `e.message.includes(...)` branch and the dead `"8 characters"` IPC path.
- Remove `password_too_weak` from `SaveFailureReason` and `SAVE_ERRORS` as unreachable, and
  fix the two tests that assert it (this also closes the HYG-21 sub-item).

### C. `atomicWrite` — `src/main/store.ts`

- Write temp → `fsync` the temp → **one** `rename(tmp, filePath)`. No unlink of the live
  file, so the path is never absent. `.prev` removed outright (owner decision).
- `fsync` the **directory** after the rename: without it the rename itself is not durable
  across a power cut on some filesystems, which would make the temp-file dance cosmetic.
- Clean up the temp file if the rename fails, so a failed save leaves nothing behind.

## Non-negotiable: negative controls

Per the project's standing rule, a green suite is not evidence. Every new test must be
shown to fail under the mutation it names:

- reword `describePasswordPolicy()`'s text → the classification test must fail (this is
  precisely the bug being removed, so it must become **impossible** to write)
- relax the policy to `.min(8)` in the schema → a weak-password test must fail
- remove the temp-file-then-rename and write in place → the atomicity test must fail

Tests to run: `npm test`, `npm run lint`, `npm run typecheck`, `npm run typecheck:test`.
Report the mutation results, not just the final green.

## Out of scope

SEC-05/SEC-07 (metadata validation), SEC-08 (passphrase composition), SEC-09 (single-instance
lock), HYG-21's remaining three assertion sets, HYG-13b. None of them is touched here.