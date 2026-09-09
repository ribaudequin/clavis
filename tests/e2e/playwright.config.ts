import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: path.join(__dirname, '../../node_modules/electron/dist/electron'),
    },
  },
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: path.join(__dirname, '../../node_modules/electron/dist/electron'),
        },
      },
    },
  ],
});
