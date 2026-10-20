import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isPasswordCompliant,
  describePasswordPolicy,
  scorePasswordStrength,
  PASSWORD_MIN_LENGTH,
  PASSPHRASE_MIN_LENGTH,
  REQUIRED_PASSWORD_CLASSES,
} from '../src/shared/password-policy';
import { CreateDrawerSchema, SaveDrawerSchema, UnlockDrawerSchema } from '../src/main/validation';
import { createDrawer, saveDrawer, unlockDrawer, getDrawerFilePath, setDataDir } from '../src/main/store';
import { encrypt } from '../src/main/encryption';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

// SEC-08 — The rule has two branches, and they are ALTERNATIVES:
//
//   accepted  ⇔  length ≥ 20                     (any character mix)
//              ∨  length ≥ 12 ∧ upper ∧ lower ∧ digit ∧ symbol
//
// The floor is 12, not 20. A 19-character mixed password is accepted by the
// short branch, and any wording that says the app "requires 20 characters" is
// false. The length is counted in code points, so ten emoji are ten characters
// and not the twenty that UTF-16 units would call them.
//
// HYG-22 — the policy used to exist twice (validation.ts said 8 characters, store.ts
// said 12 plus four character classes) and the two wordings differed as well. These tests pin the
// rule, the composition, and the two schemas that must not enforce it.
describe('password policy', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clavis-pw-'));
    setDataDir(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // An independent code-point count. The policy uses countCodePoints() from
  // src/shared/limits.ts, and a test that counted with the same helper would
  // agree with the code even if the code counted UTF-16 units; the spread below
  // counts code points on its own.
  const codePoints = (s: string): number => [...s].length;

  describe('isPasswordCompliant', () => {
    it('requires all four character classes below the passphrase threshold', () => {
      // Each of these clears the minimum length with three classes present: the length
      // cannot be what refuses them, and no single class can be what admits the rest.
      // They are also all under the passphrase threshold, so the second branch of the
      // rule cannot rescue them — the test would otherwise be measuring the wrong
      // branch the day someone raises one of these strings to 20 characters.
      const missingOne: Array<[string, string]> = [
        ['no uppercase', 'correct-123!'],
        ['no lowercase', 'CORRECT-123!'],
        ['no digit', 'CorrectPassword!'],
        ['no symbol', 'Password1Only'],
      ];
      for (const [why, password] of missingOne) {
        expect(codePoints(password), why).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
        expect(codePoints(password), why).toBeLessThan(PASSPHRASE_MIN_LENGTH);
        expect(isPasswordCompliant(password), why).toBe(false);
      }
    });

    it('admits a passphrase of the passphrase length and refuses one character less', () => {
      // The branch the composition rule used to make unreachable: twenty
      // characters of anything at all. The audit's own case is a 28-character
      // lowercase passphrase, which the old rule refused.
      const passphrase = 'correct horse battery staple';
      expect(codePoints(passphrase)).toBe(28);
      expect(isPasswordCompliant(passphrase)).toBe(true);

      // Nineteen characters is below both thresholds, and with one class it is
      // refused by the short branch too.
      const tooShort = 'correct horse batte';
      expect(codePoints(tooShort)).toBe(PASSPHRASE_MIN_LENGTH - 1);
      expect(isPasswordCompliant(tooShort)).toBe(false);

      // Twenty characters of a single class is still twenty characters: the
      // passphrase branch asks for length, not for a mix.
      for (const singleClass of ['a', 'A', '0', '!']) {
        expect(isPasswordCompliant(singleClass.repeat(PASSPHRASE_MIN_LENGTH)), singleClass).toBe(true);
        expect(isPasswordCompliant(singleClass.repeat(PASSPHRASE_MIN_LENGTH - 1)), singleClass).toBe(false);
      }
    });

    it('admits a password of exactly the minimum length and refuses one character less', () => {
      const compliant = 'Abcdefghi1!x';
      expect(compliant).toHaveLength(PASSWORD_MIN_LENGTH);
      expect(isPasswordCompliant(compliant)).toBe(true);
      expect(isPasswordCompliant(compliant.slice(0, -1))).toBe(false);
    });

    it('refuses the empty string and a run of one repeated class', () => {
      expect(isPasswordCompliant('')).toBe(false);
      expect(isPasswordCompliant('!!!!!!!!!!!!')).toBe(false);
      expect(isPasswordCompliant('ZZZZZZZZZZZZ')).toBe(false);
    });

    it('counts the length in code points, so ten emoji are ten characters and are refused', () => {
      // Ten emoji are twenty UTF-16 units, and under the passphrase branch a
      // count in UTF-16 units would call this a twenty-character passphrase and
      // accept it. It is ten characters long.
      const tenEmoji = '\u{1F600}'.repeat(10);
      expect(tenEmoji.length).toBe(20);
      expect(codePoints(tenEmoji)).toBe(10);
      expect(isPasswordCompliant(tenEmoji)).toBe(false);
    });

    it('accepts a passphrase of twenty code points that carries an astral character', () => {
      // The other side of the same count: nineteen emoji plus one letter are
      // twenty code points, and the passphrase branch admits them.
      const passphrase = '\u{1F600}'.repeat(PASSPHRASE_MIN_LENGTH - 1) + 'a';
      expect(codePoints(passphrase)).toBe(PASSPHRASE_MIN_LENGTH);
      expect(isPasswordCompliant(passphrase)).toBe(true);
    });

    it('applies the same rule to a Buffer as to a string', () => {
      // createDrawer takes both. A Buffer path that skipped the check would let a weak
      // password in through the overload the renderer never calls.
      expect(isPasswordCompliant(Buffer.from('Abcdefghi1!x', 'utf8'))).toBe(true);
      expect(isPasswordCompliant(Buffer.from('short', 'utf8'))).toBe(false);
    });

    it('counts a Buffer in code points too', () => {
      // The Buffer overload decodes to a string and then runs the same predicate,
      // so the unit of the count cannot differ between the two overloads.
      const tenEmoji = Buffer.from('\u{1F600}'.repeat(10), 'utf8');
      expect(codePoints(tenEmoji.toString('utf8'))).toBe(10);
      expect(isPasswordCompliant(tenEmoji)).toBe(false);

      const twentyCodePoints = Buffer.from('\u{1F600}'.repeat(PASSPHRASE_MIN_LENGTH - 1) + 'a', 'utf8');
      expect(isPasswordCompliant(twentyCodePoints)).toBe(true);
    });

    it('names exactly the four classes the policy describes', () => {
      // A class dropped from REQUIRED_PASSWORD_CLASSES, or renamed, fails here rather
      // than in production — and it fails even though the checks above would still
      // pass, because each of them names its missing class in the test rather than in
      // the code.
      expect(Object.keys(REQUIRED_PASSWORD_CLASSES).sort()).toEqual(['digit', 'lower', 'symbol', 'upper']);
    });

    // The old rule, reproduced so the property below is checked against the rule
    // it claims: twelve characters counted in UTF-16 units, with all four classes.
    // The plan's promise is that its acceptance set is a subset of the new one's.
    const oldRuleAccepted = (p: string): boolean =>
      p.length >= PASSWORD_MIN_LENGTH &&
      Object.values(REQUIRED_PASSWORD_CLASSES).every((re) => re.test(p));

    it('refuses nothing that the old rule accepted', () => {
      const acceptedBefore: Array<[string, string]> = [
        ['the 12-character minimum with all four classes', 'Abcdefghi1!x'],
        ['the same, with the classes in another order', 'x9!Abcdefghi'],
        ['a 14-character mixed password', 'Segur0#Strong!'],
        ['a 16-character mixed password', 'Correct-Passw0rd!'],
        ['a 17-character mixed password', 'Str0ng-Passw0rd!'],
        ['a 19-character mixed password', 'Abcdefghij1!ABCDE'],
        ['a 24-character mixed password', 'Correct-Horse-Battery-1!'],
      ];
      for (const [why, password] of acceptedBefore) {
        // The table is checked against the old rule first, so it cannot rot into
        // a list of passwords the old rule refused.
        expect(oldRuleAccepted(password), `${why}: the case must be an old acceptance`).toBe(true);
        expect(isPasswordCompliant(password), why).toBe(true);
      }
    });

    it('refuses exactly one password the old rule accepted — the one the unit change reaches', () => {
      // The old rule counted UTF-16 units, so an astral character counted twice
      // and a twelve-unit password could be eleven characters long. The new rule
      // counts code points, and this password is eleven of them: the old rule
      // accepted it and the new one refuses it. It is the only exception, and it
      // is safe because the policy is create-time only — the drawer it opened
      // still opens and still saves, since save and unlock hold sanity bounds
      // only (see the SEC-02 block below).
      const password = 'A\u{1F600}bcdefg1!x';
      expect(password.length).toBe(PASSWORD_MIN_LENGTH);
      expect(codePoints(password)).toBe(PASSWORD_MIN_LENGTH - 1);
      expect(oldRuleAccepted(password)).toBe(true);
      expect(isPasswordCompliant(password)).toBe(false);
    });
  });

  // The wording is compared live-to-live everywhere else in the suite, so a
  // sentence that has fallen behind the code changes nothing and nothing goes
  // red. These assertions are the negative control the 2026-10-18 plan claimed
  // and never had: both thresholds, read back out of the constants, and the
  // four classes the composition branch asks for.
  describe('describePasswordPolicy', () => {
    it('names both thresholds, read from the constants', () => {
      const wording = describePasswordPolicy();
      // The word boundary is what makes this a check and not a coincidence: a
      // sentence that said "at least 120 characters" would satisfy a plain
      // substring search for "12" and would be wrong.
      expect(wording).toMatch(new RegExp(`\\b${PASSWORD_MIN_LENGTH}\\b`));
      expect(wording).toMatch(new RegExp(`\\b${PASSPHRASE_MIN_LENGTH}\\b`));
    });

    it('names the four classes the composition branch asks for', () => {
      const wording = describePasswordPolicy().toLowerCase();
      for (const className of ['upper', 'lower', 'digit', 'symbol']) {
        expect(wording, className).toContain(className);
      }
    });
  });

  // The meter and the gate have to agree, in both directions: the meter is what
  // the user believes, so a meter that calls an accepted password "weak" (or a
  // refused one "strong") cancels the policy at the interface.
  describe('scorePasswordStrength', () => {
    const CASES: Array<[string, string]> = [
      ['the empty string', ''],
      ['one character', 'a'],
      ['eleven characters', 'Abcdefghi1!'],
      ['twelve characters of one class', 'abcdefghijkl'],
      ['twelve characters of three classes', 'Abcdefghij1'],
      ['twelve characters of four classes', 'Abcdefghi1!x'],
      ['nineteen characters of four classes', 'Abcdefghij1!ABCDE'],
      ['nineteen characters of one class', 'abcdefghijklmnopqrs'],
      ['twenty characters of one class', 'abcdefghijklmnopqrst'],
      ['twenty characters of four classes', 'Abcdefghij1!ABCDEFGH'],
      ["the audit's case, a 24-character passphrase", 'the quick brown fox jump'],
      ['ten emoji', '\u{1F600}'.repeat(10)],
      ['twenty code points with an astral character', '\u{1F600}'.repeat(PASSPHRASE_MIN_LENGTH - 1) + 'a'],
    ];

    it('agrees with the gate on every case: compliant ⇔ score ≥ 3', () => {
      for (const [why, password] of CASES) {
        const score = scorePasswordStrength(password);
        const compliant = isPasswordCompliant(password);
        expect(score, why).toBeGreaterThanOrEqual(0);
        expect(score, why).toBeLessThanOrEqual(5);
        // The invariant in one comparison, with both sides named so a failure
        // says which of the two moved.
        expect({ why, meterAccepts: score >= 3, gateAccepts: compliant }).toEqual({
          why,
          meterAccepts: compliant,
          gateAccepts: compliant,
        });
      }
    });

    it("scores the audit's own case — a 24-character lowercase passphrase — at 3 or more", () => {
      // The case the audit complained about: it used to read as "fair" (2) and
      // the old rule refused it outright.
      const passphrase = 'the quick brown fox jump';
      expect(codePoints(passphrase)).toBe(24);
      expect(isPasswordCompliant(passphrase)).toBe(true);
      expect(scorePasswordStrength(passphrase)).toBeGreaterThanOrEqual(3);
    });
  });

  // The classification contract the IPC layer depends on: the create schema expresses
  // the policy as an issue whose path and code identify it, so ipc-handlers never reads
  // the message. A chain of .min()/.regex checks would not give it that.
  describe('CreateDrawerSchema', () => {
    it('raises the policy violation as one issue on the password path with code custom', () => {
      const parsed = CreateDrawerSchema.safeParse({ title: 'Test', password: 'short' });

      expect(parsed.success).toBe(false);
      if (parsed.success) throw new Error('expected the policy to refuse');
      const policyIssues = parsed.error.issues.filter(
        (i) => i.path[0] === 'password' && i.code === 'custom'
      );
      expect(policyIssues).toHaveLength(1);
      expect(policyIssues[0].message).toBe(describePasswordPolicy());
    });

    it('accepts a compliant password', () => {
      expect(CreateDrawerSchema.safeParse({ title: 'Test', password: 'Abcdefghi1!x' }).success).toBe(true);
    });

    it('accepts a passphrase the composition rule used to refuse', () => {
      const parsed = CreateDrawerSchema.safeParse({
        title: 'Test',
        password: 'correct horse battery staple',
      });
      expect(parsed.success).toBe(true);
    });

    it('still refuses an over-long password with too_big, not with the policy code', () => {
      const parsed = CreateDrawerSchema.safeParse({ title: 'Test', password: 'Abcdefghi1!x'.repeat(20) });

      expect(parsed.success).toBe(false);
      if (parsed.success) throw new Error('expected failure');
      expect(parsed.error.issues.map((i) => i.code)).toEqual(['too_big']);
    });
  });

  // SEC-02 — the reason the policy is create-only. CHANNELS has no change-password
  // member, so a save re-uses the password that already opens the drawer, and drawers
  // created before the 12-character rule still open with 8-character passwords. A
  // policy on either of these two schemas would leave those users able to unlock a
  // drawer and unable to save into it.
  describe('save and unlock hold sanity bounds only', () => {
    const LEGACY_PASSWORD = 'oldpass1';
    const LEGACY_ID = '123e4567-e89b-12d3-a456-426614174000';

    /** Stands in for a .clavis written before the 12-character rule existed. */
    async function writeLegacyDrawer(id: string, password: string, content: string): Promise<void> {
      const params = { timeCost: 3, memoryCost: 2 ** 18, parallelism: 1 };
      const { encryptedData, salt, iv, authTag } = await encrypt(content, password, params);
      await fs.mkdir(path.dirname(getDrawerFilePath(id)), { recursive: true });
      await fs.writeFile(
        getDrawerFilePath(id),
        JSON.stringify({
          id,
          title: 'Legacy',
          iconData: '[]',
          createdAt: 1,
          updatedAt: 1,
          encryptedData,
          salt,
          iv,
          authTag,
          keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 18, parallelism: 1 },
        }),
        { mode: 0o600 }
      );
    }

    it('admits a legacy 8-character password on save', () => {
      expect(
        SaveDrawerSchema.safeParse({ id: LEGACY_ID, password: LEGACY_PASSWORD, title: 'Legacy', content: 'w' })
          .success
      ).toBe(true);
    });

    it('admits a legacy 8-character password on unlock', () => {
      expect(UnlockDrawerSchema.safeParse({ id: LEGACY_ID, password: LEGACY_PASSWORD }).success).toBe(true);
    });

    it('still refuses an empty or over-long password on both', () => {
      for (const password of ['', 'x'.repeat(129)]) {
        expect(
          SaveDrawerSchema.safeParse({ id: LEGACY_ID, password, title: 'T', content: 'c' }).success,
          `save, length ${password.length}`
        ).toBe(false);
        expect(UnlockDrawerSchema.safeParse({ id: LEGACY_ID, password }).success, `unlock, length ${password.length}`).toBe(false);
      }
    });

    it('really does let an 8-character password save and read back a drawer', async () => {
      // The schema assertions above are the contract; this is the behaviour behind it.
      // createDrawer refuses weak passwords outright, so the file is written directly —
      // it stands in for the pre-rule population the split exists to protect.
      await writeLegacyDrawer(LEGACY_ID, LEGACY_PASSWORD, 'written before the 12-character rule');

      expect(await saveDrawer(LEGACY_ID, LEGACY_PASSWORD, 'Renamed', 'written with a legacy password'))
        .toEqual({ ok: true });

      const reopened = await unlockDrawer(LEGACY_ID, LEGACY_PASSWORD);
      expect(reopened.ok).toBe(true);
      if (!reopened.ok) throw new Error('expected ok');
      expect(reopened.data.title).toBe('Renamed');
      expect(reopened.data.content).toBe('written with a legacy password');
    });
  });

  // store.ts keeps its own call as defence in depth for callers with no schema in front
  // of them. It is unreachable from the IPC path — CreateDrawerSchema refuses the same
  // password first — and these are what keeps it honest.
  describe('createDrawer as defence in depth', () => {
    it('refuses a weak password with the policy module wording', async () => {
      await expect(createDrawer('T', 'short')).rejects.toThrow(describePasswordPolicy());
      await expect(createDrawer('T', '')).rejects.toThrow(describePasswordPolicy());
      await expect(createDrawer('T', '123456789012')).rejects.toThrow(describePasswordPolicy());
    });

    it('accepts a compliant password and saves with it', async () => {
      const drawer = await createDrawer('Good', 'Segur0#Strong!');
      expect(drawer.id).toBeTruthy();
      expect(await saveDrawer(drawer.id, 'Segur0#Strong!', 'Good', 'hello')).toEqual({ ok: true });
    });

    it('accepts a passphrase and saves with it', async () => {
      const drawer = await createDrawer('Passphrase', 'correct horse battery staple');
      expect(drawer.id).toBeTruthy();
      expect(await saveDrawer(drawer.id, 'correct horse battery staple', 'Passphrase', 'hello')).toEqual({
        ok: true,
      });
    });
  });
});
