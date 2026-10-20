// SEC-08 — The password policy, and the one place it is written.
//
// HYG-22 already fixed one half of this: the rule used to exist twice (the Zod
// schemas said 8 characters, store.ts said 12 plus four character classes) and
// the two copies disagreed. One module now owns the rule, the wording and the
// message.
//
// SEC-08 is the other half, and the more interesting one. The rule has two
// branches, and they are ALTERNATIVES:
//
//   accepted  ⇔  length ≥ 20                    (any character mix)
//              ∨  length ≥ 12 ∧ upper ∧ lower ∧ digit ∧ symbol
//
// The second branch is the short path; the first is the passphrase path, and it
// exists because the composition rule was refusing passphrases the user wanted
// to keep. A 30-character lowercase passphrase used to be refused, and the
// remedy the rule pushed the user towards — "correct horse battery staple1!" —
// is a deterministic transformation that an attacker's rules dictionary already
// enumerates, so the compliance step did not add entropy. It collapsed a large
// set of possible secrets onto a much smaller one.
//
// The floor is 12, not 20. A 19-character mixed password is accepted by the
// second branch, and any wording that says the app "requires 20 characters" is
// false. This is the single most likely thing a reviewer will catch.
//
// THIS FILE LIVES IN src/shared/ BECAUSE BOTH PROCESSES NEED IT. The main
// process enforces the rule (CreateDrawerSchema and, as defence in depth, the
// store); the renderer applies the same rule to the create form so the user
// sees the reason before submitting. Before the move, the renderer had its own
// copy — its own regexes, in CreateDrawerModal.tsx — and a strength meter that
// scored on its own rules and contradicted the gate in both directions. One
// module, imported by both, is the only way the two cannot drift.
//
// It lives in src/shared/ and not in src/main/ because a shared module is
// bundled into the renderer, which runs sandboxed with no Node globals. The
// `Buffer` in isPasswordCompliant's signature is a TYPE only — the body
// discriminates with `typeof p === 'string'`, and it must keep doing so.
// `Buffer.isBuffer(p)` would throw a ReferenceError at the first keystroke in
// the renderer, and the difference between those two lines is the difference
// between a policy and a crash.
import { countCodePoints } from './limits';

// The short path: 12 characters with all four character classes.
export const PASSWORD_MIN_LENGTH = 12;

// The passphrase path: 20 characters of anything at all.
export const PASSPHRASE_MIN_LENGTH = 20;

// Every class must be present, not merely counted: the four below are the
// composition the create path has always enforced, and the policy is worthless
// if a future edit raises the count without checking the same four.
//
// Note what this is NOT: an entropy check. `Passw0rd!!!1` satisfies it and has
// almost no guess resistance — the rule was never an entropy check either, so
// the passphrase branch does not make the worst password worse; it makes an
// existing weakness visible. The rule constrains length, and below
// PASSPHRASE_MIN_LENGTH it also constrains shape. See SECURITY.md.
export const REQUIRED_PASSWORD_CLASSES = Object.freeze({
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /\d/,
  symbol: /[^A-Za-z0-9]/,
}) as Readonly<Record<string, RegExp>>;

/**
 * Whether a password is acceptable for a NEW drawer.
 *
 * The rule is create-time only, deliberately: CHANNELS has no change-password
 * member, so a save can only re-use the password that already opens the drawer,
 * and drawers created before the 12-character rule still open with
 * 8-character passwords. Enforcing the policy on save or unlock would strand
 * exactly those users.
 */
export function isPasswordCompliant(p: string | Buffer): boolean {
  // `typeof`, not `Buffer.isBuffer` — see the header. The renderer calls this
  // with a string and has no `Buffer` global.
  const s = typeof p === 'string' ? p : p.toString('utf8');
  // Code points, not UTF-16 units. `s.length` counts an astral character as
  // two, and ten emoji are `s.length` 20 — which, under the passphrase branch,
  // would be a twenty-character passphrase that is really ten characters long.
  // The schema's own `.max(128)` already counts code points (Zod folds
  // surrogate pairs), so this also removes a disagreement between the policy's
  // minimum and the schema's maximum.
  const length = countCodePoints(s);
  if (length >= PASSPHRASE_MIN_LENGTH) return true;
  if (length < PASSWORD_MIN_LENGTH) return false;
  return Object.values(REQUIRED_PASSWORD_CLASSES).every((re) => re.test(s));
}

// The single wording of the policy. This is the message the store throws and the
// one the create schema reports on a refine issue; nothing downstream of it is
// allowed to paraphrase it. It never reaches the user directly — the renderer
// translates on ErrorCode — so it is main-process log text only, and the
// numbers come from the constants so the sentence cannot contradict the check.
//
// It must name BOTH thresholds. A wording that drops the passphrase branch
// still reads as a plausible policy, and the only thing that catches it is a
// test that reads both constants back out of this string.
export function describePasswordPolicy(): string {
  return (
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters with upper, lower, digit, symbol, ` +
    `or at least ${PASSPHRASE_MIN_LENGTH} characters`
  );
}

/**
 * The strength meter's score, 0 to 5.
 *
 * The meter used to score on its own rules inside the component, where nothing
 * could test it, and it contradicted the gate in both directions: a
 * 24-character lowercase passphrase scored 2 ('Razoável') while a 12-character
 * mixed password scored 5 ('Excelente'). The meter is what the user believes,
 * so a policy change that leaves it alone is cancelled at the interface.
 *
 * The scale, and the boundary that matters:
 *
 *   0  empty
 *   1  under 12 characters                     → refused
 *   2  12–19 characters, not the full mix      → refused
 *   3  12–19 characters, the full mix          → accepted
 *   4  20 or more characters                   → accepted
 *   5  20 or more characters, the full mix     → accepted
 *
 * So `compliant ⇔ score ≥ 3`: the two lowest scores are exactly the states the
 * app refuses, and they are the two lowest bars. The colours the renderer maps
 * onto these scores are unchanged — score 1 is `--strength-weak` and score 5 is
 * `--strength-excellent`, as they were — because the scale is unchanged; only
 * which password earns which score has moved.
 */
export function scorePasswordStrength(pw: string): number {
  const length = countCodePoints(pw);
  if (length === 0) return 0;
  const classes = Object.values(REQUIRED_PASSWORD_CLASSES).filter((re) => re.test(pw)).length;
  if (length < PASSWORD_MIN_LENGTH) return 1;
  if (length < PASSPHRASE_MIN_LENGTH) return classes === 4 ? 3 : 2;
  return classes === 4 ? 5 : 4;
}
