import React, { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { t } from '../../i18n';
import { EyeOpenIcon, EyeClosedIcon } from './EyeIcons';

interface PasswordModalProps {
  /**
   * The drawer this prompt is for.
   *
   * It is here, and not in HomeScreen, because the delay question is about *this*
   * drawer: the prompt that asks it is the one that shows the answer.
   */
  drawerId: string;
  drawerTitle: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  error: string | null;
}

function PasswordModal({
  drawerId,
  drawerTitle,
  onClose,
  onSubmit,
  error,
}: PasswordModalProps): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // The seconds still to wait, or null while there is no wait running. The
  // number ticks, so it is kept out of the live region (see the render below).
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Whether an attempt has ever been made. The focus returns to the input when
  // an attempt *ends* — before the first one the input already holds it.
  const attemptedRef = useRef(false);

  useModalKeyboard(modalRef, { onEscape: onClose });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useFocusTrap(modalRef, { isActive: true });

  // The focus has to stay inside the modal while the unlock is in flight, or the
  // Escape listener never fires: `useModalKeyboard` attaches it to the modal
  // container, and a keydown that lands on <body> propagates *upward* and never
  // reaches a descendant. Measured in the packaged app during an unlock:
  // {"activeTag":"BODY","inputDisabled":true,"focusInsideModal":false} — and an
  // Escape press left the dialog on screen.
  //
  // The Cancel button is where the focus goes: it is the control that has to
  // stay usable during the wait, and it is the safe action to land on
  // (DESIGN.md rule 8 — Escape goes to the cancel path; rule 9 — a stray Enter
  // lands on the cancel button, never on the committing one).
  useEffect(() => {
    if (!isLoading) return;
    cancelRef.current?.focus();
  }, [isLoading]);

  // The focus goes back to the password input when the attempt ends, so the
  // next keystroke has somewhere to go instead of landing on the Cancel button.
  //
  // It cannot happen in the `finally` block: the input is disabled until the
  // attempt ends, and focusing a disabled input is a no-op. This effect runs
  // after React has committed the render that re-enables it.
  useEffect(() => {
    if (isLoading || !attemptedRef.current) return;
    inputRef.current?.focus();
  }, [isLoading]);

  // The interval is cleared when the attempt ends and when the modal goes away.
  // A countdown that keeps ticking after its attempt is over is a number that
  // lies about the next one.
  useEffect(() => {
    return () => {
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, []);

  function stopCountdown(): void {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setRemainingSeconds(null);
  }

  function startCountdown(delayMs: number): void {
    // A deadline, not a counter that ticks itself down: the interval can be
    // late (a busy main thread, a backgrounded window) and a decrementing
    // counter would drift away from the wait the user is actually serving.
    // Recomputing the remainder from the clock cannot drift.
    const deadline = Date.now() + delayMs;

    const tick = (): void => {
      // The remainder cannot go negative: the clock can be a hair past the
      // deadline, and a countdown that shows "-1 s" is worse than one that
      // shows "0 s".
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left === 0) {
        // The wait is over but the attempt may still be in flight, so the
        // number stays on screen (at zero) until the attempt ends. Only the
        // interval stops.
        if (countdownRef.current !== null) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
  }

  /**
   * How long the next attempt on this drawer would wait, in milliseconds.
   *
   * The answer comes from the main process, which owns the policy: the ladder
   * must not be written twice, or the countdown and the wait the user actually
   * serves become two different numbers.
   *
   * It is defensive on purpose. A missing bridge, a rejected query or an answer
   * that is not a finite positive number all mean "no wait" — never "do not
   * unlock". A missing countdown must not cost the user their attempt.
   */
  async function queryUnlockDelay(id: string): Promise<number> {
    try {
      const delay = await window.electronAPI?.getUnlockDelay?.(id);
      return typeof delay === 'number' && Number.isFinite(delay) && delay > 0 ? delay : 0;
    } catch {
      return 0;
    }
  }

  async function handleSubmit(e?: React.FormEvent): Promise<void> {
    if (e) e.preventDefault();
    // The guard against a second attempt is this line, not the button's
    // `disabled`: the button can be pressed by a keyboard before React has
    // applied the loading state.
    if (isLoading || password.trim() === '') return;
    attemptedRef.current = true;
    // The waiting state goes up first, so it is visible while the delay is
    // being asked for and while the main process serves it.
    setIsLoading(true);
    try {
      const delayMs = await queryUnlockDelay(drawerId);
      if (delayMs > 0) startCountdown(delayMs);
      await onSubmit(password);
    } catch {
      // A2-deferred — `onSubmit` is `HomeScreen.handleUnlockSubmit`, which catches its own
      // failure and sets `unlockError`, so there is no message left for this layer to add.
      // The catch exists because a rejection from a form submit has nothing above it: left
      // unhandled it becomes a global rejection, and the user sees a form that did nothing.
    } finally {
      // Whatever happened, the countdown goes: a stale number must not survive
      // into the next attempt.
      stopCountdown();
      setIsLoading(false);
    }
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-modal-title"
      aria-describedby="password-error"
    >
      <div className="bg-white rounded-lg p-6 w-80">
        <h2 id="password-modal-title" className="text-lg font-semibold mb-4">
          {drawerTitle}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password-input" className="block text-sm text-gray-600 mb-1">
              {t('label.password')}
            </label>
            <div className="relative">
              <input
                id="password-input"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full border border-input rounded px-2 py-1 text-sm pr-8 disabled:opacity-50"
                placeholder={t('label.password')}
                autoComplete="current-password"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                aria-label={showPassword ? t('label.hide_password') : t('label.show_password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
            {error && (
              <p id="password-error" className="text-red-700 text-xs mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
          {remainingSeconds !== null && (
            <div className="mb-3">
              {/* The live region carries a static sentence, and it is announced
                  once — when it appears. A region that announced the remaining
                  seconds every second would be hostile to a screen reader, so
                  the ticking number sits outside it and is hidden from assistive
                  technology: the static sentence already says the same thing. */}
              <p role="status" aria-live="polite" className="sr-only">
                {t('msg.unlock_wait_hint')}
              </p>
              <p className="text-sm text-gray-700">
                <span aria-hidden="true">
                  {t('msg.unlock_wait', { seconds: String(remainingSeconds) })}
                </span>
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {/* The Cancel button is NOT disabled during the wait: cancelling is
                the way out of a rate-limited attempt, and the attempt counter
                on the other side of this prompt discards the pending result.
                It is also where the focus goes while the wait runs, so that a
                real Escape press reaches the container's listener. */}
            <button
              type="button"
              ref={cancelRef}
              onClick={onClose}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              {t('btn.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? t('btn.decrypting') : t('btn.open')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordModal;
