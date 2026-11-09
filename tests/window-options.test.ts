import { describe, it, expect } from 'vitest';
import { windowOptions, windowLoadTarget } from '../src/main/window-options';
import type { BrowserWindowConstructorOptions } from 'electron';

describe('windowOptions', () => {
  const dirname = '/app/dist/main';

  it('keeps the renderer isolated (sandbox, contextIsolation, nodeIntegration)', () => {
    const opts = windowOptions(false, dirname, 'linux');

    expect(opts.webPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    });
  });

  it('enables devTools only in development (unpackaged)', () => {
    const dev = windowOptions(false, dirname, 'linux') as BrowserWindowConstructorOptions;
    const prod = windowOptions(true, dirname, 'linux') as BrowserWindowConstructorOptions;

    expect(dev.webPreferences?.devTools).toBe(true);
    expect(prod.webPreferences?.devTools).toBe(false);
  });

  it('preload path is resolved relative to dirname', () => {
    const opts = windowOptions(false, dirname, 'linux') as BrowserWindowConstructorOptions;
    expect(opts.webPreferences?.preload).toBe('/app/dist/main/preload.js');
  });

  it('icon path is platform-specific', () => {
    const win = windowOptions(false, dirname, 'win32');
    const mac = windowOptions(false, dirname, 'darwin');
    const linux = windowOptions(false, dirname, 'linux');

    expect(win.icon).toContain('clavis.ico');
    expect(mac.icon).toContain('clavis.icns');
    expect(linux.icon).toContain('clavis.png');
    // path.join normalizes the '..' so the final path is /app/icons/...
    expect(win.icon).toBe('/app/icons/clavis.ico');
    expect(mac.icon).toBe('/app/icons/clavis.icns');
    expect(linux.icon).toBe('/app/icons/clavis.png');
  });

  it('windowLoadTarget returns file path when packaged, dev URL otherwise', () => {
    // path.join normalizes the path
    expect(windowLoadTarget(true, '/app/dist/main')).toBe('/app/dist/renderer/index.html');
    expect(windowLoadTarget(false, '/app/dist/main')).toBe('http://localhost:3000');
  });
});