import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [react(), svgr()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'jsdom',
    testTimeout: 30000,
    // QA-03 — Coverage thresholds (floors just below today's measured values:
    // 82.53 / 72.04 / 80.06 / 83.77). They exist to stop regression, not demand
    // a rewrite. CI runs `npm run test:coverage` which fails if thresholds dip.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 75,
        lines: 80,
      },
    },
  },
});