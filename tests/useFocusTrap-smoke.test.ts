import { describe, it, expect } from 'vitest';

describe('useFocusTrap smoke', () => {
  it('exports a hook function', async () => {
    const { useFocusTrap } = await import('../src/renderer/hooks/useFocusTrap');
    expect(typeof useFocusTrap).toBe('function');
  });
});
