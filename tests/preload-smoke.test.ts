import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn() },
}));

describe('preload smoke', () => {
  it('loads preload index without crash', async () => {
    const mod = await import('../src/main/preload/index');
    expect(mod).toBeDefined();
  });
});
