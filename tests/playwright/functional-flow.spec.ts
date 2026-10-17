import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';

test.skip('AppImage smoke + recommended flow', async ({ page }) => {
  const proc = spawn('bash', ['-c', `DISPLAY=:0 "/home/marcelo/Documentos/opencode/Clavis-Project/out/make/AppImage/x64/clavis-0.6.0-beta-x64.AppImage" --user-data-dir=/tmp/clavis-e2e-$$`], { detached: true });
  await new Promise(r => setTimeout(r, 5000));
  await page.goto('http://localhost:3000');
  expect(require('fs').existsSync('/home/marcelo/Documentos/opencode/Clavis-Project/out/make/AppImage/x64/clavis-0.6.0-beta-x64.AppImage')).toBeTruthy();
  expect(proc.exitCode === null || proc.exitCode === undefined).toBeTruthy();
  await expect(page.locator('text=/bytes/')).toBeVisible();
  proc.kill('SIGTERM');
});
