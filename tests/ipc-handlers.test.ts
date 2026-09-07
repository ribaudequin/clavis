import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));

vi.mock('../src/main/store.js', () => ({
  listDrawers: vi.fn(),
  createDrawer: vi.fn(),
  unlockDrawer: vi.fn(),
  saveDrawer: vi.fn(),
  deleteDrawer: vi.fn(),
  readDrawerRaw: vi.fn(),
  importDrawerRaw: vi.fn(),
  ensureDataDir: vi.fn(),
}));

vi.mock('../src/main/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  initializeLogger: vi.fn(),
}));

vi.mock('fs/promises', () => {
  const actual = require('fs/promises');
  return {
    ...actual,
    default: actual,
    readFile: vi.fn(),
    lstat: vi.fn(),
  };
});

import { registerIpcHandlers, __resetAllowedImportPaths } from '../src/main/ipc-handlers';
import * as store from '../src/main/store';
import * as fsPromises from 'fs/promises';
import { ErrorCode, Result } from '../src/shared/types';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_UUID_2 = '123e4567-e89b-12d3-a456-426614174001';

type Handler = (...args: any[]) => Promise<Result<any>>;

let handlers: Map<string, Handler>;

beforeEach(() => {
  vi.clearAllMocks();
  __resetAllowedImportPaths();
  handlers = new Map<string, Handler>();
  registerIpcHandlers({
    ipcMain: {
      handle: (channel: string, fn: Handler) => {
        handlers.set(channel, fn);
      },
    },
    dialog: {
      showOpenDialog: vi.fn(),
    },
  });
});

function getHandler<T = any>(channel: string): T {
  const h = handlers.get(channel);
  if (!h) throw new Error(`Handler not registered: ${channel}`);
  return h as unknown as T;
}

describe('IPC handlers', () => {
  describe('list-drawers', () => {
    it('returns ok with data on success', async () => {
      const items = [{ id: VALID_UUID, title: 't', iconData: 'rgb(0,0,0)' }];
      vi.mocked(store.listDrawers).mockResolvedValue(items);

      const handler = getHandler<(e: any) => Promise<Result<typeof items>>>('list-drawers');
      const result = await handler({});

      expect(result).toEqual({ ok: true, data: items });
      expect(store.listDrawers).toHaveBeenCalledOnce();
    });

    it('returns FILE_NOT_FOUND error when store throws', async () => {
      vi.mocked(store.listDrawers).mockRejectedValue(new Error('boom'));

      const handler = getHandler<(e: any) => Promise<Result<any>>>('list-drawers');
      const result = await handler({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to list drawers');
      }
    });
  });

  describe('create-drawer', () => {
    it('returns ok with encrypted drawer on success', async () => {
      const drawer = { id: VALID_UUID, title: 'A', iconData: 'rgb(0,0,0)' } as any;
      vi.mocked(store.createDrawer).mockResolvedValue(drawer);

      const handler = getHandler<(e: any, t: string, p: string) => Promise<Result<any>>>('create-drawer');
      const result = await handler({}, 'My Drawer', 'password12345');

      expect(result).toEqual({ ok: true, data: drawer });
      expect(store.createDrawer).toHaveBeenCalledWith('My Drawer', 'password12345');
    });

    it('returns VALIDATION_ERROR on Zod failure (empty title)', async () => {
      const handler = getHandler<(e: any, t: string, p: string) => Promise<Result<any>>>('create-drawer');
      const result = await handler({}, '', 'password12345');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toBe('Title is required');
      }
      expect(store.createDrawer).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR on Zod failure (password too short)', async () => {
      const handler = getHandler<(e: any, t: string, p: string) => Promise<Result<any>>>('create-drawer');
      const result = await handler({}, 'Title', 'short');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.createDrawer).not.toHaveBeenCalled();
    });

    it('returns PASSWORD_TOO_SHORT when store throws with password message', async () => {
      vi.mocked(store.createDrawer).mockRejectedValue(new Error('Password must be at least 8 characters'));

      const handler = getHandler<(e: any, t: string, p: string) => Promise<Result<any>>>('create-drawer');
      const result = await handler({}, 'Title', 'whatever1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.PASSWORD_TOO_SHORT);
        expect(result.error.message).toBe('Password must be at least 8 characters');
      }
    });

    it('returns WRITE_FAILED on generic store error', async () => {
      vi.mocked(store.createDrawer).mockRejectedValue(new Error('disk full'));

      const handler = getHandler<(e: any, t: string, p: string) => Promise<Result<any>>>('create-drawer');
      const result = await handler({}, 'Title', 'password12345');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toBe('Failed to create drawer');
      }
    });
  });

  describe('unlock-drawer', () => {
    it('returns ok with content on success', async () => {
      const payload = { title: 'A', content: 'hello', iconData: 'rgb(0,0,0)' };
      vi.mocked(store.unlockDrawer).mockResolvedValue(payload);

      const handler = getHandler<(e: any, id: string, p: string) => Promise<Result<any>>>('unlock-drawer');
      const result = await handler({}, VALID_UUID, 'password12345');

      expect(result).toEqual({ ok: true, data: payload });
      expect(store.unlockDrawer).toHaveBeenCalledWith(VALID_UUID, 'password12345');
    });

    it('returns DECRYPT_FAILED with data:null mapped to error envelope when password wrong', async () => {
      vi.mocked(store.unlockDrawer).mockResolvedValue(null);

      const handler = getHandler<(e: any, id: string, p: string) => Promise<Result<any>>>('unlock-drawer');
      const result = await handler({}, VALID_UUID, 'wrong-password');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.DECRYPT_FAILED);
        expect(result.error.message).toBe('Incorrect password or drawer not found');
        expect(result.error.details).toBeUndefined();
      }
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler<(e: any, id: string, p: string) => Promise<Result<any>>>('unlock-drawer');
      const result = await handler({}, 'not-a-uuid', 'password12345');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.unlockDrawer).not.toHaveBeenCalled();
    });

    it('returns DECRYPT_FAILED when store throws', async () => {
      vi.mocked(store.unlockDrawer).mockRejectedValue(new Error('crypto broke'));

      const handler = getHandler<(e: any, id: string, p: string) => Promise<Result<any>>>('unlock-drawer');
      const result = await handler({}, VALID_UUID, 'password12345');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.DECRYPT_FAILED);
        expect(result.error.message).toBe('Failed to unlock drawer');
      }
    });
  });

  describe('save-drawer', () => {
    it('returns ok on success', async () => {
      vi.mocked(store.saveDrawer).mockResolvedValue(true);

      const handler = getHandler<(e: any, id: string, p: string, t: string, c: string) => Promise<Result<any>>>('save-drawer');
      const result = await handler({}, VALID_UUID, 'password12345', 'Title', 'content');

      expect(result).toEqual({ ok: true, data: undefined });
      expect(store.saveDrawer).toHaveBeenCalledWith(VALID_UUID, 'password12345', 'Title', 'content');
    });

    it('returns WRITE_FAILED with "invalid ID or password" when store returns false', async () => {
      vi.mocked(store.saveDrawer).mockResolvedValue(false);

      const handler = getHandler<(e: any, id: string, p: string, t: string, c: string) => Promise<Result<any>>>('save-drawer');
      const result = await handler({}, VALID_UUID, 'wrong-password', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toBe('Failed to save drawer (invalid ID or password)');
      }
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler<(e: any, id: string, p: string, t: string, c: string) => Promise<Result<any>>>('save-drawer');
      const result = await handler({}, 'bad', 'password12345', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.saveDrawer).not.toHaveBeenCalled();
    });

    it('returns WRITE_FAILED when store throws', async () => {
      vi.mocked(store.saveDrawer).mockRejectedValue(new Error('io error'));

      const handler = getHandler<(e: any, id: string, p: string, t: string, c: string) => Promise<Result<any>>>('save-drawer');
      const result = await handler({}, VALID_UUID, 'password12345', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toBe('Failed to save drawer');
      }
    });
  });

  describe('delete-drawer', () => {
    it('returns ok on success', async () => {
      vi.mocked(store.deleteDrawer).mockResolvedValue(true);

      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('delete-drawer');
      const result = await handler({}, VALID_UUID);

      expect(result).toEqual({ ok: true, data: undefined });
    });

    it('returns FILE_NOT_FOUND when store returns false', async () => {
      vi.mocked(store.deleteDrawer).mockResolvedValue(false);

      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('delete-drawer');
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to delete drawer (invalid ID or drawer not found)');
      }
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('delete-drawer');
      const result = await handler({}, 'not-a-uuid');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.deleteDrawer).not.toHaveBeenCalled();
    });

    it('returns WRITE_FAILED when store throws', async () => {
      vi.mocked(store.deleteDrawer).mockRejectedValue(new Error('disk error'));

      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('delete-drawer');
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
      }
    });
  });

  describe('export-drawer', () => {
    it('returns ok with raw json string on success', async () => {
      const raw = '{"id":"x","title":"t"}';
      vi.mocked(store.readDrawerRaw).mockResolvedValue(raw);

      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('export-drawer');
      const result = await handler({}, VALID_UUID);

      expect(result).toEqual({ ok: true, data: raw });
    });

    it('returns FILE_NOT_FOUND when store returns null', async () => {
      vi.mocked(store.readDrawerRaw).mockResolvedValue(null);

      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('export-drawer');
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Drawer not found');
      }
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('export-drawer');
      const result = await handler({}, 'not-a-uuid');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.readDrawerRaw).not.toHaveBeenCalled();
    });

    it('returns WRITE_FAILED when store throws', async () => {
      vi.mocked(store.readDrawerRaw).mockRejectedValue(new Error('eio'));

      const handler = getHandler<(e: any, id: string) => Promise<Result<any>>>('export-drawer');
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
      }
    });
  });

  describe('open-file-dialog', () => {
    it('returns ok with data:null when user cancels (no file selected)', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: [] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });

      const result = await handlers.get('open-file-dialog')!({});
      expect(result).toEqual({ ok: true, data: null });
      expect(showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: [{ name: 'Clavis Drawers', extensions: ['clavis'] }],
      });
    });

    it('returns ok with token and fileName on valid selection', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/home/user/secret.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });

      const result = await handlers.get('open-file-dialog')!({});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).not.toBeNull();
        expect(result.data!.fileName).toBe('secret.clavis');
        expect(result.data!.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }
      expect(showOpenDialog).toHaveBeenCalledOnce();
    });

    it('returns FILE_NOT_FOUND error when dialog throws', async () => {
      const showOpenDialog = vi.fn().mockRejectedValue(new Error('dialog crash'));
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });

      const result = await handlers.get('open-file-dialog')!({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to open file dialog');
      }
    });
  });

  describe('import-drawer', () => {
    beforeEach(() => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: [] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });
      vi.mocked(fsPromises.lstat as any).mockResolvedValue({ isSymbolicLink: () => false });
    });

    it('returns VALIDATION_ERROR for non-uuid token', async () => {
      const handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const result = await handler({}, 'not-a-uuid');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('returns VALIDATION_ERROR "Invalid or expired import token" for unknown uuid token', async () => {
      const handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toBe('Invalid or expired import token');
      }
      expect(fsPromises.readFile).not.toHaveBeenCalled();
    });

    it('returns ok after successful import and consumes token (one-shot)', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/import.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });
      const dialogResult = await handlers.get('open-file-dialog')!({});
      expect(dialogResult.ok).toBe(true);
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      vi.mocked(fsPromises.readFile as any).mockResolvedValue('{"id":"x","title":"t","iconData":"i","createdAt":0,"updatedAt":0,"encryptedData":"e","salt":"s","iv":"i","authTag":"a","keyDerivation":{"algorithm":"x","iterations":1,"memory":1,"parallelism":1}}');
      vi.mocked(store.importDrawerRaw).mockResolvedValue(true);

      const handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const result = await handler({}, token);

      expect(result).toEqual({ ok: true, data: undefined });
      expect(fsPromises.readFile).toHaveBeenCalledWith('/tmp/import.clavis', 'utf8');
      expect(store.importDrawerRaw).toHaveBeenCalledOnce();

      const replay = await handler({}, token);
      expect(replay.ok).toBe(false);
      if (!replay.ok) {
        expect(replay.error.message).toBe('Invalid or expired import token');
      }
    });

    it('returns INVALID_JSON when importDrawerRaw returns false', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/bad.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });
      const dialogResult = await handlers.get('open-file-dialog')!({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      vi.mocked(fsPromises.readFile as any).mockResolvedValue('garbage');
      vi.mocked(store.importDrawerRaw).mockResolvedValue(false);

      const handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.INVALID_JSON);
        expect(result.error.message).toBe('Failed to import drawer (invalid file format)');
      }
    });

    it('returns FILE_NOT_FOUND when fs.readFile throws', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/missing.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });
      const dialogResult = await handlers.get('open-file-dialog')!({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      vi.mocked(fsPromises.readFile as any).mockRejectedValue(new Error('ENOENT'));

      const handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to read import file');
      }
    });

    it('strips exception details from import error envelope (details === undefined)', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/leak.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });
      const dialogResult = await handlers.get('open-file-dialog')!({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      vi.mocked(fsPromises.readFile as any).mockRejectedValue(
        new Error('read failed: file contents leaked into message')
      );

      const handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.details).toBeUndefined();
      }
    });

    it('returns VALIDATION_ERROR "Refusing to import a symbolic link" when file is a symlink', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/link.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });
      const dialogResult = await handlers.get('open-file-dialog')!({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      vi.mocked(fsPromises.lstat as any).mockResolvedValue({ isSymbolicLink: () => true });

      const handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toBe('Refusing to import a symbolic link');
      }
      expect(fsPromises.readFile).not.toHaveBeenCalled();
      expect(store.importDrawerRaw).not.toHaveBeenCalled();
    });
  });

  describe('handler registration', () => {
    it('registers all 8 expected channels', () => {
      const expected = [
        'list-drawers',
        'create-drawer',
        'unlock-drawer',
        'save-drawer',
        'delete-drawer',
        'export-drawer',
        'open-file-dialog',
        'import-drawer',
      ];
      for (const channel of expected) {
        expect(handlers.has(channel), `missing handler for ${channel}`).toBe(true);
      }
      expect(handlers.size).toBe(expected.length);
    });
  });

  describe('Result envelope', () => {
    it('always returns either ok:true with data or ok:false with structured error', async () => {
      vi.mocked(store.listDrawers).mockRejectedValue(new Error('x'));
      const handler = getHandler<(e: any) => Promise<Result<any>>>('list-drawers');
      const result = await handler({});
      expect('ok' in result).toBe(true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(Object.values(ErrorCode)).toContain(result.error.code);
      }
    });
  });

  describe('token whitelist (allowedImportPaths)', () => {
    it('__resetAllowedImportPaths clears the whitelist', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/a.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (ch: string, fn: Handler) => handlers.set(ch, fn) },
        dialog: { showOpenDialog },
      });
      const dlgResult = await handlers.get('open-file-dialog')!({});
      if (!dlgResult.ok) throw new Error('expected ok');
      const token = dlgResult.data!.token;

      let handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      vi.mocked(fsPromises.readFile as any).mockResolvedValue('{}');
      vi.mocked(store.importDrawerRaw).mockResolvedValue(true);
      await handler({}, token);

      __resetAllowedImportPaths();
      handler = getHandler<(e: any, t: string) => Promise<Result<any>>>('import-drawer');
      const replay = await handler({}, VALID_UUID_2);
      expect(replay.ok).toBe(false);
      if (!replay.ok) {
        expect(replay.error.message).toBe('Invalid or expired import token');
      }
    });
  });
});