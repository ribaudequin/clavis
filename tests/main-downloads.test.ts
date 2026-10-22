// HYG-24 — The main process is the only place that can see a download end.
//
// The renderer hands Chromium a blob URL, and the blob URL may only be revoked once
// the browser is done with it. A web page gets no download event and the blob URL
// lives in the renderer's own context, so the renderer cannot know when the download
// finished — only this process can, and it has to say so.
//
// The observer therefore has one job and two things it must NOT do:
//   - it must not call `setSavePath`, which would decide where the file lands. The
//     app's behaviour is Electron's default (the file appears in the downloads
//     directory); measured, an observing listener that does not set a path leaves
//     that exactly as it was.
//   - it must not swallow the outcome: a download that did not write the file has to
//     reach the renderer, because the renderer is what tells the user.
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeItem {
  fileName: string;
  setSavePath: ReturnType<typeof vi.fn>;
  getFilename: () => string;
  once: (event: string, listener: (event: unknown, state: string) => void) => void;
  doneListener?: (event: unknown, state: string) => void;
}

const willDownloadListeners: Array<(event: unknown, item: FakeItem) => void> = [];

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      on: (event: string, listener: (event: unknown, item: FakeItem) => void) => {
        if (event === 'will-download') willDownloadListeners.push(listener);
      },
    },
  },
}));

vi.mock('../src/main/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  initializeLogger: vi.fn(),
}));

import { observeDownloads } from '../src/main/downloads';
import type { DownloadTarget } from '../src/main/downloads';
import { CHANNELS } from '../src/shared/channels';

function makeItem(fileName: string): FakeItem {
  const item: FakeItem = {
    fileName,
    setSavePath: vi.fn(),
    getFilename: () => fileName,
    once: (event, listener) => {
      if (event === 'done') item.doneListener = listener;
    },
  };
  return item;
}

function makeWindow(isDestroyed = false): {
  window: DownloadTarget;
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn();
  return {
    window: { isDestroyed: () => isDestroyed, webContents: { send } },
    send,
  };
}

beforeEach(() => {
  willDownloadListeners.length = 0;
});

describe('the download observer', () => {
  it('registers on will-download', () => {
    observeDownloads(() => null);
    expect(willDownloadListeners).toHaveLength(1);
  });

  it('tells the renderer the outcome when the download ends', () => {
    const { window, send } = makeWindow();
    observeDownloads(() => window);

    const item = makeItem('drawer.clavis');
    willDownloadListeners[0]({}, item);
    item.doneListener?.({}, 'completed');

    expect(send).toHaveBeenCalledExactlyOnceWith(CHANNELS.EXPORT_DOWNLOAD_DONE, {
      fileName: 'drawer.clavis',
      outcome: 'completed',
    });
  });

  it('reports an interrupted download as interrupted, not as a success', () => {
    // The whole reason the renderer waits: an export that did not write the file has
    // to arrive as a failure, because the renderer is what tells the user.
    const { window, send } = makeWindow();
    observeDownloads(() => window);

    const item = makeItem('drawer.clavis');
    willDownloadListeners[0]({}, item);
    item.doneListener?.({}, 'interrupted');

    expect(send).toHaveBeenCalledExactlyOnceWith(CHANNELS.EXPORT_DOWNLOAD_DONE, {
      fileName: 'drawer.clavis',
      outcome: 'interrupted',
    });
  });

  it('does not decide where the file lands', () => {
    // `setSavePath` would change the app's behaviour: the export would go to this
    // path instead of Electron's default (the user's downloads directory).
    const { window } = makeWindow();
    observeDownloads(() => window);

    const item = makeItem('drawer.clavis');
    willDownloadListeners[0]({}, item);
    item.doneListener?.({}, 'completed');

    // After the download ended as well: an observer that set a path only on the way
    // out would still be changing where the file lands.
    expect(item.setSavePath).not.toHaveBeenCalled();
  });

  it('says nothing when there is no window to tell', () => {
    const { window, send } = makeWindow();
    observeDownloads(() => null);

    const item = makeItem('drawer.clavis');
    willDownloadListeners[0]({}, item);
    item.doneListener?.({}, 'completed');

    expect(send).not.toHaveBeenCalled();
  });

  it('says nothing when the window has been destroyed', () => {
    // The window is resolved per notification, not captured: on macOS it is
    // recreated when the app is reactivated, and a captured one would point at a
    // window that no longer exists.
    const { window, send } = makeWindow(true);
    observeDownloads(() => window);

    const item = makeItem('drawer.clavis');
    willDownloadListeners[0]({}, item);
    item.doneListener?.({}, 'completed');

    expect(send).not.toHaveBeenCalled();
  });
});
