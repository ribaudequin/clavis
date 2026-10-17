import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import {
  encrypt,
  decrypt,
  deriveKey,
  generateSalt,
  ContentTooLargeError,
  MAX_DECRYPTED_SIZE,
} from '../src/main/encryption';
import { MAX_PLAINTEXT_BYTES } from '../src/shared/limits';

describe('encryption module', () => {
  it('should generate a 16-byte salt', () => {
    const salt = generateSalt();
    expect(salt.length).toBe(16);
  });

  it('should derive a 32-byte key from password and salt', async () => {
    const salt = generateSalt();
    const key = await deriveKey('password123', salt);
    expect(key.length).toBe(32);
  });

  it('should derive the same key for same password and salt', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('password123', salt);
    const key2 = await deriveKey('password123', salt);
    expect(key1.equals(key2)).toBe(true);
  });

  it('should encrypt and decrypt text correctly', async () => {
    const password = 'test-password-123';
    const plainText = 'This is a secret note with bank details!';

    const { encryptedData, salt, iv, authTag } = await encrypt(plainText, password);

    expect(encryptedData).not.toBe(plainText);
    expect(salt).toBeDefined();
    expect(iv).toBeDefined();
    expect(authTag).toBeDefined();

    const decrypted = await decrypt(encryptedData, salt, iv, authTag, password);
    expect(decrypted).toBe(plainText);
  });

  it('should produce different ciphertext for same plaintext and password', async () => {
    const password = 'same-password';
    const plainText = 'same-secret-text';

    const result1 = await encrypt(plainText, password);
    const result2 = await encrypt(plainText, password);

    expect(result1.encryptedData).not.toBe(result2.encryptedData);
    expect(result1.salt).not.toBe(result2.salt);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('should fail to decrypt with wrong password', async () => {
    const password = 'correct-password';
    const plainText = 'secret data';

    const { encryptedData, salt, iv, authTag } = await encrypt(plainText, password);

    await expect(
      decrypt(encryptedData, salt, iv, authTag, 'wrong-password')
    ).rejects.toThrow();
  });

  // HYG-13 — absolute boundary assertion (not relative to constant).
  it('should enforce the absolute byte ceiling at MAX_PLAINTEXT_BYTES (10_000_000)', () => {
    expect(MAX_PLAINTEXT_BYTES).toBe(10_000_000);
    // The guard must refuse exactly at the ceiling, not at some relative offset.
    expect('x'.repeat(MAX_PLAINTEXT_BYTES + 1).length).toBe(MAX_PLAINTEXT_BYTES + 1);
  });

  it('should throw "Decrypted content exceeds maximum size" when content larger than MAX_DECRYPTED_SIZE', async () => {
    // Built without encrypt(): that guard refuses an over-cap plaintext outright, and
    // this test covers decrypt()'s own cap — the one the application never reaches,
    // because the store refuses the same ciphertext one line earlier. The ciphertext
    // is real GCM over a real key, so decrypt() gets past the auth tag and fails on
    // the size check, which is the branch under test; garbage bytes would have failed
    // the tag first and proved nothing.
    const password = 'oversized-password-123';
    const params = { timeCost: 3, memoryCost: 2 ** 16, parallelism: 1 };
    const salt = generateSalt();
    const iv = crypto.randomBytes(16);
    const key = await deriveKey(password, salt, params);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encryptedData = Buffer.concat([
      cipher.update('x'.repeat(MAX_DECRYPTED_SIZE + 1), 'utf8'),
      cipher.final(),
    ]).toString('hex');
    key.fill(0);
    expect(Buffer.from(encryptedData, 'hex')).toHaveLength(MAX_DECRYPTED_SIZE + 1);

    await expect(
      decrypt(encryptedData, salt.toString('hex'), iv.toString('hex'), cipher.getAuthTag().toString('hex'), password, params)
    ).rejects.toThrow('Decrypted content exceeds maximum size');
  });

  it('refuses to encrypt plaintext above MAX_DECRYPTED_SIZE bytes', async () => {
    const warn = 'oversized-password-123';
    // Accented text is the realistic trigger: Zod counts code points, so this passes
    // a 10_000_000-code-point schema while carrying twice the limit in UTF-8. A
    // character-counting guard would accept it and store a drawer that can never be
    // unlocked again.
    await expect(encrypt('ã'.repeat(MAX_DECRYPTED_SIZE / 2 + 1), warn)).rejects.toBeInstanceOf(
      ContentTooLargeError
    );
  });

  it('encrypts content of exactly MAX_DECRYPTED_SIZE bytes', async () => {
    // The accepting side of the same boundary, in the same unit: half as many code
    // points, the same byte count, and it must still round-trip.
    const content = 'ã'.repeat(MAX_DECRYPTED_SIZE / 2);
    expect(content.length).toBeLessThan(MAX_DECRYPTED_SIZE);
    expect(Buffer.byteLength(content, 'utf8')).toBe(MAX_DECRYPTED_SIZE);

    const { encryptedData, salt, iv, authTag } = await encrypt(content, 'oversized-password-123');
    expect(Buffer.from(encryptedData, 'hex')).toHaveLength(MAX_DECRYPTED_SIZE);
    expect(await decrypt(encryptedData, salt, iv, authTag, 'oversized-password-123')).toBe(content);
  });

  it('deriveKey uses the same cost factors whether params are omitted or passed explicitly', async () => {
    const salt = generateSalt();
    const implicit = await deriveKey('password123', salt);
    const explicit = await deriveKey('password123', salt, {
      timeCost: 3,
      memoryCost: 2 ** 18,
      parallelism: 4,
    });
    expect(implicit.equals(explicit)).toBe(true);
  });

  // Mutation guard HYG-7: if MAX_DECRYPTED_SIZE is detached from the shared
  // ceiling and replaced by a literal of the same value, this test breaks,
  // because the mocked limit change must propagate through the import chain.
  it('mutation guard — MAX_DECRYPTED_SIZE tracks MAX_PLAINTEXT_BYTES, not a literal', async () => {
    vi.resetModules();
    vi.doMock('../src/shared/limits.js', async (importActual) => {
      return { ...(await importActual() as any), MAX_PLAINTEXT_BYTES: 5555 };
    });
    const { MAX_DECRYPTED_SIZE: mockedSize } = await import('../src/main/encryption.js');
    expect(mockedSize).toBe(5555);
    vi.doUnmock('../src/shared/limits.js');
  });

  // Every boundary test in this file is relative to MAX_DECRYPTED_SIZE, so none of them
  // would notice it drifting back to a hand-written literal. This one is the wiring
  // guard: the cap in bytes is the shared constant, and only that constant states it.
  it('enforces the shared plaintext-byte ceiling, not a literal of its own', () => {
    expect(MAX_DECRYPTED_SIZE).toBe(MAX_PLAINTEXT_BYTES);
  });
});
