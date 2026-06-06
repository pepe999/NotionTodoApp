import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAuthedApp, task } from './helpers';

// PLAN.md 4.4 – a11y: žádná kritická/serious porušení na klíčových stránkách.
test('LoginPage nemá kritické a11y problémy', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto('/login');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(serious).toEqual([]);
});

test('Dashboard (Kanban) nemá kritické a11y problémy', async ({ page }) => {
  await mockAuthedApp(page, [task('t1', 'Úkol')]);
  await page.goto('/');
  await page.getByRole('heading', { name: 'Todo' }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(serious).toEqual([]);
});
