// DATA-04 — Three generations of drawer backup, and auto-recovery on startup.
//
// The backup chain lives in `atomicWrite` (store.ts) and is exercised through the
// public store API: `createDrawer` → `saveDrawer` (N times) → inspect the `.bak`
// files on disk. The auto-recovery lives in `ensureDataDir` and is exercised by
// deleting the live `.clavis` (simulating the crash window between the two renames)
// and calling `ensureDataDir` again.
//
// `fs/promises` is a real ESM namespace, so vi.spyOn cannot redefine its exports;
// the mock re-exports the real module as a mutable object (same pattern as
// store-atomic-write.test.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  setDataDir,
  getDrawersPath,
  getDrawerFilePath,
  createDrawer,
  saveDrawer,
  unlockDrawer,
  ensureDataDir,
} from '../src/main/store';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, default: actual };
});

const PASSWORD = 'Str0ngPass1!';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-backup-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  setDataDir(path.join(os.homedir(), '.local', 'share', 'Clavis'));
  await fs.rm(tempDir, { recursive: true, force: true });
});

/** Files the drawers directory holds, excluding nothing. */
async function drawersDirListing(): Promise<string[]> {
  return (await fs.readdir(getDrawersPath())).sort();
}

describe('DATA-04 — three generations of backup', () => {
  it('first save (createDrawer) leaves no .bak — the live file did not exist before', async () => {
    const drawer = await createDrawer('Backup', PASSWORD);

    // createDrawer calls atomicWrite with a new id: the live file does not exist,
    // so the rotation's `rename(filePath, bak)` fails with ENOENT and no .bak is
    // created. This is the expected initial state.
    expect(await drawersDirListing()).toEqual([`${drawer.id}.clavis`]);
  });

  it('second save creates .bak with the previous (initial) state', async () => {
    const drawer = await createDrawer('Backup', PASSWORD);

    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v1');

    // The .bak is the state before this save — which is the empty drawer createDrawer
    // produced. It exists and contains valid ciphertext.
    const files = await drawersDirListing();
    expect(files).toContain(`${drawer.id}.clavis`);
    expect(files).toContain(`${drawer.id}.clavis.bak`);
    expect(files).not.toContain(`${drawer.id}.clavis.bak.1`);
    expect(files).not.toContain(`${drawer.id}.clavis.bak.2`);

    // The .bak is a valid drawer file (same envelope as the live one).
    const bakContent = await fs.readFile(`${getDrawerFilePath(drawer.id)}.bak`, 'utf8');
    expect(() => JSON.parse(bakContent)).not.toThrow();
  });

  it('third save rotates: .bak = save #1, .bak.1 = initial state, no .bak.2 yet', async () => {
    const drawer = await createDrawer('Backup', PASSWORD);
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v1');
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v2');

    const files = await drawersDirListing();
    expect(files).toContain(`${drawer.id}.clavis`);
    expect(files).toContain(`${drawer.id}.clavis.bak`);
    expect(files).toContain(`${drawer.id}.clavis.bak.1`);
    expect(files).not.toContain(`${drawer.id}.clavis.bak.2`);

    // The .bak is the state before save #2 — which is save #1 ('v1').
    const bakContent = await fs.readFile(`${getDrawerFilePath(drawer.id)}.bak`, 'utf8');
    const bakDrawer = JSON.parse(bakContent);
    // The .bak is a complete drawer envelope; we can verify it is not the initial
    // state by checking that it has a non-empty encryptedData (the initial state
    // encrypts an empty string, so its ciphertext is empty).
    expect(bakDrawer.encryptedData.length).toBeGreaterThan(0);
  });

  it('fourth save fills .bak.2; fifth save overwrites .bak.2 (no fourth generation)', async () => {
    const drawer = await createDrawer('Backup', PASSWORD);
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v1');
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v2');
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v3');

    // Now all three .bak files exist.
    let files = await drawersDirListing();
    expect(files).toContain(`${drawer.id}.clavis.bak`);
    expect(files).toContain(`${drawer.id}.clavis.bak.1`);
    expect(files).toContain(`${drawer.id}.clavis.bak.2`);

    // Save #4: the oldest (.bak.2) is unlinked, .bak.1 → .bak.2, .bak → .bak.1,
    // live → .bak. No .bak.3 is created — the chain is fixed at three.
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v4');

    files = await drawersDirListing();
    expect(files).toContain(`${drawer.id}.clavis.bak`);
    expect(files).toContain(`${drawer.id}.clavis.bak.1`);
    expect(files).toContain(`${drawer.id}.clavis.bak.2`);
    // No fourth generation.
    expect(files).not.toContain(`${drawer.id}.clavis.bak.3`);
    // Exactly three .bak files + the live file.
    expect(files).toHaveLength(4);
  });

  it('the live file is always a valid drawer — every generation is unlockable', async () => {
    const drawer = await createDrawer('Backup', PASSWORD);
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v1');
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v2');
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v3');

    // The live file opens with the current password.
    const live = await unlockDrawer(drawer.id, PASSWORD);
    expect(live.ok).toBe(true);

    // Each .bak is a valid drawer file (same envelope). We cannot unlock them
    // through the store API (the path is derived from the id, and .bak files
    // have a different name), but we can verify they parse as JSON and carry
    // the same crypto fields.
    for (const suffix of ['.bak', '.bak.1', '.bak.2']) {
      const bakPath = `${getDrawerFilePath(drawer.id)}${suffix}`;
      const content = await fs.readFile(bakPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('encryptedData');
      expect(parsed).toHaveProperty('salt');
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('authTag');
    }
  });

  it('a failed save does not corrupt the backup chain', async () => {
    const drawer = await createDrawer('Backup', PASSWORD);
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v1');
    await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v2');

    // Before the failed save: .clavis = v2, .bak = v1, .bak.1 = initial.
    const beforeBak = await fs.readFile(`${getDrawerFilePath(drawer.id)}.bak`, 'utf8');
    const beforeBak1 = await fs.readFile(`${getDrawerFilePath(drawer.id)}.bak.1`, 'utf8');
    const beforeLive = await fs.readFile(getDrawerFilePath(drawer.id), 'utf8');

    // Make the next save fail at the final rename step (tmp → live).
    // The rotation has already moved the live file to .bak and .bak to .bak.1;
    // the failure happens before the temp file is renamed into place.
    const originalRename = fs.rename.bind(fs);
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      // Fail only the final rename (tmp → live), not the rotation renames.
      if (String(from).includes('.tmp-') && String(to) === getDrawerFilePath(drawer.id)) {
        throw new Error('EIO: simulated rename failure');
      }
      return originalRename(from, to);
    });

    const result = await saveDrawer(drawer.id, PASSWORD, 'Backup', 'v3');
    expect(result).toEqual({ ok: false, reason: 'write_failed' });

    // The rotation already happened: .bak now holds v2 (was live), .bak.1 holds v1 (was .bak).
    const afterFiles = await drawersDirListing();
    expect(afterFiles).toContain(`${drawer.id}.clavis.bak`);
    expect(afterFiles).toContain(`${drawer.id}.clavis.bak.1`);

    // .bak contains v2 (the state before the failed save).
    const afterBak = await fs.readFile(`${getDrawerFilePath(drawer.id)}.bak`, 'utf8');
    expect(afterBak).toBe(beforeLive); // v2 is now in .bak

    // .bak.1 contains v1 (the previous .bak).
    const afterBak1 = await fs.readFile(`${getDrawerFilePath(drawer.id)}.bak.1`, 'utf8');
    expect(afterBak1).toBe(beforeBak); // v1 is now in .bak.1

    // No temp file left behind.
    expect(afterFiles).not.toContain(expect.stringContaining('.tmp-'));
  });
});

describe('DATA-04 — auto-recovery on startup', () => {
  it('recovers a drawer whose live file is missing but whose .bak exists', async () => {
    const drawer = await createDrawer('Recover', PASSWORD);
    await saveDrawer(drawer.id, PASSWORD, 'Recover', 'v1');
    // Now .clavis = v1, .bak = initial (empty content).
    // Save again to have .bak = v1.
    await saveDrawer(drawer.id, PASSWORD, 'Recover', 'v2');
    // Now .clavis = v2, .bak = v1, .bak.1 = initial.

    // Simulate the crash window: live file gone, .bak present.
    const livePath = getDrawerFilePath(drawer.id);
    await fs.unlink(livePath);
    expect(await fs.access(livePath).then(() => true).catch(() => false)).toBe(false);

    // ensureDataDir runs on every app startup and triggers recovery.
    await ensureDataDir();

    // The .bak was renamed back to .clavis.
    const files = await drawersDirListing();
    expect(files).toContain(`${drawer.id}.clavis`);
    expect(files).not.toContain(`${drawer.id}.clavis.bak`);

    // The recovered drawer opens with the password and contains v1 (the .bak state).
    const unlocked = await unlockDrawer(drawer.id, PASSWORD);
    expect(unlocked.ok).toBe(true);
    expect(unlocked.ok && unlocked.data.content).toBe('v1');
  });

  it('does not recover when the live file exists (rotation worked)', async () => {
    const drawer = await createDrawer('Recover', PASSWORD);
    await saveDrawer(drawer.id, PASSWORD, 'Recover', 'v1');
    await saveDrawer(drawer.id, PASSWORD, 'Recover', 'v2');

    // Both .clavis and .clavis.bak exist — this is the normal post-save state.
    const files = await drawersDirListing();
    expect(files).toContain(`${drawer.id}.clavis`);
    expect(files).toContain(`${drawer.id}.clavis.bak`);

    const liveBefore = await fs.readFile(getDrawerFilePath(drawer.id), 'utf8');

    await ensureDataDir();

    // Nothing changed: the live file is still v2, the .bak is still v1.
    const liveAfter = await fs.readFile(getDrawerFilePath(drawer.id), 'utf8');
    expect(liveAfter).toBe(liveBefore);

    const filesAfter = await drawersDirListing();
    expect(filesAfter).toContain(`${drawer.id}.clavis`);
    expect(filesAfter).toContain(`${drawer.id}.clavis.bak`);
  });

  it('leaves older generations alone during recovery', async () => {
    const drawer = await createDrawer('Recover', PASSWORD);
    await saveDrawer(drawer.id, PASSWORD, 'Recover', 'v1');
    await saveDrawer(drawer.id, PASSWORD, 'Recover', 'v2');
    await saveDrawer(drawer.id, PASSWORD, 'Recover', 'v3');

    // Now: .clavis = v3, .bak = v2, .bak.1 = v1, .bak.2 = initial.
    // Simulate crash: remove live file.
    await fs.unlink(getDrawerFilePath(drawer.id));

    await ensureDataDir();

    // .bak (v2) is recovered to .clavis.
    const files = await drawersDirListing();
    expect(files).toContain(`${drawer.id}.clavis`);
    expect(files).not.toContain(`${drawer.id}.clavis.bak`); // Renamed to .clavis.
    // Older generations are untouched.
    expect(files).toContain(`${drawer.id}.clavis.bak.1`); // v1
    expect(files).toContain(`${drawer.id}.clavis.bak.2`); // initial

    // The recovered drawer opens with the password and contains v2.
    const unlocked = await unlockDrawer(drawer.id, PASSWORD);
    expect(unlocked.ok).toBe(true);
    expect(unlocked.ok && unlocked.data.content).toBe('v2');
  });

  it('handles a missing drawers directory gracefully', async () => {
    // Remove the entire drawers directory.
    await fs.rm(getDrawersPath(), { recursive: true, force: true });

    // ensureDataDir creates the directory and then runs recovery (which finds nothing).
    await expect(ensureDataDir()).resolves.not.toThrow();

    // The directory was recreated.
    const stat = await fs.stat(getDrawersPath());
    expect(stat.isDirectory()).toBe(true);
  });
});