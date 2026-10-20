// @vitest-environment jsdom
// REL-02 — cancelling the unlock dialog did not cancel the unlock.
//
// The Escape handler and the Cancel button both unmount the modal, but the
// in-flight `unlockDrawer` promise kept running: when it resolved it still
// called setViewState and opened the drawer, after the user had explicitly
// dismissed the prompt (and, in the failure case, it painted the error on
// whichever drawer the user opened next). The renderer now invalidates the
// attempt from the cancel side and drops the stale result.
//
// The real HomeScreen, the real PasswordModal and the real useFocusTrap /
// useModalKeyboard hooks are used on purpose: the defect lives in the wiring
// between the modal's Escape handler and the pending promise, so mocking the
// hooks would test a program that does not exist. `unlockDrawer` is the only
// stub, and it hands back a deferred promise the test resolves by hand, which
// is what makes "the modal was dismissed while the unlock was in flight"
// reproducible.
//
// The dismissal below is a REAL user action, and it can be one now. While the
// unlock is in flight the modal moves the focus to the Cancel button, so the
// keypress lands on a control that is enabled and inside the dialog — which is
// what it takes for the Escape listener (on the modal container) to fire at
// all. It used to be a `fireEvent.keyDown` on the *disabled* password input:
// jsdom honours that and a real browser does not, because the browser moves
// the focus to <body> when the input is disabled, and a keydown on <body>
// travels upward and never reaches a descendant. That is the very trap
// UX-08 closes, and it is why this file could not reach the state it is about.
//
// Every path the guard has to cover gets its own test: a stale success, a stale
// failure, a stale "drawer not found" and a stale crash. A guard that only
// covers the happy path would leave the other three invisible to this file.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

import HomeScreen from '../src/renderer/pages/HomeScreen';
import { t, tError } from '../src/i18n';
import { DrawerListItem, EncryptedDrawer, ErrorCode, Result } from '../src/shared/types';

type UnlockPayload = { title: string; content: string; iconData: string };
type UnlockResult = Result<UnlockPayload | null>;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const FIRST_DRAWER: DrawerListItem = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Banco Central',
  iconData: '[]',
};
const SECOND_DRAWER: DrawerListItem = {
  id: '223e4567-e89b-12d3-a456-426614174000',
  title: 'Contas Poupanca',
  iconData: '[]',
};
const DRAWERS: DrawerListItem[] = [FIRST_DRAWER, SECOND_DRAWER];

const PASSWORD = 'correct horse battery staple';
const WRONG_PASSWORD_ERROR = { code: ErrorCode.WRONG_PASSWORD, message: 'Incorrect password.' };

let unlockDeferred: Deferred<UnlockResult>;
let unlockCalls: Array<{ id: string; password: string }>;

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: DRAWERS }),
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
    unlockDrawer: (id: string, password: string): Promise<UnlockResult> => {
      unlockCalls.push({ id, password });
      return unlockDeferred.promise;
    },
    // UX-08 — the modal asks the main process how long the next attempt would
    // wait before it submits. No wait here: this file is about the dismissal,
    // not about the countdown.
    getUnlockDelay: async (): Promise<number> => 0,
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async (): Promise<Result<{ token: string; fileName: string } | null>> => ({
      ok: true,
      data: null,
    }),
    restartApp: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    getAppVersion: async (): Promise<string> => '0.0.0-test',
    checkUpdate: async (): Promise<{ tag_name?: string } | null> => null,
  };
}

beforeEach(() => {
  unlockDeferred = createDeferred<UnlockResult>();
  unlockCalls = [];
  window.electronAPI = buildStub();
});

afterEach(() => {
  cleanup();
});

async function openPasswordModal(drawerTitle: string): Promise<HTMLInputElement> {
  fireEvent.click(await screen.findByRole('button', { name: drawerTitle }));
  return (await screen.findByLabelText(t('label.password'))) as HTMLInputElement;
}

async function submitPassword(input: HTMLInputElement, password: string): Promise<void> {
  fireEvent.change(input, { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: t('btn.open') }));
  // The modal asks the main process for the delay before it submits, so the
  // submit lands a couple of microtasks after the click.
  await act(async () => {});
}

async function resolveUnlock(result: UnlockResult): Promise<void> {
  await act(async () => {
    unlockDeferred.resolve(result);
  });
  // A second flush: the continuation of the awaited promise and the render it
  // schedules must both have landed before the assertions read the DOM.
  await act(async () => {});
}

async function rejectUnlock(reason: unknown): Promise<void> {
  await act(async () => {
    unlockDeferred.reject(reason);
  });
  await act(async () => {});
}

/**
 * The dismissal a user makes: an Escape press on the element that holds the focus.
 *
 * It used to be a keydown on the *disabled* password input, which jsdom honours
 * and a real browser does not — the browser moves the focus to <body> when the
 * input is disabled, and a keydown on <body> travels upward and never reaches
 * the container that owns the Escape listener. UX-08 moved the focus to the
 * Cancel button while the unlock runs, so the press lands where a user's would.
 */
function pressEscape(): void {
  const focused = document.activeElement as HTMLElement | null;
  if (!focused) throw new Error('Nothing holds the focus, so there is no keypress to make.');
  fireEvent.keyDown(focused, { key: 'Escape' });
}

// The shared shape of the stale-result tests: an unlock is started on the first
// drawer, dismissed with Escape, and another drawer is opened so a fresh prompt
// is on screen when the abandoned promise settles.
async function cancelAnUnlockAndOpenAnotherDrawer(): Promise<HTMLInputElement> {
  render(<HomeScreen />);

  const input = await openPasswordModal(FIRST_DRAWER.title);
  await submitPassword(input, PASSWORD);
  expect(unlockCalls).toHaveLength(1);

  pressEscape();
  expect(screen.queryByLabelText(t('label.password'))).toBeNull();

  return openPasswordModal(SECOND_DRAWER.title);
}

describe('REL-02 — a cancelled unlock does not unlock', () => {
  it('does not open the drawer when the prompt was dismissed with Escape', async () => {
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input, PASSWORD);
    expect(unlockCalls).toHaveLength(1);

    pressEscape();
    expect(screen.queryByLabelText(t('label.password'))).toBeNull();

    await resolveUnlock({
      ok: true,
      data: { title: FIRST_DRAWER.title, content: 'IBAN 1234', iconData: '[]' },
    });

    // The home screen must still be the one on screen. ViewDrawer is lazily
    // imported behind a Suspense, so the absence of the drawer's content would
    // also hold while the fallback is up — the drawer row in the list is what
    // proves the home screen is still rendered.
    expect(screen.getByText(FIRST_DRAWER.title)).toBeTruthy();
    expect(screen.getByText('Clavis')).toBeTruthy();
    expect(screen.getByRole('button', { name: t('btn.new') })).toBeTruthy();
  });

  it('does not put the cancelled attempt error on the drawer opened next', async () => {
    await cancelAnUnlockAndOpenAnotherDrawer();
    expect(screen.queryByRole('alert')).toBeNull();

    await resolveUnlock({ ok: false, error: WRONG_PASSWORD_ERROR });

    // The failure belongs to the dismissed prompt, not to the one on screen.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('#password-error')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does not put the cancelled attempt "drawer not found" error on the drawer opened next', async () => {
    await cancelAnUnlockAndOpenAnotherDrawer();

    await resolveUnlock({ ok: true, data: null });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('#password-error')).toBeNull();
  });

  it('does not put the cancelled attempt crash error on the drawer opened next', async () => {
    await cancelAnUnlockAndOpenAnotherDrawer();

    await rejectUnlock(new Error('ipc channel closed'));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('#password-error')).toBeNull();
  });
});

describe('REL-02 — the control: an unlock that was not cancelled still behaves as before', () => {
  it('keeps the prompt open and shows the error of a failed unlock', async () => {
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input, PASSWORD);
    expect(unlockCalls).toHaveLength(1);

    await resolveUnlock({ ok: false, error: WRONG_PASSWORD_ERROR });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(tError(WRONG_PASSWORD_ERROR));
    expect(screen.getByLabelText(t('label.password'))).toBeTruthy();
  });

  it('opens the drawer of a successful unlock', async () => {
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input, PASSWORD);
    expect(unlockCalls).toHaveLength(1);

    await resolveUnlock({
      ok: true,
      data: { title: FIRST_DRAWER.title, content: 'IBAN 1234', iconData: '[]' },
    });

    expect(await screen.findByDisplayValue('IBAN 1234')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('btn.new') })).toBeNull();
  });
});
