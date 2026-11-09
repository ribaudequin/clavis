import * as path from 'path';
import type { BrowserWindowConstructorOptions } from 'electron';

/**
 * Pure, testable window options factory.
 *
 * Extracted from `src/main/index.ts` so the security-critical webPreferences
 * (sandbox, contextIsolation, nodeIntegration) can be unit-tested without
 * launching Electron.
 */
export function windowOptions(
  isPackaged: boolean,
  dirname: string,
  platform: NodeJS.Platform
): BrowserWindowConstructorOptions {
  const iconPath = ((): string => {
    if (platform === 'win32') {
      return path.join(dirname, '..', '..', 'icons', 'clavis.ico');
    }
    if (platform === 'darwin') {
      return path.join(dirname, '..', '..', 'icons', 'clavis.icns');
    }
    return path.join(dirname, '..', '..', 'icons', 'clavis.png');
  })();

  return {
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !isPackaged,
      preload: path.join(dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    icon: iconPath,
    resizable: true,
  };
}

/** The URL or file path the main window should load. */
export function windowLoadTarget(isPackaged: boolean, dirname: string): string {
  if (isPackaged) {
    return path.join(dirname, '..', 'renderer', 'index.html');
  }
  return 'http://localhost:3000';
}