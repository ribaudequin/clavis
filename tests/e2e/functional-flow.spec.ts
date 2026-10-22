import { test, expect } from '@playwright/test';
import { launchIsolated, UI, E2E_PASSWORD } from './launch';
import { APP_VERSION } from './artifact';

// The recommended flow, end to end, against the packaged artifact rather than a dev
// server: create -> unlock -> edit -> save -> reopen -> delete. The reopen is the step
// that earns the test. Everything before it happens inside one decrypted session and
// would still pass if saving did nothing; reopening proves the ciphertext on disk was
// rewritten and re-reads clean through the KDF, which is the part that silently breaks.
//
// It replaced a skipped spec that could not have run: it launched the AppImage through
// `spawn`, waited five seconds, then drove `page` against http://localhost:3000 — an
// origin nothing serves (the vite port only exists under `vite dev`) — and read the
// artifact through a hardcoded absolute path under one developer's home directory. The
// recorded failure was "Cannot GET /". Electron has no baseURL to navigate to: the
// window comes from `app.firstWindow()`.

// The launcher, the profile isolation and the bilingual name matching all live in launch.ts
// now. This file used to carry its own copy of the launch, and the comment under it claimed
// `CI=1` pinned the UI to English. It does not, and it never could: `detectLocale()` has no
// override of any kind (HYG-23 removed its `process.env.CI` branch, which Vite had already
// turned into `{}.CI ? 'en' : …`, a constant undefined, in a packaged build), so the locale
// follows the machine running the app. Hence every name matched below is a two-locale pattern.
// `UI.delete` is the row button in the list; `UI.deleteDrawer` is the button inside an open
// drawer, which opens the confirmation.

test('create, unlock, edit, save, reopen and delete against the packaged build', async () => {
  const { app, window, close } = await launchIsolated();

  // The build under test is the one the manifest declares.
  expect(await app.evaluate(async ({ app: electronApp }) => electronApp.getVersion())).toBe(APP_VERSION);

  // --- create -------------------------------------------------------------------
  await window.getByRole('button', { name: UI.newDrawer }).first().click();
  await window.locator('#drawer-title').fill('E2E Drawer');
  await window.locator('#drawer-password').fill(E2E_PASSWORD);
  await window.locator('#drawer-confirm-password').fill(E2E_PASSWORD);
  await window.locator('form button[type="submit"]').click();

  // The list shows the title that was just encrypted, not a placeholder.
  await expect(window.getByRole('list').getByText('E2E Drawer')).toBeVisible({ timeout: 15000 });

  // --- unlock -------------------------------------------------------------------
  await window.getByRole('list').getByText('E2E Drawer').click();
  const dialog = window.getByRole('dialog');
  const passwordInput = dialog.locator('#password-input');
  await expect(passwordInput).toBeVisible({ timeout: 15000 });

  // A wrong password must be refused, not silently accepted: without this, the unlock
  // below proves nothing, because an empty note also "opens" when nobody checks the key.
  await passwordInput.fill('Wr0ng-Passw0rd!');
  await dialog.getByRole('button', { name: UI.open }).click();
  await expect(dialog.locator('#password-error')).toBeVisible({ timeout: 15000 });
  await expect(window.locator('#drawer-content-textarea')).toHaveCount(0);

  await passwordInput.fill(E2E_PASSWORD);
  await dialog.getByRole('button', { name: UI.open }).click();

  const content = window.locator('#drawer-content-textarea');
  await expect(content).toBeVisible({ timeout: 15000 });

  // --- edit and save ------------------------------------------------------------
  const edited = 'Edited by the packaged flow test.';
  await content.fill(edited);
  await window.getByRole('button', { name: UI.saveAndBack }).click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  // --- reopen: the ciphertext really changed ------------------------------------
  await window.getByRole('list').getByText('E2E Drawer').click();
  const reopened = window.getByRole('dialog');
  await expect(reopened.locator('#password-input')).toBeVisible({ timeout: 15000 });
  await reopened.locator('#password-input').fill(E2E_PASSWORD);
  await reopened.getByRole('button', { name: UI.open }).click();
  await expect(window.locator('#drawer-content-textarea')).toHaveValue(edited, { timeout: 15000 });

  // --- delete -------------------------------------------------------------------
  await window.getByRole('button', { name: UI.back }).first().click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  const row = window.getByRole('listitem').filter({ hasText: 'E2E Drawer' });
  await row.getByRole('button', { name: UI.delete }).click();

  // Scoped to the confirmation dialog: the row's own Delete button is still in the DOM
  // behind the overlay, and both carry the same accessible name, so an unscoped
  // locator either clicks the one under the overlay or is blocked by it.
  const confirm = window.locator('[aria-labelledby="delete-confirm-title"]');
  await expect(confirm).toBeVisible({ timeout: 15000 });
  await confirm.getByRole('button', { name: UI.delete }).click();
  // The last drawer is gone, so this is the empty state: a call to action rather than a list.
  await expect(window.getByRole('button', { name: UI.createFirst })).toBeVisible({ timeout: 15000 });
  await expect(window.getByRole('listitem')).toHaveCount(0);

  // close(), not app.close(): it also removes the profile and download temp directories.
  await close();
});
