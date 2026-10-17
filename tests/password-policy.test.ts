import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setDataDir, createDrawer, saveDrawer } from '../src/main/store';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Password policy (complex > 2^19 / KDF-01 evito)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clavis-pw-'));
    setDataDir(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('rejects weak password (< 12 chars, no mix)', async () => {
    await expect(createDrawer('T', 'short')).rejects.toThrow('Password must be at least 12');
  });

  it('rejects 12 chars but missing symbol', async () => {
    await expect(createDrawer('T', 'Password1Only')).rejects.toThrow('Password must be at least 12');
  });

  it('accepts strong password', async () => {
    const d = await createDrawer('Good', 'Segur0#Strong!');
    expect(d.id).toBeTruthy();
    await saveDrawer(d.id, 'Segur0#Strong!', 'Good', 'hello');
  });
});
