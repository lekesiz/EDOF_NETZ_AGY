import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run E2E tests sequentially to prevent database locks
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker since tests might interact with the database
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/edof',
      WEDOF_API_KEY: 'mock-wedof-key',
      PENNYLANE_API_TOKEN: 'mock-pennylane-token',
      RESEND_API_KEY: 'mock-resend-key',
      CRON_SECRET: 'edof-cron-secret-2026',
      NEXT_PUBLIC_CRON_SECRET: 'edof-cron-secret-2026',
      SKIP_AUTH: 'true',
      NODE_ENV: 'development',
    },
  },
});
