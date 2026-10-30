import { describe, it, expect } from 'vitest';

describe('channels', () => {
  it('exports CHANNELS with all expected keys and string values', async () => {
    const mod = await import('../src/shared/channels');
    expect(mod.CHANNELS).toBeDefined();
    const keys = Object.keys(mod.CHANNELS);
    expect(keys.length).toBeGreaterThanOrEqual(12);
    expect(typeof mod.CHANNELS.LIST_DRAWERS).toBe('string');
    expect(mod.CHANNELS.LIST_DRAWERS).toBe('list-drawers');
    expect(mod.CHANNELS.CHECK_UPDATE).toBe('check-update');
  });

  it('channel values are unique', async () => {
    const mod = await import('../src/shared/channels');
    const values = Object.values(mod.CHANNELS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
