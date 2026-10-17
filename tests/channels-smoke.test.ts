import { describe, it, expect } from 'vitest';

describe('channels smoke', () => {
  it('exports CHANNELS and Channel type', async () => {
    const mod = await import('../src/shared/channels');
    expect(mod.CHANNELS).toBeDefined();
    expect(typeof mod.CHANNELS.LIST_DRAWERS).toBe('string');
  });
});
