import { defineConfig, devices } from '@playwright/test';

// Full end-to-end suite against a production build, served the same way as the live site
// (base path /bjj/, service worker enabled). Separate from `npm test` (vitest) so the fast
// unit suite stays fast; run this with `npm run e2e`.
export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/bjj/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/bjj/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
