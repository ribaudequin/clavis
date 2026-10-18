import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { findAppImage, APP_VERSION } from './appimage';

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

const PASSWORD = 'E2e-Smoke-Pass1!';

// Scoped to the modal's role="dialog": the form also holds the show/hide toggle, and the
// create modal has its own submit button with the same accessible name.
const OPEN_DRAWER = /^(open|abrir)$/i;

// Matches both locales; t('btn.delete') is "Delete" / "Eliminar".
const DELETE_DRAWER = /^(delete|eliminar)$/i;

async function launch(appImage: string): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: [appImage, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'clavis-e2e-'))}`],
    executablePath: appImage,
    // store.ts skips the legacy ~/.local/share/Clavis migration when --user-data-dir is
    // set (userDataWasOverridden), so the run starts empty instead of inheriting the real
    // profile's drawers. CI=1 pins detectLocale() to 'en' so the assertions below do not
    // depend on the runner's system locale.
    env: { ...process.env, CI: '1' },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

test('create, unlock, edit, save, reopen and delete against the packaged AppImage', async () => {
  const appImage = findAppImage();
  const { app, window } = await launch(appImage);

  // The build under test is the one the manifest declares.
  expect(await app.evaluate(async ({ app: electronApp }) => electronApp.getVersion())).toBe(APP_VERSION);

  // --- create -------------------------------------------------------------------
  await window.getByRole('button', { name: /new drawer|nova gaveta|create the first/i }).first().click();
  await window.locator('#drawer-title').fill('E2E Drawer');
  await window.locator('#drawer-password').fill(PASSWORD);
  await window.locator('#drawer-confirm-password').fill(PASSWORD);
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
  await dialog.getByRole('button', { name: OPEN_DRAWER }).click();
  await expect(dialog.locator('#password-error')).toBeVisible({ timeout: 15000 });
  await expect(window.locator('#drawer-content-textarea')).toHaveCount(0);

  await passwordInput.fill(PASSWORD);
  await dialog.getByRole('button', { name: OPEN_DRAWER }).click();

  const content = window.locator('#drawer-content-textarea');
  await expect(content).toBeVisible({ timeout: 15000 });

  // --- edit and save ------------------------------------------------------------
  const edited = 'Edited by the packaged flow test.';
  await content.fill(edited);
  await window.getByRole('button', { name: /save drawer and back|guardar e voltar/i }).click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  // --- reopen: the ciphertext really changed ------------------------------------
  await window.getByRole('list').getByText('E2E Drawer').click();
  const reopened = window.getByRole('dialog');
  await expect(reopened.locator('#password-input')).toBeVisible({ timeout: 15000 });
  await reopened.locator('#password-input').fill(PASSWORD);
  await reopened.getByRole('button', { name: OPEN_DRAWER }).click();
  await expect(window.locator('#drawer-content-textarea')).toHaveValue(edited, { timeout: 15000 });

  // --- delete -------------------------------------------------------------------
  await window.getByRole('button', { name: /back|voltar/i }).first().click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  const row = window.getByRole('listitem').filter({ hasText: 'E2E Drawer' });
  await row.getByRole('button', { name: DELETE_DRAWER }).click();

  // Scoped to the confirmation dialog: the row's own Delete button is still in the DOM
  // behind the overlay, and both carry the same accessible name, so an unscoped
  // locator either clicks the one under the overlay or is blocked by it.
  const confirm = window.locator('[aria-labelledby="delete-confirm-title"]');
  await expect(confirm).toBeVisible({ timeout: 15000 });
  await confirm.getByRole('button', { name: DELETE_DRAWER }).click();
  await expect(window.getByRole('list').getByText('E2E Drawer')).toHaveCount(0, { timeout: 15000 });

  await app.close();
});
