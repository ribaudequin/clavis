// @vitest-environment jsdom
// Why this file exists: ErrorBoundary is the last thing standing between a crashed renderer
// and a white window, and every line of its fallback (alert role, assertive live region,
// details block, restart bridge) shipped untested. The suite runs under the CI locale, so
// user-visible strings are matched bilingually rather than pinned to one language.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ErrorBoundary from '../src/renderer/components/ErrorBoundary';
import { t, translations } from '../src/i18n';
import { DrawerListItem, ElectronAPI, EncryptedDrawer, Result } from '../src/shared/types';

const ERROR_TITLE = /^(something went wrong|algo correu mal)$/i;
const ERROR_DETAILS = /^(error details|detalhes do erro)$/i;
const RESTART = /^(restart|reiniciar)$/i;
const CHILD_TEXT = 'healthy subtree';
const CRASH = 'drawer render exploded';
const ORIGINAL_LANGUAGE = window.navigator.language;
/** The bridge and the URL are read at module load, before any test touches them: the hygiene
 *  case at the bottom of this file compares the live values against these. */
const BRIDGE_AT_LOAD: ElectronAPI | undefined = window.electronAPI;
const HREF_AT_LOAD = window.location.href;

function setLanguage(lang: string): void {
  Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });
}

function Boom(): React.ReactElement {
  throw new Error(CRASH);
}

function buildBridge(): ElectronAPI {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: [] }),
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
  };
}

function installBridge(overrides: Partial<ElectronAPI> = {}): void {
  window.electronAPI = { ...buildBridge(), ...overrides };
}

/** Deleting the property rather than assigning `undefined` matters: the component branches on
 *  `if (window.electronAPI)`, and a stub object with no preload behind it would still be truthy. */
function removeBridge(): void {
  Reflect.deleteProperty(window, 'electronAPI');
}

function restoreBridge(): void {
  if (BRIDGE_AT_LOAD === undefined) Reflect.deleteProperty(window, 'electronAPI');
  else window.electronAPI = BRIDGE_AT_LOAD;
}

/** `window.location` is an unforgeable non-configurable accessor in jsdom, so neither
 *  `Object.defineProperty(window, 'location', …)` nor `vi.spyOn(window.location, 'reload')`
 *  can touch it. Vitest's jsdom environment re-exposes every window key on `globalThis` as a
 *  configurable accessor, so replacing the value there is the only seam that works. */
function installLocation(reload: () => void): void {
  vi.stubGlobal('location', { href: HREF_AT_LOAD, reload });
}

/** React reports every error a boundary swallows through `console.error` of its own, so the
 *  spy has to cover the throwing render — and only that render. The calls are copied out
 *  before `mockRestore`, which would otherwise wipe the history the assertions read. */
function captureConsoleError<T>(run: () => T): { value: T; consoleErrors: unknown[][] } {
  const consoleErrors: unknown[][] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args);
  });
  try {
    return { value: run(), consoleErrors };
  } finally {
    spy.mockRestore();
  }
}

/** Reaches the fallback by its position in the container rather than by `role="alert"`: the
 *  role is one behaviour under test, and a helper that queries by it would take every other
 *  case down with it the moment it went missing. */
function renderCaught(): { fallback: Element; consoleErrors: unknown[][] } {
  const { value: container, consoleErrors } = captureConsoleError(() =>
    render(
      <ErrorBoundary>
        <p>{CHILD_TEXT}</p>
        <Boom />
      </ErrorBoundary>
    ).container
  );
  const fallback = container.firstElementChild;
  if (fallback === null) throw new Error('the boundary rendered no fallback');
  return { fallback, consoleErrors };
}

interface FallbackStrings {
  title: string;
  hint: string;
  details: string;
  restart: string;
}

function fallbackStrings(fallback: Element): FallbackStrings {
  return {
    title: screen.getByRole('heading', { level: 1 }).textContent ?? '',
    hint: fallback.querySelector('p')?.textContent ?? '',
    details: fallback.querySelector('summary')?.textContent ?? '',
    restart: screen.getByRole('button', { name: RESTART }).textContent ?? '',
  };
}

beforeEach(() => {
  vi.stubEnv('CI', undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  restoreBridge();
  setLanguage(ORIGINAL_LANGUAGE);
});

describe('ErrorBoundary', () => {
  it('renders the children untouched, with no fallback and no details block, while nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>{CHILD_TEXT}</p>
      </ErrorBoundary>
    );

    expect(screen.getByText(CHILD_TEXT)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('details')).toBeNull();
  });

  it('replaces the whole subtree with the fallback when a child throws during render', () => {
    const { fallback } = renderCaught();

    expect(screen.queryByText(CHILD_TEXT)).toBeNull();
    expect(fallback.textContent).not.toContain(CHILD_TEXT);
    expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeTruthy();
    expect(screen.getByRole('button', { name: RESTART })).toBeTruthy();
  });

  it('announces the fallback as an assertive alert whose accessible name is the translated title', () => {
    const { fallback } = renderCaught();

    // P3.22 put the role, the live politeness and the label there together: a screen reader
    // only announces an inserted live region when it is named, so any one of the three
    // missing silently costs the announcement.
    expect(screen.getByRole('alert', { name: ERROR_TITLE })).toBe(fallback);
    expect(fallback.getAttribute('aria-live')).toBe('assertive');
    expect(fallback.getAttribute('aria-label')).toBe(t('label.error_title'));
  });

  it('logs the caught error through console.error, so a swallowed crash cannot rot the boundary', () => {
    const { consoleErrors } = renderCaught();

    const reported = consoleErrors.filter(([first]) => first === 'ErrorBoundary caught error:');
    expect(reported).toHaveLength(1);
    const error = reported[0][1];
    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toBe(CRASH);
  });

  it('keeps the caught error text in a details block that is collapsed by default and labelled', () => {
    const { fallback } = renderCaught();

    const details = fallback.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.querySelector('summary')?.textContent).toMatch(ERROR_DETAILS);
    // jsdom runs no layout, so "collapsed" cannot be measured as visibility; the state of a
    // <details> is the `open` attribute and nothing else.
    expect(details?.hasAttribute('open')).toBe(false);
    expect(details?.getAttribute('open')).toBeNull();
    expect(details?.querySelector('pre')?.textContent).toBe(`Error: ${CRASH}`);
  });

  it('renders no decorative markup and leaves Restart as the only focusable element in the fallback', () => {
    const { fallback } = renderCaught();

    // Characterisation, not a rule: the fallback ships no icon. If one is ever added it has to
    // come in hidden from the accessibility tree, so this case is what forces that decision.
    expect(fallback.querySelector('svg, img')).toBeNull();
    // <summary> is natively focusable and therefore absent from this list by design.
    const focusables = Array.from(fallback.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'));
    expect(focusables).toHaveLength(1);
    expect(focusables[0]).toBe(screen.getByRole('button', { name: RESTART }));
  });

  it('restarts through the preload bridge and never reloads the window when the bridge is present', () => {
    const restartApp = vi.fn(async (): Promise<Result<void>> => ({ ok: true, data: undefined }));
    installBridge({ restartApp });
    const reload = vi.fn();
    installLocation(reload);
    renderCaught();

    fireEvent.click(screen.getByRole('button', { name: RESTART }));

    expect(restartApp).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads the window when the preload bridge is absent', () => {
    removeBridge();
    const reload = vi.fn();
    installLocation(reload);
    renderCaught();

    fireEvent.click(screen.getByRole('button', { name: RESTART }));

    expect(window.electronAPI).toBeUndefined();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('resolves every fallback string through t() in both locales and never renders a raw key', () => {
    const fields: [keyof FallbackStrings, string][] = [
      ['title', 'label.error_title'],
      ['hint', 'msg.error_restart_hint'],
      ['details', 'label.error_details'],
      ['restart', 'btn.restart'],
    ];

    setLanguage('pt-PT');
    const ptFallback = renderCaught().fallback;
    const pt = fallbackStrings(ptFallback);
    cleanup();

    setLanguage('en-US');
    const enFallback = renderCaught().fallback;
    const en = fallbackStrings(enFallback);

    for (const [field, key] of fields) {
      expect(pt[field]).toBe(translations['pt-PT'][key]);
      expect(en[field]).toBe(translations['en'][key]);
      expect(pt[field]).not.toBe(en[field]);
    }
    // t() hands back the key itself when a translation is missing, so a key reaching the DOM is
    // the signature of a string that was hardcoded or of a gap in the dictionary.
    expect(ptFallback.textContent).not.toMatch(/\b(label|msg|btn)\.[a-z_]+/);
    expect(enFallback.textContent).not.toMatch(/\b(label|msg|btn)\.[a-z_]+/);
  });
});

describe('ErrorBoundary — focus after the tree is replaced', () => {
  it('moves focus onto the Error details toggle so the fallback is operable by keyboard alone', () => {
    const { fallback } = renderCaught();

    // A boundary swaps the tree out from under the user, so focus is left on <body> (or on a
    // node that no longer exists) and the only action in the fallback is unreachable by
    // keyboard until the user hunts for it with Tab. One object comparison, because a separate
    // assertion for each field could go green on an unrelated throw.
    //
    // The target is the <summary>, not Restart: focus is moved to somewhere Enter is harmless,
    // and Restart is one Tab away. The `focusOnRestart: false` field is what keeps that a
    // decision rather than an accident — it fails the moment anyone moves focus onto the button.
    expect({
      fallbackRendered: screen.queryByRole('alert') !== null,
      focusedTag: document.activeElement?.tagName ?? null,
      focusOnDetails: document.activeElement === fallback.querySelector('summary'),
      focusOnRestart: document.activeElement === screen.queryByRole('button', { name: RESTART }),
    }).toEqual({
      fallbackRendered: true,
      focusedTag: 'SUMMARY',
      focusOnDetails: true,
      focusOnRestart: false,
    });
  });
});

describe('ErrorBoundary — suite hygiene', () => {
  // Runs last on purpose: the two restart cases above are what install the stubs this one checks.
  it('hands window.location and window.electronAPI back exactly as it found them', () => {
    expect(window.location.href).toBe(HREF_AT_LOAD);
    expect(typeof window.location.reload).toBe('function');
    expect(vi.isMockFunction(window.location.reload)).toBe(false);
    expect(window.electronAPI).toBe(BRIDGE_AT_LOAD);
  });
});