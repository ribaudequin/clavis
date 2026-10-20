// Interaction, keyboard and modal behaviour, driven against the packaged AppImage.
//
// This file replaces a spec that had never run. It launched the source tree with
// `args: ['.']`, which cannot work: main/index.ts:41 calls `loadURL('http://localhost:3000')`
// when `app.isPackaged` is false, and package.json has no script that starts that server (only
// `build:renderer`, which is `vite build`). Measured on this box before rewriting anything —
// the window came up as `Cannot GET /`, title "Error", zero `#root` — so all ten tests died at
// their first locator. Stale selectors were the third reason, not the first: the passwords
// ('testpassword') are rejected by the password policy (>= 12 characters with all four character
// classes, or >= 20 characters of any mix), and the placeholders it matched were reworded in
// 0.6.0.
//
// Two of its tests encoded behaviour the product does not have, which is what a spec that
// executes nowhere is for:
//
//   - `Ctrl+N creates drawer` asserted a global shortcut. The only keyboard shortcut in all of
//     src/ is Ctrl+S in ViewDrawer:103. TODO.md records P1.7 (Ctrl+N, Escape, Enter, Ctrl+S) as
//     DONE, which is wrong about Ctrl+N. The test is deleted rather than made to pass; the
//     Escape and Ctrl+S tests below cover what actually exists.
//   - Three separate tests "tested" import by clicking the button and asserting the word
//     "Clavis" was still on screen — which is true before the click, after it, and on a
//     failure. All three became one round trip (export, delete, import, unlock) that fails if
//     any step does not happen.
//
// And the file was the only one touching the developer's real profile: no `--user-data-dir`.
// That is now asserted, not requested, in launch.ts.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import { launchIsolated, waitForDownload, stubImportDialog, UI, E2E_PASSWORD } from './launch';
import type { IsolatedApp } from './launch';
import { APP_VERSION } from './artifact';

// One app per test, always torn down — including the process and both temporary
// directories, which app.close() alone would leave behind. A leaked Electron process is not
// caught by a single-instance lock either, because the app never takes one (SEC-09, still
// open); it just accumulates.
let ctx: IsolatedApp | null = null;
test.afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

async function open(): Promise<IsolatedApp> {
  ctx = await launchIsolated();
  return ctx;
}

/**
 * Fills the create form and submits it with the button, not the keyboard.
 *
 * There is no content field here — createDrawer takes a title and a password only, and the old
 * spec filled a `textarea[placeholder="Drawer content"]` that does not exist in this modal.
 * Content is set later, on the drawer screen.
 */
async function createDrawer(window: Page, title: string): Promise<void> {
  await window.getByRole('button', { name: UI.newDrawer }).first().click();
  await window.locator('#drawer-title').fill(title);
  await window.locator('#drawer-password').fill(E2E_PASSWORD);
  await window.locator('#drawer-confirm-password').fill(E2E_PASSWORD);
  await window.locator('form button[type="submit"]').click();
  await expect(window.getByRole('list').getByText(title)).toBeVisible({ timeout: 15000 });
}

/** Opens a drawer from the list and unlocks it, so the drawer screen is showing. */
async function unlockDrawer(window: Page, title: string): Promise<void> {
  await window.getByRole('list').getByText(title).click();
  const dialog = window.getByRole('dialog');
  await expect(dialog.locator('#password-input')).toBeVisible({ timeout: 15000 });
  await dialog.locator('#password-input').fill(E2E_PASSWORD);
  await dialog.getByRole('button', { name: UI.open }).click();
  await expect(window.locator('#drawer-content-textarea')).toBeVisible({ timeout: 15000 });
}

test('boots on a throwaway profile that holds none of the real profile', async () => {
  const { app, window, profileDir } = await open();

  expect(await app.evaluate(async ({ app: a }) => a.getVersion())).toBe(APP_VERSION);

  // The empty state rendered. Not `getByRole('list')`: HomeScreen only renders the <ul> when
  // there is something in it, so a drawer-free profile has no list to wait for. And not
  // `getByRole('listitem')).toHaveCount(0)` alone either — that also passes on a window that
  // never painted. The call to action is a positive signal that this is really the app.
  await expect(window.getByRole('button', { name: UI.createFirst })).toBeVisible({ timeout: 15000 });
  await expect(window.getByRole('listitem')).toHaveCount(0);

  // And nothing was written into the profile that was supposed to be empty. This is the one
  // that would catch the legacy migration running despite --user-data-dir (HYG-16), which
  // copied real drawers into a supposedly clean profile.
  const drawerFiles = fs.readdirSync(profileDir).filter((name) => name.endsWith('.clavis'));
  expect(drawerFiles).toEqual([]);
});

test('Escape closes the create modal without creating anything', async () => {
  const { window } = await open();

  await window.getByRole('button', { name: UI.newDrawer }).first().click();
  await window.locator('#drawer-title').fill('Abandoned');
  await window.keyboard.press('Escape');

  await expect(window.getByRole('dialog')).toHaveCount(0);
  // Escape must abandon the form, not leave a half-filled drawer behind it.
  await expect(window.getByRole('listitem')).toHaveCount(0);
});

test('Enter in the create form submits it', async () => {
  const { window } = await open();

  await window.getByRole('button', { name: UI.newDrawer }).first().click();
  await window.locator('#drawer-title').fill('Enter Submits');
  await window.locator('#drawer-password').fill(E2E_PASSWORD);
  await window.locator('#drawer-confirm-password').fill(E2E_PASSWORD);
  // Enter in the title field, not on the submit button: pressing the button would prove
  // nothing about the keyboard.
  await window.locator('#drawer-title').press('Enter');

  await expect(window.getByRole('list').getByText('Enter Submits')).toBeVisible({ timeout: 15000 });
  await expect(window.getByRole('dialog')).toHaveCount(0);
});

test('Ctrl+S saves the open drawer and the edit survives a reopen', async () => {
  const { window } = await open();
  await createDrawer(window, 'Shortcut Save');

  await unlockDrawer(window, 'Shortcut Save');
  const edited = 'Saved with the keyboard shortcut.';
  await window.locator('#drawer-content-textarea').fill(edited);
  await window.locator('#drawer-content-textarea').press('Control+s');

  // Returning to the list at all means the save succeeded — handleSave only calls onBack()
  // after the result came back ok, and a failure leaves the drawer open with a toast. The
  // reopen is what makes it proof rather than inference.
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });
  await unlockDrawer(window, 'Shortcut Save');
  await expect(window.locator('#drawer-content-textarea')).toHaveValue(edited);
});

test('the delete confirmation holds focus, and Escape leaves the drawer alone', async () => {
  const { window } = await open();
  await createDrawer(window, 'Focus Trap');
  await unlockDrawer(window, 'Focus Trap');

  await window.getByRole('button', { name: UI.deleteDrawer }).click();
  const confirm = window.locator('[aria-labelledby="delete-confirm-title"]');
  await expect(confirm).toBeVisible({ timeout: 10000 });

  // The focus trap, on the real window. Asserting "focus is inside the dialog" on open is
  // not this: DeleteConfirmModal focuses its Cancel button from its own mount effect, so that
  // holds whether or not useFocusTrap is wired up at all — removing the hook would leave it
  // green. What the hook does is intercept Tab at the boundaries, so Tab has to be pressed
  // past the last focusable element for the assertion to mean anything.
  const focusIsInside = async (): Promise<boolean> =>
    window.evaluate(() => {
      const dialog = document.querySelector('[aria-labelledby="delete-confirm-title"]');
      return !!dialog && dialog.contains(document.activeElement);
    });

  await window.keyboard.press('Tab');
  await window.keyboard.press('Tab');
  await window.keyboard.press('Tab');
  expect(await focusIsInside()).toBe(true);

  await window.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  // Cancelling must not delete. There is no <ul role="list"> on the drawer screen, so
  // `getByRole('list')` has zero matches here and `toHaveCount(0)` on it would pass on a
  // blank or crashed window; what has to still be on screen is the drawer's own content.
  await expect(window.locator('#drawer-content-textarea')).toBeVisible();

  // Confirm for real this time, so the test cannot pass by never deleting anything.
  // Deleting from inside the drawer returns to the list directly — there is no drawer
  // screen left to go "back" from, and waiting for that button is what hung an earlier
  // version of this test until the timeout.
  await window.getByRole('button', { name: UI.deleteDrawer }).click();
  const confirmed = window.locator('[aria-labelledby="delete-confirm-title"]');
  await expect(confirmed).toBeVisible({ timeout: 10000 });
  await confirmed.getByRole('button', { name: UI.delete }).click();
  // Positive first: the drawer is now the only one, so the app is in the empty state — its
  // call to action, not a <ul role="list">, which only exists while something is in it.
  await expect(window.getByRole('button', { name: UI.createFirst })).toBeVisible({ timeout: 15000 });
  await expect(window.getByRole('listitem')).toHaveCount(0);
});

test('leaving with unsaved edits asks first, and "save and leave" persists them', async () => {
  const { window } = await open();
  await createDrawer(window, 'Unsaved');
  await unlockDrawer(window, 'Unsaved');

  const edited = 'Typed but not yet saved.';
  await window.locator('#drawer-content-textarea').fill(edited);
  await window.getByRole('button', { name: UI.back }).first().click();

  const discard = window.locator('[aria-labelledby="discard-title"]');
  await expect(discard).toBeVisible({ timeout: 10000 });

  // Cancel keeps the edits and the session.
  await discard.getByRole('button', { name: UI.cancel }).click();
  await expect(discard).toHaveCount(0);
  await expect(window.locator('#drawer-content-textarea')).toHaveValue(edited);

  // The primary action is the one that keeps the data.
  await window.getByRole('button', { name: UI.back }).first().click();
  await discard.getByRole('button', { name: UI.saveAndLeave }).click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  await unlockDrawer(window, 'Unsaved');
  await expect(window.locator('#drawer-content-textarea')).toHaveValue(edited);
});

// The button that throws the user's unsaved work away is the one destructive path in this
// modal, and it was the only one with no end-to-end coverage — the test above proves the
// dialog appears and that "save and leave" keeps the data, which says nothing about whether
// "discard and leave" really discards.
test('"discard and leave" drops the edits and keeps the saved content', async () => {
  const { window } = await open();
  await createDrawer(window, 'Discard');
  await unlockDrawer(window, 'Discard');
  await window.locator('#drawer-content-textarea').fill('The saved version.');
  await window.getByRole('button', { name: UI.saveAndBack }).click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  await unlockDrawer(window, 'Discard');
  await window.locator('#drawer-content-textarea').fill('Typed and then thrown away.');
  await window.getByRole('button', { name: UI.back }).first().click();

  const discard = window.locator('[aria-labelledby="discard-title"]');
  await expect(discard).toBeVisible({ timeout: 10000 });
  await discard.getByRole('button', { name: UI.discardAndLeave }).click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  // The edit is gone, and what is left is the version that was actually saved — not an empty
  // note, which is what a half-finished implementation would produce.
  await unlockDrawer(window, 'Discard');
  await expect(window.locator('#drawer-content-textarea')).toHaveValue('The saved version.');
});

test('an exported drawer can be deleted and imported back, and still opens', async () => {
  const { app, window, downloadDir } = await open();
  const original = 'Round trip through a .clavis file.';
  await createDrawer(window, 'Round Trip');
  await unlockDrawer(window, 'Round Trip');
  await window.locator('#drawer-content-textarea').fill(original);
  await window.getByRole('button', { name: UI.saveAndBack }).click();
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });

  // --- export -------------------------------------------------------------------
  const row = window.getByRole('listitem').filter({ hasText: 'Round Trip' });
  await row.getByRole('button', { name: /^(export|exportar)$/i }).click();
  const exported = await waitForDownload(downloadDir);
  expect(exported.endsWith('.clavis')).toBe(true);

  // --- delete, so the import is not blocked by OVERWRITE-01 --------------------
  await row.getByRole('button', { name: UI.delete }).click();
  const confirm = window.locator('[aria-labelledby="delete-confirm-title"]');
  await expect(confirm).toBeVisible({ timeout: 10000 });
  await confirm.getByRole('button', { name: UI.delete }).click();
  await expect(window.getByRole('button', { name: UI.createFirst })).toBeVisible({ timeout: 15000 });
  await expect(window.getByRole('listitem')).toHaveCount(0);

  // --- import -------------------------------------------------------------------
  // The chooser is native, so it is stubbed at the module the handler reads it from.
  await stubImportDialog(app, exported);
  await window.getByRole('button', { name: UI.import }).click();
  await expect(window.getByRole('list').getByText('Round Trip')).toBeVisible({ timeout: 15000 });

  // --- and it decrypts ----------------------------------------------------------
  // The listing alone would pass on a file that imported as an unreadable shell: the title is
  // in cleartext metadata. Unlocking is the assertion that the ciphertext survived.
  await unlockDrawer(window, 'Round Trip');
  await expect(window.locator('#drawer-content-textarea')).toHaveValue(original);
});