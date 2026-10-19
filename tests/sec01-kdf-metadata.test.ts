// SEC-01 — the drawer must record the KDF backend that actually derived the key,
// and must use that recorded backend when the drawer is opened again.
//
// HYG-21 sub-item (2): the previous file asserted `res.algorithm` was one of two
// strings (a tautology on the union type) and then titled a second test "encoded in
// drawer metadata" while never importing `store` — so the value that reaches the
// file on disk was untested, and the hardcoded `'argon2id'` expectation would fail
// on exactly the cross-build targets where the scrypt fallback runs.
//
// The cross-backend tests at the bottom are the ones that expose the original
// SEC-01: recording the label is useless if deriveKey ignores it. This machine has
// argon2 loaded, so a scrypt drawer only opens if the stored value is honoured.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const PASSWORD = 'Str0ng!Passw0rd';
const LEGACY_MEMORY = 2 ** 16;

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-sec01-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  vi.doUnmock('../src/main/encryption.js');
  vi.resetModules();
  await fs.rm(tempDir, { recursive: true, force: true });
});

async function writeScryptDrawer(content: string): Promise<{ id: string; store: typeof import('../src/main/store.js') }> {
  const { deriveKey } = await import('../src/main/encryption.js');
  const store = await import('../src/main/store.js');
  store.setDataDir(tempDir);
  await store.ensureDataDir();

  // Independent fixture, not `encrypt()`: a drawer whose ciphertext was derived by a
  // *real* scrypt call. Building it with encrypt() would let one bug hide behind the
  // other — if both sides ignore the label, they still agree with each other and the
  // drawer opens, which is exactly what the original SEC-01 did.
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const N = 2 ** 14; // LEGACY_MEMORY (2^16 KiB) maps to logN 14 in deriveKey
  const passwordBuffer = Buffer.from(PASSWORD, 'utf8');
  const referenceKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(passwordBuffer, salt, 32, { N, r: 8, p: 4, maxmem: 128 * N * 8 * 2 }, (e, key) =>
      e ? reject(e) : resolve(key)
    );
  });

  // The fixture is only meaningful if deriveKey agrees with the reference scrypt
  // derivation; if it picks argon2 here, the assertion says so before the unlock does.
  const derived = await deriveKey(passwordBuffer, salt, {
    algorithm: 'scrypt',
    timeCost: 3,
    memoryCost: LEGACY_MEMORY,
    parallelism: 4,
  });
  expect(derived.equals(referenceKey)).toBe(true);

  const cipher = crypto.createCipheriv('aes-256-gcm', referenceKey, iv);
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  referenceKey.fill(0);
  derived.fill(0);

  const id = crypto.randomUUID();
  await fs.writeFile(
    store.getDrawerFilePath(id),
    JSON.stringify({
      id,
      title: 'Scrypt drawer',
      iconData: '[]',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      encryptedData: encrypted.toString('hex'),
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyDerivation: {
        algorithm: 'scrypt',
        iterations: 3,
        memory: LEGACY_MEMORY,
        parallelism: 4,
      },
    })
  );

  return { id, store };
}

describe('SEC-01 — KDF fallback metadata', () => {
  it('encrypt reports the backend that actually ran, not a fixed label', async () => {
    const { encrypt, isArgon2Available } = await import('../src/main/encryption.js');

    const res = await encrypt('test', PASSWORD);

    // Not "one of two strings": the label is tied to the same probe the rest of the
    // app uses to decide whether the native module loaded.
    expect(res.algorithm).toBe(isArgon2Available() ? 'argon2id' : 'scrypt');
  });

  it('createDrawer writes the backend returned by encrypt into the file on disk', async () => {
    // The discriminating form: force the fallback label and assert it survives the
    // trip to disk. A hardcoded 'argon2id' in store.ts passes the real-backend test
    // above on this machine and fails here, which is the point.
    vi.resetModules();
    vi.doMock('../src/main/encryption.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/main/encryption.js')>();
      return {
        ...actual,
        encrypt: vi.fn(async () => ({
          encryptedData: 'ab',
          salt: '00'.repeat(16),
          iv: '00'.repeat(16),
          authTag: '00'.repeat(16),
          algorithm: 'scrypt' as const,
        })),
      };
    });

    const store = await import('../src/main/store.js');
    store.setDataDir(tempDir);

    const drawer = await store.createDrawer('Backend', PASSWORD);
    const raw = JSON.parse(await fs.readFile(store.getDrawerFilePath(drawer.id), 'utf8'));

    expect(drawer.keyDerivation.algorithm).toBe('scrypt');
    expect(raw.keyDerivation.algorithm).toBe('scrypt');
  });

  it('deriveKey follows the stored backend instead of runtime availability', async () => {
    const { deriveKey, isArgon2Available } = await import('../src/main/encryption.js');
    const salt = crypto.randomBytes(16);
    const N = 2 ** 14;
    const reference = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(Buffer.from(PASSWORD, 'utf8'), salt, 32, { N, r: 8, p: 4, maxmem: 128 * N * 8 * 2 }, (e, key) =>
        e ? reject(e) : resolve(key)
      );
    });

    const asScrypt = await deriveKey(PASSWORD, salt, {
      algorithm: 'scrypt',
      timeCost: 3,
      memoryCost: LEGACY_MEMORY,
      parallelism: 4,
    });
    expect(asScrypt.equals(reference)).toBe(true);

    if (isArgon2Available()) {
      const byAvailability = await deriveKey(PASSWORD, salt, {
        timeCost: 3,
        memoryCost: LEGACY_MEMORY,
        parallelism: 4,
      });
      expect(byAvailability.equals(reference)).toBe(false);
    }
  });

  it('derives a scrypt key at the default memory cost without hitting Node\'s maxmem ceiling', async () => {
    // 2^18 KiB maps to N = 2^16, which needs 64 MiB; Node's default maxmem is 32 MiB.
    // Without an explicit maxmem the fallback threw ERR_CRYPTO_INVALID_SCRYPT_PARAMS,
    // so a build without argon2 could not create a drawer at all with the defaults.
    const { deriveKey, DEFAULT_MEMORY_COST } = await import('../src/main/encryption.js');
    expect(DEFAULT_MEMORY_COST).toBe(2 ** 18);

    await expect(deriveKey(PASSWORD, crypto.randomBytes(16), { algorithm: 'scrypt' })).resolves.toHaveLength(32);
  });

  it('unlocks a scrypt drawer on a build where argon2 is available', async () => {
    const { id, store } = await writeScryptDrawer('segredo');

    // Before the fix deriveKey picked the backend by availability, so this exact
    // call returned { ok: false, reason: 'wrong_password' } with the password right.
    const res = await store.unlockDrawer(id, PASSWORD);

    expect(res).toEqual({
      ok: true,
      data: { title: 'Scrypt drawer', content: 'segredo', iconData: '[]' },
    });
  });

  it('re-encrypts a scrypt drawer with scrypt on save, keeping the label truthful', async () => {
    const { id, store } = await writeScryptDrawer('antes');

    // Without the same fix on the write side, saveDrawer re-encrypted with argon2
    // while spreading the old 'scrypt' label over the new ciphertext.
    const saved = await store.saveDrawer(id, PASSWORD, 'Scrypt drawer', 'depois');
    expect(saved).toEqual({ ok: true });

    const raw = JSON.parse(await fs.readFile(store.getDrawerFilePath(id), 'utf8'));
    expect(raw.keyDerivation.algorithm).toBe('scrypt');

    const res = await store.unlockDrawer(id, PASSWORD);
    expect(res).toEqual({
      ok: true,
      data: { title: 'Scrypt drawer', content: 'depois', iconData: '[]' },
    });
  });
});
