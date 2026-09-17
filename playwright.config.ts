import { defineConfig, devices } from '@playwright/test';

const CI = process.env.CI === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad Pro'] },
    },
  ],
  // In CI, the server is started externally (e2e.yml) before Playwright runs.
  // Only define webServer for local development.
  ...(CI
    ? {}
    : {
        webServer: {
          command: 'bun run dev',
          url: 'http://localhost:8080',
          reuseExistingServer: true,
          timeout: 120000,
        },
      }),
});
