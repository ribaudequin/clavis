import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  setDataDir,
  getDataDir,
  createDrawer,
  listDrawers,
  unlockDrawer,
  saveDrawer,
  deleteDrawer,
  isValidId,
  getDrawerFilePath,
  importDrawerRaw,
  readDrawerRaw,
  migrateDrawersFrom,
  MAX_DRAWER_FILE_SIZE,
  FileTooLargeError,
} from '../src/main/store';
import { encrypt, MAX_DECRYPTED_SIZE } from '../src/main/encryption';
import { logger } from '../src/main/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let tempDir: string;

// A drawer-shaped file padded past the shared ceiling by its title. Every test
// below needs a file that *would* parse if it were read — that way the only
// thing that can exclude it is the pre-read stat check, not a parse failure.
// The KDF memory of 2^21 is out of bounds on purpose: without the guard, the
// downstream refusal for this file is kdf_out_of_bounds, which is a different
// reason from the too_large the stat check produces.
function buildOverCapDrawer(id: string): string {
  return JSON.stringify({
    id,
    title: 'x'.repeat(MAX_DRAWER_FILE_SIZE),
    iconData: '[]',
    createdAt: 1,
    updatedAt: 1,
    encryptedData: 'ab',
    salt: '00'.repeat(16),
    iv: '00'.repeat(16),
    authTag: '00'.repeat(16),
    keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 21, parallelism: 4 },
  });
}

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  setDataDir(path.join(os.homedir(), '.local', 'share', 'Clavis'));
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('store module', () => {
  it('createDrawer creates a .clavis file with mode 0o600 and a valid UUID id', async () => {
    const drawer = await createDrawer('Minha Gaveta', 'Str0ng!Pass');

    expect(UUID_RE.test(drawer.id)).toBe(true);
    expect(drawer.title).toBe('Minha Gaveta');

    const filePath = getDrawerFilePath(drawer.id);
    expect(filePath.endsWith('.clavis')).toBe(true);

    const stat = await fs.stat(filePath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('listDrawers returns created drawers with title and iconData', async () => {
    const a = await createDrawer('Gaveta A', 'Passw0rd-A!');
    const b = await createDrawer('Gaveta B', 'Passw0rd-B!');

    const drawers = await listDrawers();

    expect(drawers).toHaveLength(2);
    const ids = drawers.map((d) => d.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);

    const found = drawers.find((d) => d.id === a.id);
    expect(found?.title).toBe('Gaveta A');
    expect(found?.iconData).toBe(a.iconData);
    expect(found?.iconData).toContain('rgb(');
  });

  it('unlockDrawer with correct password returns decrypted content; wrong password is reported as such', async () => {
    const drawer = await createDrawer('Segredos', 'correct-password');
    const result = await unlockDrawer(drawer.id, 'correct-password');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.title).toBe('Segredos');
    expect(result.data.content).toBe('');

    const wrong = await unlockDrawer(drawer.id, 'W1rong!Pass');
    expect(wrong).toEqual({ ok: false, reason: 'wrong_password' });
  });

  it('saveDrawer updates content (unlock again returns new content)', async () => {
    const drawer = await createDrawer('Gaveta', 'Str0ng!Pass');

    const saved = await saveDrawer(drawer.id, 'Str0ng!Pass', 'Novo Título', 'conteúdo atualizado');
    expect(saved).toEqual({ ok: true });

    const result = await unlockDrawer(drawer.id, 'Str0ng!Pass');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.title).toBe('Novo Título');
    expect(result.data.content).toBe('conteúdo atualizado');
  });

  it('deleteDrawer removes the file and returns true', async () => {
    const drawer = await createDrawer('Para Apagar', 'Str0ng!Pass');
    const filePath = getDrawerFilePath(drawer.id);

    await expect(fs.stat(filePath)).resolves.toBeDefined();

    const deleted = await deleteDrawer(drawer.id);
    expect(deleted).toBe(true);

    await expect(fs.stat(filePath)).rejects.toThrow();
    expect(await listDrawers()).toHaveLength(0);
  });

  it('saveDrawer and deleteDrawer reject invalid ids', async () => {
    expect(await saveDrawer('not-a-uuid', 'pw', 't', 'c')).toEqual({ ok: false, reason: 'invalid_id' });
    expect(await deleteDrawer('not-a-uuid')).toBe(false);
  });

  it('isValidId rejects path traversal', async () => {
    expect(isValidId('../../../etc/passwd')).toBe(false);
    expect(isValidId('..')).toBe(false);
    expect(isValidId('')).toBe(false);
    expect(isValidId('a'.repeat(36))).toBe(false);
    expect(isValidId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('createDrawer rejects password shorter than 12 or lacking composition', async () => {
    await expect(createDrawer('Test', 'short')).rejects.toThrow('Password must be at least 12 characters with upper, lower, digit, symbol');
    await expect(createDrawer('Test', '')).rejects.toThrow('Password must be at least 12 characters with upper, lower, digit, symbol');
    await expect(createDrawer('Test', '123456789012')).rejects.toThrow('Password must be at least 12 characters with upper, lower, digit, symbol');
  });

  it('saveDrawer rejects weak password', async () => {
    const drawer = await createDrawer('Test', 'Str0ng!Pass');
    const result = await saveDrawer(drawer.id, 'weak', 'Title', 'content');
    expect(result).toEqual({ ok: false, reason: 'password_too_weak' });
  });

  // SAV-02 — These four used to be indistinguishable from a wrong password: all six
  // returned a bare null, and the IPC layer reported them as DECRYPT_FAILED while
  // counting them against the rate limiter. A user whose drawer is oversized or
  // corrupt was told their password was wrong, then locked out for retrying it.
  describe('unlock failure reasons', () => {
    const ABSENT_ID = '123e4567-e89b-12d3-a456-426614174040';
    const GARBAGE_ID = '123e4567-e89b-12d3-a456-426614174041';
    const PASSWORD = 'Correct-123!';

    async function writeFile(id: string, body: string): Promise<void> {
      await fs.mkdir(path.dirname(getDrawerFilePath(id)), { recursive: true });
      await fs.writeFile(getDrawerFilePath(id), body, { mode: 0o600 });
    }

    it('reports an id that is not a drawer id as invalid_id', async () => {
      expect(await unlockDrawer('not-a-uuid', PASSWORD)).toEqual({
        ok: false,
        reason: 'invalid_id',
      });
    });

    it('reports a missing drawer file as read_failed, not as a wrong password', async () => {
      // No such file: the read is the only thing that can fail here.
      expect(await unlockDrawer(ABSENT_ID, PASSWORD)).toEqual({
        ok: false,
        reason: 'read_failed',
      });
    });

    it('reports an unparseable drawer file as parse_failed, not as a wrong password', async () => {
      // Valid JSON is not required to reach the parse; only the file contents are.
      await writeFile(GARBAGE_ID, 'this is not json at all');

      expect(await unlockDrawer(GARBAGE_ID, PASSWORD)).toEqual({
        ok: false,
        reason: 'parse_failed',
      });
    });

    it('never reports a wrong password when the failure happened before decryption', async () => {
      // The distinction the lockout bug rested on, in one assertion: a failure that
      // never reached the cipher must not be counted as a guess.
      const failures = await Promise.all([
        unlockDrawer('not-a-uuid', PASSWORD),
        unlockDrawer(ABSENT_ID, PASSWORD),
        unlockDrawer(GARBAGE_ID, PASSWORD),
      ]);
      expect(failures).not.toContainEqual({ ok: false, reason: 'wrong_password' });
    });
  });

  describe('KDF compatibility and bounds', () => {
    const LEGACY_ID = '123e4567-e89b-12d3-a456-426614174000';
    const HUGE_ID = '123e4567-e89b-12d3-a456-426614174001';
    const lowId = '123e4567-e89b-12d3-a456-426614174002';

    async function writeDrawer(
      id: string,
      password: string,
      content: string,
      memory: number,
      parallelism: number
    ): Promise<void> {
      const params = { timeCost: 3, memoryCost: memory, parallelism };
      const { encryptedData, salt, iv, authTag } = await encrypt(content, password, params);
      const drawer = {
        id,
        title: 'Drawer',
        iconData: '[]',
        createdAt: 1,
        updatedAt: 1,
        encryptedData,
        salt,
        iv,
        authTag,
        keyDerivation: { algorithm: 'argon2id', iterations: 3, memory, parallelism },
      };
      await fs.mkdir(path.dirname(getDrawerFilePath(id)), { recursive: true });
      await fs.writeFile(getDrawerFilePath(id), JSON.stringify(drawer), { mode: 0o600 });
    }

    it('unlocks drawers created with legacy 2^16 KDF params', async () => {
      await writeDrawer(LEGACY_ID, 'legacy-password', 'legacy content', 2 ** 16, 1);

      const unlocked = await unlockDrawer(LEGACY_ID, 'legacy-password');
      expect(unlocked.ok).toBe(true);
      if (!unlocked.ok) throw new Error('expected ok');
      expect(unlocked.data.content).toBe('legacy content');
    });

    it('saveDrawer preserves legacy KDF metadata and stays unlockable', async () => {
      await writeDrawer(LEGACY_ID, 'legacy-password', 'old', 2 ** 16, 1);

      const saved = await saveDrawer(LEGACY_ID, 'legacy-password', 'Updated', 'new content');
      expect(saved).toEqual({ ok: true });

      const raw = JSON.parse(await fs.readFile(getDrawerFilePath(LEGACY_ID), 'utf8'));
      expect(raw.keyDerivation.memory).toBe(2 ** 16);

      const unlocked = await unlockDrawer(LEGACY_ID, 'legacy-password');
      expect(unlocked.ok).toBe(true);
      if (!unlocked.ok) throw new Error('expected ok');
      expect(unlocked.data.content).toBe('new content');
    });

    it('refuses (without crashing) drawers whose KDF memory exceeds the safety cap', async () => {
      // 2^21 KiB (~2 GiB) is known to crash the native Argon2 binding in Electron,
      // so the bounds check must short-circuit before any derivation is attempted.
      const drawer = {
        id: HUGE_ID,
        title: 'Huge',
        iconData: '[]',
        createdAt: 1,
        updatedAt: 1,
        encryptedData: '00',
        salt: '00'.repeat(16),
        iv: '00'.repeat(16),
        authTag: '00'.repeat(16),
        keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 21, parallelism: 4 },
      };
      await fs.mkdir(path.dirname(getDrawerFilePath(HUGE_ID)), { recursive: true });
      await fs.writeFile(getDrawerFilePath(HUGE_ID), JSON.stringify(drawer), { mode: 0o600 });

      expect(await unlockDrawer(HUGE_ID, 'Str0ng!Pass')).toEqual({
        ok: false,
        reason: 'kdf_out_of_bounds',
      });
      expect(await saveDrawer(HUGE_ID, 'Str0ng!KDF', 't', 'c')).toEqual({
        ok: false,
        reason: 'kdf_out_of_bounds',
      });
    });

    it('importDrawerRaw accepts legacy 2^16 params but rejects below-floor and above-cap values', async () => {
      const base = {
        id: lowId,
        title: 'Import',
        iconData: '[]',
        createdAt: 1,
        updatedAt: 1,
        encryptedData: 'e',
        salt: 's',
        iv: 'i',
        authTag: 'a',
      };

      const legacy = { ...base, id: '123e4567-e89b-12d3-a456-426614174010', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 16, parallelism: 1 } };
      expect(await importDrawerRaw(JSON.stringify(legacy))).toBe(true);

      const tooWeak = { ...base, id: '123e4567-e89b-12d3-a456-426614174011', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 14, parallelism: 1 } };
      expect(await importDrawerRaw(JSON.stringify(tooWeak))).toBe(false);

      const tooHuge = { ...base, id: '123e4567-e89b-12d3-a456-426614174012', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 21, parallelism: 4 } };
      expect(await importDrawerRaw(JSON.stringify(tooHuge))).toBe(false);
    });
  });

  describe('Size limits', () => {
    const PASSWORD = 'Correct-123!';
    const SIZE_WARNING = 'Unlock failed: encrypted file exceeds max size';

    // The envelope createDrawer/saveDrawer write, field for field. A synthetic hex
    // payload of a chosen length is enough to drive the import size predicate and
    // the unlock guard: neither derives a key from the payload to measure it.
    function buildDrawer(id: string, encryptedData: string): string {
      return JSON.stringify(
        {
          id,
          title: 'Capacity',
          iconData: '[]',
          createdAt: 1,
          updatedAt: 1,
          encryptedData,
          salt: '00'.repeat(16),
          iv: '00'.repeat(16),
          authTag: '00'.repeat(16),
          keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 18, parallelism: 4 },
        },
        null,
        2
      );
    }

    async function writeRawDrawer(id: string, drawer: string): Promise<void> {
      await fs.mkdir(path.dirname(getDrawerFilePath(id)), { recursive: true });
      await fs.writeFile(getDrawerFilePath(id), drawer, { mode: 0o600 });
    }

    it('round-trips a maximum-size drawer through the real export and import path', async () => {
      // The reported defect end to end, over public APIs only: save the largest
      // permitted text, export it, drop the drawer, import it back, unlock it.
      // This pays real Argon2id derivations at 2^18 KiB (~0.3 s each here) because
      // the file it hands to importDrawerRaw() is produced by the same encrypt() the
      // app uses — nothing about the envelope is assumed.
      const warn = vi.spyOn(logger, 'warn');
      const content = 'x'.repeat(MAX_DECRYPTED_SIZE);
      const drawer = await createDrawer('Capacidade', PASSWORD);
      expect(await saveDrawer(drawer.id, PASSWORD, 'Capacidade', content)).toEqual({ ok: true });

      const exported = await readDrawerRaw(drawer.id);
      expect(exported).not.toBeNull();
      // Hex doubles the payload, so this file is past the 11 MB the old cap allowed.
      expect(exported!.length).toBeGreaterThan(2 * MAX_DECRYPTED_SIZE);
      expect(exported!.length).toBeLessThanOrEqual(2 * MAX_DECRYPTED_SIZE + 4096);

      expect(await deleteDrawer(drawer.id)).toBe(true);
      expect(await importDrawerRaw(exported!)).toBe(true);
      expect(await readDrawerRaw(drawer.id)).toBe(exported);

      const unlocked = await unlockDrawer(drawer.id, PASSWORD);
      expect(unlocked.ok).toBe(true);
      if (!unlocked.ok) throw new Error('expected ok');
      expect(unlocked.data.content).toBe(content);
      // GCM ciphertext is the plaintext length (the tag is stored separately), so
      // this drawer sits exactly on MAX_DECRYPTED_SIZE decoded bytes.
      const stored = JSON.parse(await fs.readFile(getDrawerFilePath(drawer.id), 'utf8')) as {
        encryptedData: string;
      };
      expect(Buffer.from(stored.encryptedData, 'hex')).toHaveLength(MAX_DECRYPTED_SIZE);
      expect(warn).not.toHaveBeenCalledWith(SIZE_WARNING, expect.anything());
      warn.mockRestore();
    });

    it('admits a maximum-size envelope and refuses one past the derived cap', async () => {
      // Synthetic payload, so what is covered here is the size predicate alone:
      // importDrawerRaw() measures fileContent.length and never decrypts, which the
      // test above already showed with a real maximum-size file.
      const atLimit = buildDrawer(
        '123e4567-e89b-12d3-a456-426614174020',
        'ab'.repeat(MAX_DECRYPTED_SIZE)
      );
      expect(atLimit.length).toBeGreaterThan(2 * MAX_DECRYPTED_SIZE);
      expect(await importDrawerRaw(atLimit)).toBe(true);

      // The cap is 2 x MAX_DECRYPTED_SIZE plus the envelope allowance, so this
      // payload pushes the file past it and must be refused before any parsing.
      const overCap = buildDrawer(
        '123e4567-e89b-12d3-a456-426614174021',
        'ab'.repeat(MAX_DECRYPTED_SIZE + 4097)
      );
      expect(overCap.length).toBeGreaterThan(2 * MAX_DECRYPTED_SIZE + 4096);
      await expect(importDrawerRaw(overCap)).rejects.toBeInstanceOf(FileTooLargeError);
    });

    it('refuses to import a drawer whose ciphertext exceeds MAX_DECRYPTED_SIZE', async () => {
      // Door 2: the file-size cap is measured in characters, so a file that fits
      // under it can still carry up to twice MAX_DECRYPTED_SIZE bytes of ciphertext.
      // Admitting that produces a drawer that appears in the list under its
      // plaintext title and can never be opened, so the ciphertext length has to be
      // checked at the door. Without the check this file imports and returns true.
      const warn = vi.spyOn(logger, 'warn');
      const id = '123e4567-e89b-12d3-a456-426614174022';
      const overCapCiphertext = buildDrawer(id, 'ab'.repeat(MAX_DECRYPTED_SIZE + 1));
      // Under the character cap on purpose: this is the case the cap cannot see.
      expect(overCapCiphertext.length).toBeLessThanOrEqual(2 * MAX_DECRYPTED_SIZE + 4096);

      expect(await importDrawerRaw(overCapCiphertext)).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        'importDrawerRaw: ciphertext exceeds max size',
        expect.objectContaining({ id, bytes: MAX_DECRYPTED_SIZE + 1 })
      );
      warn.mockRestore();

      // The accepting side of the same boundary, one byte below the refusal.
      const atCiphertextCap = buildDrawer(
        '123e4567-e89b-12d3-a456-426614174023',
        'ab'.repeat(MAX_DECRYPTED_SIZE)
      );
      expect(await importDrawerRaw(atCiphertextCap)).toBe(true);
    });

    it('refuses ciphertext above MAX_DECRYPTED_SIZE before attempting decryption', async () => {
      // A wrong_password result alone would not prove the guard fired — garbage
      // ciphertext produces that too. The size warning is what tells the two apart,
      // so this test would stay green if the bound were raised and the guard stopped
      // firing.
      const warn = vi.spyOn(logger, 'warn');
      const id = '123e4567-e89b-12d3-a456-426614174030';
      await writeRawDrawer(
        id,
        buildDrawer(id, 'ab'.repeat(MAX_DECRYPTED_SIZE + 1))
      );

      expect(await unlockDrawer(id, PASSWORD)).toEqual({ ok: false, reason: 'too_large' });
      expect(warn).toHaveBeenCalledWith(
        SIZE_WARNING,
        expect.objectContaining({ size: MAX_DECRYPTED_SIZE + 1 })
      );
      warn.mockRestore();
    });

    it('admits ciphertext of exactly MAX_DECRYPTED_SIZE', async () => {
      // The same boundary from the accepting side: garbage ciphertext of precisely
      // the maximum length must get past the guard and fail on its auth tag, not on
      // its size. Guards against the bound being set too tight.
      const warn = vi.spyOn(logger, 'warn');
      const id = '123e4567-e89b-12d3-a456-426614174031';
      await writeRawDrawer(id, buildDrawer(id, 'ab'.repeat(MAX_DECRYPTED_SIZE)));

      expect(await unlockDrawer(id, PASSWORD)).toEqual({ ok: false, reason: 'wrong_password' });
      expect(warn).not.toHaveBeenCalledWith(SIZE_WARNING, expect.anything());
      warn.mockRestore();
    });

    // SAV-03 — The save side of the same ceiling. Door 1 of the original report: ten
    // million accented characters pass the Zod schema (10 million code points) and
    // were stored as a 20 MB ciphertext that unlockDrawer then refused forever.
    describe('save refuses content above the byte ceiling', () => {
      it('refuses 10 million accented characters and leaves the stored drawer untouched', async () => {
        const drawer = await createDrawer('Acentos', PASSWORD);
        const before = await fs.readFile(getDrawerFilePath(drawer.id), 'utf8');

        const content = 'ã'.repeat(10_000_000);
        expect(content.length).toBeLessThanOrEqual(MAX_DECRYPTED_SIZE);
        expect(await saveDrawer(drawer.id, PASSWORD, 'Acentos', content)).toEqual({
          ok: false,
          reason: 'content_too_large',
        });

        // A refusal that still rewrote the file would have replaced readable content
        // with a drawer nobody can open.
        expect(await fs.readFile(getDrawerFilePath(drawer.id), 'utf8')).toBe(before);
        const unlocked = await unlockDrawer(drawer.id, PASSWORD);
        expect(unlocked.ok).toBe(true);
        if (!unlocked.ok) throw new Error('expected ok');
        expect(unlocked.data.content).toBe('');
      });

      it('stores content of exactly MAX_DECRYPTED_SIZE bytes', async () => {
        // The accepting side, in bytes: half the code points, the same ceiling.
        const drawer = await createDrawer('Limite', PASSWORD);
        const content = 'ã'.repeat(MAX_DECRYPTED_SIZE / 2);

        expect(await saveDrawer(drawer.id, PASSWORD, 'Limite', content)).toEqual({ ok: true });

        const unlocked = await unlockDrawer(drawer.id, PASSWORD);
        expect(unlocked.ok).toBe(true);
        if (!unlocked.ok) throw new Error('expected ok');
        expect(unlocked.data.content).toBe(content);
      });

      it('never reports an oversized note as a password or id problem', async () => {
        const drawer = await createDrawer('Acentos', PASSWORD);
        const refused = await saveDrawer(drawer.id, PASSWORD, 'Acentos', 'ã'.repeat(10_000_000));
        expect(refused).not.toEqual({ ok: false, reason: 'invalid_id' });
        expect(refused).not.toEqual({ ok: false, reason: 'password_too_weak' });
        expect(refused).not.toEqual({ ok: false, reason: 'write_failed' });
      });
    });
  });

  // Block B — Every guard that measures a file was downstream of the allocation
  // it existed to prevent: listDrawers, unlockDrawer, saveDrawer and readDrawerRaw
  // read the whole file before anything checked its size, and the import handler
  // held the lstat result without ever looking at stat.size. MAX_DRAWER_FILE_SIZE
  // is now consulted by fs.stat before each read, so the refusal costs one stat
  // syscall instead of the file's size in memory.
  describe('stat.size guards before reads', () => {
    const PASSWORD = 'Correct-123!';

    async function writeOverCapFile(id: string): Promise<void> {
      await fs.mkdir(path.dirname(getDrawerFilePath(id)), { recursive: true });
      await fs.writeFile(getDrawerFilePath(id), buildOverCapDrawer(id), { mode: 0o600 });
    }

    it('listDrawers skips a file above the ceiling without reading it', async () => {
      // No user gesture and fires on every app open: this is the read the plan
      // ranked first. The over-cap file is valid JSON that would parse into a
      // list entry, so its absence is the pre-read refusal — not a parse failure.
      const normal = await createDrawer('Normal', PASSWORD);
      const overCapId = '123e4567-e89b-12d3-a456-426614174099';
      await writeOverCapFile(overCapId);

      const drawers = await listDrawers();

      const ids = drawers.map((d) => d.id);
      expect(ids).toContain(normal.id);
      expect(ids).not.toContain(overCapId);
    });

    it('unlockDrawer refuses a file above the ceiling with too_large, not a downstream failure', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174098';
      await writeOverCapFile(id);

      // The KDF in this file is out of bounds, so without the pre-read guard the
      // same file is refused as kdf_out_of_bounds. A different reason for the
      // same file is what proves the stat check fired before the read.
      expect(await unlockDrawer(id, PASSWORD)).toEqual({ ok: false, reason: 'too_large' });
    });

    it('saveDrawer refuses a file above the ceiling with too_large', async () => {
      const drawer = await createDrawer('Existing', PASSWORD);
      await fs.writeFile(getDrawerFilePath(drawer.id), buildOverCapDrawer(drawer.id), { mode: 0o600 });

      // Without the guard the save reads and parses the file and refuses on its
      // KDF bounds instead — the assertion pins which refusal fires.
      expect(await saveDrawer(drawer.id, PASSWORD, 't', 'c')).toEqual({
        ok: false,
        reason: 'too_large',
      });
    });

    it('readDrawerRaw returns null for a file above the ceiling', async () => {
      // This is the export path that crosses IPC into a renderer Blob.
      const drawer = await createDrawer('Exportable', PASSWORD);
      await fs.writeFile(getDrawerFilePath(drawer.id), buildOverCapDrawer(drawer.id), { mode: 0o600 });

      expect(await readDrawerRaw(drawer.id)).toBeNull();
    });
  });

  // Block B — The legacy migration's copy has no read to guard, so the file is
  // measured before it is moved into the new data dir.
  describe('legacy migration', () => {
    it('copies legacy drawers but skips any file above the ceiling', async () => {
      const oldDir = path.join(tempDir, 'old', 'drawers');
      const newDir = path.join(tempDir, 'new', 'drawers');
      await fs.mkdir(oldDir, { recursive: true });
      await fs.mkdir(newDir, { recursive: true });

      const smallId = '123e4567-e89b-12d3-a456-426614174097';
      await fs.writeFile(
        path.join(oldDir, `${smallId}.clavis`),
        JSON.stringify({ id: smallId }),
        { mode: 0o600 }
      );
      const overCapId = '123e4567-e89b-12d3-a456-426614174096';
      await fs.writeFile(
        path.join(oldDir, `${overCapId}.clavis`),
        buildOverCapDrawer(overCapId),
        { mode: 0o600 }
      );
      await fs.writeFile(path.join(oldDir, 'notes.txt'), 'not a drawer', { mode: 0o600 });

      const copied = await migrateDrawersFrom(oldDir, newDir);

      expect(copied).toBe(1);
      await expect(fs.stat(path.join(newDir, `${smallId}.clavis`))).resolves.toBeDefined();
      // The over-cap file would have been copied by an unbounded migration;
      // its absence is the stat check before the copy.
      await expect(fs.stat(path.join(newDir, `${overCapId}.clavis`))).rejects.toThrow();
    });
  });
});
