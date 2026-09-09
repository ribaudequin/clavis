import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { ensureDataDir } from './store.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { logger, initializeLogger } from './logger.js';

let mainWindow: BrowserWindow | null = null;

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

  creditsWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  creditsWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  creditsWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());

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

app.whenReady().then(async () => {
  initializeLogger();
  logger.info('Clavis started', { version: app.getVersion(), platform: process.platform, arch: process.arch });
  // Non-fatal check: argon2 native may be unavailable on cross-built Windows artifacts
  try {
    const { isArgon2Available, getArgon2LoadError } = await import('./encryption.js');
    if (!isArgon2Available()) {
      const err = getArgon2LoadError();
      logger.warn('Running with scrypt fallback — argon2 native unavailable', {
        error: err?.message,
      });
    }
  } catch (e) {
    logger.error('Failed to check argon2 availability', { error: e instanceof Error ? e.message : String(e) });
  }
  await ensureDataDir();
  Menu.setApplicationMenu(null);
  registerIpcHandlers({ ipcMain, dialog });
  createWindow();

  // Auto-updater (GitHub Releases endpoint)
  if (app.isPackaged) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'ribaudequin',
      repo: 'clavis',
    });
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      logger.warn('Auto-updater check failed', { error: err instanceof Error ? err.message : String(err) });
    });
  }
});

app.on('window-all-closed', () => {
  logger.info('Clavis shutdown', {});
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});