// DATA-04 — E2E tests for drawer backup and auto-recovery.
//
// These tests drive the real packaged app through the UI and inspect the filesystem
// to verify that backups are created and recovered correctly. They are the bridge
// between the unit tests (which mock fs/promises) and the real runtime behaviour
// (which involves Electron, the real filesystem, and the full startup sequence).
//
// The tests are deliberately minimal: they create a drawer, save it, and check that
// .bak files exist on disk. The auto-recovery test deletes the live file and restarts
// the app to verify that ensureDataDir restores it from the backup.
//
// Each test uses a fresh isolated profile (launchIsolated), so the backups are not
// polluted by previous runs.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchIsolated, UI, E2E_PASSWORD } from './launch';
import type { IsolatedApp } from './launch';

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
 * Fills the create form and submits it with the button.
 */
async function createDrawer(window: Page, title: string): Promise<void> {
  await window.getByRole('button', { name: UI.newDrawer }).first().click();
  await window.locator('#drawer-title').fill(title);
  await window.locator('#drawer-password').fill(E2E_PASSWORD);
  await window.locator('#drawer-confirm-password').fill(E2E_PASSWORD);
  await window.locator('form button[type="submit"]').click();
  await expect(window.getByRole('list').getByText(title)).toBeVisible({ timeout: 15000 });
}

/**
 * Opens a drawer from the list and unlocks it.
 */
async function unlockDrawer(window: Page, title: string): Promise<void> {
  await window.getByRole('list').getByText(title).click();
  const dialog = window.getByRole('dialog');
  await expect(dialog.locator('#password-input')).toBeVisible({ timeout: 15000 });
  await dialog.locator('#password-input').fill(E2E_PASSWORD);
  await dialog.getByRole('button', { name: UI.open }).click();
  await expect(window.locator('#drawer-content-textarea')).toBeVisible({ timeout: 15000 });
}

/**
 * Saves the current drawer content and returns to the list.
 */
async function saveAndBack(window: Page): Promise<void> {
  await window.locator('#drawer-content-textarea').press('ControlOrMeta+s');
  await expect(window.getByRole('list')).toBeVisible({ timeout: 15000 });
}

/**
 * Returns the path to the drawers directory for the given profile.
 */
function drawersPath(profileDir: string): string {
  return path.join(profileDir, 'drawers');
}

/**
 * Lists all files in the drawers directory.
 */
async function listDrawerFiles(profileDir: string): Promise<string[]> {
  const dir = drawersPath(profileDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort();
}

test('DATA-04: create + first save leaves .clavis and .bak (create counts as save #0)', async () => {
  const { window, profileDir } = await open();

  // createDrawer creates the drawer with an initial save (empty content).
  await createDrawer(window, 'Backup Test');
  await unlockDrawer(window, 'Backup Test');

  // First explicit save: 'First save'
  await window.locator('#drawer-content-textarea').fill('First save');
  await saveAndBack(window);

  // After create + 1 save: .clavis and .clavis.bak exist.
  // createDrawer's initial save counts as save #0, so the first explicit save
  // creates .bak from the initial state.
  const files = await listDrawerFiles(profileDir);
  const clavisFiles = files.filter((f) => f.endsWith('.clavis'));
  const bakFiles = files.filter((f) => f.endsWith('.clavis.bak'));

  expect(clavisFiles).toHaveLength(1);
  expect(bakFiles).toHaveLength(1);
  // No second generation yet.
  expect(files.filter((f) => f.endsWith('.clavis.bak.1'))).toHaveLength(0);
});

test('DATA-04: second save creates .bak with the previous state', async () => {
  const { window, profileDir } = await open();

  await createDrawer(window, 'Backup Test');
  await unlockDrawer(window, 'Backup Test');

  // First save: 'version1'
  await window.locator('#drawer-content-textarea').fill('version1');
  await saveAndBack(window);

  // Second save: 'version2'
  await unlockDrawer(window, 'Backup Test');
  await window.locator('#drawer-content-textarea').fill('version2');
  await saveAndBack(window);

  // After two saves: .clavis and .clavis.bak exist.
  const files = await listDrawerFiles(profileDir);
  const clavisFiles = files.filter((f) => f.endsWith('.clavis'));
  const bakFiles = files.filter((f) => f.endsWith('.clavis.bak'));

  expect(clavisFiles).toHaveLength(1);
  expect(bakFiles).toHaveLength(1);

  // The .bak file should be a valid JSON drawer envelope.
  const bakPath = path.join(drawersPath(profileDir), bakFiles[0]);
  const bakContent = fs.readFileSync(bakPath, 'utf8');
  const parsed = JSON.parse(bakContent);
  expect(parsed).toHaveProperty('id');
  expect(parsed).toHaveProperty('encryptedData');
  expect(parsed).toHaveProperty('salt');
  expect(parsed).toHaveProperty('iv');
  expect(parsed).toHaveProperty('authTag');
});

test('DATA-04: three saves create .bak, .bak.1; four saves fill .bak.2', async () => {
  const { window, profileDir } = await open();

  // createDrawer creates the drawer with an initial save (empty content).
  await createDrawer(window, 'Backup Test');
  await unlockDrawer(window, 'Backup Test');

  // Save 1: 'v1' (creates .bak from initial state)
  await window.locator('#drawer-content-textarea').fill('v1');
  await saveAndBack(window);

  // After create + save 1: .clavis, .clavis.bak
  let files = await listDrawerFiles(profileDir);
  expect(files.filter((f) => f.endsWith('.clavis'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak.1'))).toHaveLength(0);

  // Save 2: 'v2' (creates .bak.1 from previous .bak)
  await unlockDrawer(window, 'Backup Test');
  await window.locator('#drawer-content-textarea').fill('v2');
  await saveAndBack(window);

  // After save 2: .clavis, .clavis.bak, .clavis.bak.1
  files = await listDrawerFiles(profileDir);
  expect(files.filter((f) => f.endsWith('.clavis'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak.1'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak.2'))).toHaveLength(0);

  // Save 3: 'v3' (creates .bak.2 from previous .bak.1)
  await unlockDrawer(window, 'Backup Test');
  await window.locator('#drawer-content-textarea').fill('v3');
  await saveAndBack(window);

  // After save 3: .clavis, .clavis.bak, .clavis.bak.1, .clavis.bak.2
  // (three generations of backup, oldest preserved)
  files = await listDrawerFiles(profileDir);
  expect(files.filter((f) => f.endsWith('.clavis'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak.1'))).toHaveLength(1);
  expect(files.filter((f) => f.endsWith('.clavis.bak.2'))).toHaveLength(1);
  // No fourth generation.
  expect(files.filter((f) => f.endsWith('.clavis.bak.3'))).toHaveLength(0);
});

test('DATA-04: auto-recovery restores .bak when .clavis is missing', async () => {
  const { app, window, profileDir } = await open();

  // createDrawer creates the drawer with an initial save (empty content).
  await createDrawer(window, 'Recover Test');
  await unlockDrawer(window, 'Recover Test');

  // Save twice to have a .bak with meaningful content.
  await window.locator('#drawer-content-textarea').fill('original');
  await saveAndBack(window);
  await unlockDrawer(window, 'Recover Test');
  await window.locator('#drawer-content-textarea').fill('updated');
  await saveAndBack(window);

  // Verify .clavis and .clavis.bak exist.
  let files = await listDrawerFiles(profileDir);
  const clavisFile = files.find((f) => f.endsWith('.clavis'));
  const bakFile = files.find((f) => f.endsWith('.clavis.bak'));
  expect(clavisFile).toBeDefined();
  expect(bakFile).toBeDefined();

  // Read the .bak content before deleting the live file.
  const bakPath = path.join(drawersPath(profileDir), bakFile!);
  const bakContent = fs.readFileSync(bakPath, 'utf8');

  // Simulate the crash window: delete the live .clavis file.
  const clavisPath = path.join(drawersPath(profileDir), clavisFile!);
  fs.unlinkSync(clavisPath);

  // Verify the live file is gone.
  files = await listDrawerFiles(profileDir);
  expect(files.find((f) => f === clavisFile)).toBeUndefined();

  // Close the app.
  await app.close();
  ctx = null;

  // Restart the app with the SAME profile (to trigger ensureDataDir with auto-recovery).
  // We need to manually launch with the same profile directory.
  const { _electron: electron } = await import('@playwright/test');
  const { resolveTarget } = await import('./artifact');
  const target = resolveTarget();
  const newApp = await electron.launch({
    args: [...(target.passAsArgument ? [target.executablePath] : []), `--user-data-dir=${profileDir}`],
    executablePath: target.executablePath,
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
  });
  const newWindow = await newApp.firstWindow();
  await newWindow.waitForLoadState('domcontentloaded');
  ctx = { app: newApp, window: newWindow, profileDir, downloadDir: '', downloadEvents: async () => [], close: async () => { await newApp.close(); } };

  // The .bak should have been renamed to .clavis during startup.
  files = await listDrawerFiles(profileDir);
  const recoveredClavis = files.find((f) => f.endsWith('.clavis'));
  const remainingBak = files.find((f) => f.endsWith('.clavis.bak'));

  expect(recoveredClavis).toBeDefined();
  // The .bak file should have been consumed (renamed to .clavis).
  expect(remainingBak).toBeUndefined();

  // The recovered drawer should open with the password.
  await unlockDrawer(newWindow, 'Recover Test');

  // The recovered content should be from the .bak (which was 'updated' before the crash).
  // Note: .bak contains the state BEFORE the last save, which was 'original'.
  // After the second save, .bak = 'original', .clavis = 'updated'.
  // After deleting .clavis and recovering, .clavis = 'original'.
  await expect(newWindow.locator('#drawer-content-textarea')).toHaveValue('original');
});

test('DATA-04: backups are valid drawer files (same envelope as live)', async () => {
  const { window, profileDir } = await open();

  await createDrawer(window, 'Backup Test');
  await unlockDrawer(window, 'Backup Test');

  // Save three times to have all backup generations.
  await window.locator('#drawer-content-textarea').fill('v1');
  await saveAndBack(window);
  await unlockDrawer(window, 'Backup Test');
  await window.locator('#drawer-content-textarea').fill('v2');
  await saveAndBack(window);
  await unlockDrawer(window, 'Backup Test');
  await window.locator('#drawer-content-textarea').fill('v3');
  await saveAndBack(window);

  // Read all backup files and verify they are valid drawer envelopes.
  const files = await listDrawerFiles(profileDir);
  const bakFiles = files.filter((f) => f.includes('.clavis.bak'));

  expect(bakFiles.length).toBeGreaterThanOrEqual(1);

  for (const bakFile of bakFiles) {
    const bakPath = path.join(drawersPath(profileDir), bakFile);
    const content = fs.readFileSync(bakPath, 'utf8');
    const parsed = JSON.parse(content);

    // Each backup must be a complete drawer envelope.
    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('title');
    expect(parsed).toHaveProperty('iconData');
    expect(parsed).toHaveProperty('createdAt');
    expect(parsed).toHaveProperty('updatedAt');
    expect(parsed).toHaveProperty('encryptedData');
    expect(parsed).toHaveProperty('salt');
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('authTag');
    expect(parsed).toHaveProperty('keyDerivation');

    // The keyDerivation must be valid.
    expect(parsed.keyDerivation).toHaveProperty('algorithm');
    expect(parsed.keyDerivation).toHaveProperty('iterations');
    expect(parsed.keyDerivation).toHaveProperty('memory');
    expect(parsed.keyDerivation).toHaveProperty('parallelism');
  }
});