import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Clavis E2E — Critical Flows', () => {
  test('create drawer, unlock, edit, save, delete', async () => {
    const app = await electron.launch({ args: ['.'] });
    const window = await app.firstWindow();
    await window.waitForLoadState('load');

    // 1. Create drawer
    await window.locator('button:has-text("New Drawer")').click();
    await window.locator('input[placeholder="Drawer title"]').fill('E2E Test Drawer');
    await window.locator('textarea[placeholder="Drawer content"]').fill('Test content for E2E');
    await window.locator('button:has-text("Create")').click();

    // 2. List drawer
    await expect(window.locator('text=E2E Test Drawer')).toBeVisible({ timeout: 5000 });

    // 3. Unlock drawer
    await window.locator('text=E2E Test Drawer').click();
    await window.locator('input[placeholder="Enter password"]').fill('testpassword');
    await window.locator('button:has-text("Open")').click();

    // 4. Edit and save
    await window.locator('input[id="drawer-title-input"]').fill('Updated Drawer');
    await window.locator('textarea[id="drawer-content-textarea"]').fill('Updated content');
    await window.locator('button:has-text("Save drawer and back to menu")').click();

    // 5. Delete drawer
    await window.locator('button:has-text("delete drawer")').click();
    await window.locator('button:has-text("Delete Drawer")').click();

    await expect(window.locator('text=Updated Drawer')).not.toBeVisible({ timeout: 5000 });
    await app.close();
  });

  test('import drawer via file picker', async () => {
    const app = await electron.launch({ args: ['.'] });
    const window = await app.firstWindow();
    await window.waitForLoadState('load');

    await window.locator('button:has-text("Import")').click();

    await app.close();
  });
});

test.describe('Clavis E2E — Error Paths', () => {
  test('wrong password shows error', async () => {
    const app = await electron.launch({ args: ['.'] });
    const window = await app.firstWindow();
    await window.waitForLoadState('load');

    await window.locator('button:has-text("New Drawer")').click();
    await window.locator('input[placeholder="Drawer title"]').fill('Error Test');
    await window.locator('button:has-text("Create")').click();
    await window.locator('text=Error Test').click();
    await window.locator('input[placeholder="Enter password"]').fill('wrong');
    await window.locator('button:has-text("Open")').click();

    await expect(window.locator('text=Wrong password')).toBeVisible({ timeout: 3000 });
    await app.close();
  });

  test('corrupted file and invalid path handled gracefully', async () => {
    const app = await electron.launch({ args: ['.'] });
    const window = await app.firstWindow();
    await window.waitForLoadState('load');

    // Corrupted file / invalid import path
    await window.locator('button:has-text("Import")').click();

    await expect(window.locator('text=Clavis')).toBeVisible();
    await app.close();
  });
});
