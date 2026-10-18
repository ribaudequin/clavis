import { test, expect, _electron as electron } from '@playwright/test';
import { findAppImage, APP_VERSION } from './appimage';

test('AppImage launches and reports the version declared in package.json', async () => {
  const appImage = findAppImage();

  const app = await electron.launch({ args: [appImage], executablePath: appImage });
  const window = await app.firstWindow();
  await window.waitForLoadState('load');

  // Invariant: the built artifact reports the version the manifest declares.
  const version = await app.evaluate(async ({ app: electronApp }) => electronApp.getVersion());
  expect(version).toBe(APP_VERSION);

  // The UI loads (app title heading).
  await expect(window.getByRole('heading', { name: 'Clavis' })).toBeVisible({ timeout: 5000 });

  await app.close();
});
