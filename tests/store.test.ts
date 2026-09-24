import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  setDataDir,
  getDataDir,
  createDrawer,
  listDrawers,
  unlockDrawer,
  saveDrawer,
  deleteDrawer,
  isValidId,
  getDrawerFilePath,
  importDrawerRaw,
} from '../src/main/store';
import { encrypt } from '../src/main/encryption';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  setDataDir(path.join(os.homedir(), '.local', 'share', 'Clavis'));
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('store module', () => {
  it('createDrawer creates a .clavis file with mode 0o600 and a valid UUID id', async () => {
    const drawer = await createDrawer('Minha Gaveta', 's3cret-password!');

    expect(UUID_RE.test(drawer.id)).toBe(true);
    expect(drawer.title).toBe('Minha Gaveta');

    const filePath = getDrawerFilePath(drawer.id);
    expect(filePath.endsWith('.clavis')).toBe(true);

    const stat = await fs.stat(filePath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('listDrawers returns created drawers with title and iconData', async () => {
    const a = await createDrawer('Gaveta A', 'password-a');
    const b = await createDrawer('Gaveta B', 'password-b');

    const drawers = await listDrawers();

    expect(drawers).toHaveLength(2);
    const ids = drawers.map((d) => d.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);

    const found = drawers.find((d) => d.id === a.id);
    expect(found?.title).toBe('Gaveta A');
    expect(found?.iconData).toBe(a.iconData);
    expect(found?.iconData).toContain('rgb(');
  });

  it('unlockDrawer with correct password returns decrypted content; wrong password returns null', async () => {
    const drawer = await createDrawer('Segredos', 'correct-password');
    const result = await unlockDrawer(drawer.id, 'correct-password');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Segredos');
    expect(result?.content).toBe('');

    const wrong = await unlockDrawer(drawer.id, 'wrong-password');
    expect(wrong).toBeNull();
  });

  it('saveDrawer updates content (unlock again returns new content)', async () => {
    const drawer = await createDrawer('Gaveta', 'password-123');

    const saved = await saveDrawer(drawer.id, 'password-123', 'Novo Título', 'conteúdo atualizado');
    expect(saved).toBe(true);

    const result = await unlockDrawer(drawer.id, 'password-123');
    expect(result?.title).toBe('Novo Título');
    expect(result?.content).toBe('conteúdo atualizado');
  });

  it('deleteDrawer removes the file and returns true', async () => {
    const drawer = await createDrawer('Para Apagar', 'password-123');
    const filePath = getDrawerFilePath(drawer.id);

    await expect(fs.stat(filePath)).resolves.toBeDefined();

    const deleted = await deleteDrawer(drawer.id);
    expect(deleted).toBe(true);

    await expect(fs.stat(filePath)).rejects.toThrow();
    expect(await listDrawers()).toHaveLength(0);
  });

  it('saveDrawer and deleteDrawer reject invalid ids', async () => {
    expect(await saveDrawer('not-a-uuid', 'pw', 't', 'c')).toBe(false);
    expect(await deleteDrawer('not-a-uuid')).toBe(false);
  });

  it('isValidId rejects path traversal', async () => {
    expect(isValidId('../../../etc/passwd')).toBe(false);
    expect(isValidId('..')).toBe(false);
    expect(isValidId('')).toBe(false);
    expect(isValidId('a'.repeat(36))).toBe(false);
    expect(isValidId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('createDrawer rejects password shorter than 8 characters', async () => {
    await expect(createDrawer('Test', 'short')).rejects.toThrow('Password must be at least 8 characters');
    await expect(createDrawer('Test', '')).rejects.toThrow('Password must be at least 8 characters');
    await expect(createDrawer('Test', '1234567')).rejects.toThrow('Password must be at least 8 characters');
  });

  it('saveDrawer rejects password shorter than 8 characters', async () => {
    const drawer = await createDrawer('Test', 'valid-password-123');
    const result = await saveDrawer(drawer.id, 'short', 'Title', 'content');
    expect(result).toBe(false);
  });

  describe('KDF compatibility and bounds', () => {
    const LEGACY_ID = '123e4567-e89b-12d3-a456-426614174000';
    const HUGE_ID = '123e4567-e89b-12d3-a456-426614174001';
    const lowId = '123e4567-e89b-12d3-a456-426614174002';

    async function writeDrawer(
      id: string,
      password: string,
      content: string,
      memory: number,
      parallelism: number
    ): Promise<void> {
      const params = { timeCost: 3, memoryCost: memory, parallelism };
      const { encryptedData, salt, iv, authTag } = await encrypt(content, password, params);
      const drawer = {
        id,
        title: 'Drawer',
        iconData: '[]',
        createdAt: 1,
        updatedAt: 1,
        encryptedData,
        salt,
        iv,
        authTag,
        keyDerivation: { algorithm: 'argon2id', iterations: 3, memory, parallelism },
      };
      await fs.mkdir(path.dirname(getDrawerFilePath(id)), { recursive: true });
      await fs.writeFile(getDrawerFilePath(id), JSON.stringify(drawer), { mode: 0o600 });
    }

    it('unlocks drawers created with legacy 2^16 KDF params', async () => {
      await writeDrawer(LEGACY_ID, 'legacy-password', 'legacy content', 2 ** 16, 1);

      const unlocked = await unlockDrawer(LEGACY_ID, 'legacy-password');
      expect(unlocked).not.toBeNull();
      expect(unlocked?.content).toBe('legacy content');
    });

    it('saveDrawer preserves legacy KDF metadata and stays unlockable', async () => {
      await writeDrawer(LEGACY_ID, 'legacy-password', 'old', 2 ** 16, 1);

      const saved = await saveDrawer(LEGACY_ID, 'legacy-password', 'Updated', 'new content');
      expect(saved).toBe(true);

      const raw = JSON.parse(await fs.readFile(getDrawerFilePath(LEGACY_ID), 'utf8'));
      expect(raw.keyDerivation.memory).toBe(2 ** 16);

      const unlocked = await unlockDrawer(LEGACY_ID, 'legacy-password');
      expect(unlocked?.content).toBe('new content');
    });

    it('refuses (without crashing) drawers whose KDF memory exceeds the safety cap', async () => {
      // 2^21 KiB (~2 GiB) is known to crash the native Argon2 binding in Electron,
      // so the bounds check must short-circuit before any derivation is attempted.
      const drawer = {
        id: HUGE_ID,
        title: 'Huge',
        iconData: '[]',
        createdAt: 1,
        updatedAt: 1,
        encryptedData: '00',
        salt: '00'.repeat(16),
        iv: '00'.repeat(16),
        authTag: '00'.repeat(16),
        keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 21, parallelism: 4 },
      };
      await fs.mkdir(path.dirname(getDrawerFilePath(HUGE_ID)), { recursive: true });
      await fs.writeFile(getDrawerFilePath(HUGE_ID), JSON.stringify(drawer), { mode: 0o600 });

      expect(await unlockDrawer(HUGE_ID, 'password-123')).toBeNull();
      expect(await saveDrawer(HUGE_ID, 'password-123', 't', 'c')).toBe(false);
    });

    it('importDrawerRaw accepts legacy 2^16 params but rejects below-floor and above-cap values', async () => {
      const base = {
        id: lowId,
        title: 'Import',
        iconData: '[]',
        createdAt: 1,
        updatedAt: 1,
        encryptedData: 'e',
        salt: 's',
        iv: 'i',
        authTag: 'a',
      };

      const legacy = { ...base, id: '123e4567-e89b-12d3-a456-426614174010', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 16, parallelism: 1 } };
      expect(await importDrawerRaw(JSON.stringify(legacy))).toBe(true);

      const tooWeak = { ...base, id: '123e4567-e89b-12d3-a456-426614174011', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 14, parallelism: 1 } };
      expect(await importDrawerRaw(JSON.stringify(tooWeak))).toBe(false);

      const tooHuge = { ...base, id: '123e4567-e89b-12d3-a456-426614174012', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 2 ** 21, parallelism: 4 } };
      expect(await importDrawerRaw(JSON.stringify(tooHuge))).toBe(false);
    });
  });
});
