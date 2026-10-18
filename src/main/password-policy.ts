// HYG-22 — The policy used to be written twice and the two copies disagreed: the
// Zod schemas said 8 characters, store.ts said 12 plus four character classes. Both
// sat on the create path, so an 8-to-11 character password passed the schema the
// project calls its validation authority and was then refused by the store.
//
// One module owns the rule, the wording and the message, so the schema and the log
// cannot drift into two versions of the same policy.

export const PASSWORD_MIN_LENGTH = 12;

// Every class must be present, not merely counted: the four below are the composition
// the create path has always enforced, and the policy is worthless if a future edit
// raises the count without checking the same four.
export const REQUIRED_PASSWORD_CLASSES = Object.freeze({
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /\d/,
  symbol: /[^A-Za-z0-9]/,
}) as Readonly<Record<string, RegExp>>;

export function isPasswordCompliant(p: string | Buffer): boolean {
  const s = typeof p === 'string' ? p : p.toString('utf8');
  if (s.length < PASSWORD_MIN_LENGTH) return false;
  return Object.values(REQUIRED_PASSWORD_CLASSES).every((re) => re.test(s));
}

// The single wording of the policy. This is the message the store throws and the one
// the create schema reports on a refine issue; nothing downstream of it is allowed to
// paraphrase it. It never reaches the user directly — the renderer translates on
// ErrorCode — so it is main-process log text only, and the number comes from the
// constant so the sentence cannot contradict the check.
export function describePasswordPolicy(): string {
  return `Password must be at least ${PASSWORD_MIN_LENGTH} characters with upper, lower, digit, symbol`;
}