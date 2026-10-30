// P0.12 — `decrypt()` used to decode the whole ciphertext before comparing it against
// the ceiling, so refusing a 500 MB hex payload cost the 250 MB buffer it refused. The
// guard is now a comparison on the string length, which is exact: Node's hex decoder
// stops at the first invalid pair, so `Buffer.from(hex, 'hex')` never yields more than
// `floor(len / 2)` bytes.
//
// What is asserted is therefore not "it throws" — it did that before, after the
// allocation — but *where* it throws: `Buffer.from` must never be called with the
// oversized string at all. A timing assertion would be the weak version of this and
// would pass on a fast machine with a 250 MB buffer.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { decrypt, CiphertextTooLargeError, MAX_DECRYPTED_SIZE, type KDFParams } from '../src/main/encryption';

// Metadata is irrelevant to the guard: it fires before the KDF, so these only need to
// be well-formed hex of the right shape. Fixed rather than random so a failure is
// reproducible.
const SALT_HEX = '00'.repeat(16);
const IV_HEX = '00'.repeat(16);
const AUTH_TAG_HEX = '00'.repeat(16);

// The cheapest legal backend, for the one test that gets past the guard: scrypt at the
// floor keeps the boundary test at tens of milliseconds instead of a 256 MiB argon2 run.
const CHEAP_KDF: KDFParams = { algorithm: 'scrypt', timeCost: 3, memoryCost: 2 ** 16, parallelism: 1 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('P0.12 — the ciphertext size guard runs before the decode', () => {
  it('refuses a ciphertext one byte over the cap without ever decoding it', async () => {
    // 20 MB of string, which is what a maximal legitimate drawer looks like; the point
    // is that the *decoded* 10 MB buffer is what the guard must not need.
    const overCap = 'ab'.repeat(MAX_DECRYPTED_SIZE + 1);
    const fromSpy = vi.spyOn(Buffer, 'from');

    await expect(decrypt(overCap, SALT_HEX, IV_HEX, AUTH_TAG_HEX, 'pw')).rejects.toBeInstanceOf(
      CiphertextTooLargeError
    );

    // The salt, the IV and the tag are decoded before the guard and always will be:
    // they are three 16-byte allocations. The ciphertext is the one that must not be.
    const decodedCiphertextCalls = fromSpy.mock.calls.filter(([value]) => value === overCap);
    expect(decodedCiphertextCalls).toEqual([]);
  });

  it('names the ceiling it enforced, so the log says which limit fired', async () => {
    const overCap = 'ab'.repeat(MAX_DECRYPTED_SIZE + 1);

    await expect(decrypt(overCap, SALT_HEX, IV_HEX, AUTH_TAG_HEX, 'pw')).rejects.toThrow(
      `Ciphertext exceeds max size (${MAX_DECRYPTED_SIZE} bytes)`
    );
  });

  it('does not refuse a ciphertext that lands exactly on the cap', async () => {
    // The boundary is the mutation target: `>` becoming `>=` refuses a maximal legal
    // drawer, which is a data-loss bug and not a hardening extra. At exactly the cap the
    // guard must let the call through to the decode, where it fails on the fake
    // ciphertext instead — a different error, from a later stage.
    const atCap = 'ab'.repeat(MAX_DECRYPTED_SIZE);
    const fromSpy = vi.spyOn(Buffer, 'from');

    const error = await decrypt(atCap, SALT_HEX, IV_HEX, AUTH_TAG_HEX, 'pw', CHEAP_KDF).then(
      () => null,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CiphertextTooLargeError);
    // Reaching the decode is the evidence: the guard did not fire.
    expect(fromSpy.mock.calls.some(([value]) => value === atCap)).toBe(true);
  });
});
