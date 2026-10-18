import { test, expect } from '@playwright/test';
import { launchIsolated } from './launch';
import { APP_VERSION } from './artifact';

// Invariant: the built artifact reports the version the manifest declares.
//
// Renamed from `appimage-validation.spec.ts`, because it does not necessarily test an
// AppImage. It tests whichever packaged build artifact.ts finds — the AppImage when one
// exists, the `electron-forge package` output otherwise — and a filename that names the
// artifact it does not always exercise is the kind of drift this suite exists to catch.
//
// Launched through launch.ts, which is also what isolates the profile. This spec used to
// launch with `args: [appImage]` and no `--user-data-dir` — it read the developer's real
// drawers while being described as a passing test.
test('the packaged application launches and reports the version declared in package.json', async () => {
  const { app, window, close } = await launchIsolated();

  const version = await app.evaluate(async ({ app: electronApp }) => electronApp.getVersion());
  expect(version).toBe(APP_VERSION);

  // The UI loads (app title heading).
  await expect(window.getByRole('heading', { name: 'Clavis' })).toBeVisible({ timeout: 5000 });

  // close(), not app.close(): it also removes the profile and download temp directories.
  await close();
});