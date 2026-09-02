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
} from '../src/main/store';

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
});
