// SEC-09 — the single-instance lock, proved against the packaged binary.
//
// The unit test (tests/single-instance.test.ts) drives `acquireSingleInstanceLock` with
// plain objects, so it proves the *decision* is right and nothing about Electron. Three
// things in it are invisible from there, and this file is where they are measured:
//
//   1. The lock belongs to the `userData` directory, not to the executable.
//      `app.requestSingleInstanceLock()` is backed by Chromium's ProcessSingleton, whose
//      lock files (`SingletonLock`, `SingletonSocket`) live inside the user data dir. Two
//      processes on the same `--user-data-dir` collide; two on different ones do not.
//      That is why the second instance here is spawned with the *first* instance's
//      profile and not merely with the same binary — same executable, different profile,
//      and the collision never happens.
//
//   2. The loser has to quit *before* `app.whenReady()`, so it never creates a window and
//      never registers the IPC handlers. "The second process exited" cannot tell a
//      refusal from a crash that happened to exit 0, hence the two log assertions: the
//      refusal sentence (the losing branch is the only thing that writes it) and the
//      absence of a second startup line (the losing branch never reaches the ready
//      branch, which is where the window is created).
//
//   3. Playwright's `_electron.launch` cannot be used for the second process. It waits for
//      a window to appear, and the whole point of the losing branch is that there never
//      is one, so it would fail with "no window appeared" — a confusing way of saying
//      "the application correctly refused to start". The second instance is therefore a
//      plain `child_process.spawn`, which has no opinion about windows.
//
// The second test is the negative control, and it is the part that makes the first one
// mean something: "a spawned process exited" is also what a broken spawn, a missing
// display or a crash on startup look like from the outside. The control runs the same
// spawn against the same binary, with a live first instance holding a lock somewhere
// else, and differs in exactly one variable — it gets its own profile — and it must stay
// alive. If the control ever exits, the artifact is broken and the first test is no
// longer measuring the lock.
//
// Every process and every temporary directory created here is removed in the teardown
// below, which runs even when an assertion fails: a leaked Electron keeps a window open
// and a `SingletonLock` in a profile, and the next test in this file would then be
// measuring a profile somebody else already claimed.
import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchIsolated, UI } from './launch';
import type { IsolatedApp } from './launch';
import { resolveTarget, APP_VERSION } from './artifact';
import type { Target } from './artifact';

// Written by the process that lost the lock, immediately before it quits. It is the
// positive evidence that the refusal branch was taken: an exit code of 0 on its own could
// be a clean shutdown of anything, but only this branch writes this sentence.
const REFUSAL_LINE = 'Another instance is already running — this one exits';

// Written by the primary instance when it reaches `app.whenReady()`. The losing branch
// never gets there, so this line must appear exactly once in the log no matter how many
// instances were started against the profile.
const STARTUP_LINE = 'Clavis started';

// Generous, because "it did not exit" is the bug this test exists to catch and a slow
// machine must not be reported as one. The losing process normally goes in well under a
// second (measured: ~450ms).
const SECOND_INSTANCE_EXIT_TIMEOUT = 30_000;

// How long the control is watched for an exit that must not happen.
const CONTROL_OBSERVATION_WINDOW = 10_000;

type ExitOutcome =
  | { kind: 'exited'; code: number | null; signal: NodeJS.Signals | null }
  | { kind: 'spawn-error'; message: string }
  | { kind: 'still-running' };

interface SpawnedInstance {
  child: ChildProcess;
  /** Resolves with how the process ended. Never rejects. */
  exited: Promise<ExitOutcome>;
  /** Everything the process wrote to stdout and stderr, for the failure messages. */
  output(): string;
}

const TIMED_OUT = Symbol('timed-out');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  return new Promise<T | typeof TIMED_OUT>((resolve, reject) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Starts a second instance of the packaged application as a plain child process.
 *
 * `child_process.spawn` and not `_electron.launch`, for the reason in the header: the
 * losing process never opens a window, and Playwright's Electron launcher waits for one.
 */
function spawnInstance(target: Target, userDataDir: string): SpawnedInstance {
  // `--no-sandbox` first, exactly where Playwright puts it. This is not a shortcut: it is
  // what makes the spawned process comparable to the first one.
  //
  // Playwright's Electron launcher builds its arguments as
  // `['--inspect=0', '--remote-debugging-port=0', ...args]` and then, on Linux,
  // `unshift`s `--no-sandbox` in front of them when `chromiumSandbox` is off (the
  // default) — `playwright-core/lib/coreBundle.js`, the Electron launcher's `launch()`.
  // The first instance therefore always runs unsandboxed, and a raw `spawn` that does
  // not repeat the flag is not running the same program.
  //
  // The difference is invisible on a development machine and fatal on a CI runner. The
  // runner has AppArmor's `kernel.apparmor_restrict_unprivileged_userns` set, so the
  // unprivileged user namespace Chromium would normally use is refused; Chromium then
  // insists on the SUID sandbox, finds `chrome-sandbox` in the packaged output owned by
  // the runner user with mode 755 instead of 4755, and aborts:
  //
  //   FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:166] The SUID sandbox
  //   helper binary was found, but is not configured correctly.
  //
  // The process dies of SIGTRAP before it can refuse anything, which is what the first
  // CI run of this file showed: the two new tests failed with `signal SIGTRAP` and the
  // ten pre-existing tests — all launched by Playwright — passed. The refusal of the
  // lock was never even reached.
  //
  // The application itself is unaffected: this flag is a test-harness concession that
  // Playwright already makes for the instance it launches, and a user running the
  // installed app gets Chromium's own sandbox.
  const args = [
    '--no-sandbox',
    // The AppImage has to be argv[1] as well as the executable: it is a self-extracting
    // archive with its own argv handling, and Electron lives inside it. The packager
    // output is already a plain Electron binary, and passing its own path as argv[1]
    // makes Electron try to load a directory as an application. Both shapes were
    // measured. The order here is the one Playwright produces for the same artifact
    // (`--no-sandbox` first, then the AppImage path), and the CI `build` job runs the
    // whole suite against the AppImage through Playwright.
    ...(target.passAsArgument ? [target.executablePath] : []),
    `--user-data-dir=${userDataDir}`,
  ];

  const child = spawn(target.executablePath, args, {
    // The same environment the first instance got, for the same reason: DISPLAY has to
    // reach the process or it cannot create a window, and process.env is
    // Record<string, string | undefined> while spawn wants Record<string, string>.
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Drained as it arrives. Nobody reads it during the run, but a pipe that nobody reads
  // fills up and blocks the writer — and a blocked writer cannot exit.
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const exited = new Promise<ExitOutcome>((resolve) => {
    child.once('exit', (code, signal) => resolve({ kind: 'exited', code, signal }));
    // A process that never started (ENOENT, a binary that cannot be executed) emits
    // 'error' and may never emit 'exit'. Without this the test would sit until the
    // timeout and then report "the second instance did not exit" — the wrong diagnosis,
    // because the process never existed.
    child.once('error', (error) => resolve({ kind: 'spawn-error', message: error.message }));
  });

  return { child, exited, output: () => output };
}

/** Waits for the process to end. `still-running` means the timeout elapsed first. */
async function waitForExit(instance: SpawnedInstance, timeoutMs: number): Promise<ExitOutcome> {
  const outcome = await withTimeout(instance.exited, timeoutMs);
  return outcome === TIMED_OUT ? { kind: 'still-running' } : outcome;
}

/** The log file, or an empty string when it is not there (yet). */
function readLog(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function countLinesContaining(text: string, needle: string): number {
  return text.split('\n').filter((line) => line.includes(needle)).length;
}

/** Ends a spawned process, escalating to SIGKILL if SIGTERM is ignored. */
async function terminate(instance: SpawnedInstance): Promise<void> {
  if (instance.child.exitCode !== null || instance.child.signalCode !== null) return;
  const ended = withTimeout(instance.exited, 5_000);
  instance.child.kill('SIGTERM');
  if ((await ended) === TIMED_OUT) {
    // A stuck Electron. SIGKILL still releases the lock, because the lock is a file the
    // kernel removes when the process dies.
    instance.child.kill('SIGKILL');
    await instance.exited;
  }
}

let first: IsolatedApp | null = null;
const spawned: SpawnedInstance[] = [];
const tempProfiles: string[] = [];

test.afterEach(async () => {
  // Every spawned process first: a leaked Electron keeps a window open and a
  // `SingletonLock` in its profile, and the next test in this file would be measuring a
  // profile somebody else already claimed.
  while (spawned.length > 0) {
    await terminate(spawned.pop() as SpawnedInstance);
  }
  // close(), not app.close(): it also removes the profile and download temp directories.
  await first?.close();
  first = null;
  for (const dir of tempProfiles) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempProfiles.length = 0;
});

test('a second instance on the same profile quits by itself and leaves the first one running', async () => {
  const target = resolveTarget();
  first = await launchIsolated();
  const instance = first;

  // The first instance is genuinely up. Without this, the rest of the test could be
  // measuring a process that never started: a second instance that quits because the
  // *first* one had died is a different defect, and not the one this file is about.
  expect(await instance.app.evaluate(async ({ app: electronApp }) => electronApp.getVersion())).toBe(
    APP_VERSION
  );

  // The log path is asked of the running application instead of hardcoded, so a change in
  // where Electron keeps its logs cannot quietly turn this into a test that asserts on an
  // empty file. The layout below is the one src/main/logger.ts builds:
  // `<logs>/Clavis/main.log`.
  const logsDir = await instance.app.evaluate(async ({ app: electronApp }) => electronApp.getPath('logs'));
  const logFile = path.join(logsDir, 'Clavis', 'main.log');

  // The refusal line must not be in the log yet. The profile is brand new, so this is
  // close to a formality — but it is what makes "the line appeared later" mean "the
  // second process wrote it" rather than "the file already said so".
  expect(readLog(logFile)).not.toContain(REFUSAL_LINE);

  // --- the second instance --------------------------------------------------------
  // The same profile as the first one, because that is where the lock lives.
  const second = spawnInstance(target, instance.profileDir);
  spawned.push(second);

  const outcome = await waitForExit(second, SECOND_INSTANCE_EXIT_TIMEOUT);
  if (outcome.kind === 'spawn-error') {
    throw new Error(
      `The second instance could not be spawned at all: ${outcome.message}. ` +
        `The binary is ${target.executablePath}.`
    );
  }
  if (outcome.kind === 'still-running') {
    throw new Error(
      `The second instance did not exit within ${SECOND_INSTANCE_EXIT_TIMEOUT}ms. It was ` +
        `spawned exactly like the first one — same executable (${target.executablePath}), ` +
        `same --user-data-dir=${instance.profileDir} — so a process that stays alive here ` +
        `means the single-instance lock is no longer refusing the second process, which is ` +
        `SEC-09 reopening. Output:\n${second.output()}`
    );
  }

  // Code 0, and not merely "it ended". A non-zero code is a crash; a null code is a
  // process killed by a signal. The refusal branch is a clean `app.quit()`, and anything
  // else means the process died on the way there.
  expect(
    outcome.code,
    'The second instance must exit cleanly (code 0). A non-zero code means it crashed ' +
      'rather than refusing the lock, and a null code means a signal killed it — neither ' +
      `is what SEC-09 asks for. Output:\n${second.output()}`
  ).toBe(0);

  // The refusal sentence is the positive evidence that the process took the losing
  // branch. It is written before `app.quit()`, and nothing else writes it.
  await expect
    .poll(() => readLog(logFile), {
      timeout: 10_000,
      message: `The second instance exited but never wrote "${REFUSAL_LINE}" to ${logFile}. ` +
        `It took some other exit path.`,
    })
    .toContain(REFUSAL_LINE);

  // And it never became a primary instance: it must not have reached `app.whenReady()`,
  // which is where the window is created and the IPC handlers are registered. The startup
  // line belongs to the first instance alone, so a second one appearing here would mean
  // the refused process carried on into the ready branch and opened its own window over
  // the same drawers — the exact failure the lock exists to prevent.
  const startupLines = countLinesContaining(readLog(logFile), STARTUP_LINE);
  expect(
    startupLines,
    `${logFile} must contain exactly one "${STARTUP_LINE}" line — the first instance's. ` +
      `The refused instance must never reach app.whenReady(). Log:\n${readLog(logFile)}`
  ).toBe(1);

  // The primary instance is untouched: still answering, and its window is still the one
  // the user is looking at. A second instance that took the lock away from the first
  // one, or a first one that died and left the profile to the newcomer, shows up here.
  expect(await instance.app.evaluate(async ({ app: electronApp }) => electronApp.getVersion())).toBe(
    APP_VERSION
  );
  await expect(instance.window.getByRole('button', { name: UI.createFirst })).toBeVisible({
    timeout: 15_000,
  });
});

test('a second instance with its own profile keeps running, so the lock is what ends the first one', async () => {
  const target = resolveTarget();
  first = await launchIsolated();
  const instance = first;

  expect(await instance.app.evaluate(async ({ app: electronApp }) => electronApp.getVersion())).toBe(
    APP_VERSION
  );

  // The control differs from the test above in exactly one variable: it gets its own
  // profile. Everything else is the same — the binary, the spawn mechanics, the
  // environment, and a live first instance holding a lock somewhere else.
  const controlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clavis-e2e-control-'));
  tempProfiles.push(controlDir);

  const control = spawnInstance(target, controlDir);
  spawned.push(control);

  const outcome = await waitForExit(control, CONTROL_OBSERVATION_WINDOW);
  if (outcome.kind === 'spawn-error') {
    throw new Error(`The control instance could not be spawned: ${outcome.message}`);
  }
  if (outcome.kind === 'exited') {
    throw new Error(
      `The control instance exited on its own (code ${outcome.code}, signal ` +
        `${outcome.signal}) within ${CONTROL_OBSERVATION_WINDOW}ms. It has its own ` +
        `--user-data-dir, so it should have become a primary instance and kept running. ` +
        `An artifact that quits on its own makes the test above meaningless: it would pass ` +
        `for a reason that has nothing to do with the lock. Output:\n${control.output()}`
    );
  }

  // And it is a running application, not a process that hung before it did anything: the
  // data directory is created by `ensureDataDir()`, which runs in the `whenReady` branch
  // — the branch the refused instance must never reach. Its presence there proves the
  // control got a lock of its own and carried on into the normal startup path.
  await expect
    .poll(() => fs.existsSync(path.join(controlDir, 'drawers')), {
      timeout: 20_000,
      message: `The control instance never created ${controlDir}/drawers, so it did not ` +
        `reach app.whenReady(). It should have started as an ordinary primary instance.`,
    })
    .toBe(true);
});
