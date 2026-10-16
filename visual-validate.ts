import { _electron as electron } from '@playwright/test';
import path from 'path';

(async () => {
  const appImage = '/home/marcelo/Documentos/opencode/Clavis-Project/out/make/AppImage/x64/clavis-0.4.9-beta-x64.AppImage';
  const app = await electron.launch({ args: [appImage], executablePath: appImage });
  const win = await app.firstWindow();
  await win.waitForLoadState('load');
  await win.screenshot({ path: '/tmp/appimage-validation.png', fullPage: false });
  const title = await win.title();
  console.log('AppImage validado — título:', title);
  await app.close();
})();
