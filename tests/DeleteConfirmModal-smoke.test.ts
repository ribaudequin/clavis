import { describe, it, expect } from 'vitest';

describe('DeleteConfirmModal smoke', () => {
  it('exports a component function', async () => {
    const { default: Component } = await import('../src/renderer/components/DeleteConfirmModal');
    expect(typeof Component).toBe('function');
  });
});
