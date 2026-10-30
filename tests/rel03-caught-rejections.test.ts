// @vitest-environment jsdom
// A2-deferred — five handlers in `HomeScreen` and `PasswordModal` had a `try` whose only
// handler was `finally`. On the success path that is fine; on a rejected bridge call it
// reset the loading flag and then let the rejection escape, so the spinner stopped and the
// user was told nothing. This file drives the real components and asserts the message.
//
// It used to be three `expect(true).toBe(true)` placeholders. A placeholder that cannot
// fail is worse than no test: it reports coverage for a behaviour nobody checked.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('react-hot-toast');
import { toast } from 'react-hot-toast';

import HomeScreen from '../src/renderer/pages/HomeScreen';
import { t } from '../src/i18n';
import { DrawerListItem, EncryptedDrawer, Result } from '../src/shared/types';

const DRAWER: DrawerListItem = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Banco Central',
  // A valid nine-colour icon, so the card renders through its normal path.
  iconData:
    '["rgb(1,2,3)","rgb(4,5,6)","rgb(7,8,9)","rgb(10,11,12)","rgb(13,14,15)","rgb(16,17,18)","rgb(19,20,21)","rgb(22,23,24)","rgb(25,26,27)"]',
};

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: [DRAWER] }),
    createDrawer: async (): Promise<Result<EncryptedDrawer>> => ({
      ok: true,
      data: {
        id: 'x',
        title: '',
        iconData: '',
        createdAt: 0,
        updatedAt: 0,
        encryptedData: '',
        salt: '',
        iv: '',
        authTag: '',
        keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 65536, parallelism: 1 },
      },
    }),
    unlockDrawer: async (): Promise<Result<{ title: string; content: string; iconData: string } | null>> => ({
      ok: true,
      data: null,
    }),
    getUnlockDelay: async (): Promise<number> => 0,
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async (): Promise<Result<{ token: string; fileName: string } | null>> => ({ ok: true, data: null }),
    restartApp: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    getAppVersion: async (): Promise<string> => '0.0.0-test',
    checkUpdate: async (): Promise<{ tag_name?: string } | null> => null,
    onExportDownloadDone: () => () => {},
  };
}

/** The message a toast was called with, in any order of occurrence. */
/** `HomeScreen` is rendered without JSX so this file stays a `.ts`: it was the documented
 *  REL-03 test file and its name is referenced by the changelog. */
function renderHome(): void {
  render(React.createElement(HomeScreen));
}

function toastMessages(): string[] {
  return vi.mocked(toast.error).mock.calls.map(([message]) => String(message));
}

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  window.electronAPI = buildStub();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('REL-03 / A2 — a rejected bridge call is shown, not swallowed', () => {
  it('reports a rejected listDrawers through the load-drawers message', async () => {
    window.electronAPI = {
      ...buildStub(),
      listDrawers: async () => {
        throw new Error('channel closed');
      },
    };

    renderHome();

    await waitFor(() => expect(toastMessages()).toContain(t('msg.error_load_drawers')));
  });

  it('reports a rejected exportDrawer through the export message', async () => {
    window.electronAPI = {
      ...buildStub(),
      exportDrawer: async () => {
        throw new Error('channel closed');
      },
    };

    renderHome();
    fireEvent.click(await screen.findByRole('button', { name: t('btn.export') }));

    await waitFor(() => expect(toastMessages()).toContain(t('msg.error_export')));
  });

  it('reports a rejected openFile through the import message and clears the importing flag', async () => {
    window.electronAPI = {
      ...buildStub(),
      openFile: async () => {
        throw new Error('channel closed');
      },
    };

    renderHome();
    const importButton = await screen.findByRole('button', { name: t('btn.import') });
    fireEvent.click(importButton);

    await waitFor(() => expect(toastMessages()).toContain(t('msg.error_import')));
    // The flag reset is what the old `finally`-only version still did; keeping it asserted
    // means the fix cannot regress into "the button stays disabled forever".
    await waitFor(() => expect((importButton as HTMLButtonElement).disabled).toBe(false));
  });

  it('reports a rejected deleteDrawer with the complete sentence, not the "Error deleting:" prefix', async () => {
    window.electronAPI = {
      ...buildStub(),
      deleteDrawer: async () => {
        throw new Error('channel closed');
      },
    };

    renderHome();
    fireEvent.click(await screen.findByRole('button', { name: t('btn.delete') }));

    // The card's Delete opens the confirm modal, which has a Delete of its own — the two
    // share a label by design, so the modal is reached through its dialog role rather
    // than through whatever order the two happen to be in the document.
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: t('btn.delete') }));

    await waitFor(() => expect(toastMessages()).toContain(t('msg.error_delete_failed')));
    expect(toastMessages()).not.toContain(t('msg.error_delete'));
  });
});
