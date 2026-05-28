import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/results',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: './e2e/report' }]],
  use: {
    baseURL: 'http://localhost:3021',
    screenshot: 'off', // we take manual screenshots
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // Expect server + dashboard to be running already
  // Start with: pnpm dev (dashboard on 3021, server on 3020)
});
