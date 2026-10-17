import { describe, it, expect } from 'vitest';

describe('SkeletonLoader smoke', () => {
  it('exports SkeletonCard and SkeletonLoaders', async () => {
    const mod = await import('../src/renderer/components/SkeletonLoader');
    expect(typeof mod.SkeletonCard).toBe('function');
    expect(typeof mod.SkeletonLoaders).toBe('function');
  });
});
