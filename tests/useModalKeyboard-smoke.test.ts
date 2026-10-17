import { describe, it, expect } from 'vitest';

describe('useModalKeyboard smoke', () => {
  it('exports a hook function', async () => {
    const { useModalKeyboard } = await import('../src/renderer/hooks/useModalKeyboard');
    expect(typeof useModalKeyboard).toBe('function');
  });
});
