// SEC-05 — A malformed crypto field used to reach decrypt(), throw, and be reported as
// `wrong_password`, which also fed the unlock rate limiter for a correct password.
// SEC-07 — listDrawers() and importDrawerRaw() forwarded title/iconData unchecked: a
// non-string title crashed React, an unbounded iconData froze the renderer, and an
// internal id that disagreed with the filename was listed under an id that cannot open.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  setDataDir,
  getDrawerFilePath,
  generateIconData,
  importDrawerRaw,
  listDrawers,
  unlockDrawer,
  MAX_DRAWER_FILE_SIZE,
} from '../src/main/store';
import { logger } from '../src/main/logger';

const PASSWORD = 'Str0ng!Passw0rd';
const ID_1 = '123e4567-e89b-12d3-a456-426614174110';
const ID_2 = '123e4567-e89b-12d3-a456-426614174111';
const ID_3 = '123e4567-e89b-12d3-a456-426614174112';
const ID_4 = '123e4567-e89b-12d3-a456-426614174113';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(
    os.tmpdir(),
    `clavis-sec05-07-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempDir, { recursive: true, force: true });
});

function validDrawer(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    title: 'Drawer',
    iconData: '[]',
    createdAt: 1,
    updatedAt: 1,
    encryptedData: '',
    salt: '00'.repeat(16),
    iv: '11'.repeat(16),
    authTag: '22'.repeat(16),
    keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 16, parallelism: 4 },
    ...overrides,
  };
}

async function writeDrawer(id: string, body: unknown): Promise<void> {
  await fs.mkdir(path.dirname(getDrawerFilePath(id)), { recursive: true });
  await fs.writeFile(getDrawerFilePath(id), JSON.stringify(body), { mode: 0o600 });
}

describe('SEC-05 — crypto metadata shape', () => {
  it('import rejects an IV that decodes to 2 bytes', async () => {
    // 4 hex characters, not 32: this is the value that used to reach decrypt().
    expect(await importDrawerRaw(JSON.stringify(validDrawer(ID_1, { iv: 'abcd' })))).toBe(false);
  });

  it('import rejects odd-length ciphertext', async () => {
    expect(
      await importDrawerRaw(JSON.stringify(validDrawer(ID_1, { encryptedData: 'abc' })))
    ).toBe(false);
  });

  it('import accepts 32-hex salt/iv/authTag (either case) and empty ciphertext', async () => {
    const drawer = validDrawer(ID_1, {
      salt: 'AA'.repeat(16),
      iv: 'bB'.repeat(16),
      authTag: 'cC'.repeat(16),
      encryptedData: '',
    });

    expect(await importDrawerRaw(JSON.stringify(drawer))).toBe(true);
    // Empty content encrypts to an empty ciphertext, so this is a real drawer shape.
    const stored = JSON.parse(await fs.readFile(getDrawerFilePath(ID_1), 'utf8')) as {
      encryptedData: string;
    };
    expect(stored.encryptedData).toBe('');
  });

  it('unlock reports a 2-byte IV as corrupt_metadata, not wrong_password', async () => {
    await writeDrawer(ID_1, validDrawer(ID_1, { iv: 'abcd' }));

    expect(await unlockDrawer(ID_1, PASSWORD)).toEqual({ ok: false, reason: 'corrupt_metadata' });
  });
});

describe('SEC-07 — bounded metadata', () => {
  it('import rejects a title that is an object', async () => {
    expect(
      await importDrawerRaw(JSON.stringify(validDrawer(ID_1, { title: { evil: true } })))
    ).toBe(false);
  });

  it('import rejects a million-entry iconData array without reaching the renderer', async () => {
    const iconData = JSON.stringify(new Array(1_000_000).fill('x'));
    const body = JSON.stringify(validDrawer(ID_1, { iconData }));

    // Under the file-size cap on purpose: only the metadata schema can refuse this.
    // HYG-13b — the ceiling is read from the store, not restated here: the number
    // had three owners (the source, the ipc-handlers mock and this line) and the
    // copy in this file was the one that would have gone stale unnoticed.
    expect(body.length).toBeLessThan(MAX_DRAWER_FILE_SIZE);
    expect(await importDrawerRaw(body)).toBe(false);
  });

  it('import rejects any iconData array above 64 entries', async () => {
    const iconData = JSON.stringify(new Array(65).fill('rgb(0,0,0)'));
    expect(await importDrawerRaw(JSON.stringify(validDrawer(ID_1, { iconData })))).toBe(false);
  });

  it('import accepts the real nine-entry rgb() icon', async () => {
    const iconData = generateIconData(ID_1);
    expect(JSON.parse(iconData)).toHaveLength(9);

    expect(await importDrawerRaw(JSON.stringify(validDrawer(ID_1, { iconData })))).toBe(true);
  });

  it('listDrawers skips a file whose internal id does not match its filename', async () => {
    const warn = vi.spyOn(logger, 'error');

    await writeDrawer(ID_1, validDrawer(ID_2));
    await writeDrawer(ID_3, validDrawer(ID_3));

    const drawers = await listDrawers();

    // ID_2 is a perfectly valid drawer, but it lives in ID_1.clavis: listing it under
    // ID_2 would produce an entry getDrawerFilePath() can never open.
    expect(drawers.map((d) => d.id)).toEqual([ID_3]);
    expect(warn).toHaveBeenCalledWith(
      'listDrawers skipped drawer whose id does not match its filename',
      expect.objectContaining({ file: `${ID_1}.clavis`, id: ID_2 })
    );
  });

  it('listDrawers skips a file with a non-string title and still lists valid drawers', async () => {
    const warn = vi.spyOn(logger, 'error');

    await writeDrawer(ID_1, validDrawer(ID_1, { title: { evil: true } }));
    await writeDrawer(ID_3, validDrawer(ID_3));

    const drawers = await listDrawers();

    expect(drawers.map((d) => d.id)).toEqual([ID_3]);
    expect(warn).toHaveBeenCalledWith(
      'listDrawers skipped invalid metadata',
      expect.objectContaining({ file: `${ID_1}.clavis` })
    );
  });

  it('unlock reports a non-string title as corrupt_metadata, not wrong_password', async () => {
    await writeDrawer(ID_1, validDrawer(ID_1, { title: { evil: true } }));

    expect(await unlockDrawer(ID_1, PASSWORD)).toEqual({ ok: false, reason: 'corrupt_metadata' });
  });

  it('unlock reports malformed iconData as corrupt_metadata, not wrong_password', async () => {
    await writeDrawer(ID_1, validDrawer(ID_1, { iconData: 'not json' }));

    expect(await unlockDrawer(ID_1, PASSWORD)).toEqual({ ok: false, reason: 'corrupt_metadata' });
  });
});
