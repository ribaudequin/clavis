import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test('AppImage local — validação básica', async () => {
  const appImage = path.join(__dirname, '../../out/make/AppImage/x64/clavis-0.4.9-beta-x64.AppImage');
  const app = await electron.launch({ args: [appImage], executablePath: appImage });
  const window = await app.firstWindow();
  await window.waitForLoadState('load');

  // Versão via API (testada anteriormente no harness)
  const version = await app.evaluate(async ({ app }) => app.getVersion());
  expect(version).toBe('0.4.9-beta');

  // Verifica que a UI carrega (título do app)
  await expect(window.getByRole('heading', { name: 'Clavis' })).toBeVisible({ timeout: 5000 });

  await app.close();
});
