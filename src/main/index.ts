import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
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
} from './store';
import {
  CreateDrawerSchema,
  UnlockDrawerSchema,
  SaveDrawerSchema,
  DeleteDrawerSchema,
  ExportDrawerSchema,
  ImportDrawerSchema,
} from './validation';

let mainWindow: BrowserWindow | null = null;
const allowedImportPaths = new Map<string, string>();

function createCreditsWindow(): void {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(true);
  }
  const creditsWindow = new BrowserWindow({
    width: 380,
    height: 300,
    parent: mainWindow || undefined,
    modal: true,
    titleBarStyle: 'default',
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  creditsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'credits.html'));

  creditsWindow.on('closed', () => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(false);
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, '..', 'icons', 'linux', '512x512.png'),
    resizable: true,
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());
}

function handleIPC(): void {
  ipcMain.handle('list-drawers', async () => await listDrawers());

  ipcMain.handle('create-drawer', async (_e, title: string, password: string) => {
    try {
      const validated = CreateDrawerSchema.parse({ title, password });
      return await createDrawer(validated.title, validated.password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error('create-drawer validation failed:', e.issues);
      }
      return null;
    }
  });

  ipcMain.handle('unlock-drawer', async (_e, id: string, password: string) => {
    try {
      const validated = UnlockDrawerSchema.parse({ id, password });
      return await unlockDrawer(validated.id, validated.password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error('unlock-drawer validation failed:', e.issues);
      }
      return null;
    }
  });

  ipcMain.handle('save-drawer', async (_e, id: string, password: string, title: string, content: string) => {
    try {
      const validated = SaveDrawerSchema.parse({ id, password, title, content });
      return await saveDrawer(validated.id, validated.password, validated.title, validated.content);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error('save-drawer validation failed:', e.issues);
      }
      return false;
    }
  });

  ipcMain.handle('delete-drawer', async (_e, id: string) => {
    try {
      const validated = DeleteDrawerSchema.parse({ id });
      return await deleteDrawer(validated.id);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error('delete-drawer validation failed:', e.issues);
      }
      return false;
    }
  });

  ipcMain.handle('export-drawer', async (_e, id: string) => {
    try {
      const validated = ExportDrawerSchema.parse({ id });
      return readDrawerRaw(validated.id);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error('export-drawer validation failed:', e.issues);
      }
      return null;
    }
  });

  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Clavis Drawers', extensions: ['clavis'] }],
    });
    const filePath = result.filePaths[0];
    if (!filePath) return null;

    const token = randomUUID();
    allowedImportPaths.set(token, filePath);

    setTimeout(() => allowedImportPaths.delete(token), 5 * 60 * 1000);

    return { token, fileName: path.basename(filePath) };
  });

  ipcMain.handle('import-drawer', async (_e, token: string) => {
    try {
      const validated = ImportDrawerSchema.parse({ token });
      const filePath = allowedImportPaths.get(validated.token);
      if (!filePath) {
        console.error('import-drawer: invalid or expired token');
        return false;
      }

      allowedImportPaths.delete(validated.token);

      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        return importDrawerRaw(fileContent);
      } catch (e) {
        console.error('import-drawer read failed', e);
        return false;
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error('import-drawer validation failed:', e.issues);
      }
      return false;
    }
  });
}

app.whenReady().then(async () => {
  await ensureDataDir();
  Menu.setApplicationMenu(null);
  createWindow();
  handleIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
