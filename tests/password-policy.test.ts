import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isPasswordCompliant,
  describePasswordPolicy,
  PASSWORD_MIN_LENGTH,
  REQUIRED_PASSWORD_CLASSES,
} from '../src/main/password-policy';
import { CreateDrawerSchema, SaveDrawerSchema, UnlockDrawerSchema } from '../src/main/validation';
import { createDrawer, saveDrawer, unlockDrawer, getDrawerFilePath, setDataDir } from '../src/main/store';
import { encrypt } from '../src/main/encryption';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

// HYG-22 — the policy used to exist twice (validation.ts said 8 characters, store.ts
// said 12 plus four classes) and the two wordings differed as well. These tests pin the
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

  describe('isPasswordCompliant', () => {
    it('requires exactly the four documented character classes', () => {
      // Each of these clears the minimum length with three classes present: the length
      // cannot be what refuses them, and no single class can be what admits the rest.
      const missingOne: Array<[string, string]> = [
        ['no uppercase', 'correct-123!'],
        ['no lowercase', 'CORRECT-123!'],
        ['no digit', 'CorrectPassword!'],
        ['no symbol', 'Password1Only'],
      ];
      for (const [why, password] of missingOne) {
        expect(password.length, why).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
        expect(isPasswordCompliant(password), why).toBe(false);
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

    it('applies the same rule to a Buffer as to a string', () => {
      // createDrawer takes both. A Buffer path that skipped the check would let a weak
      // password in through the overload the renderer never calls.
      expect(isPasswordCompliant(Buffer.from('Abcdefghi1!x', 'utf8'))).toBe(true);
      expect(isPasswordCompliant(Buffer.from('short', 'utf8'))).toBe(false);
    });

    it('names exactly the four classes the policy describes', () => {
      // A class dropped from REQUIRED_PASSWORD_CLASSES, or renamed, fails here rather
      // than in production — and it fails even though the checks above would still
      // pass, because each of them names its missing class in the test rather than in
      // the code.
      expect(Object.keys(REQUIRED_PASSWORD_CLASSES).sort()).toEqual(['digit', 'lower', 'symbol', 'upper']);
    });
  });

  describe('describePasswordPolicy', () => {
    it('states the minimum length from the constant, not from a literal of its own', () => {
      expect(describePasswordPolicy()).toContain(String(PASSWORD_MIN_LENGTH));
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
  });
});