import { describe, it, expect } from 'vitest';

describe('ErrorBoundary smoke', () => {
  it('exports a component function', async () => {
    const { default: Component } = await import('../src/renderer/components/ErrorBoundary');
    expect(typeof Component).toBe('function');
  });
});
