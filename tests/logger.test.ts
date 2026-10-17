import { describe, it, expect, vi } from 'vitest';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));

describe('logger smoke', () => {
  it('exports initializeLogger and logger', async () => {
    const mod = await import('../src/main/logger');
    expect(typeof mod.initializeLogger).toBe('function');
    expect(mod.logger).toBeDefined();
  });
});
