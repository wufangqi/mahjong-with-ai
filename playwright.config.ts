import { defineConfig, devices } from '@playwright/test';
import { CHROME_UHD_GPU_ARGS } from './tools/budget/chromeGpuArgs.mjs';

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
  ],
});
