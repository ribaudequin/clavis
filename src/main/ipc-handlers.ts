import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { z } from 'zod';
import {
  ensureDataDir,
  listDrawers,
  createDrawer,
  unlockDrawer,
  saveDrawer,
  deleteDrawer,
  readDrawerRaw,
  importDrawerRaw,
} from './store.js';
import {
  CreateDrawerSchema,
  UnlockDrawerSchema,
  SaveDrawerSchema,
  DeleteDrawerSchema,
  ExportDrawerSchema,
  ImportDrawerSchema,
} from './validation.js';
import { Result, ErrorCode, DrawerListItem, EncryptedDrawer } from '../shared/types.js';
import { CHANNELS } from '../shared/channels.js';
import { logger } from './logger.js';

const allowedImportPaths = new Map<string, string>();

export function __resetAllowedImportPaths(): void {
  allowedImportPaths.clear();
}

export interface IpcDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain: { handle: (channel: string, fn: (...args: any[]) => any) => void };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dialog: any;
}

export function registerIpcHandlers(deps: IpcDeps): void {
  const { ipcMain, dialog } = deps;

  ipcMain.handle(CHANNELS.LIST_DRAWERS, async (): Promise<Result<DrawerListItem[]>> => {
    try {
      logger.debug('IPC handler called', { handler: 'list-drawers' });
      const data = await listDrawers();
      logger.info('Drawers listed', { count: data.length });
      return { ok: true, data };
    } catch (e) {
      logger.error('list-drawers failed', { error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.FILE_NOT_FOUND,
          message: 'Failed to list drawers',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.CREATE_DRAWER, async (_e, title: string, password: string): Promise<Result<EncryptedDrawer>> => {
    try {
      logger.debug('IPC handler called', { handler: 'create-drawer', title });
      const validated = CreateDrawerSchema.parse({ title, password });
      const data = await createDrawer(validated.title, validated.password);
      logger.info('Drawer created', { id: data.id, title: data.title });
      return { ok: true, data };
    } catch (e) {
      if (e instanceof z.ZodError) {
        logger.warn('create-drawer validation failed', { issues: e.issues.length });
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: e.issues[0]?.message || 'Validation failed',
            details: e.issues,
          },
        };
      }
      if (e instanceof Error && e.message.includes('Password must be at least 8 characters')) {
        logger.warn('create-drawer password too short', {});
        return {
          ok: false,
          error: {
            code: ErrorCode.PASSWORD_TOO_SHORT,
            message: 'Password must be at least 8 characters',
            details: e,
          },
        };
      }
      logger.error('create-drawer failed', { error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.WRITE_FAILED,
          message: 'Failed to create drawer',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.UNLOCK_DRAWER, async (_e, id: string, password: string): Promise<Result<{ title: string; content: string; iconData: string } | null>> => {
    try {
      logger.debug('IPC handler called', { handler: 'unlock-drawer', id });
      const validated = UnlockDrawerSchema.parse({ id, password });
      const data = await unlockDrawer(validated.id, validated.password);
      if (data === null) {
        logger.warn('Unlock failed: incorrect password or drawer not found', { id });
        return {
          ok: false,
          error: {
            code: ErrorCode.DECRYPT_FAILED,
            message: 'Incorrect password or drawer not found',
          },
        };
      }
      logger.info('Drawer unlocked', { id });
      return { ok: true, data };
    } catch (e) {
      if (e instanceof z.ZodError) {
        logger.warn('unlock-drawer validation failed', { issues: e.issues.length });
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: e.issues[0]?.message || 'Validation failed',
            details: e.issues,
          },
        };
      }
      logger.error('unlock-drawer failed', { id, error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.DECRYPT_FAILED,
          message: 'Failed to unlock drawer',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.SAVE_DRAWER, async (_e, id: string, password: string, title: string, content: string): Promise<Result<void>> => {
    try {
      logger.debug('IPC handler called', { handler: 'save-drawer', id });
      const validated = SaveDrawerSchema.parse({ id, password, title, content });
      const success = await saveDrawer(validated.id, validated.password, validated.title, validated.content);
      if (!success) {
        logger.warn('Save failed: invalid ID or password', { id });
        return {
          ok: false,
          error: {
            code: ErrorCode.WRITE_FAILED,
            message: 'Failed to save drawer (invalid ID or password)',
          },
        };
      }
      logger.info('Drawer saved', { id });
      return { ok: true, data: undefined };
    } catch (e) {
      if (e instanceof z.ZodError) {
        logger.warn('save-drawer validation failed', { issues: e.issues.length });
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: e.issues[0]?.message || 'Validation failed',
            details: e.issues,
          },
        };
      }
      logger.error('save-drawer failed', { id, error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.WRITE_FAILED,
          message: 'Failed to save drawer',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.DELETE_DRAWER, async (_e, id: string): Promise<Result<void>> => {
    try {
      logger.debug('IPC handler called', { handler: 'delete-drawer', id });
      const validated = DeleteDrawerSchema.parse({ id });
      const success = await deleteDrawer(validated.id);
      if (!success) {
        logger.warn('Delete failed: invalid ID or drawer not found', { id });
        return {
          ok: false,
          error: {
            code: ErrorCode.FILE_NOT_FOUND,
            message: 'Failed to delete drawer (invalid ID or drawer not found)',
          },
        };
      }
      logger.info('Drawer deleted', { id });
      return { ok: true, data: undefined };
    } catch (e) {
      if (e instanceof z.ZodError) {
        logger.warn('delete-drawer validation failed', { issues: e.issues.length });
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: e.issues[0]?.message || 'Validation failed',
            details: e.issues,
          },
        };
      }
      logger.error('delete-drawer failed', { id, error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.WRITE_FAILED,
          message: 'Failed to delete drawer',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.EXPORT_DRAWER, async (_e, id: string): Promise<Result<string>> => {
    try {
      logger.debug('IPC handler called', { handler: 'export-drawer', id });
      const validated = ExportDrawerSchema.parse({ id });
      const data = await readDrawerRaw(validated.id);
      if (!data) {
        logger.warn('Export failed: drawer not found', { id });
        return {
          ok: false,
          error: {
            code: ErrorCode.FILE_NOT_FOUND,
            message: 'Drawer not found',
          },
        };
      }
      logger.info('Drawer exported', { id });
      return { ok: true, data };
    } catch (e) {
      if (e instanceof z.ZodError) {
        logger.warn('export-drawer validation failed', { issues: e.issues.length });
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: e.issues[0]?.message || 'Validation failed',
            details: e.issues,
          },
        };
      }
      logger.error('export-drawer failed', { id, error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.WRITE_FAILED,
          message: 'Failed to export drawer',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.OPEN_FILE_DIALOG, async (): Promise<Result<{ token: string; fileName: string } | null>> => {
    try {
      logger.debug('IPC handler called', { handler: 'open-file-dialog' });
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Clavis Drawers', extensions: ['clavis'] }],
      });
      const filePath = result.filePaths[0];
      if (!filePath) {
        logger.debug('File dialog cancelled', {});
        return { ok: true, data: null };
      }

      const token = randomUUID();
      allowedImportPaths.set(token, filePath);

      setTimeout(() => allowedImportPaths.delete(token), 5 * 60 * 1000);

      logger.debug('File dialog completed', { fileName: path.basename(filePath) });
      return { ok: true, data: { token, fileName: path.basename(filePath) } };
    } catch (e) {
      logger.error('open-file-dialog failed', { error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.FILE_NOT_FOUND,
          message: 'Failed to open file dialog',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.IMPORT_DRAWER, async (_e, token: string): Promise<Result<void>> => {
    try {
      logger.debug('IPC handler called', { handler: 'import-drawer' });
      const validated = ImportDrawerSchema.parse({ token });
      const filePath = allowedImportPaths.get(validated.token);
      if (!filePath) {
        logger.warn('import-drawer: invalid or expired token', {});
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid or expired import token',
          },
        };
      }

      allowedImportPaths.delete(validated.token);

      try {
        const stat = await fs.lstat(filePath);
        if (stat.isSymbolicLink()) {
          logger.warn('import-drawer: refusing symlink', { fileName: path.basename(filePath) });
          return {
            ok: false,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: 'Refusing to import a symbolic link',
            },
          };
        }
        const fileContent = await fs.readFile(filePath, 'utf8');
        const success = await importDrawerRaw(fileContent);
        if (!success) {
          logger.warn('import-drawer: invalid file format', {});
          return {
            ok: false,
            error: {
              code: ErrorCode.INVALID_JSON,
              message: 'Failed to import drawer (invalid file format)',
            },
          };
        }
        logger.info('Drawer imported', { fileName: path.basename(filePath) });
        return { ok: true, data: undefined };
      } catch (e) {
        logger.error('import-drawer read failed', { error: e instanceof Error ? e.message : String(e) });
        return {
          ok: false,
          error: {
            code: ErrorCode.FILE_NOT_FOUND,
            message: 'Failed to read import file',
            details: undefined,
          },
        };
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        logger.warn('import-drawer validation failed', { issues: e.issues.length });
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: e.issues[0]?.message || 'Validation failed',
            details: e.issues,
          },
        };
      }
      logger.error('import-drawer failed', { error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.WRITE_FAILED,
          message: 'Failed to import drawer',
          details: e,
        },
      };
    }
  });

  ipcMain.handle(CHANNELS.RESTART_APP, async (): Promise<Result<void>> => {
    try {
      logger.info('Restart requested via IPC', {});
      setImmediate(() => app.quit());
      return { ok: true, data: undefined };
    } catch (e) {
      logger.error('restart-app failed', { error: e instanceof Error ? e.message : String(e) });
      return {
        ok: false,
        error: {
          code: ErrorCode.WRITE_FAILED,
          message: 'Failed to restart app',
        },
      };
    }
  });
}