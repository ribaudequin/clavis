import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  readDrawerRaw,
  importDrawerRaw,
  isValidId,
} from '../src/main/store';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `clavis-ipc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  setDataDir(tempDir);
});

afterEach(async () => {
  setDataDir(path.join(os.homedir(), '.local', 'share', 'Clavis'));
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('IPC handlers (mocked via store functions)', () => {
  describe('list-drawers handler', () => {
    it('returns empty array when no drawers exist', async () => {
      const result = await listDrawers();
      expect(result).toEqual([]);
    });

    it('returns list of created drawers with metadata', async () => {
      const drawer1 = await createDrawer('Drawer 1', 'password123456');
      const drawer2 = await createDrawer('Drawer 2', 'password654321');

      const result = await listDrawers();
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toContain(drawer1.id);
      expect(result.map((d) => d.id)).toContain(drawer2.id);
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('iconData');
    });
  });

  describe('create-drawer handler', () => {
    it('creates a new drawer with valid title and password', async () => {
      const result = await createDrawer('My Secrets', 'SecurePassword123');
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title', 'My Secrets');
      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(isValidId(result.id)).toBe(true);
    });

    it('rejects password shorter than 8 characters', async () => {
      await expect(createDrawer('Test', 'short')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('creates drawer with empty content', async () => {
      const result = await createDrawer('Empty', 'password123456');
      const unlocked = await unlockDrawer(result.id, 'password123456');
      
      expect(unlocked?.content).toBe('');
    });
  });

  describe('unlock-drawer handler', () => {
    it('unlocks drawer with correct password', async () => {
      const drawer = await createDrawer('Test Drawer', 'correctPassword123');
      const result = await unlockDrawer(drawer.id, 'correctPassword123');
      
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Drawer');
      expect(result?.iconData).toBeDefined();
    });

    it('returns null with wrong password', async () => {
      const drawer = await createDrawer('Test Drawer', 'correctPassword123');
      const result = await unlockDrawer(drawer.id, 'wrongPassword123');
      
      expect(result).toBeNull();
    });

    it('returns null with invalid ID', async () => {
      const result = await unlockDrawer('not-a-uuid', 'password123');
      expect(result).toBeNull();
    });

    it('returns null with non-existent drawer ID', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const result = await unlockDrawer(fakeId, 'password123456');
      expect(result).toBeNull();
    });
  });

  describe('save-drawer handler', () => {
    it('saves drawer with updated content', async () => {
      const drawer = await createDrawer('My Drawer', 'password123456');
      const saveResult = await saveDrawer(drawer.id, 'password123456', 'Updated Title', 'New Content');
      
      expect(saveResult).toBe(true);

      const unlocked = await unlockDrawer(drawer.id, 'password123456');
      expect(unlocked?.title).toBe('Updated Title');
      expect(unlocked?.content).toBe('New Content');
    });

    it('rejects save with invalid drawer ID', async () => {
      const result = await saveDrawer('not-a-uuid', 'password123456', 'Title', 'Content');
      expect(result).toBe(false);
    });

    it('rejects save with password shorter than 8 characters', async () => {
      const drawer = await createDrawer('Test', 'password123456');
      const result = await saveDrawer(drawer.id, 'short', 'Title', 'Content');
      expect(result).toBe(false);
    });

    it('rejects save with non-existent drawer ID', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const result = await saveDrawer(fakeId, 'password123456', 'Title', 'Content');
      expect(result).toBe(false);
    });
  });

  describe('delete-drawer handler', () => {
    it('deletes an existing drawer', async () => {
      const drawer = await createDrawer('To Delete', 'password123456');
      const listBefore = await listDrawers();
      expect(listBefore).toHaveLength(1);

      const deleteResult = await deleteDrawer(drawer.id);
      expect(deleteResult).toBe(true);

      const listAfter = await listDrawers();
      expect(listAfter).toHaveLength(0);
    });

    it('rejects delete with invalid ID', async () => {
      const result = await deleteDrawer('not-a-uuid');
      expect(result).toBe(false);
    });

    it('rejects delete with non-existent drawer ID', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const result = await deleteDrawer(fakeId);
      expect(result).toBe(false);
    });
  });

  describe('export-drawer handler', () => {
    it('exports drawer as JSON string', async () => {
      const drawer = await createDrawer('Export Test', 'password123456');
      const exported = await readDrawerRaw(drawer.id);
      
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.id).toBe(drawer.id);
      expect(parsed.title).toBe('Export Test');
      expect(parsed.encryptedData).toBeDefined();
    });

    it('returns null for non-existent drawer', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const result = await readDrawerRaw(fakeId);
      expect(result).toBeNull();
    });

    it('returns null for invalid ID', async () => {
      const result = await readDrawerRaw('not-a-uuid');
      expect(result).toBeNull();
    });
  });

  describe('import-drawer handler', () => {
    it('imports drawer from JSON string', async () => {
      const original = await createDrawer('Original', 'password123456');
      const exported = await readDrawerRaw(original.id);

      await deleteDrawer(original.id);
      let drawers = await listDrawers();
      expect(drawers).toHaveLength(0);

      const imported = await importDrawerRaw(exported);
      expect(imported).toBe(true);

      drawers = await listDrawers();
      expect(drawers).toHaveLength(1);
      expect(drawers[0].id).toBe(original.id);
      expect(drawers[0].title).toBe('Original');
    });

    it('rejects import with invalid JSON', async () => {
      const result = await importDrawerRaw('invalid json');
      expect(result).toBe(false);
    });

    it('rejects import with malformed drawer', async () => {
      const malformed = JSON.stringify({ id: 'not-a-uuid', title: 'Bad' });
      const result = await importDrawerRaw(malformed);
      expect(result).toBe(false);
    });

    it('handles import of drawer with large content', async () => {
      const original = await createDrawer('Large', 'password123456');
      const largeContent = 'x'.repeat(100000);
      
      const saved = await saveDrawer(original.id, 'password123456', 'Large Drawer', largeContent);
      expect(saved).toBe(true);

      const exported = await readDrawerRaw(original.id);
      await deleteDrawer(original.id);

      const imported = await importDrawerRaw(exported);
      expect(imported).toBe(true);

      const unlocked = await unlockDrawer(original.id, 'password123456');
      expect(unlocked?.content).toBe(largeContent);
    });
  });

  describe('open-file-dialog handler simulation', () => {
    it('simulates file path validation via isValidId for drawer IDs', async () => {
      expect(isValidId('../../../etc/passwd')).toBe(false);
      expect(isValidId('/etc/passwd')).toBe(false);
      expect(isValidId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });
  });

  describe('IPC handler error handling', () => {
    it('handles concurrent drawer operations', async () => {
      const promises = [
        createDrawer('Drawer 1', 'password123456'),
        createDrawer('Drawer 2', 'password654321'),
        createDrawer('Drawer 3', 'passwordABCDEF'),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.map((d) => d.id)).toHaveLength(3);

      const drawers = await listDrawers();
      expect(drawers).toHaveLength(3);
    });

    it('preserves drawer data after save operations', async () => {
      const drawer = await createDrawer('Persistent', 'password123456');
      const originalId = drawer.id;

      await saveDrawer(drawer.id, 'password123456', 'Modified Title', 'Modified Content');
      await saveDrawer(drawer.id, 'password123456', 'Final Title', 'Final Content');

      const unlocked = await unlockDrawer(originalId, 'password123456');
      expect(unlocked?.title).toBe('Final Title');
      expect(unlocked?.content).toBe('Final Content');
    });
  });
});
