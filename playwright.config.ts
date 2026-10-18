import { defineConfig } from '@playwright/test';

// One config, at the root, so `npm run test:e2e` resolves it without `--config`.
//
// It used to live at tests/e2e/playwright.config.ts with `testDir: './tests/e2e'`, which
// Playwright resolves relative to the config's own directory — so it pointed at
// tests/e2e/tests/e2e, which does not exist, and no script ever passed `--config`, so it
// was an orphan. With no config found, Playwright defaults to the cwd and the default
// testMatch, '**/*.@(spec|test).?(c|m)[jt]s?(x)', which also matches the 39 vitest
// files: `npm run test:e2e` collected 42 files and failed on the first React test.
//
// The Desktop Safari project was removed rather than repaired: it declared no
// launchOptions, so it inherited the `electron` executablePath set on `use` above while
// devices['Desktop Safari'] selects webkit — WebKit pointed at the Electron binary. There
// is no web target to run it against; these specs drive the Electron app itself.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  // The vitest suite lives in the same tree and must never be collected here.
  testIgnore: '**/*.test.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // Playwright's default is 30s for the whole test, and the per-expectation timeouts in the
  // specs draw from that same budget rather than adding to it. Every unlock derives a key
  // with argon2id at 2^18 KiB — 256 MiB and a few hundred ms on a fast machine — and the
  // round trip does five or six of them, so a 2-vCPU CI runner is routinely several times
  // slower. This is the setting that stops the first red run from being a runner, not a bug.
  timeout: 120_000,
  reporter: 'list',
  // Electron specs launch the packaged app; there is no web server to start and no
  // baseURL to navigate to — the window comes from app.firstWindow().
});
