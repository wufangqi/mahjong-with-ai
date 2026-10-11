import { defineConfig, devices } from '@playwright/test';
import { CHROME_UHD_GPU_ARGS } from './tools/budget/chromeGpuArgs.mjs';

const publishOnly = /publish\.spec\.ts/;
/** Firefox/WebKit need host libs + usable WebGL2; enable in CI or PUBLISH_MULTI_BROWSER=1. */
const multiBrowser =
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  process.env.PUBLISH_MULTI_BROWSER === '1';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // ANGLE/Vulkan binds Intel UHD; precise-memory for soak samples (WUF-65).
          args: CHROME_UHD_GPU_ARGS,
        },
      },
    },
    ...(multiBrowser
      ? [
          {
            // Edge shares Chromium; exercise Gecko for Firefox acceptance.
            name: 'firefox',
            testMatch: publishOnly,
            use: { ...devices['Desktop Firefox'] },
          },
          {
            // WebKit stands in for desktop Safari on Linux CI.
            name: 'webkit',
            testMatch: publishOnly,
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],
});
