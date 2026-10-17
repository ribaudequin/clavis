import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
) as { version: string };

const APPIMAGE_DIR = path.resolve(__dirname, '../../out/make/AppImage/x64');

test('AppImage launches and reports the version declared in package.json', async () => {
  // Locate the artifact by glob instead of a hardcoded name, so version bumps
  // cannot break this gate. @reforged/maker-appimage writes to out/make/AppImage/<targetArch>.
  const names = fs.existsSync(APPIMAGE_DIR)
    ? fs.readdirSync(APPIMAGE_DIR).filter((name) => name.endsWith('.AppImage'))
    : [];

  // Newest build wins when several are present.
  const appImage = names
    .map((name) => path.join(APPIMAGE_DIR, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

  if (!appImage) {
    throw new Error(
      `No .AppImage found in ${APPIMAGE_DIR}. Run \`npm run make\` to build one before this test.`
    );
  }

  const app = await electron.launch({ args: [appImage], executablePath: appImage });
  const window = await app.firstWindow();
  await window.waitForLoadState('load');

  // Invariant: the built artifact reports the version the manifest declares.
  const version = await app.evaluate(async ({ app }) => app.getVersion());
  expect(version).toBe(pkg.version);

  // The UI loads (app title heading).
  await expect(window.getByRole('heading', { name: 'Clavis' })).toBeVisible({ timeout: 5000 });

  await app.close();
});