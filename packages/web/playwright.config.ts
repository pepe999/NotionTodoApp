import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E / visual / a11y (PLAN.md 4.2–4.4).
 *
 * Specy mockují síť na úrovni prohlížeče (page.route), takže nepotřebují běžící
 * backend – jen Vite dev server (webServer níže). Spuštění:
 *   npx playwright install chromium && npm run test:e2e --workspace @notiontodoapp/web
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
