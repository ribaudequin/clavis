import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';

import * as path from 'path';
import { ensureDataDir } from './store.js';
import { registerIpcHandlers, clearImportTimers } from './ipc-handlers.js';
import { logger, initializeLogger } from './logger.js';
import { acquireSingleInstanceLock } from './single-instance.js';

let mainWindow: BrowserWindow | null = null;

// The log has to follow the profile. Electron's default log directory sits
// inside `userData` on Linux and Windows, but at `~/Library/Logs/<app name>` on
// macOS — Electron 44's own `setAppLogsPath()` documentation says so — so under
// `--user-data-dir=<profile>` the log would land outside the throwaway profile,
// in a file shared by every Clavis process on the machine, and the e2e specs
// would read whichever process wrote there last.
// `app.setAppLogsPath()` overrides the same path service that
// `app.getPath('logs')` reads, so the log stays where the app says it is and the
// specs — which ask the running app — cannot disagree with it. On Linux and
// Windows the resolved path is the one Electron already reports
// (`<userData>/logs`), so this changes nothing there.
let logRelocationError: string | null = null;
if (app.commandLine.hasSwitch('user-data-dir')) {
  try {
    app.setAppLogsPath(path.join(app.getPath('userData'), 'logs'));
  } catch (e) {
    // A failure here must never stop the app from starting: the log simply
    // stays where Electron put it.
    logRelocationError = e instanceof Error ? e.message : String(e);
  }
}

// SEC-09 — The logger is initialized here instead of inside the ready handler
// because the "another instance is already running" line is written before the
// app is ready, and electron-log writes to its own default location until
// `initializeLogger()` points the file transport at the project's log file.
// `app.getPath('logs')` carries no "must be called after ready" restriction in
// the Electron API, and it was measured to return the same path before and
// after ready on Electron 44 — so resolving it this early is safe.
initializeLogger();

// Reported here and not inside the catch above: `logger.warn` is only safe
// once `initializeLogger()` has pointed the file transport at the log file.
if (logRelocationError) {
  logger.warn('Could not move the log directory into the userData profile', {
    error: logRelocationError,
  });
}

// The lock has to be requested at module scope, before `app.whenReady()` and
// before any window exists: two processes that both passed this point would
// each create a window over the same `userData` directory, and `saveDrawer` is
// a read-modify-write with no lock of its own, so the second write would
// silently discard the first (SEC-09). Electron's own documented pattern is
// the same shape — request the lock at startup, quit immediately if it is
// refused, and let the primary instance carry on loading.
const isPrimaryInstance = acquireSingleInstanceLock({
  app,
  getWindow: () => mainWindow,
});


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
    // The window icon, from the same trio the packager uses: `icons/clavis.png`,
    // `icons/clavis.ico` and `icons/clavis.icns` sit side by side with the same
    // basename because the packager resolves the platform's format by rewriting
    // the extension in place (see tests/packaging-icon.test.ts).
    //
    // TWO levels up, not one. The main process runs from `<app root>/dist/main`
    // — in development and inside the packaged app alike — and the icons sit at
    // `<app root>/icons`, a sibling of `dist`, because the packager's `ignore`
    // rule keeps `icons` at the app root rather than under `dist`. One `..`
    // resolved to `<app root>/dist/icons`, which does not exist: the path was
    // wrong in development and in the packaged app, and the option was silently
    // ignored, leaving the window with Electron's default icon. Measured, not
    // assumed: a PNG loaded from inside the asar returns a 512×512 image, and
    // the same load from the wrong path returns an empty one.
    icon: (() => {
      const platform = process.platform;
      if (platform === 'win32') {
        return path.join(__dirname, '..', '..', 'icons', 'clavis.ico');
      }
      if (platform === 'darwin') {
        return path.join(__dirname, '..', '..', 'icons', 'clavis.icns');
      }
      return path.join(__dirname, '..', '..', 'icons', 'clavis.png');
    })(),
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

  // Context menu (cut/copy/paste) — global for all text inputs
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut', label: 'Cut', enabled: params.editFlags.canCut },
      { role: 'copy', label: 'Copy', enabled: params.editFlags.canCopy },
      { role: 'paste', label: 'Paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', label: 'Select All', enabled: params.editFlags.canSelectAll },
    ]);
    const win = mainWindow;
    if (win) {
      menu.popup({ window: win });
    }
  });
}

if (!isPrimaryInstance) {
  // Another instance already owns this `userData` directory. Say so in the
  // project's log file and leave without touching a single drawer: the whole
  // point of the lock is that this process never opens the store, never
  // registers the IPC handlers and never creates a window.
  logger.info('Another instance is already running — this one exits', {
    version: app.getVersion(),
    platform: process.platform,
  });
  app.quit();
} else {
  app.whenReady().then(async () => {
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
  });
}

app.on('window-all-closed', () => {
  logger.info('Clavis shutdown', {});
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  clearImportTimers();
});

app.on('activate', () => {
  // The process that lost the lock race quits as soon as it knows it lost it;
  // without this guard a late `activate` (a macOS dock click) could still open
  // a window in that process — a window with no IPC handlers behind it,
  // because the startup sequence never ran there.
  if (!isPrimaryInstance) return;
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
