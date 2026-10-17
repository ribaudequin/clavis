import { describe, it, expect } from 'vitest';

describe('CreditsModal smoke', () => {
  it('exports a component function', async () => {
    const { default: Component } = await import('../src/renderer/components/CreditsModal');
    expect(typeof Component).toBe('function');
  });
});
