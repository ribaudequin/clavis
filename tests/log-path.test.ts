// B2 (PLANO-E2E-3-SISTEMAS-2026-10-21) — The log has to follow the profile.
//
// The e2e suite launches the app with `--user-data-dir=<throwaway profile>` and
// then asks the running app where its log is (`app.getPath('logs')`). Electron's
// default log directory is inside `userData` on Linux and Windows, but at
// `~/Library/Logs/<app name>` on macOS — so without the relocation the macOS log
// escapes the throwaway profile and lands in a file shared by every Clavis
// process on the machine, which is the file `single-instance.spec.ts` counts
// lines in.
//
// The subject is the real startup path (`src/main/index.ts`); the fake `app`
// models the one Electron behaviour that matters — `setAppLogsPath()` moves the
// log directory (Electron 44's `SetAppLogsPath` overrides the `DIR_APP_LOGS`
// path service, which is the very one `getPath('logs')` reads). Everything else
// about Electron is stubbed out: this file is about the decision, not about
// Electron.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';

const electron = vi.hoisted(() => {
  // macOS's default, deliberately outside the profile: the case the relocation
  // exists for. On Linux and Windows the default is `<userData>/logs` already.
  const DEFAULT_LOGS_DIR = '/home/tester/Library/Logs/clavis';
  const PROFILE_DIR = '/tmp/clavis-e2e-profile';

  const state = {
    /** The `userData` directory the app was launched with. */
    profileDir: PROFILE_DIR,
    /** Where the logs are right now. */
    logsDir: DEFAULT_LOGS_DIR,
    /** Whether the app was launched with `--user-data-dir`. */
    hasUserDataDirSwitch: true,
    setAppLogsPathCalls: [] as string[],
    setAppLogsPathThrows: false,
  };

  const app = {
    commandLine: {
      hasSwitch: vi.fn((name: string) => name === 'user-data-dir' && state.hasUserDataDirSwitch),
    },
    getPath: vi.fn((name: string) => {
      if (name === 'logs') return state.logsDir;
      if (name === 'userData') return state.profileDir;
      return '/tmp';
    }),
    setAppLogsPath: vi.fn((dir: string) => {
      if (state.setAppLogsPathThrows) throw new TypeError('Path must be absolute');
      state.setAppLogsPathCalls.push(dir);
      state.logsDir = dir;
    }),
    requestSingleInstanceLock: vi.fn(() => true),
    on: vi.fn(),
    quit: vi.fn(),
    getVersion: vi.fn(() => '0.0.0-test'),
    isPackaged: false,
    // Never resolves: this file is about the startup path, and a ready app
    // would open a window over the test runner.
    whenReady: vi.fn(() => new Promise<void>(() => {})),
  };

  return { state, app, DEFAULT_LOGS_DIR, PROFILE_DIR };
});

vi.mock('electron', () => ({
  app: electron.app,
  BrowserWindow: class {
    webContents = { on: vi.fn(), setWindowOpenHandler: vi.fn() };
    loadFile = vi.fn();
    loadURL = vi.fn();
    static getAllWindows = vi.fn(() => []);
  },
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openExternal: vi.fn() },
  Menu: { setApplicationMenu: vi.fn(), buildFromTemplate: vi.fn(() => []) },
}));

// The real logger resolves the log directory when it is initialized
// (`path.join(app.getPath('logs'), 'Clavis')`), so the fake records the
// directory it was handed: that is what says whether the app had already moved
// the log by the time the logger looked. The order of the two calls is the
// contract — the logger takes the directory once, at startup.
const loggerMock = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  /** The log directory the logger saw when it was initialized. */
  logsDirAtInit: '',
}));

vi.mock('../src/main/logger.js', () => ({
  logger: loggerMock.logger,
  initializeLogger: vi.fn(() => {
    loggerMock.logsDirAtInit = electron.app.getPath('logs');
  }),
}));

// The store and the IPC handlers are not part of this decision; stubbing them
// keeps the startup path from touching the disk.
vi.mock('../src/main/store.js', () => ({ ensureDataDir: vi.fn() }));
vi.mock('../src/main/ipc-handlers.js', () => ({
  registerIpcHandlers: vi.fn(),
  clearImportTimers: vi.fn(),
}));

/** Runs the real startup path, with a fresh module registry. */
async function startApp(): Promise<void> {
  vi.resetModules();
  await import('../src/main/index');
}

beforeEach(() => {
  vi.clearAllMocks();
  electron.state.profileDir = electron.PROFILE_DIR;
  electron.state.logsDir = electron.DEFAULT_LOGS_DIR;
  electron.state.hasUserDataDirSwitch = true;
  electron.state.setAppLogsPathCalls = [];
  electron.state.setAppLogsPathThrows = false;
  loggerMock.logsDirAtInit = '';
});

describe('B2 — the log follows the profile', () => {
  it('moves the log into the userData profile when the profile was relocated', async () => {
    electron.state.hasUserDataDirSwitch = true;

    await startApp();

    expect(electron.state.setAppLogsPathCalls).toEqual([
      path.join(electron.PROFILE_DIR, 'logs'),
    ]);
    // The directory the logger resolved: inside the throwaway profile, so the
    // log belongs to this run alone. The logger takes the directory once, at
    // startup, so this also says the move happened before the logger looked.
    expect(loggerMock.logsDirAtInit).toBe(path.join(electron.PROFILE_DIR, 'logs'));
  });

  it('leaves the log alone when the app runs on the real profile', async () => {
    electron.state.hasUserDataDirSwitch = false;

    await startApp();

    expect(electron.state.setAppLogsPathCalls).toEqual([]);
    expect(loggerMock.logsDirAtInit).toBe(electron.DEFAULT_LOGS_DIR);
  });

  it('starts anyway when the log cannot be moved, and says so', async () => {
    // Electron throws from `setAppLogsPath()` when the path is not absolute
    // (Electron 44's `SetAppLogsPath`). A failure to relocate the log must not
    // take the app down with it.
    electron.state.setAppLogsPathThrows = true;

    await expect(startApp()).resolves.toBeUndefined();

    // The log stays where Electron put it, and the failure is reported instead
    // of swallowed.
    expect(loggerMock.logsDirAtInit).toBe(electron.DEFAULT_LOGS_DIR);
    expect(loggerMock.logger.warn).toHaveBeenCalled();
  });
});
