# PLANO — SEC-08: a passphrase the app accepts, and one owner for the rule

**Date:** 2026-10-20
**Closes:** **SEC-08** (composition rules reject strong passphrases) and **UX-02** (the strength
meter's labels are not translated).
**Owner decisions (2026-10-20):** the gate keeps composition rules **with a carve-out**; the
minimum stays 12 on the short path and the carve-out is at **20**; **no blocklist**; the policy
moves to `src/shared/`; the strength meter is reworked so it cannot contradict the gate, and its
labels are translated; `SECURITY.md` states the rule honestly.

## The finding

The audit (`audits/audit_2026-10-17.md`, SEC-08 — a *design recommendation*, Medium, not a
confirmed vulnerability): the policy requires upper **and** lower **and** digit **and** symbol. A
30-character lowercase passphrase is rejected; a predictable `Password1!` satisfies the rules.
NIST SP 800-63B recommends length and a blocklist over composition rules, because composition
requirements push users toward predictable patterns.

The audit's own condition for keeping composition is explicit: *"If the product decision is to
keep composition, document it as such; do not present it as a security improvement over a long
passphrase."*

## What was found while investigating — the part the audit does not mention

**The rule is written in the renderer three times, and the main process owns it once:**

| Copy | Where | What it is |
|---|---|---|
| the owner | `src/main/password-policy.ts` | the rule itself, since HYG-22 |
| the gate | `src/renderer/components/CreateDrawerModal.tsx:92` | the pre-submit check, with **its own regexes** |
| the meter's floor | `CreateDrawerModal.tsx:52` | `pw.length < 12` |
| the meter's scoring | `CreateDrawerModal.tsx:56,58` | the four classes, scored on their own |

HYG-22 removed the duplicate between `validation.ts` and `store.ts` and left this one. The
renderer's copy is what the user actually meets, and nothing tests it.

**The meter's labels are hardcoded Portuguese** ('Muito curta (mín. 12, misto obrigatório)',
'Fraca', 'Razoável', 'Boa', 'Forte', 'Excelente') in a component that is otherwise fully
translated — this is UX-02, and it is in the same function as the duplicate rule.
`DESIGN.md`'s own "Known gaps" table describes those labels as **English** ('Weak', 'Fair',
'Good'…), so the table is describing a version of the code that no longer exists. That row is
fixed by this change.

**The meter's verdict contradicts the gate, in both directions.** Measured: a 24-character
lowercase passphrase scores 2 ('Razoável'), while `Password12!` — 12 characters — scores 5
('Excelente'). The meter is what the user believes, so a policy change that leaves it alone is
cancelled at the interface.

**Four documents state the rule, and two of them are already wrong today:**

| Where | What it says | Status |
|---|---|---|
| `README.md:86` | "minimum 8 characters, maximum 128" | **already false** — stale since HYG-22 replaced the 8-character rule |
| `PLANO.md:21` | "Minimum 8 characters enforced in both UI and backend" | **already false**, same stale rule |
| `docs/user-guide.md:4` | "≥12 chars, mixed" | right today, wrong after this change |
| `SECURITY.md:39` | the 12+4 rule, as fact | wrong after this change |

## The rule

```
accepted  ⇔  length ≥ 20                              (any character mix)
           ∨  length ≥ 12 ∧ has upper ∧ has lower ∧ has digit ∧ has symbol
```

Two branches, **alternatives**, not a sequence.

**The floor is 12, not 20.** A 19-character mixed password is accepted by the second branch, and
any wording that says the app "requires 20 characters" is false. This is the single most likely
thing a reviewer will catch.

Two thresholds, two named constants: `PASSWORD_MIN_LENGTH = 12` and `PASSPHRASE_MIN_LENGTH = 20`.
`PASSWORD_MIN_LENGTH` keeps its name and its value: `tests/password-policy.test.ts` asserts on it,
and repurposing it to mean 20 would silently change what that test means.

**The length is counted in code points, not in UTF-16 units.** The policy today uses `s.length`,
which counts UTF-16 code units — and an astral character counts as two. That is invisible under
the composition rule (an emoji is not a letter or a digit, so the rule refuses it anyway) and
becomes a hole under the carve-out: **ten emoji are `s.length` 20 and would be accepted as a
twenty-character passphrase.** The project already has the right function —
`countCodePoints()` in `src/shared/limits.ts`, written for exactly this (HYG-8) — and the
inconsistency it fixes is wider than the carve-out: the schema's `.max(128)` already counts code
points (Zod folds surrogate pairs), so the policy's minimum and the schema's maximum are today
measured in two different units. The meter's length and the renderer's gate use the same count.

**Nothing that was accepted stops being accepted** — with exactly one exception, and it is the
code-point change talking. The old rule counted UTF-16 units, so a password of 12 units that
carried an astral character (`A😀bcdefg1!x` — 12 units, **11 code points**) satisfied it; the
new rule counts 11 and refuses it. The policy is create-time only, so a drawer created with such
a password still opens and still saves (SEC-02 keeps save and unlock at sanity bounds). The
exception is pinned by a test rather than left implied.

The policy is **not stored in the `.clavis` file** (the file carries only `keyDerivation`), so
there is no migration, no format bump, and no drawer written by any version is affected.

### Why length is checked before shape

The audit's objection and NIST's are the same objection: users answer a composition rule in
predictable ways. A user with a 30-character passphrase who is *required* to comply applies a
**deterministic transformation** to it — `correct horse battery staple1!` — and that
transformation is one an attacker's rules dictionary already enumerates. So the compliance step
does not add entropy; it collapses a large set of possible secrets onto a much smaller one.

The honest framing for the documentation, and the one the audit's condition allows: **the rule
constrains length, and below 20 characters it also constrains shape. It is a length-and-shape
gate, not an entropy check.** `Passw0rd!!!1` satisfies the composition branch today and has almost
no guess resistance — the composition rule was never an entropy check either, so the carve-out
does not make the worst password worse; it makes an existing weakness visible.

The economics of the attack this app has to survive, with the project's own parameters (Argon2id
at 2^18 KiB — 256 MiB and ~0.4–0.6 s per derivation, measured): a dictionary hit is free; a
composition-compliant human password falls in roughly 2^20–2^30 candidates, which is minutes to a
few hundred dollars of rented memory; a three-to-four word passphrase is roughly 2^33–2^44, which
is not. **The carve-out is worth 10–20 bits of effective entropy against a realistic attacker, and
it is the only part of the policy that does anything for this threat model.** The 12-character
floor buys almost nothing.

## The work

### A. One module owns the rule, and it lives where both processes reach it

- `src/main/password-policy.ts` → **`src/shared/password-policy.ts`**. `src/shared/` is already the
  main↔renderer channel (`limits.ts`, `types.ts`, `channels.ts`, and `limits.ts` already hosts a
  function, `countCodePoints`), it is already compiled by `tsc` into `dist/shared/`, and it is
  already imported by both processes. The convention is `.js` in the main process and no
  extension in the renderer; both are followed.
- The module owns: `PASSWORD_MIN_LENGTH`, `PASSPHRASE_MIN_LENGTH`, `REQUIRED_PASSWORD_CLASSES`,
  `isPasswordCompliant`, `describePasswordPolicy`, **and the strength meter's scoring** (below).
- **The length is counted with `countCodePoints()` from `src/shared/limits.ts`**, not with
  `s.length`. See above — this is the difference between a ten-character emoji string and a
  twenty-character passphrase.
- **`isPasswordCompliant` keeps its `string | Buffer` signature and its `typeof p === 'string'`
  discriminator.** The renderer runs sandboxed with no Node globals, so `Buffer.isBuffer(p)` in
  that module would throw a `ReferenceError` at the first keystroke. `Buffer` is safe here only
  as a *type*.
- `describePasswordPolicy()` must name **both** thresholds, and they come from the constants.
  The wording is main-process log text only; the renderer translates on `ErrorCode`, so the user
  never reads it — but the renderer has its own sentence (below), and the two must agree.

### B. The renderer stops re-deriving the rule

- **`getPasswordStrength()` leaves the component** and becomes an exported pure function in
  `src/shared/password-policy.ts`. It is currently a local function inside the component, so it
  cannot be unit-tested at all — and "the meter derives its verdict from the shared policy" is
  unverifiable while the scoring lives where nothing can reach it. Only the **colour** mapping
  (`--strength-*`) stays in the renderer.
- The meter's length is counted in code points too, or a ten-emoji string would draw a full
  bar.
- The meter's scoring, rewritten so it cannot contradict the gate:

  | Score | Condition | Label | Token |
  |---|---|---|---|
  | 0 | empty | — (the meter is not rendered) | — |
  | 1 | `length < 12` | too short | `--strength-weak` |
  | 2 | 12–19 chars, not the full mix | too simple | `--strength-fair` |
  | 3 | 12–19 chars, the full mix | good | `--strength-good` |
  | 4 | ≥ 20 chars | strong | `--strength-strong` |
  | 5 | ≥ 20 chars **and** 4 classes | excellent | `--strength-excellent` |

  **The invariant: `compliant ⇔ score ≥ 3`.** The two lowest scores are exactly the states the
  app refuses, and they are the two lowest bars — so the meter's verdict cannot contradict the
  gate's. A 12–19 character password that is missing a class is *not* "fair": the app refuses
  it, and the meter has to say so.

  The colour mapping is **unchanged** from what the code has today (score 1 →
  `--strength-weak`, 5 → `--strength-excellent`), because the scale is unchanged; only which
  password earns which score has moved. The meter draws 5 bars, as today.
- **The gate** (`CreateDrawerModal.tsx:92`) calls `isPasswordCompliant(password)` instead of its
  own regexes. The inline check is what the user meets before the IPC round trip, and it must be
  the same predicate the main process will apply.
- **The labels go through `t()`**, in both catalogues — which is UX-02. The pt-PT values must
  use "palavra-passe" and not "senha": `tests/i18n.test.ts`'s quarantine scan only walks
  `translations['pt-PT']`, so the moment the label joins the catalogue it comes under the scan.

### C. The message states the rule the code enforces

- `msg.password_too_short` and `error.password_too_short`, in **both** catalogues, must name both
  thresholds. `error.password_too_short` is the `tError()` translation of
  `ErrorCode.PASSWORD_TOO_SHORT` — the code stays, because every password the policy refuses is
  under 20 characters, so the name is still literally true. **No new `ErrorCode`:** `ERROR_MESSAGE_KEYS`
  is a `Record<ErrorCode, string>`, so a new code without a translation would not compile.
- The create schema stays **one `.refine()` over one boolean**. Two refines would raise two
  `custom` issues, and `isPasswordPolicyIssue` (`ipc-handlers.ts:142`) picks the first one it
  finds — the classification contract that `tests/password-policy.test.ts:93` pins would break.

### D. The docs state the rule the code enforces

- **`SECURITY.md` §"Passwords"** — the rule as fact, with the two branches named, and the floor
  stated as 12. It must say **why** length is checked before shape (the transformation argument),
  and it must say what the rule is **not**: not an entropy check, and no blocklist. A new
  **Known Limitations** item carries the residual risk — a policy that constrains length and
  shape, not entropy, with no blocklist, and the Argon2id parameters bounding the attacker's
  *rate* and not the *number* of guesses. The "Four items are documented honestly" count becomes
  five.
- `README.md:86` and `PLANO.md:21` — the 8-character rule they still state, replaced by the real
  one. `PLANO.md` is the plan of record, and this change is exactly the "architecture/goal
  decision" that the project rules allow it to be edited for.
- `docs/user-guide.md:4` — "≥12 chars, mixed" becomes the two branches.
- `DESIGN.md` — the strength-meter tokens and the "Known gaps" row (which describes the old
  English labels) are corrected; the row closes with this change.
- `CHANGELOG.md` — a new entry. The 2026-10-18 history stays as history.

### E. The tests

The invariant, in one sentence: **for every password, the renderer's gate accepts it ⇔
`isPasswordCompliant` accepts it; the meter's verdict equals the gate's verdict; and the refusal
text names both thresholds the policy actually enforces.** Three surfaces, and today only the
main-process half is pinned.

- **The rule** (`tests/password-policy.test.ts`): both branches, the boundaries (exactly 20 is
  accepted, 19 without classes is refused), the audit's own case (a 28-character lowercase
  passphrase is accepted), the "nothing that was accepted stops being accepted" property, and
  `describePasswordPolicy()` naming **both** thresholds read from the constants.
- **The one-issue contract** stays: exactly one `custom` issue on `path[0] === 'password'` for a
  refused password.
- **The drift guards** (the part HYG-22 did not have, in a new
  `tests/password-policy.one-owner.test.ts`):
  - *behavioural* — the form **accepts** a 24-character lowercase passphrase (today's inline check
    refuses it, so this goes red) and **refuses** a 13-character three-class password, with
    `createDrawer` not called;
  - *structural* — the renderer source holds no character-class regex and imports the shared
    module, with a **count guard** so a scan that stops matching cannot pass vacuously. This is
    the only thing that catches a *faithful* re-inline of the new rule, which behaves identically
    and would pass every behavioural test. The precedent is `tests/preload.test.ts:214-227`;
  - *wiring* — the schema consults the shared module rather than a literal of its own, proven the
    way `tests/store-limit.mutation.test.ts:67-89` proves `MAX_CONTENT_CODE_POINTS` is read
    rather than restated.
- **The message** (`tests/i18n.test.ts`): both password messages, in both catalogues, name both
  thresholds read from the shared module. The key-parity test and the quarantine scan then police
  the meter's new labels for free.
- **The meter**: the label agrees with the gate's verdict, for an accepted and a refused password.

**The negative controls** — every new test must be shown to fail under the mutation it names, and
the mutations are reported, not just the green:

| Mutation | Must go red |
|---|---|
| drop the ≥ 20 branch | the rule test; the form's passphrase test |
| drop the 12+4 branch | the rule test |
| drop one required class from the 12-path | the rule test and the existing "four documented classes" test |
| re-inline the **old** check in the renderer | the form's passphrase test |
| re-inline the **new** check in the renderer | the structural guard only |
| count the length in UTF-16 units instead of code points | the rule test (a ten-emoji string must be refused) |
| `describePasswordPolicy()` drops the 20-character path | the wording test — **today nothing goes red**, which is the gap the 2026-10-18 plan's own control was supposed to close |
| the messages keep the old sentence | the i18n test |
| the meter scores on its own | the meter's agreement test |
| a meter label added to one catalogue only | the **existing** key-parity test |
| a pt-PT meter label containing "senha" | the **existing** quarantine scan |

### F. What does not change

- The save and unlock paths. `SaveDrawerSchema` and `UnlockDrawerSchema` keep **sanity bounds
  only** (1–128 characters, no composition rule): there is no change-password channel, so a save
  can only re-use the password that already opens the drawer, and drawers created before the
  12-character rule still open with 8-character passwords. Enforcing the policy there would
  re-open SEC-02.
- The IPC classification, the `ErrorCode` set, the `Result` envelope, the `.clavis` format, the
  rate limiter, the key derivation. **The policy is not stored in the file**, so no drawer is
  affected and no migration exists.
- `src/main/ipc-handlers.ts` — the classification is by path and code, never by message text, and
  the carve-out changes *which* passwords are refused, not the shape of the issue.

### G. The traps, recorded so the next session does not rediscover them

- **The floor is 12, not 20.** Say it in the docs, in the message, and in the tests.
- **One `.refine()`, not two.** Two refines raise two `custom` issues and the classification
  picks arbitrarily.
- **`typeof p === 'string'` must stay.** `Buffer.isBuffer` would throw in the sandboxed renderer.
- **The meter's labels enter the quarantine scan** the moment they join the catalogue: no
  "senha" in the pt-PT values.
- **The strength meter's scoring must leave the component** or it cannot be tested, and the
  "the meter agrees with the gate" invariant is unverifiable.
- **A source scan needs a count guard**, or a scan that stops matching passes vacuously.
- **The wording is compared live-to-live everywhere**, so nothing pins it. A test that reads both
  thresholds from the constants is the only thing that will catch a sentence that has fallen
  behind the code.
- **`E2E_PASSWORD` is 16 characters** and qualifies only through the composition path — a single
  point of failure one tightening away. It is lengthened past 20 so it satisfies both branches.

## The gates

`lint` (0 errors) · `typecheck` · `typecheck:test` · `vitest` · `build` · `package` ·
the e2e suite against `out/clavis-linux-x64` **and** against the AppImage, in **both** locales.
The e2e gains nothing in runtime — the policy is create-time and the e2e's password is unchanged
in character — but the suite is the only thing that proves the app still creates and opens
drawers under the new rule.
