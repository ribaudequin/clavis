import { describe, it, expect } from 'vitest';

describe('types smoke', () => {
  it('exports ErrorCode enum and AppError interface', async () => {
    const mod = await import('../src/shared/types');
    expect(mod.ErrorCode).toBeDefined();
    expect((mod as any).AppError).toBeUndefined(); // interface erased at runtime
    expect(typeof mod.ErrorCode.INVALID_ID).toBe('string');
  });
});
