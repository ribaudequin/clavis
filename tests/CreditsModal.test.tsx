// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
import CreditsModal from '../src/renderer/components/CreditsModal';
import { DrawerListItem, ElectronAPI, EncryptedDrawer, Result } from '../src/shared/types';

const UPDATE_LINK_SELECTOR = 'a[href*="releases/latest"]';
const RELEASES_URL = 'https://github.com/ribaudequin/clavis/releases/latest';
const CLOSE_BUTTON = /^(close|fechar)$/i;
const CREDITS_TITLE = /créditos|credits/i;
const ORIGINAL_LANGUAGE = window.navigator.language;

function setLanguage(lang: string): void {
  Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });
}

function queryUpdateLink(): HTMLAnchorElement | null {
  return document.querySelector<HTMLAnchorElement>(UPDATE_LINK_SELECTOR);
}

async function findUpdateLink(): Promise<HTMLAnchorElement> {
  return await waitFor(() => {
    const link = queryUpdateLink();
    if (!link) throw new Error('update link not rendered');
    return link;
  });
}

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: [] }),
    createDrawer: async (): Promise<Result<EncryptedDrawer>> => ({ ok: true, data: { id: 'x', title: '', iconData: '', createdAt: 0, updatedAt: 0, encryptedData: '', salt: '', iv: '', authTag: '', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 65536, parallelism: 1 } } }),
    unlockDrawer: async (): Promise<Result<{ title: string; content: string; iconData: string } | null>> => ({ ok: true, data: null }),
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async (): Promise<Result<{ token: string; fileName: string } | null>> => ({ ok: true, data: null }),
    restartApp: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    getAppVersion: async (): Promise<string> => '0.0.0-test',
    checkUpdate: async (): Promise<{ tag_name?: string } | null> => null,
  };
}

let checkUpdate: Mock<ElectronAPI['checkUpdate']>;
let getAppVersion: Mock<ElectronAPI['getAppVersion']>;

function installStub(tag: string | null, current: string): void {
  checkUpdate = vi.fn(async (): Promise<{ tag_name?: string } | null> => (tag === null ? null : { tag_name: tag }));
  getAppVersion = vi.fn(async (): Promise<string> => current);
  window.electronAPI = { ...buildStub(), checkUpdate, getAppVersion };
}

function installCustomStub(check: ElectronAPI['checkUpdate'], version: ElectronAPI['getAppVersion']): void {
  checkUpdate = vi.fn(check);
  getAppVersion = vi.fn(version);
  window.electronAPI = { ...buildStub(), checkUpdate, getAppVersion };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubEnv('CI', undefined);
  installStub(null, '0.4.3-beta');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  setLanguage(ORIGINAL_LANGUAGE);
});

describe('CreditsModal', () => {
  it('shows the "new version available" link when the latest release is newer than the installed version', async () => {
    installStub('v0.4.4-beta', '0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);

    const link = await findUpdateLink();
    expect(link.textContent).toMatch(/v0\.4\.4-beta/);
    expect(link.getAttribute('href')).toBe(RELEASES_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(checkUpdate).toHaveBeenCalledTimes(1);
    expect(getAppVersion).toHaveBeenCalledTimes(1);
  });

  it('does not show the update link when the latest release matches the installed version', async () => {
    installStub('v0.4.3-beta', '0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    expect(checkUpdate).toHaveBeenCalledTimes(1);
    expect(getAppVersion).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(queryUpdateLink()).toBeNull();
  });

  it('does not show the update link when the update check returns null', async () => {
    installStub(null, '0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    expect(checkUpdate).toHaveBeenCalledTimes(1);
    expect(getAppVersion).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(queryUpdateLink()).toBeNull();
  });

  it('compares versions after stripping the leading v from both the tag and the installed version', async () => {
    installStub('v0.4.4-beta', 'v0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);

    const link = await findUpdateLink();
    expect(link.textContent).toMatch(/v0\.4\.4-beta/);
    expect(link.getAttribute('href')).toBe(RELEASES_URL);
  });

  it('shows the update link when only the installed version carries the leading v', async () => {
    installStub('0.4.4-beta', 'v0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);

    const link = await findUpdateLink();
    expect(link.textContent).toMatch(/0\.4\.4-beta/);
  });

  it('does not show the update link when both sides carry a leading v and the versions match', async () => {
    installStub('v0.4.3-beta', 'v0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    expect(queryUpdateLink()).toBeNull();
  });

  it('does not show the update link when the versions match and only the installed version carries a leading v', async () => {
    installStub('0.4.3-beta', 'v0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    expect(checkUpdate).toHaveBeenCalledTimes(1);
    expect(getAppVersion).toHaveBeenCalledTimes(1);
    expect(queryUpdateLink()).toBeNull();
  });

  it('swallows a rejected update check without crashing or leaking an unhandled rejection', async () => {
    installCustomStub(
      async (): Promise<{ tag_name?: string } | null> => {
        throw new Error('update endpoint unreachable');
      },
      async (): Promise<string> => '0.4.3-beta'
    );

    const unhandled: unknown[] = [];
    const recordUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', recordUnhandled);

    try {
      render(<CreditsModal isOpen onClose={() => {}} />);
      await settle();

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(queryUpdateLink()).toBeNull();
      expect(getAppVersion).not.toHaveBeenCalled();
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', recordUnhandled);
    }
  });

  it('renders nothing and skips the update check while the modal is closed', async () => {
    installStub('v0.4.4-beta', '0.4.3-beta');

    const { container } = render(<CreditsModal isOpen={false} onClose={() => {}} />);
    await settle();

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(checkUpdate).not.toHaveBeenCalled();
    expect(getAppVersion).not.toHaveBeenCalled();
  });

  it('runs the update check when the modal is opened after mounting closed', async () => {
    installStub('v0.4.4-beta', '0.4.3-beta');

    const { rerender } = render(<CreditsModal isOpen={false} onClose={() => {}} />);
    await settle();
    expect(checkUpdate).not.toHaveBeenCalled();

    rerender(<CreditsModal isOpen onClose={() => {}} />);

    const link = await findUpdateLink();
    expect(link.textContent).toMatch(/v0\.4\.4-beta/);
    expect(checkUpdate).toHaveBeenCalledTimes(1);
    expect(getAppVersion).toHaveBeenCalledTimes(1);
  });

  it('discards a stale update that resolves after a later check replaced it', async () => {
    const resolvers: ((value: { tag_name?: string } | null) => void)[] = [];
    installCustomStub(
      (): Promise<{ tag_name?: string } | null> =>
        new Promise<{ tag_name?: string } | null>((resolve) => {
          resolvers.push(resolve);
        }),
      async (): Promise<string> => '0.4.3-beta'
    );

    const { rerender } = render(<CreditsModal isOpen onClose={() => {}} />);
    expect(resolvers).toHaveLength(1);

    rerender(<CreditsModal isOpen={false} onClose={() => {}} />);
    rerender(<CreditsModal isOpen onClose={() => {}} />);
    expect(resolvers).toHaveLength(2);
    await settle();

    await act(async () => {
      resolvers[0]({ tag_name: 'v0.4.4-beta' });
      await Promise.resolve();
    });

    expect(checkUpdate).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(queryUpdateLink()).toBeNull();
  });

  it('renders the dialog with its title and close buttons', async () => {
    installStub(null, '0.4.3-beta');

    render(<CreditsModal isOpen onClose={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { level: 2, name: CREDITS_TITLE })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: CLOSE_BUTTON })).toHaveLength(2);

    await settle();
    expect(queryUpdateLink()).toBeNull();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();

    render(<CreditsModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getAllByRole('button', { name: CLOSE_BUTTON })[1]);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('translates the update link label per detected locale and keeps the version in both', async () => {
    installStub('v0.4.4-beta', '0.4.3-beta');

    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    const ptText = (await findUpdateLink()).textContent ?? '';
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    const enText = (await findUpdateLink()).textContent ?? '';

    expect(ptText).toContain('v0.4.4-beta');
    expect(enText).toContain('v0.4.4-beta');
    expect(ptText).not.toBe(enText);
  });
});
