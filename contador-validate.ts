import { _electron as electron } from '@playwright/test';
import path from 'path';

(async () => {
  const appImage = '/home/marcelo/Documentos/opencode/Clavis-Project/out/make/AppImage/x64/clavis-0.4.9-beta-x64.AppImage';
  const app = await electron.launch({ args: [appImage], executablePath: appImage });
  const win = await app.firstWindow();
  await win.waitForLoadState('load', { timeout: 8000 });

  await win.waitForLoadState('load', { timeout: 15000 });
  await win.screenshot({ path: '/tmp/contador-validado.png', fullPage: false });
  console.log('Contador implementado — screenshot: /tmp/contador-validado.png');

  await app.close();
})();
