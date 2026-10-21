// The KDF the packaged build actually uses.
//
// Why this test exists: `src/main/encryption.ts:34-41` loads the argon2 native module
// inside a try/catch, and when the load fails it falls back to Node's scrypt — with a
// `logger.warn` and nothing else. No user sees it, no dialog says it, and no test
// asserted it. So the question "does the Windows build derive keys with argon2id or
// with scrypt?" had no answer: the published Windows and macOS builds had never been
// executed by anything, and the fallback is exactly the kind of failure that hides.
//
// The answer is already written down, in the drawer the app creates: the stored
// metadata carries `keyDerivation.algorithm` — 'argon2id' | 'scrypt'
// (`src/main/store.ts:369`, filled from the backend that actually derived the key,
// `encryption.ts:180`). A drawer created on a build whose native module loaded records
// 'argon2id'; a drawer created on a build that fell back records 'scrypt'. This test
// creates a drawer through the UI and reads that field back off disk.
//
// It is deliberately not a unit test. `tests/encryption.test.ts` exercises the module
// in the developer's own process, where argon2 is installed and loadable — it cannot
// answer the question, which is about the *packaged* artifact on a *foreign* platform.
// Here the app under test is the binary that ships, so the assertion is about the
// thing the users download.
//
// When it fails, it fails with the cause: the native module did not load, the app
// fell back to scrypt, and the build is weaker than the one that was intended.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchIsolated, UI, E2E_PASSWORD } from './launch';
import type { IsolatedApp } from './launch';

// One app per test, always torn down — the process and both temporary directories,
// which app.close() alone would leave behind.
let ctx: IsolatedApp | null = null;
test.afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

async function open(): Promise<IsolatedApp> {
  ctx = await launchIsolated();
  return ctx;
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

/** The `.clavis` files in the profile's drawers directory. */
function drawerFiles(drawersDir: string): string[] {
  if (!fs.existsSync(drawersDir)) return [];
  return fs.readdirSync(drawersDir).filter((name) => name.endsWith('.clavis'));
}

test('the packaged build derives keys with argon2id, not the silent scrypt fallback', async () => {
  const title = 'KDF Backend';
  const { window, profileDir } = await open();

  await createDrawer(window, title);

  // The drawers live in `<userData>/drawers` (src/main/store.ts, `getDrawersPath`),
  // and `<userData>` is the throwaway profile this instance owns — the isolation is
  // asserted by the harness before the app is handed over.
  const drawersDir = path.join(profileDir, 'drawers');

  // One drawer, written by this run. The file is created by an atomic rename
  // (`atomicWrite`), so it is either absent or complete.
  await expect
    .poll(() => drawerFiles(drawersDir).length, {
      timeout: 15_000,
      message:
        `No .clavis file appeared in ${drawersDir}. The drawer was created through the ` +
        'UI and listed on screen, so the store wrote it — without a file to read there ' +
        'is nothing to assert the KDF against.',
    })
    .toBe(1);

  const file = path.join(drawersDir, drawerFiles(drawersDir)[0]);
  const drawer = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    keyDerivation?: { algorithm?: string };
  };
  const algorithm = drawer.keyDerivation?.algorithm;

  // The diagnosis is written from the value that was actually read, so the message
  // cannot claim a scrypt fallback that did not happen — and when the fallback *did*
  // happen, it names the cause rather than just the mismatch.
  expect(
    algorithm,
    `The drawer written by the packaged build records keyDerivation.algorithm = ` +
      `"${String(algorithm)}" instead of "argon2id". ` +
      (algorithm === 'scrypt'
        ? 'The argon2 native module did not load on this platform and the app fell ' +
          'back to scrypt (src/main/encryption.ts:34-41 — the require() sits in a ' +
          'try/catch whose only consequence is a logger.warn). Nothing else would ' +
          'ever have said so: the drawer is created, encrypted and unlocked normally, ' +
          'and the fallback is invisible to the user.'
        : 'The field is written by the store on every save (src/main/store.ts:369) ' +
          'and always names the backend that actually derived the key, so it should ' +
          'be present and should be argon2id.')
  ).toBe('argon2id');
});
