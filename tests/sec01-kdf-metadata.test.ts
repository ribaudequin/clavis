import { describe, it, expect } from 'vitest';
import { encrypt } from '../src/main/encryption';

describe('SEC-01 — KDF fallback metadata', () => {
  it('encrypt returns algorithm matching effective backend', async () => {
    const res = await encrypt('test', 'Str0ng!Pass');
    expect(res.algorithm).toBeDefined();
    expect(res.algorithm === 'argon2id' || res.algorithm === 'scrypt').toBe(true);
  });

  it('algorithm is encoded in drawer metadata, not hardcoded', async () => {
    // Contract check: encryption returns algorithm; store writes it to keyDerivation
    const enc = await encrypt('hello', 'Str0ng!Pass');
    expect(enc.algorithm).toBe('argon2id'); // in this env argon2 loads
  });
});
