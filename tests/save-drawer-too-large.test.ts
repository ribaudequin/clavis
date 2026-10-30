// P0.12 (second half) — `decrypt()` can now throw `CiphertextTooLargeError`, and
// `saveDrawer` used to classify *every* non-KDF failure from that call as
// `wrong_password`. A drawer whose stored ciphertext is over the ceiling is damaged file
// data: telling the user their password is wrong sends them to guess a password that was
// never the problem, and feeds the unlock rate limiter with attempts that cannot succeed.
//
// The corruption is written straight into the `.clavis` file, because the save path's job
// is exactly to survive a drawer it did not produce.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { createDrawer, saveDrawer, getDrawerFilePath, setDataDir } from '../src/main/store';
import { MAX_DECRYPTED_SIZE } from '../src/main/encryption';

const PASSWORD = 'Str0ngPass1!';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-too-large-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  setDataDir(path.join(os.homedir(), '.local', 'share', 'Clavis'));
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('P0.12 — an oversized stored ciphertext is refused as too_large, not as a bad password', () => {
  it('returns too_large when the drawer on disk exceeds the ciphertext ceiling', async () => {
    const drawer = await createDrawer('Corrompida', PASSWORD);
    const filePath = getDrawerFilePath(drawer.id);

    // One byte over the cap. The file stays below MAX_DRAWER_FILE_SIZE (20 004 096
    // chars), so this reaches the SEC-04 decrypt rather than being refused by the
    // file-size guard — which is the branch this test is about.
    const corrupted = JSON.parse(await fs.readFile(filePath, 'utf8'));
    corrupted.encryptedData = 'ab'.repeat(MAX_DECRYPTED_SIZE + 1);
    await fs.writeFile(filePath, JSON.stringify(corrupted, null, 2), 'utf8');

    const result = await saveDrawer(drawer.id, PASSWORD, 'Corrompida', 'conteúdo novo');

    expect(result).toEqual({ ok: false, reason: 'too_large' });
    // The distinction is the fix: `wrong_password` is what this used to return.
    expect(result).not.toEqual({ ok: false, reason: 'wrong_password' });
  });

  it('leaves the damaged file untouched instead of overwriting it', async () => {
    const drawer = await createDrawer('Corrompida', PASSWORD);
    const filePath = getDrawerFilePath(drawer.id);
    const corrupted = JSON.parse(await fs.readFile(filePath, 'utf8'));
    corrupted.encryptedData = 'ab'.repeat(MAX_DECRYPTED_SIZE + 1);
    await fs.writeFile(filePath, JSON.stringify(corrupted, null, 2), 'utf8');
    const before = await fs.readFile(filePath, 'utf8');

    await saveDrawer(drawer.id, PASSWORD, 'Corrompida', 'conteúdo novo');

    expect(await fs.readFile(filePath, 'utf8')).toBe(before);
  });
});
