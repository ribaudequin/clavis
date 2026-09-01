import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ensureDataDir,
  listDrawers,
  createDrawer,
  unlockDrawer,
  saveDrawer,
  deleteDrawer,
  readDrawerRaw,
  importDrawerRaw,
  isValidId,
} from './store';

let mainWindow: BrowserWindow | null = null;

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
  ipcMain.handle('create-drawer', async (_e, title: string, password: string) =>
    await createDrawer(title, password)
  );
  ipcMain.handle('unlock-drawer', async (_e, id: string, password: string) =>
    await unlockDrawer(id, password)
  );
  ipcMain.handle('save-drawer', async (_e, id: string, password: string, title: string, content: string) =>
    await saveDrawer(id, password, title, content)
  );
  ipcMain.handle('delete-drawer', async (_e, id: string) =>
    await deleteDrawer(id)
  );
  ipcMain.handle('export-drawer', async (_e, id: string) => {
    return readDrawerRaw(id);
  });
  ipcMain.handle('import-drawer', async (_e, filePath: string) => {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      return importDrawerRaw(fileContent);
    } catch (e) { console.error('import-drawer read failed', e); return false; }
  });
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Clavis Drawers', extensions: ['clavis'] }],
    });
    return result.filePaths[0] || null;
  });
}

app.whenReady().then(async () => {
  await ensureDataDir();
  createWindow();
  handleIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
