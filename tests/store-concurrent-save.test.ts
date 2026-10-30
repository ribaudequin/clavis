// DATA-01 — a save is a read-modify-write, and two saves of the same drawer must not
// interleave: the second save has to read *after* the first one's rename landed, or it
// re-encrypts stale content and silently discards the newer edit. The lock in store.ts is
// the whole fix, so this test observes the I/O order rather than the return values — with
// the lock absent both reads happen before either derivation finishes.
//
// `fs/promises` is a real ESM namespace, so vi.spyOn cannot redefine its exports; the mock
// re-exports the real module as a mutable object (same pattern as store-atomic-write.test.ts).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  setDataDir,
  createDrawer,
  getDrawerFilePath,
  saveDrawer,
  unlockDrawer,
} from '../src/main/store';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, default: actual };
});

const PASSWORD = 'Str0ngPass1!';
let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-concurrent-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('DATA-01 — concurrent saves are serialized per drawer', () => {
  it('reads the second time only after the first save has renamed', async () => {
    const drawer = await createDrawer('Corrida', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    const events: string[] = [];
    const realRead = fs.readFile.bind(fs);
    const realRename = fs.rename.bind(fs);

    vi.spyOn(fs, 'readFile').mockImplementation((async (p: unknown, ...rest: unknown[]) => {
      if (String(p) === livePath) events.push('read');
      return (realRead as (...args: unknown[]) => Promise<unknown>)(p, ...rest);
    }) as never);

    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      await realRename(from, to);
      if (String(to) === livePath) events.push('rename');
    });

    const results = await Promise.all([
      saveDrawer(drawer.id, PASSWORD, 'Corrida', 'A'),
      saveDrawer(drawer.id, PASSWORD, 'Corrida', 'B'),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    // Serialized: read, rename, read, rename. The racy shape is read, read, rename, rename.
    expect(events).toEqual(['read', 'rename', 'read', 'rename']);

    const unlocked = await unlockDrawer(drawer.id, PASSWORD);
    expect(unlocked.ok && unlocked.data.content).toBe('B');
  });
});
