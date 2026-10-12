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
const REPO_URL = 'https://github.com/ribaudequin/clavis';
const LICENSE_URL = 'https://github.com/ribaudequin/clavis/blob/main/LICENSE';
const PATREON_URL = 'https://www.patreon.com/banduastudio';
const CLOSE_BUTTON = /^(close|fechar)$/i;
const CREDITS_TITLE = /créditos|credits/i;
const APP_NAME = 'clavis';
const ETH = '0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4';
const SOL = 'Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf';
const ORIGINAL_LANGUAGE = window.navigator.language;

function setLanguage(lang: string): void {
  Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });
}

function queryUpdateLink(): HTMLAnchorElement | null {
  return document.querySelector<HTMLAnchorElement>(UPDATE_LINK_SELECTOR);
}

/** The app name sits in its own <span>, so it matches exactly and never twice. */
function queryNameLine(): HTMLElement | null {
  return screen.queryByText(APP_NAME, { selector: 'span' });
}

/** Matches inside a single <span>, so a parent that repeats the text cannot double-match. */
function querySpan(pattern: RegExp): HTMLElement | null {
  return screen.queryByText(pattern, { selector: 'span' });
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

/** Drains the microtask queue and one macrotask turn. The version arrives through
 *  Promise.allSettled, which costs an extra tick over a bare await, so a single
 *  Promise.resolve() is no longer enough to know the state has landed. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
}

/** Awaits a span instead of assuming how many ticks it took to arrive. */
async function findSpan(pattern: RegExp): Promise<HTMLElement> {
  return await waitFor(() => {
    const found = querySpan(pattern);
    if (!found) throw new Error(`span not rendered for ${pattern}`);
    return found;
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
      // The version no longer rides on the update check: it is read on its own, so a
      // failing check must not blank the About screen's version.
      expect(getAppVersion).toHaveBeenCalledTimes(1);
      expect(await findSpan(/Version 0\.4\.3-beta/)).toBeTruthy();
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

describe('CreditsModal — required About content', () => {
  it('shows the app name exactly as it ships, identically in both locales', async () => {
    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const ptName = (await findSpan(/^clavis$/)).textContent ?? '';
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const enName = queryNameLine()?.textContent ?? '';

    // Data, not prose: the name is never translated, and it is lowercase as the
    // README and ABOUT.md §3.1 ship it.
    expect(ptName).toBe(APP_NAME);
    expect(enName).toBe(APP_NAME);
  });

  it('shows the version reported at runtime, never a literal from the markup', async () => {
    installStub('v0.4.4-beta', '9.9.9-not-in-the-markup');

    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const shown = (await findSpan(/Version (\S+)/)).textContent ?? '';
    expect(shown).toContain('9.9.9-not-in-the-markup');
  });

  it('strips a leading v from the runtime version', async () => {
    installStub('v0.4.4-beta', 'v1.2.3');

    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const shown = (await findSpan(/Version (\S+)/)).textContent ?? '';
    expect(shown).toContain('1.2.3');
    expect(shown).not.toContain('vv');
  });

  it('omits the version, but keeps the name, when the version cannot be read', async () => {
    installCustomStub(
      async (): Promise<{ tag_name?: string } | null> => null,
      async (): Promise<string> => {
        throw new Error('version unavailable');
      }
    );

    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    expect(queryNameLine()).toBeTruthy();
    expect(querySpan(/Version/)).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('translates the version label while keeping the version number identical', async () => {
    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const ptVersion = (await findSpan(/Versão (\S+)/)).textContent ?? '';
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const enVersion = (await findSpan(/Version (\S+)/)).textContent ?? '';

    expect(ptVersion).toContain('0.4.3-beta');
    expect(enVersion).toContain('0.4.3-beta');
    expect(ptVersion).not.toBe(enVersion);
  });

  it('links the MIT licence to the repository licence file', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const licence = screen.getByRole('link', { name: 'MIT' });
    expect(licence.getAttribute('href')).toBe(LICENSE_URL);
    expect(licence.getAttribute('target')).toBe('_blank');
    expect(licence.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('translates the licence label per locale and never translates the licence itself', async () => {
    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    expect(screen.getByText(/Licença/)).toBeTruthy();
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    expect(screen.getByText(/Licence/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'MIT' })).toHaveLength(1);
  });

  it('shows the studio identity line, translated, beside the Pixel Arc mark', async () => {
    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const ptStudio = querySpan(/Uma app Bandua Studio/);
    expect(ptStudio).toBeTruthy();
    expect(ptStudio?.closest('li')?.querySelector('svg')).toBeTruthy();
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const enStudio = querySpan(/A Bandua Studio app/);
    expect(enStudio).toBeTruthy();
    expect(enStudio?.closest('li')?.querySelector('svg')).toBeTruthy();
  });

  it('names the author and the studio on the identity line', async () => {
    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const studio = querySpan(/A Bandua Studio app/)?.textContent ?? '';
    expect(studio).toContain('Bandua Studio');
    expect(studio).toContain('Marcelo Salvador');
  });
  it('gives Patreon the same prominence as Ko-fi: one CTA button each, the same width', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const kofi = screen.getByRole('link', { name: 'Ko-fi' });
    const patreon = screen.getByRole('link', { name: 'Patreon' });

    // Same row: both CTAs share a parent, and that parent is the flex row that puts
    // them side by side. Checking parentage alone is not enough — a `block` parent
    // still holds both links, it just stacks them.
    const row = patreon.parentElement;
    expect(row).toBe(kofi.parentElement);
    expect(row?.getAttribute('class')).toContain('flex');

    // Identical styling, so neither channel outranks the other, and both grow to half
    // the row — the two buttons used to differ by 66px with a void between them.
    expect(patreon.getAttribute('class')).toBe(kofi.getAttribute('class'));
    expect(patreon.getAttribute('class')).toContain('flex-1');
    expect(patreon.getAttribute('class')).toContain('justify-center');

    // Both labels are platform names, so both are data and stay identical in every
    // locale — ABOUT.md §3.3. The pitch itself is the paragraph above these buttons.
    expect(kofi.textContent?.trim()).toBe('Ko-fi');
    expect(patreon.textContent?.trim()).toBe('Patreon');
  });

  it('keeps the support ask to one short line above the buttons', async () => {
    // The ask sits directly above two buttons inside a 351px content box. At text-sm a
    // 14px line holds roughly 45 characters before it wraps, and the three-line paragraph
    // this replaced pushed the card past the fold for a modal nobody scrolls to read.
    // jsdom has no layout, so length is the proxy — it is what keeps the wrap from coming back.
    const ask = (): string =>
      document.querySelector('[role="dialog"] section:nth-of-type(3) p.text-sm')?.textContent?.trim() ?? '';

    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const pt = ask();
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const en = ask();

    expect(pt.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
    expect(pt.length).toBeLessThanOrEqual(50);
    expect(en.length).toBeLessThanOrEqual(50);
    // One sentence: no full stop before the end.
    expect(pt.replace(/\.$/, '')).not.toMatch(/[.!?]\s+\S/);
    expect(en.replace(/\.$/, '')).not.toMatch(/[.!?]\s+\S/);
  });

  it('keeps the CTA labels identical in both locales, because they are platform names', async () => {
    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const ctaLabels = (): string[] =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="ko-fi.com"], a[href*="patreon.com"]'))
        .map((a) => a.textContent?.trim() ?? '');
    const pt = ctaLabels();
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const en = ctaLabels();

    expect(pt).toEqual(['Ko-fi', 'Patreon']);
    expect(en).toEqual(pt);
  });

  it('spreads the chip row across the full width so both rows share the same two edges', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const chips = Array.from(document.querySelectorAll('a[href*="etherscan"], a[href*="solscan"]'));
    const row = chips[0].parentElement;
    // justify-between, not a left-aligned list: the row has to reach the right edge
    // like the CTA row above it. flex-wrap stays as the guard against a fourth chip.
    expect(row?.getAttribute('class')).toContain('justify-between');
    expect(row?.getAttribute('class')).toContain('flex-wrap');
  });

  it('keeps the support channels out of the chip row, leaving GitHub and the two explorers', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    // One link per channel — the CTA is the only Patreon and the only Ko-fi link, so
    // neither appears twice in two different roles.
    expect(screen.getAllByRole('link', { name: 'Patreon' })).toHaveLength(1);
    const kofiHrefs = Array.from(document.querySelectorAll('a')).filter(
      (a) => a.getAttribute('href') === 'https://ko-fi.com/A0383T5'
    );
    expect(kofiHrefs).toHaveLength(1);

    const chips = Array.from(document.querySelectorAll('a[href*="etherscan"], a[href*="solscan"]'))
      .map((a) => a.getAttribute('href'));
    expect(chips).toEqual([
      `https://etherscan.io/address/${ETH}`,
      `https://solscan.io/account/${SOL}`,
    ]);
    expect(screen.getAllByRole('link', { name: 'GitHub' })).toHaveLength(2);
  });

  it('links the studio profiles named in ABOUT.md §4.1, beside the identity line', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    // The X label is the handle, not "X": the icon already is the letter, so repeating it
    // said nothing, while the handle says which account this is.
    const x = screen.getByRole('link', { name: '@banduastudio' });
    const linkedin = screen.getByRole('link', { name: 'LinkedIn' });
    expect(x.getAttribute('href')).toBe('https://x.com/banduastudio');
    expect(linkedin.getAttribute('href')).toBe('https://www.linkedin.com/in/bandua-marcelo-salvador');
    for (const link of [x, linkedin]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }

    // They belong with the studio identity, not in the chip row: these are the studio's
    // profiles, while that row is the project's repository and the two explorers.
    const studio = querySpan(/Bandua Studio/);
    const credits = studio?.closest('ul');
    expect(credits?.contains(x)).toBe(true);
    expect(credits?.contains(linkedin)).toBe(true);
    // The handle comes from BRAND.md §9; a bare "X" must not creep back in as the label.
    expect(x.textContent?.trim()).toBe('@banduastudio');
    expect(screen.queryByRole('link', { name: 'X' })).toBeNull();
    const chips = document.querySelector('a[href*="etherscan"]')?.parentElement;
    expect(chips?.contains(x)).toBe(false);
  });

  it('keeps the studio profile names identical in both locales, because they are names', async () => {
    setLanguage('pt-PT');
    const { unmount } = render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const pt = screen.getByRole('link', { name: 'LinkedIn' }).textContent?.trim();
    unmount();

    setLanguage('en-US');
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();
    const en = screen.getByRole('link', { name: 'LinkedIn' }).textContent?.trim();

    expect(pt).toBe('LinkedIn');
    expect(en).toBe(pt);
  });

  it('links Patreon to the canonical studio page', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const patreon = screen.getByRole('link', { name: 'Patreon' });
    expect(patreon.getAttribute('href')).toBe(PATREON_URL);
    expect(patreon.getAttribute('target')).toBe('_blank');
    expect(patreon.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('keeps both support channels reachable alongside the repository and explorers', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('https://ko-fi.com/A0383T5');
    expect(hrefs).toContain(PATREON_URL);
    expect(hrefs).toContain(REPO_URL);
    expect(hrefs).toContain(`https://etherscan.io/address/${ETH}`);
    expect(hrefs).toContain(`https://solscan.io/account/${SOL}`);
  });

  it('renders the mark at no less than the 32px brand minimum', async () => {
    render(<CreditsModal isOpen onClose={() => {}} />);
    await settle();

    const mark = querySpan(/A Bandua Studio app/)?.closest('li')?.querySelector('svg');
    expect(mark).toBeTruthy();
    // BRAND.md §4.4 — below 32px the 8px grid stops resolving. w-8 is 32px.
    expect(mark?.getAttribute('class')).toContain('w-8');
    expect(mark?.getAttribute('class')).toContain('h-8');
  });
});
