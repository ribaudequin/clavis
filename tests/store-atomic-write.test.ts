// HYG-22 — atomicWrite (src/main/store.ts) is private, so every test here drives it
// through the public store API. What is pinned is not "does the save work" — it did,
// before the fix, and the drawer's only file still died — but the shape of the I/O the
// write performs, because the defect lives in what is on disk at the instant the write
// lands, not in the return value.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import {
  setDataDir,
  getDrawersPath,
  getDrawerFilePath,
  createDrawer,
  saveDrawer,
  unlockDrawer,
} from '../src/main/store';

// `fs/promises` is a real ESM namespace, so vi.spyOn cannot redefine its exports. The
// mock below re-exports the real module as a plain mutable object: every function
// passes straight through, and store.ts — which imports this same specifier — resolves
// to the object the spies below mutate.
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, default: actual };
});

const PASSWORD = 'Str0ngPass1!';

let tempDir: string;

interface IoTrace {
  /** Ordered log of the calls atomicWrite made: `op:path[:detail]`. */
  events: string[];
  /** Every path `fs.writeFile` was called with while the trace was installed. */
  writtenPaths: string[];
  /** Per rename: its endpoints, and whether the live .clavis existed the instant it returned. */
  renames: { from: string; to: string; liveExistsAfter: boolean }[];
}

/**
 * Records the filesystem calls a save performs. The interesting observation is
 * `liveExistsAfter`: it samples the live path *synchronously between* two renames, which
 * is exactly the window in which the old sequence had no file there at all.
 */
function traceIo(livePath: string): IoTrace {
  const trace: IoTrace = { events: [], writtenPaths: [], renames: [] };
  const realOpen = fs.open.bind(fs);
  const realWriteFile = fs.writeFile.bind(fs);
  const realRename = fs.rename.bind(fs);

  vi.spyOn(fs, 'open').mockImplementation(async (p, flags, mode) => {
    trace.events.push(`open:${p}:${flags}`);
    const handle = await realOpen(p, flags, mode);
    vi.spyOn(handle, 'sync').mockImplementation(async () => {
      trace.events.push(`sync:${p}`);
    });
    return handle;
  });

  vi.spyOn(fs, 'writeFile').mockImplementation(async (p, data, options) => {
    const mode = typeof options === 'object' && options !== null ? options.mode : undefined;
    trace.events.push(`writeFile:${p}:${mode ?? '-'}`);
    trace.writtenPaths.push(String(p));
    return realWriteFile(p, data, options);
  });

  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    await realRename(from, to);
    trace.events.push(`rename:${from}->${to}`);
    trace.renames.push({
      from: String(from),
      to: String(to),
      liveExistsAfter: existsSync(livePath),
    });
  });

  return trace;
}

/** Files the drawers directory holds, excluding nothing — the point is to assert there is nothing else. */
async function drawersDirListing(): Promise<string[]> {
  return (await fs.readdir(getDrawersPath())).sort();
}

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-atomicwrite-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  setDataDir(path.join(os.homedir(), '.local', 'share', 'Clavis'));
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('HYG-22 — atomicWrite leaves no window in which the drawer is not a file', () => {
  it('createDrawer leaves exactly the .clavis in the drawers directory — no .prev, no .tmp-*', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);

    expect(await drawersDirListing()).toEqual([`${drawer.id}.clavis`]);
  });

  it('saveDrawer leaves exactly the .clavis in the drawers directory — no .prev, no .tmp-*', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);

    const saved = await saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'conteúdo novo');
    expect(saved).toEqual({ ok: true });

    expect(await drawersDirListing()).toEqual([`${drawer.id}.clavis`]);
  });

  it('never leaves the live .clavis absent: it exists after every rename, and the save renames at all', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    const before = await fs.readFile(livePath, 'utf8');
    const trace = traceIo(livePath);

    const saved = await saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'conteúdo novo');

    expect(saved).toEqual({ ok: true });
    // A save that performs no rename at all is an in-place write, not an atomic one.
    expect(trace.renames.length).toBeGreaterThanOrEqual(1);
    // The old sequence failed this: its first rename moved the drawer to .prev, so the
    // sample taken immediately after that rename found nothing at the live path.
    expect(trace.renames.filter((r) => !r.liveExistsAfter)).toEqual([]);
    // The live file was replaced, not left as the same bytes.
    expect(await fs.readFile(livePath, 'utf8')).not.toBe(before);
    expect(await drawersDirListing()).toEqual([`${drawer.id}.clavis`]);
  });

  it('a rename that fails leaves the original drawer byte-for-byte intact and no temp file behind', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    const before = await fs.readFile(livePath, 'utf8');

    // Fails the FIRST rename only, which is the crash window the old two-rename sequence
    // created. That sequence swallowed this failure and carried on to the second rename.
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EIO: simulated rename failure'));

    const saved = await saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'conteúdo novo');

    expect(saved).toEqual({ ok: false, reason: 'write_failed' });
    expect(existsSync(livePath)).toBe(true);
    expect(await fs.readFile(livePath, 'utf8')).toBe(before);
    // A failed save must not leave a copy of the drawer in the profile for good.
    expect(await drawersDirListing()).toEqual([`${drawer.id}.clavis`]);
    // And the drawer is still a working drawer, not a truncated husk.
    const unlocked = await unlockDrawer(drawer.id, PASSWORD);
    expect(unlocked.ok).toBe(true);
  });

  it('never opens the live .clavis for writing: the drawer is written only through a temp path', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    const trace = traceIo(livePath);

    await saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'conteúdo novo');

    expect(trace.writtenPaths.length).toBeGreaterThanOrEqual(1);
    // An in-place `fs.writeFile(livePath, data)` truncates the drawer's only inode in
    // front of the reader: every kill in that window leaves an unopenable drawer.
    expect(trace.writtenPaths).not.toContain(livePath);
  });

  it('replaces the drawer with a different inode rather than rewriting the live one', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    const before = (await fs.stat(livePath)).ino;

    await saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'conteúdo novo');

    const after = (await fs.stat(livePath)).ino;
    expect(after).not.toBe(before);
  });

  it('stages the write in a temp file, fsyncs it, renames it into place, then fsyncs the directory', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    const trace = traceIo(livePath);

    await saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'conteúdo novo');

    const tmpPath = trace.writtenPaths[0];
    expect(path.dirname(tmpPath)).toBe(getDrawersPath());
    expect(path.basename(tmpPath)).not.toBe(path.basename(livePath));
    expect(trace.events).toEqual([
      // Written with 0o600 on a brand-new inode: the only write in the store where the
      // mode is honoured, and the inode that ends up being the .clavis.
      `writeFile:${tmpPath}:${0o600}`,
      `open:${tmpPath}:r+`,
      `sync:${tmpPath}`,
      `rename:${tmpPath}->${livePath}`,
      // Without the directory barrier the rename itself is not durable, and a power cut
      // can undo a write whose contents were already flushed.
      `open:${getDrawersPath()}:r`,
      `sync:${getDrawersPath()}`,
    ]);
  });

  it('keeps the replaced drawer at mode 0o600', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    await fs.chmod(livePath, 0o644); // a mode the temp file must not be able to hand on

    await saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'conteúdo novo');

    // rename() carries the temp file's mode over, so the drawer's permissions come from
    // the writeFile mode and from nowhere else.
    const stat = await fs.stat(livePath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('two writes in the same millisecond get different staging files', async () => {
    const drawer = await createDrawer('Atomicidade', PASSWORD);
    const livePath = getDrawerFilePath(drawer.id);
    // The temp name was built from Date.now(), so two writes inside one millisecond resolved
    // to the same path: whichever rename landed second either failed outright or moved a file
    // the other write was still filling. Freezing the clock is what makes that reachable.
    const frozen = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    // The staging path is observed rather than the collision being raced. Two concurrent
    // saves do not reliably interleave inside atomicWrite — the argon2id derivation ahead of
    // it takes ~300ms and the two finish far enough apart that the write/rename sections run
    // one after the other, which is safe even with a shared name. A first version of this test
    // awaited Promise.all and passed with the bug present for exactly that reason.
    const staging: string[] = [];
    const realWriteFile = fs.writeFile.bind(fs);
    vi.spyOn(fs, 'writeFile').mockImplementation(async (p, data, options) => {
      staging.push(String(p));
      return realWriteFile(p, data, options);
    });

    const results = await Promise.all([
      saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'escrita A'),
      saveDrawer(drawer.id, PASSWORD, 'Atomicidade', 'escrita B'),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    const stagingPaths = staging.filter((p) => p !== livePath);
    expect(stagingPaths).toHaveLength(2);
    expect(new Set(stagingPaths).size).toBe(2);
    expect(await drawersDirListing()).toEqual([`${drawer.id}.clavis`]);

    frozen.mockRestore();
  });
});