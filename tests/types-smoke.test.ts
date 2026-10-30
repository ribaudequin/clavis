import { describe, it, expect } from 'vitest';

describe('types', () => {
  it('exports ErrorCode enum with expected members', async () => {
    const mod = await import('../src/shared/types');
    expect(mod.ErrorCode).toBeDefined();
    expect(typeof mod.ErrorCode.INVALID_ID).toBe('string');
    expect(mod.ErrorCode.INVALID_ID).toBe('INVALID_ID');
    expect(mod.ErrorCode.CONTENT_TOO_LONG).toBe('CONTENT_TOO_LONG');
    expect(mod.ErrorCode.KDF_UNAVAILABLE).toBe('KDF_UNAVAILABLE');
  });

  it('exports types module', async () => {
    const mod = await import('../src/shared/types');
    expect(mod.ErrorCode).toBeDefined();
  });
});
