import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveKey, generateSalt } from '../src/main/encryption';

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
});
