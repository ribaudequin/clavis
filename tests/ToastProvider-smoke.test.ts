import { describe, it, expect } from 'vitest';

describe('ToastProvider smoke', () => {
  it('exports ToastProvider function', async () => {
    const mod = await import('../src/renderer/components/ToastProvider');
    expect(typeof mod.ToastProvider).toBe('function');
  });
});
