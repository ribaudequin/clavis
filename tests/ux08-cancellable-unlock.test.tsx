// @vitest-environment jsdom
// UX-08 — the unlock wait is cancellable, and it is counted.
//
// The defect this file is about was measured, not assumed. While an unlock was
// in flight the password input was `disabled`, so the browser moved the focus
// to <body>; the Escape listener of `useModalKeyboard` lives on the modal
// *container*, and a keydown that starts on <body> propagates upward and never
// reaches a descendant. The Cancel button was disabled too. Measured in the
// packaged app during an unlock:
//   {"activeTag":"BODY","inputDisabled":true,"focusInsideModal":false}
// and an Escape press left the dialog on screen. Under the rate limiter (3
// failures → 1 s, 5 → 5 s, 10 → 30 s, per drawer) the prompt was therefore
// frozen for up to 30 s with no way out — and REL-02's attempt counter, which
// ships as the fix for "a cancelled unlock still opens the drawer", had
// nothing to invalidate.
//
// The real hooks are used on purpose: `useFocusTrap` and `useModalKeyboard`
// are NOT mocked. The defect lives in the wiring between the modal's keyboard
// handling and the pending promise, so mocking the hooks would test a program
// that does not exist. The same goes for the real HomeScreen in the second
// half of this file: the counter REL-02 shipped is only reachable through that
// path, and a mock would make the reachability a fiction.
//
// `unlockDrawer` is the only stub that pretends to be the main process, and it
// hands back a deferred promise the test resolves by hand — that is what makes
// "the prompt was dismissed while the unlock was in flight" reproducible.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

import HomeScreen from '../src/renderer/pages/HomeScreen';
import PasswordModal from '../src/renderer/components/PasswordModal';
import { t } from '../src/i18n';
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

/** What the main process answers when the modal asks for the delay. */
let delayAnswer: number | Error = 0;
/** Every call in the order it happened — the delay query against the submit. */
let callOrder: string[] = [];
/** The unlock attempts that went out, with the password that went with them. */
let unlockCalls: Array<{ id: string; password: string }>;
let unlockDeferred: Deferred<UnlockResult>;

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
      callOrder.push(`unlock:${id}`);
      unlockCalls.push({ id, password });
      return unlockDeferred.promise;
    },
    // The read-only query the countdown reads. It answers with the delay the
    // main process would apply, and it never refuses: a drawer id that is not
    // a drawer's has no delay to report.
    getUnlockDelay: async (id: string): Promise<number> => {
      callOrder.push(`delay:${id}`);
      if (delayAnswer instanceof Error) throw delayAnswer;
      return delayAnswer;
    },
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
    // HYG-24 — The export download's outcome. No test here exports anything, so the
    // listener is a no-op that hands back the unsubscribe the renderer calls on unmount.
    onExportDownloadDone: () => () => {},
  };
}

beforeEach(() => {
  delayAnswer = 0;
  callOrder = [];
  unlockCalls = [];
  unlockDeferred = createDeferred<UnlockResult>();
  window.electronAPI = buildStub();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The countdown's live region. It is on screen only while a wait is running. */
function countdownRegion(): HTMLElement | null {
  return document.querySelector('[role="status"]');
}

function cancelButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: t('btn.cancel') }) as HTMLButtonElement;
}

function passwordInput(): HTMLInputElement {
  return screen.getByLabelText(t('label.password')) as HTMLInputElement;
}

interface ModalHarness {
  onSubmit: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  submit: () => Promise<void>;
}

/**
 * The real PasswordModal, with the real hooks, and a bridge that answers the
 * delay query.
 *
 * `pending` holds the submit open, which is what "the unlock is in flight"
 * means: the prompt is on screen, the attempt is running, and nothing has come
 * back yet.
 */
function renderModal(options: { pending?: Deferred<void> } = {}): ModalHarness {
  const onSubmit = vi.fn(async (_password: string): Promise<void> => {
    callOrder.push('submit');
    if (options.pending) await options.pending.promise;
  });
  const onClose = vi.fn();

  render(
    <PasswordModal
      drawerId={FIRST_DRAWER.id}
      drawerTitle={FIRST_DRAWER.title}
      onClose={onClose}
      onSubmit={onSubmit}
      error={null}
    />
  );

  return {
    onSubmit,
    onClose,
    submit: async () => {
      const input = passwordInput();
      await act(async () => {
        fireEvent.change(input, { target: { value: PASSWORD } });
        fireEvent.click(screen.getByRole('button', { name: t('btn.open') }));
      });
    },
  };
}

/** The HomeScreen path: the real screen, the real modal, the real counter. */
async function openPasswordModal(drawerTitle: string): Promise<HTMLInputElement> {
  fireEvent.click(await screen.findByRole('button', { name: drawerTitle }));
  return (await screen.findByLabelText(t('label.password'))) as HTMLInputElement;
}

async function submitPassword(input: HTMLInputElement): Promise<void> {
  await act(async () => {
    fireEvent.change(input, { target: { value: PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: t('btn.open') }));
  });
}

async function resolveUnlock(result: UnlockResult): Promise<void> {
  await act(async () => {
    unlockDeferred.resolve(result);
  });
  // A second flush: the continuation of the awaited promise and the render it
  // schedules must both have landed before the assertions read the DOM.
  await act(async () => {});
}

describe('UX-08 — the wait is cancellable', () => {
  it('keeps the Cancel button enabled while the unlock is in flight', async () => {
    const pending = createDeferred<void>();
    const harness = renderModal({ pending });
    await harness.submit();

    // The way out of a rate-limited attempt. It used to be disabled for the
    // whole wait, which is why the prompt was a trap.
    expect(cancelButton().disabled).toBe(false);

    // The submit stays guarded: the button the user could press twice is
    // disabled, and the guard against a second attempt is the `isLoading`
    // check inside handleSubmit.
    const submit = screen.getByRole('button', { name: t('btn.decrypting') }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect((passwordInput() as HTMLInputElement).disabled).toBe(true);
  });

  it('moves the focus to the Cancel button while the unlock is in flight', async () => {
    const pending = createDeferred<void>();
    const harness = renderModal({ pending });
    await harness.submit();

    // The focus is the whole problem: the Escape listener is on the modal
    // container, so the focused element has to be inside it for a real Escape
    // press to reach the listener at all.
    expect(document.activeElement).toBe(cancelButton());
  });

  it('gives the focus back to the password input when the attempt ends', async () => {
    const pending = createDeferred<void>();
    const harness = renderModal({ pending });
    await harness.submit();
    expect(document.activeElement).not.toBe(passwordInput());

    await act(async () => {
      pending.resolve();
    });

    // The next keystroke has to have somewhere to go: the field is usable
    // again, so the focus belongs to it.
    expect((passwordInput() as HTMLInputElement).disabled).toBe(false);
    expect(document.activeElement).toBe(passwordInput());
  });

  it('asks the main process for the delay before the submit goes out', async () => {
    const harness = renderModal();
    await harness.submit();

    // The order is the contract: the waiting state goes up first, then the
    // delay arrives, then the submit leaves. A submit that went out before the
    // question was asked would show no countdown at all.
    expect(callOrder).toEqual([`delay:${FIRST_DRAWER.id}`, 'submit']);
    expect(harness.onSubmit).toHaveBeenCalledWith(PASSWORD);
  });

  it('shows the seconds the main process reported and counts them down', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    try {
      delayAnswer = 5000;
      const pending = createDeferred<void>();
      const harness = renderModal({ pending });
      await harness.submit();

      expect(screen.getByText(t('msg.unlock_wait', { seconds: '5' }))).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(t('msg.unlock_wait', { seconds: '4' }))).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(t('msg.unlock_wait', { seconds: '3' }))).toBeTruthy();

      // It cannot go negative: past the deadline the number is 0, not -1.
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.getByText(t('msg.unlock_wait', { seconds: '0' }))).toBeTruthy();
      expect(screen.queryByText(t('msg.unlock_wait', { seconds: '-1' }))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the ticking number out of the live region', async () => {
    delayAnswer = 5000;
    const pending = createDeferred<void>();
    const harness = renderModal({ pending });
    await harness.submit();

    // A region that announced the remaining seconds every second would be
    // hostile: the live region carries a static sentence, and it is the
    // sentence that is announced once, when the countdown appears.
    const region = countdownRegion();
    expect(region).toBeTruthy();
    expect(region?.textContent).toBe(t('msg.unlock_wait_hint'));
    expect(region?.textContent).not.toContain('5');

    const ticking = screen.getByText(t('msg.unlock_wait', { seconds: '5' }));
    expect(ticking.getAttribute('aria-hidden')).toBe('true');
    expect(region?.contains(ticking)).toBe(false);
  });

  it('clears the countdown when the attempt ends', async () => {
    delayAnswer = 5000;
    const pending = createDeferred<void>();
    const harness = renderModal({ pending });
    await harness.submit();
    expect(countdownRegion()).not.toBeNull();

    await act(async () => {
      pending.resolve();
    });

    // A stale number must not survive into the next attempt.
    expect(countdownRegion()).toBeNull();
  });

  it('clears the countdown when the attempt ends in failure', async () => {
    delayAnswer = 5000;
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input);
    expect(unlockCalls).toHaveLength(1);
    expect(countdownRegion()).not.toBeNull();

    await resolveUnlock({ ok: false, error: WRONG_PASSWORD_ERROR });

    // The prompt stays open with the error, and the countdown is gone.
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(countdownRegion()).toBeNull();
  });

  it('submits the unlock even when the delay query rejects', async () => {
    delayAnswer = new Error('the channel is closed');
    const harness = renderModal();
    await harness.submit();

    // A missing countdown must never cost the user their attempt.
    expect(harness.onSubmit).toHaveBeenCalledWith(PASSWORD);
    expect(countdownRegion()).toBeNull();
  });

  it('treats an answer that is not a finite positive number as no wait', async () => {
    for (const answer of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      delayAnswer = answer;
      const harness = renderModal();
      await harness.submit();

      expect(harness.onSubmit).toHaveBeenCalledWith(PASSWORD);
      expect(countdownRegion()).toBeNull();
      cleanup();
    }
  });
});

describe('UX-08 — the counter REL-02 shipped is now reachable', () => {
  it('closes the prompt on a real Escape press while the unlock is in flight', async () => {
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input);
    expect(unlockCalls).toHaveLength(1);

    // The press a user makes: it starts on the focused element, which is
    // inside the dialog, so it reaches the container's listener.
    const focused = document.activeElement as HTMLElement;
    expect(focused).toBe(cancelButton());
    fireEvent.keyDown(focused, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not close the prompt on a keydown that starts outside it', async () => {
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input);

    // This is what the browser did before the fix: the focus was on <body>,
    // because the input was disabled, and a keydown there travels upward and
    // never reaches the container that owns the listener. The test that proves
    // the fix is only worth anything next to this one.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    // UX-01 — listener is now on document, so Escape reaches the handler even when
    // focus is on <body> (backdrop click / disabled input); the prompt closes.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open the drawer when the unlock is cancelled with the Cancel button', async () => {
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input);
    expect(unlockCalls).toHaveLength(1);

    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();

    await resolveUnlock({
      ok: true,
      data: { title: FIRST_DRAWER.title, content: 'IBAN 1234', iconData: '[]' },
    });

    // The home screen is still the one on screen, and the drawer the user
    // refused is not open.
    expect(screen.getByText('Clavis')).toBeTruthy();
    expect(screen.queryByDisplayValue('IBAN 1234')).toBeNull();
  });

  it('does not paint the cancelled attempt error on the drawer opened next', async () => {
    render(<HomeScreen />);

    const input = await openPasswordModal(FIRST_DRAWER.title);
    await submitPassword(input);

    fireEvent.click(cancelButton());

    const second = await openPasswordModal(SECOND_DRAWER.title);
    await resolveUnlock({ ok: false, error: WRONG_PASSWORD_ERROR });

    // The failure belongs to the dismissed prompt, not to the one on screen.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('#password-error')).toBeNull();
    expect(second.isConnected).toBe(true);
  });
});
