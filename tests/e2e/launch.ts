// One way to start the packaged app for an e2e test.
//
// Two things had been done per-spec and neither survived review. The packaged specs each
// carried their own `electron.launch(...)`, and one of them (`appimage-validation.spec.ts`)
// launched with **no** `--user-data-dir` at all — so the suite that everyone believed was
// green was reading the developer's real drawers. The other (`clavis.spec.ts`) launched the
// source tree with `args: ['.']`, which cannot render anything: main/index.ts:41 does
// `loadURL('http://localhost:3000')` when `app.isPackaged` is false, and no npm script
// starts that server, so every window it opened was Chromium's `Cannot GET /` error page.
// Measured, not assumed — see the header comment in clavis.spec.ts.
//
// The isolation is asserted below rather than requested. A comment saying "isolated" is
// evidence of intent; `userDataPath` coming back as something other than the temporary
// directory is evidence of behaviour, and it fails the test that most needs it — the one
// that would otherwise write to the real profile.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolveTarget } from './artifact';

// The password policy has two branches, and they are alternatives: >= 12 characters with all four
// character classes, OR >= 20 characters of any mix. An ordinary word fails at create time on
// both. This password is >= 20 characters AND carries all four classes, so it satisfies both
// branches — the fixture must not depend on the composition branch alone, which is one tightening
// of the policy away from refusing every drawer the suite creates. One constant, so the fixtures
// cannot drift apart between specs.
export const E2E_PASSWORD = 'E2e-Smoke-Passphrase1!';

// Every user-facing string goes through t(), and the locale is NOT pinned at runtime.
//
// There is no override of any kind — no CI variable, no environment variable: the locale
// is the machine's. `detectLocale()` used to open with `if (process.env.CI) return 'en'`,
// which read like an override and was not one: Vite substitutes `process.env` with `{}` at
// build time, so the branch shipped as `{}.CI ? 'en' : …`, a constant undefined. It was
// removed on 2026-10-22 (HYG-23) — the branch was dead code in the artifact, and unnecessary
// in the tests. A CI=1 env var on the launched app therefore does nothing, which is why an
// earlier comment here claiming it pinned English was wrong, and why the app rendered pt-PT
// on a box launched with CI=1.
//
// The locale consequently follows the machine running the app. These regexes are the fix:
// each matches both catalogues. They are not decoration — a name that matched only English
// would fail this suite on every Portuguese machine and pass on every CI runner, which is
// the mirror image of a locale-blind assertion.
export const UI = {
  newDrawer: /^(new drawer|nova gaveta)$/i,
  createFirst: /^(create your first drawer|criar a primeira gaveta)$/i,
  open: /^(open|abrir)$/i,
  delete: /^(delete|eliminar)$/i,
  cancel: /^(cancel|cancelar)$/i,
  import: /^(import|importar)$/i,
  // Distinct from `delete`: the row button in the list, whose name is exactly btn.delete.
  // The button inside an open drawer is btn.delete_drawer and opens the confirmation.
  deleteDrawer: /^(delete drawer|eliminar gaveta)$/i,
  saveAndBack: /^(save drawer and back to menu|guardar e voltar)$/i,
  // Anchored on purpose. `btn.save_and_back` is "Save drawer and back to menu" in English
  // — which does not end in "back" — and "Guardar e voltar" in pt-PT, which does. Left
  // unanchored this regex matched the save button as well as the back button, and `.first()`
  // hid it by resolving on DOM order. A selector that only breaks in the locale the author
  // develops in is the exact hazard the bilingual list exists to prevent.
  back: /^(←\s*)?(back|voltar)$/i,
  saveAndLeave: /^(save and leave|guardar e sair)$/i,
  discardAndLeave: /^(discard and leave|descartar e sair)$/i,
} as const;

// Where the main process records what happened to each download, so a failed export
// can say what it saw instead of only how long it waited.
const DOWNLOAD_EVENTS_KEY = '__clavisDownloadEvents';

export interface IsolatedApp {
  app: ElectronApplication;
  window: Page;
  /** The temporary profile this instance owns. Removed by close(). */
  profileDir: string;
  /** Where Electron writes `<a download>` exports, so a spec can read them back. */
  downloadDir: string;
  downloadEvents(): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * Removes a directory recursively, retrying while the OS still holds a handle on one of
 * its files, and never throws.
 *
 * `fs.rmSync(dir, { recursive: true, force: true })` uses Node's default
 * `maxRetries: 0`, and `force: true` only suppresses the error of a *missing* path. On
 * Windows a file still open by a live Chromium child (`Local Storage/leveldb/*`,
 * `Cache/*`, `SingletonLock`) fails with EBUSY/EPERM, and that exception is thrown
 * from the spec's `afterEach` — failing the test that had just passed, over a file the
 * test never touched.
 *
 * So it retries (Windows releases the handle shortly after the process dies) and
 * reports instead of throwing: a leftover temporary directory is untidy, a teardown
 * that fails the suite is worse.
 */
export function removeDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (error) {
    console.warn(
      `[e2e] could not remove ${dir}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function launchIsolated(): Promise<IsolatedApp> {
  const target = resolveTarget();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clavis-e2e-profile-'));
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clavis-e2e-download-'));

  const app = await electron.launch({
    args: [...(target.passAsArgument ? [target.executablePath] : []), `--user-data-dir=${profileDir}`],
    executablePath: target.executablePath,
    // The real environment is inherited so DISPLAY/PATH reach the app, but process.env is
    // Record<string, string | undefined> and Electron wants Record<string, string> — passing
    // it through unchanged is a type error, and `as` would paper over entries that really
    // are undefined.
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Which artifact answered matters when a run is read weeks later and there are two builds
  // on disk, so it goes in the transcript rather than only in a comment.
  console.log(`[e2e] ${target.kind}: ${target.executablePath}`);

  // store.ts skips the one-shot migration out of ~/.local/share/Clavis when this switch is
  // present, so the run starts from genuinely nothing. Both halves of that are checked here
  // rather than assumed: the switch is read, and the path Electron actually used is compared.
  const actual = await app.evaluate(async ({ app: electronApp }) => ({
    userData: electronApp.getPath('userData'),
    switched: electronApp.commandLine.hasSwitch('user-data-dir'),
    logs: electronApp.getPath('logs'),
  }));

  const cleanup = async (): Promise<void> => {
    await app.close().catch(() => undefined);
    removeDir(profileDir);
    removeDir(downloadDir);
  };

  // realpath, not resolve: os.tmpdir() is /var/folders/... on macOS while Electron reports
  // the canonicalised /private/var/folders/..., so a lexical comparison throws here on a
  // correct profile and reads like an isolation failure.
  const canonical = (target: string): string => {
    try {
      return fs.realpathSync(target);
    } catch {
      return path.resolve(target);
    }
  };

  if (!actual.switched || canonical(actual.userData) !== canonical(profileDir)) {
    await cleanup();
    throw new Error(
      `Profile isolation failed: asked for ${profileDir}, Electron used ${actual.userData} ` +
        `(switch present: ${actual.switched}). Refusing to run a test against the real profile.`
    );
  }

  // The log has to follow the profile as well. Electron's default log directory is
  // inside `userData` on Linux and Windows, but at `~/Library/Logs/<app name>` on
  // macOS — so a relocation that failed would leave the log in a file shared by every
  // Clavis process on the machine, and the specs that read the log would read
  // whichever process wrote there last. `src/main/index.ts` moves it into the profile;
  // this checks that it stayed there.
  //
  // The log lives at `<profile>/logs`, so this is a *prefix* test: a path that starts
  // with the profile directory, not one that equals it.
  if (!canonical(actual.logs).startsWith(canonical(profileDir) + path.sep)) {
    await cleanup();
    throw new Error(
      `Log isolation failed: the log would be written to ${actual.logs}, outside the ` +
        `throwaway profile ${profileDir}. Refusing to run a test against a shared log.`
    );
  }

  // Exports are produced as a Blob and handed to a detached `<a download>`, so Chromium
  // takes over the whole transfer and nothing in the app chooses where it lands. Measured:
  // without a listener here, `will-download` fires and then nothing is ever written —
  // Chromium waits for a save dialog that this environment never shows, and the file exists
  // neither in the download directory nor in ~/Downloads. `setSavePath` is what completes it.
  //
  // HYG-24 — The events of that download are recorded, because a stalled export used
  // to surface as a bare timeout that pointed at the harness rather than at the export.
  // What the events say is the difference between the two failures that look alike
  // from the outside: Chromium never started the transfer (the blob was gone before it
  // took it) and Chromium started it and it never finished.
  // The key travels in as an argument: `evaluate` runs the function in the main
  // process, where this module's scope does not exist.
  await app.evaluate(async ({ session }, options: { dir: string; key: string }) => {
    const recorded = (globalThis as unknown as Record<string, string[]>)[options.key] ?? [];
    (globalThis as unknown as Record<string, string[]>)[options.key] = recorded;
    session.defaultSession.on('will-download', (_event, item) => {
      recorded.push(`will-download:${item.getFilename()}`);
      item.setSavePath(`${options.dir}/${item.getFilename()}`);
      item.on('updated', (_e: unknown, state: string) => {
        recorded.push(`updated:${state}`);
      });
      item.on('done', (_e: unknown, state: string) => {
        recorded.push(`done:${state}`);
      });
    });
  }, { dir: downloadDir, key: DOWNLOAD_EVENTS_KEY });

  const downloadEvents = async (): Promise<string[]> =>
    (await app.evaluate(async (_electron, key: string) => {
      const recorded = (globalThis as unknown as Record<string, string[]>)[key];
      return recorded ?? [];
    }, DOWNLOAD_EVENTS_KEY)) as string[];

  return { app, window, profileDir, downloadDir, downloadEvents, close: cleanup };
}

/** Waits for Chromium to finish writing the export; it is async and has no completion event. */
export async function waitForDownload(downloadDir: string, timeoutMs = 15_000, events?: () => Promise<string[]>): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = fs.existsSync(downloadDir) ? fs.readdirSync(downloadDir) : [];
    const found = files.find((name) => name.endsWith('.clavis'));
    if (found) {
      const full = path.join(downloadDir, found);
      // A zero-length file means the download started but has not been flushed yet.
      if (fs.statSync(full).size > 0) return full;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const seen = events ? await events().catch(() => []) : [];
  throw new Error(`No .clavis was written to ${downloadDir} within ${timeoutMs}ms. Download events: ${JSON.stringify(seen)}`);
}

/**
 * Points the import dialog at a fixed path. `registerIpcHandlers` destructures `deps.dialog`
 * once at registration but calls `dialog.showOpenDialog(...)` on every import, so replacing
 * the method on the live module object is visible to the running handler. There is no way to
 * drive a native file chooser, and the three tests that used to "test" import by clicking the
 * button and asserting the word "Clavis" was still on screen were checking nothing at all.
 */
export async function stubImportDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(async ({ dialog }, chosen) => {
    (dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = async () => ({
      canceled: false,
      filePaths: [chosen],
    });
  }, filePath);
}