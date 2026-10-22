import { session } from 'electron';
import { CHANNELS } from '../shared/channels.js';
import { logger } from './logger.js';
import type { DownloadOutcome, DownloadResult } from '../shared/types.js';

/**
 * The part of the window this module needs — it only ever sends to it.
 *
 * The seam rather than `BrowserWindow` itself: the module's behaviour does not
 * depend on anything else a window can do, and a test can then hand it an object
 * with these two members instead of a cast of the real thing.
 */
export interface DownloadTarget {
  isDestroyed(): boolean;
  webContents: { send(channel: string, ...args: unknown[]): void };
}

/**
 * Tells the renderer how each download ended.
 *
 * HYG-24 — The export hands Chromium a blob URL and a `<a download>`; the blob URL may
 * only be revoked once the browser is done with it, and the renderer has no way to
 * know when that is: Chromium gives a web page no download event, and the blob URL
 * lives in the renderer's own context, so the main process is the only place that can
 * see the download finish.
 *
 * What this observer must NOT do: call `setSavePath`. That would decide where the file
 * lands, and the app's current behaviour is Electron's default — the file appears in
 * the user's downloads directory under the name the renderer asked for. Measured: with
 * an observing listener and no `setSavePath`, the export still lands in
 * `app.getPath('downloads')` exactly as it does with no listener at all.
 *
 * The terminal state arrives on the item's own `done` event. It is NOT the `updated`
 * event: measured, `updated` fires with `progressing` and never with `completed` for
 * this download, while `getState()` reads `completed` a moment later. The `done` event
 * is the one that carries the outcome.
 */
export function observeDownloads(getWindow: () => DownloadTarget | null): void {
  session.defaultSession.on('will-download', (_event, item) => {
    const fileName = item.getFilename();
    item.once('done', (_doneEvent, state: DownloadOutcome) => {
      const window = getWindow();
      if (!window || window.isDestroyed()) {
        logger.warn('Download finished with no window to tell', { fileName, outcome: state });
        return;
      }
      const result: DownloadResult = { fileName, outcome: state };
      logger.info('Download finished', { fileName, outcome: state });
      window.webContents.send(CHANNELS.EXPORT_DOWNLOAD_DONE, result);
    });
  });
}
