# Integration plan — offline common-password check (Clavis)

## Context

Clavis encrypts each "drawer" with AES-256-GCM, with the key derived from the
user's password via Argon2id (3 iterations, 256 MB memory, parallelism 4).
A dictionary attack test against ~70 weak/common passwords failed to crack a
real entry, confirming the Argon2id configuration is solid.

The password creation policy already implemented is:

- **Normal mode:** minimum 12 characters, with at least 1 uppercase letter,
  1 digit, and 1 special character.
- **Phrase mode** (contains spaces): minimum 20 characters.

## Problem to solve

The rules above guarantee length/complexity, but don't prevent predictable
passwords that still satisfy the requirements — e.g. `Password123!` in
normal mode, or `password password password` in phrase mode. This kind of
password falls easily to a dictionary/mutation attack, regardless of how
strong Argon2id is.

## Goal

Add a **100% offline** check (no network calls) that rejects
passwords/phrases found in common/leaked password lists, while keeping the
existing length/complexity rules.

The option of using the public Have I Been Pwned API (k-anonymity model)
was dropped because it isn't offline — see "Alternatives considered" below.

## Proposed solution

Use a local list of common passwords, bundled with the app, checked in
memory (no network, no external server).

| Option | npm package | Size | Coverage | License |
|---|---|---|---|---|
| A (recommended) | `fxa-common-password-list` | ~8.8 MB | Top ~1M passwords ("10 million password list" dataset), used in production by Firefox Accounts | MPL-2.0 |
| B (lighter) | `common-password-checker` | ~143 KB | Smaller list, more limited coverage | MIT |

**Trade-off to decide with the agent:** impact of option A on the final
Electron installer size vs. coverage. If the ~8.8 MB increase is
acceptable, option A is recommended.

### Known limitation

These lists contain real leaked passwords, which rarely contain spaces —
they won't catch a "phrase" made of a single common word repeated (e.g.
`password password password`, 27 characters, passes the length rule but
has near-zero entropy). The module therefore includes an additional
heuristic (`hasRepeatedCommonWord`) that detects this pattern in phrase
mode.

## Module already written

File `offline-password-check.js` (provided separately), ready to
integrate. Summary of the exported API:

```js
const { validateVaultPassword } = require('./offline-password-check');

const result = validateVaultPassword(password);
// result.valid -> boolean
// result.reason -> string (rejection reason, only when valid === false)
```

It is **synchronous** (no `async/await`), since there's no network I/O —
only reading the local list already loaded into memory by the npm package
itself.

> Note: an earlier version (`pwned-check.js`) used the HIBP API over the
> network. It has been replaced by this offline version — do not use the
> old version.

## Integration steps (for the agent)

1. **Install dependency:** `npm install fxa-common-password-list`
   (or `common-password-checker`, depending on the trade-off decision
   above).
2. **Locate the module** `offline-password-check.js` in the appropriate
   place in the project tree (e.g. `src/main/validators/` or equivalent —
   confirm against the current structure of the `ribaudequin/clavis`
   repository).
3. **Locate the current drawer-creation flow** where the
   length/complexity validations already run, and replace/complement that
   call with `validateVaultPassword(password)`.
4. **Wire `result.reason` into the existing error-feedback UI** on the
   drawer creation form (same pattern used for the current
   length/complexity errors).
5. **Check bundle impact:** confirm the increase in Electron installer
   size after adding the dependency (option A ≈ +8.8 MB) and decide
   whether it's acceptable or whether option B should be used instead.
6. **Write unit tests** (see test cases below).
7. **Manually test** both modes (normal password and phrase) with common
   and uncommon examples.

## Suggested test cases

| Input | Mode | Expected |
|---|---|---|
| `Password123!` | normal | rejected (common) |
| `Xk9#mQ2vL8pZ` | normal | accepted (not common, satisfies rules) |
| `abc` | normal | rejected (length) |
| `password password password` | phrase | rejected (repeated word) |
| `correct horse battery staple` | phrase | accepted (≥20 chars, no repetition, not a common password) |
| 15-character phrase | phrase | rejected (length) |

## Open questions for the agent to resolve

- What is the exact location of the drawer-creation handler in the
  current codebase (file/component name)?
- Should the block prevent form `submit`, or just show a non-blocking
  warning?
- Confirm the final decision between option A (`fxa-common-password-list`)
  and option B (`common-password-checker`) after measuring the actual
  impact on installer size.

## Alternatives considered and dropped

- **Have I Been Pwned API (k-anonymity):** technically solid and
  privacy-preserving (only sends 5 characters of the SHA-1 hash), but
  depends on network access — doesn't meet the 100%-offline requirement.
