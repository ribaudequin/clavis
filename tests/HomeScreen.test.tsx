// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import HomeScreen from '../src/renderer/pages/HomeScreen';
import { DrawerListItem, Result, EncryptedDrawer, DownloadResult } from '../src/shared/types';

// react-hot-toast dispatches to a module store, so it emits fine with no Toaster
// mounted; mocking it keeps the assertion container-neutral and leaves the export's
// "the file was written" / "it was not" messages observable.
vi.mock('react-hot-toast');
import { toast } from 'react-hot-toast';

let mockDrawers: DrawerListItem[];

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: mockDrawers }),
    createDrawer: async (): Promise<Result<EncryptedDrawer>> => ({ ok: true, data: { id: 'x', title: '', iconData: '', createdAt: 0, updatedAt: 0, encryptedData: '', salt: '', iv: '', authTag: '', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 65536, parallelism: 1 } } }),
    unlockDrawer: async (): Promise<Result<{ title: string; content: string; iconData: string } | null>> => ({ ok: true, data: null }),
    getUnlockDelay: async (): Promise<number> => 0,
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async (): Promise<Result<{ token: string; fileName: string } | null>> => ({ ok: true, data: null }),
    restartApp: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    getAppVersion: async (): Promise<string> => '0.0.0-test',
    checkUpdate: async (): Promise<{ tag_name?: string } | null> => null,
    // HYG-24 — The export download's outcome. No test here exports anything, so the
    // listener is a no-op that hands back the unsubscribe the renderer calls on unmount.
    onExportDownloadDone: () => () => {},
  };
}

beforeEach(() => {
  mockDrawers = [];
  window.electronAPI = buildStub();
});

afterEach(() => {
  cleanup();
});

describe('HomeScreen', () => {
  it('renders the title "Clavis" and the "New Drawer" button', async () => {
    render(<HomeScreen />);

    expect(screen.getByText('Clavis')).toBeTruthy();
    expect(screen.getByText('New Drawer')).toBeTruthy();
  });

  it('renders a drawer title when one drawer exists', async () => {
    mockDrawers = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Banco Central',
        iconData: '["rgb(1,2,3)","rgb(4,5,6)","rgb(7,8,9)","rgb(10,11,12)","rgb(13,14,15)","rgb(16,17,18)","rgb(19,20,21)","rgb(22,23,24)","rgb(25,26,27)"]',
      },
    ];

    render(<HomeScreen />);

    expect(await screen.findByText('Banco Central')).toBeTruthy();
    expect(screen.getByText('New Drawer')).toBeTruthy();
  });

  it('shows empty state when no drawers', async () => {
    render(<HomeScreen />);
    expect(await screen.findByText('No drawers created.')).toBeTruthy();
  });

  it('shows skeleton loader initially', () => {
    render(<HomeScreen />);
    expect(screen.getByText('New Drawer')).toBeTruthy();
  });
});

// HYG-24 — The export, end to end in jsdom.
//
// The export hands Chromium a blob URL and a `<a download>`; the blob URL may only be
// revoked once the browser is done with it, and the renderer has no download event of
// its own, so the main process pushes the outcome and the renderer matches it to the
// export that is waiting.
//
// The revoke is the whole point of this file, and the assertion that matters is the
// negative one: at the moment the click is dispatched, nothing has been revoked yet.
// Revoking there works only because Chromium resolves the blob URL during the click's
// default action — and a revoke that lands before that resolution kills the download
// outright: measured, the item sits at 'progressing' forever, no file is written, and
// the app says "exported successfully" anyway.
describe('the export', () => {
  const EXPORT_ID = '123e4567-e89b-12d3-a456-426614174000';
  const EXPORT_FILE = `${EXPORT_ID}.clavis`;

  let createdUrls: string[];
  let revokedUrls: string[];
  let clickedAnchors: HTMLAnchorElement[];
  let downloadListener: ((result: DownloadResult) => void) | null;
  let originalCreate: typeof URL.createObjectURL | undefined;
  let originalRevoke: typeof URL.revokeObjectURL | undefined;

  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    clickedAnchors = [];
    downloadListener = null;

    // jsdom implements neither object URL method, and clicking a real anchor would
    // make it try to navigate. Both are stubbed so what is under test is the code's
    // own ordering, not the platform's.
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    let counter = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (): string => {
        const url = `blob:mock/${++counter}`;
        createdUrls.push(url);
        return url;
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: (url: string): void => {
        revokedUrls.push(url);
      },
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clickedAnchors.push(this);
    });

    window.electronAPI = {
      ...buildStub(),
      exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '{"id":"x"}' }),
      onExportDownloadDone: (listener: (result: DownloadResult) => void) => {
        downloadListener = listener;
        return () => {
          downloadListener = null;
        };
      },
    };
    mockDrawers = [
      {
        id: EXPORT_ID,
        title: 'Banco Central',
        iconData: '["rgb(1,2,3)"]',
      },
    ];
  });

  afterEach(() => {
    if (originalCreate) {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreate });
    }
    if (originalRevoke) {
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevoke });
    }
    vi.restoreAllMocks();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  async function exportTheDrawer(): Promise<void> {
    render(<HomeScreen />);
    const button = await screen.findByRole('button', { name: 'Export' });
    fireEvent.click(button);
    await waitFor(() => expect(clickedAnchors.length).toBe(1));
  }

  it('hands Chromium a blob URL and the file name the drawer is stored under', async () => {
    await exportTheDrawer();

    expect(createdUrls).toHaveLength(1);
    expect(clickedAnchors[0].getAttribute('download')).toBe(EXPORT_FILE);
    expect(clickedAnchors[0].getAttribute('href')).toBe(createdUrls[0]);
  });

  it('revokes nothing at the moment of the click — the browser still needs the blob', async () => {
    await exportTheDrawer();

    // The mutation guard: restore the synchronous revoke and this goes red. That
    // revoke is what the item was about, and it works only by accident.
    expect(revokedUrls).toEqual([]);
  });

  it('revokes the blob when the download completes, and says the export worked', async () => {
    await exportTheDrawer();

    expect(downloadListener).not.toBeNull();
    downloadListener?.({ fileName: EXPORT_FILE, outcome: 'completed' });

    expect(revokedUrls).toEqual(createdUrls);
    expect(toast.success).toHaveBeenCalledWith('Drawer exported successfully.');
  });

  it('revokes the blob and reports the failure when the download did not write the file', async () => {
    await exportTheDrawer();

    downloadListener?.({ fileName: EXPORT_FILE, outcome: 'interrupted' });

    expect(revokedUrls).toEqual(createdUrls);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('The export did not finish. The file was not written.');
  });

  it('reports a cancelled download as a failure too', async () => {
    await exportTheDrawer();

    downloadListener?.({ fileName: EXPORT_FILE, outcome: 'cancelled' });

    expect(toast.error).toHaveBeenCalledWith('The export did not finish. The file was not written.');
  });

  it('ignores an outcome for a download it is not waiting for', async () => {
    await exportTheDrawer();

    downloadListener?.({ fileName: 'someone-elses.clavis', outcome: 'completed' });

    expect(revokedUrls).toEqual([]);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('releases the blob and reports the failure when the download never ends', async () => {
    // The fallback: a download that never reaches a terminal state would otherwise
    // hold the exported ciphertext — up to the size of a whole drawer — in memory for
    // the life of the window.
    // `shouldAdvanceTime` keeps the clock moving on its own: testing-library's waitFor
    // polls on timers, and a frozen clock would hang it. The fallback still needs
    // 30 s of clock time, which no test run reaches on its own.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await exportTheDrawer();
      expect(revokedUrls).toEqual([]);

      vi.advanceTimersByTime(30_000);

      expect(revokedUrls).toEqual(createdUrls);
      expect(toast.error).toHaveBeenCalledWith('The export did not finish. The file was not written.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the blob when the screen goes away with the export in flight', async () => {
    // The notification will not arrive any more once the listener is gone, so the
    // fallback timer would be the only thing left holding the blob — and it would
    // fire a toast into a screen that is no longer there.
    const { unmount } = render(<HomeScreen />);
    const button = await screen.findByRole('button', { name: 'Export' });
    fireEvent.click(button);
    await waitFor(() => expect(clickedAnchors.length).toBe(1));

    unmount();

    expect(revokedUrls).toEqual(createdUrls);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does not report the failure twice when the download ends after the fallback', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await exportTheDrawer();
      vi.advanceTimersByTime(30_000);
      expect(toast.error).toHaveBeenCalledTimes(1);

      downloadListener?.({ fileName: EXPORT_FILE, outcome: 'completed' });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalled();
      expect(revokedUrls).toEqual(createdUrls);
    } finally {
      vi.useRealTimers();
    }
  });
});
