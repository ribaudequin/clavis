// REL-02 — a cancelled unlock must not open the drawer.
//
// The defect: the prompt and the unlock are two different clocks. The prompt can be
// dismissed while the main process is still deriving the key, and the result then
// arrives long after the user closed it. HomeScreen now invalidates the attempt from
// the cancel side and drops the stale result (the counter and the guard are in
// src/renderer/pages/HomeScreen.tsx); the unit test for that is
// tests/rel02-cancelled-unlock.test.tsx.
//
// This file is the end-to-end half, and it exists because the unit test cannot reach
// the state the defect is about:
//
//   1. The window. The unit test hands the renderer a deferred promise and resolves
//      it by hand. Here the delay is the application's own: the main process's
//      per-drawer rate limiter (src/main/ipc-handlers.ts) sleeps *before* the
//      derivation, so the IPC promise stays pending for as long as the sleep lasts.
//      Five wrong passwords arm the 5 s tier of the ladder (3 failures → 1 s,
//      5 → 5 s, 10 → 30 s) and the sleep is real — the handler writes the delay it
//      applied into the log, and this file reads it from there.
//
//   2. The dismissal below is SYNTHETIC, and deliberately so.
//      `useModalKeyboard` (src/renderer/hooks/useModalKeyboard.ts:26) attaches its
//      Escape listener to the modal container — the element with `role="dialog"`.
//      While an unlock is in flight the password input is disabled
//      (src/renderer/components/PasswordModal.tsx:64), so the browser moves the
//      focus to <body>; measured during an unlock:
//        {"activeTag":"BODY","activeId":"","inputDisabled":true,"focusInsideModal":false}
//      A keydown that lands on <body> propagates *upward* and never reaches a
//      descendant of <body>, so a real Escape keypress cannot reach the listener
//      while the unlock runs — no user can dismiss the prompt in that state today.
//      The dispatch in `dismissPrompt` therefore goes to the element that owns the
//      listener, and it is a simulation of "the prompt was closed while an unlock was
//      pending", not a keypress a user can make. The dismissal mechanism is the
//      detail; the subject of this test is what the application does with the result
//      that arrives afterwards.
//
//   3. The control. "The drawer did not open" is also what a test that did not wait
//      long enough would see. The second test runs the identical flow — the same five
//      wrong passwords, the same 5 s sleep, the same wait — without the dismissal, and
//      the drawer opens. That is what makes the first test's negative assertion mean
//      something.
//
// Everything runs against the packaged artifact, on a throwaway profile, and every
// process and temporary directory is removed in the teardown below, which runs even
// when an assertion fails: a leaked Electron keeps a window open and a lock in its
// profile.
import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchIsolated, UI, E2E_PASSWORD } from './launch';
import type { IsolatedApp } from './launch';

// One app per test, always torn down — including the process and both temporary
// directories, which app.close() alone would leave behind.
let ctx: IsolatedApp | null = null;
test.afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

async function open(): Promise<IsolatedApp> {
  ctx = await launchIsolated();
  return ctx;
}

// A wrong password that the unlock schema accepts: UnlockDrawerSchema only bounds
// the length, and a password it refuses never reaches the store, so it never counts
// as a guess — and the rate limiter only counts guesses. This one has to be a
// plausible guess, or the ladder below is never climbed.
const WRONG_PASSWORD = 'Wr0ng-Passw0rd!';

// How many wrong passwords arm the 5 s tier of the limiter. The main process counts
// the failures per drawer and reads the count *before* the attempt:
//   0 failures → no delay, 3 → 1 s, 5 → 5 s, 10 → 30 s.
// So the fifth failure is the one that makes the *next* attempt wait 5 s.
const FAILURES_TO_ARM = 5;

// The delay the limiter applies to the correct attempt once it is armed.
const EXPECTED_DELAY_MS = 5000;

// The window the drawer is watched for, measured from the dismissal. The pending
// unlock needs the limiter's 5 s plus one argon2id derivation (2^18 KiB, a few hundred
// ms on a fast machine and several times that on a slow one), so the window is
// generous on purpose: the assertion is that nothing happened, and waiting longer can
// only make it stronger.
const WATCH_WINDOW_MS = 10_000;

// The minimum watch after the pending unlock is known to have completed. The
// completion is a condition (the main process logs it), not a guess about how long
// the derivation takes, and this is the slack that covers the renderer's reaction to
// the result — the lazy ViewDrawer chunk still has to load.
const GRACE_MS = 3_000;

/** The main process's log file, asked of the running app rather than hardcoded. */
async function logFileOf(app: ElectronApplication): Promise<string> {
  const logsDir = await app.evaluate(async ({ app: electronApp }) => electronApp.getPath('logs'));
  // The layout src/main/logger.ts builds: `<logs>/Clavis/main.log`. Under
  // --user-data-dir it lands inside the throwaway profile, so the log belongs to
  // this test alone and cannot carry another run's lines.
  return path.join(logsDir, 'Clavis', 'main.log');
}

function readLog(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** The log lines that mention this drawer and this text. */
function logLines(file: string, drawerId: string, needle: string): string[] {
  return readLog(file)
    .split('\n')
    .filter((line) => line.includes(needle) && line.includes(drawerId));
}

/** How many wrong passwords the main process has counted for this drawer. */
function failedUnlocks(file: string, drawerId: string): number {
  return logLines(file, drawerId, 'Unlock failed: incorrect password').length;
}

/** The delays the rate limiter applied to this drawer, in the order it applied them. */
function rateLimitDelays(file: string, drawerId: string): number[] {
  return logLines(file, drawerId, 'Unlock rate-limited').map((line) => {
    const match = /"delayMs":(\d+)/.exec(line);
    return match ? Number(match[1]) : -1;
  });
}

/** The id of the one drawer this test created, read from the profile the app owns. */
function drawerIdIn(profileDir: string): string {
  const files = fs
    .readdirSync(path.join(profileDir, 'drawers'))
    .filter((name) => name.endsWith('.clavis'));
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one .clavis in ${profileDir}/drawers, found ${files.length}: ` +
        `${files.join(', ')}. The log assertions below address one drawer by id, so ` +
        'an ambiguous profile would make them meaningless.'
    );
  }
  return files[0].replace(/\.clavis$/, '');
}

/** Creates a drawer through the UI and waits for it to be listed. */
async function createDrawer(window: Page, title: string): Promise<void> {
  await window.getByRole('button', { name: UI.newDrawer }).first().click();
  await window.locator('#drawer-title').fill(title);
  await window.locator('#drawer-password').fill(E2E_PASSWORD);
  await window.locator('#drawer-confirm-password').fill(E2E_PASSWORD);
  await window.locator('form button[type="submit"]').click();
  await expect(window.getByRole('list').getByText(title)).toBeVisible({ timeout: 15000 });
}

/** Opens the drawer and waits for the unlock prompt. */
async function openUnlockPrompt(window: Page, title: string): Promise<void> {
  await window.getByRole('list').getByText(title).click();
  await expect(window.getByRole('dialog').locator('#password-input')).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Submits wrong passwords until the main process's rate limiter is armed for 5 s.
 *
 * The wait is the main process's own log, not a clock. The renderer cannot say when
 * an attempt finished: the error it paints is the same text every time, so it cannot
 * be waited on, and its "the field is usable again" state can be read before React
 * has even applied the loading state — which would let the next attempt be swallowed
 * by the modal's `if (isLoading) return` and the ladder never climbed. The log line
 * is written by the handler that owns the counter, so it is the only unambiguous
 * "that attempt is over" signal there is.
 *
 * Returns how long the arming took, because it is a measurement worth reporting: ten
 * argon2id derivations (two per attempt — the real one and the constant-time dummy
 * the store runs on the failure path) plus the two 1 s delays. Measured: ~7 s.
 */
async function armRateLimiter(
  window: Page,
  logFile: string,
  drawerId: string
): Promise<number> {
  const dialog = window.getByRole('dialog');
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= FAILURES_TO_ARM; attempt++) {
    await dialog.locator('#password-input').fill(WRONG_PASSWORD);
    await dialog.getByRole('button', { name: UI.open }).click();

    // Exactly `attempt`: it proves the attempt finished, and that no extra attempt
    // slipped in behind it.
    await expect
      .poll(() => failedUnlocks(logFile, drawerId), {
        timeout: 30_000,
        message:
          `The main process never recorded wrong-password failure ${attempt} of ` +
          `${FAILURES_TO_ARM} for drawer ${drawerId}. Without the failures the rate ` +
          'limiter is never armed and there is no window to cancel into.',
      })
      .toBe(attempt);

    // The prompt stays open with the error, which is what lets the next attempt
    // happen at all.
    await expect(dialog.getByRole('alert')).toBeVisible();
    // And the field is usable again: the modal ignores a submit while it is loading,
    // so an attempt sent too early would be dropped silently.
    await expect(dialog.locator('#password-input')).toBeEnabled();
  }

  const elapsed = Date.now() - startedAt;

  // The limiter's own progression, read from its log: the fourth and fifth failures
  // were each delayed by 1 s, which is the three-failures tier of the ladder. The
  // first three were not delayed at all. If this is not what the log says, the delay
  // the test relies on is not the one it thinks it is.
  expect(rateLimitDelays(logFile, drawerId)).toEqual([1000, 1000]);

  return elapsed;
}

/**
 * Submits the correct password and waits until the main process has started the
 * limiter's sleep, which is what makes the unlock pending.
 *
 * The log line is written *before* the sleep starts, so seeing it means the IPC
 * promise cannot have resolved yet.
 */
async function submitCorrectPassword(
  window: Page,
  logFile: string,
  drawerId: string
): Promise<void> {
  const dialog = window.getByRole('dialog');
  await dialog.locator('#password-input').fill(E2E_PASSWORD);
  await dialog.getByRole('button', { name: UI.open }).click();

  await expect
    .poll(() => rateLimitDelays(logFile, drawerId), {
      timeout: 30_000,
      message:
        'The main process never applied the 5 s rate-limit delay to the correct ' +
        'attempt. The window this test cancels into would not exist, and the ' +
        'negative assertion below would pass for the wrong reason.',
    })
    .toContain(EXPECTED_DELAY_MS);
}

/**
 * Dismisses the unlock prompt the way the code expects to be dismissed.
 *
 * This is NOT a keypress a user can make today, and the header says why: the Escape
 * listener is on the modal container, the focus is on <body> while the unlock runs,
 * and a keydown on <body> never travels down to a descendant. The event is
 * therefore dispatched on the container that owns the listener, which is a deliberate
 * simulation of "the prompt was closed while an unlock was pending".
 */
async function dismissPrompt(window: Page): Promise<void> {
  await window.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) throw new Error('The unlock prompt is not on screen.');
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
  });
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

test('a pending unlock whose prompt was dismissed does not open the drawer', async () => {
  const title = 'REL-02 Cancelled';
  const { app, window, profileDir } = await open();
  const logFile = await logFileOf(app);

  await createDrawer(window, title);
  const drawerId = drawerIdIn(profileDir);
  await openUnlockPrompt(window, title);

  // Arm the limiter with wrong passwords, so the next attempt is a five second one.
  const armingMs = await armRateLimiter(window, logFile, drawerId);
  console.log(`[e2e] arming the rate limiter took ${armingMs}ms`);

  // The correct password now: the main process sleeps 5 s before it derives, so the
  // unlock is genuinely pending.
  await submitCorrectPassword(window, logFile, drawerId);

  // Dismiss the prompt while the unlock is in flight.
  await dismissPrompt(window);
  // The dismissal has to have happened, or the rest of this test would be about a
  // prompt that is still on screen.
  await expect(window.getByRole('dialog')).toHaveCount(0);

  const dismissedAt = Date.now();
  const drawerScreen = window.locator('#drawer-content-textarea');

  // The premise, waited on as a condition: the pending unlock really does finish.
  // "The drawer did not open" is only evidence if the unlock had every chance to
  // open it, and how long that takes is the machine's business (the derivation is a
  // few hundred ms on a fast box and several times that on a slow one).
  await expect
    .poll(() => logLines(logFile, drawerId, 'Drawer unlocked').length, {
      timeout: 60_000,
      message:
        'The pending unlock never completed. The main process did not log a ' +
        'successful unlock for this drawer, so the negative assertion below would ' +
        'prove nothing.',
    })
    .toBeGreaterThan(0);
  const completedAt = Date.now();

  // And then the window: the drawer must not open at any point in it. The remaining
  // time of the ten second window, or the grace period, whichever is longer — the
  // grace is what covers the renderer's reaction to a result that has already been
  // delivered.
  const remaining = Math.max(GRACE_MS, WATCH_WINDOW_MS - (completedAt - dismissedAt));
  let opened = false;
  try {
    await drawerScreen.waitFor({ state: 'attached', timeout: remaining });
    opened = true;
  } catch (error) {
    // A timeout is the expected outcome: the drawer never appeared. Anything else is
    // a real failure and must not be swallowed.
    if (!isTimeout(error)) throw error;
  }

  expect(
    opened,
    'The pending unlock opened the drawer after its prompt had been dismissed — ' +
      'the drawer the user refused is on screen.'
  ).toBe(false);

  // The home screen is still the one on screen: the list, with the drawer's own row
  // in it. The presence of the list is the assertion; the absence of the drawer
  // screen alone would also hold while the lazy ViewDrawer chunk is still loading.
  await expect(window.getByRole('list')).toBeVisible();
  await expect(window.getByRole('list').getByText(title)).toBeVisible();
  await expect(window.locator('#drawer-content-textarea')).toHaveCount(0);
});

test('the control: the same pending unlock opens the drawer when the prompt stays open', async () => {
  const title = 'REL-02 Control';
  const { app, window, profileDir } = await open();
  const logFile = await logFileOf(app);

  await createDrawer(window, title);
  const drawerId = drawerIdIn(profileDir);
  await openUnlockPrompt(window, title);

  // Exactly the same arming as the test above: the same five wrong passwords, the
  // same two 1 s delays, the same 5 s sleep on the correct attempt. The only thing
  // that differs is that the prompt is not dismissed.
  const armingMs = await armRateLimiter(window, logFile, drawerId);
  await submitCorrectPassword(window, logFile, drawerId);

  const submittedAt = Date.now();
  await expect(window.locator('#drawer-content-textarea')).toBeVisible({ timeout: 60_000 });
  const openedAfterMs = Date.now() - submittedAt;
  console.log(
    `[e2e] control: the drawer opened ${openedAfterMs}ms after the correct attempt ` +
      `(arming took ${armingMs}ms)`
  );

  // The window was the limiter's and not the renderer's: the drawer cannot open
  // before the sleep is over. The bound is 4 s rather than 5 s because the
  // measurement starts after the sleep has already begun and a timer may fire a
  // millisecond early.
  expect(openedAfterMs).toBeGreaterThan(4000);

  // The prompt is gone, replaced by the drawer it was asking for.
  await expect(window.getByRole('dialog')).toHaveCount(0);
});
