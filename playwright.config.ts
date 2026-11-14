import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', actionTimeout: 15000 },
  projects: [
    {
      name: 'initialisation',
      testMatch: 'auth-setup.spec.ts',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'chrome-desktop',
      dependencies: ['initialisation'],
      testIgnore: 'auth-setup.spec.ts',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'chrome-mobile',
      dependencies: ['initialisation'],
      testIgnore: 'auth-setup.spec.ts',
      use: { ...devices['Pixel 7'], browserName: 'chromium', channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'npm run start --workspace @suivi/backend',
      url: 'http://127.0.0.1:3101/api/v1/health/live',
      env: { PORT: '3101', NODE_ENV: 'test', API_DOCS_ENABLED: 'false' },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'npm run preview --workspace @suivi/frontend -- --port 4174',
      url: 'http://127.0.0.1:4174',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3101' },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
