import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';

// Functional flow test — recommended path (HYG-11/12 gate candidate)
// AppImage integrated + isolated profile (HYG-16 fix)
test.describe('AppImage smoke + recommended flow', () => {
  let proc: ReturnType<typeof spawn>;

  test.beforeAll(async () => {
    proc = spawn('bash', ['-c', `DISPLAY=:0 "/home/marcelo/Documentos/opencode/Clavis-Project/out/make/AppImage/x64/clavis-0.6.0-beta-x64.AppImage" --user-data-dir=/tmp/clavis-e2e-$$`], { detached: true });
    await new Promise(r => setTimeout(r, 5000));
  });

  test.afterAll(() => {
    if (proc && !proc.killed) proc.kill('SIGTERM');
  });

  test('recommend flow + smoke', async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Smoke: AppImage artifact exists
    expect(require('fs').existsSync('/home/marcelo/Documentos/opencode/Clavis-Project/out/make/AppImage/x64/clavis-0.6.0-beta-x64.AppImage')).toBeTruthy();
    // Process alive
    expect(proc.exitCode === null || proc.exitCode === undefined).toBeTruthy();

    // Recommended operational flow (manual confirmation via rendered UI if running)
    // The counter must declare BYTE limit (HYG-10)
    await expect(page.locator('text=/bytes/')).toBeVisible();
  });
});
