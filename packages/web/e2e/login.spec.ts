import { test, expect } from '@playwright/test';

// PLAN.md 4.2 – login flow (mock OAuth na úrovni prohlížeče).
test('nepřihlášený uživatel vidí přihlášení', async ({ page }) => {
  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
  );
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Přihlásit přes Google' })).toBeVisible();
});

test('chráněná cesta přesměruje na login', async ({ page }) => {
  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Přihlásit přes Google' })).toBeVisible();
});
