import { defineConfig, devices } from '@playwright/test';

const deployedBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    // A *.localhost host resolves locally while exercising the same clean-route
    // branch used by the production domain (127.0.0.1 intentionally uses the
    // legacy .html preview paths in components/routes.js).
    baseURL: deployedBaseURL || 'http://portfolio.localhost:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    reducedMotion: 'reduce'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] }
    }
  ],
  webServer: deployedBaseURL ? undefined : {
    command: 'node tests/static-server.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
