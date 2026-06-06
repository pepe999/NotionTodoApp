import { test, expect } from '@playwright/test';
import { mockAuthedApp, task } from './helpers';

// PLAN.md 4.3 – visual regression. Baseline: `--update-snapshots`.
// Threshold 0.2 % kvůli rozdílům font renderingu mezi OS (běhat na linux/chromium v CI).
test('Kanban snapshot', async ({ page }) => {
  await mockAuthedApp(page, [task('t1', 'Alpha'), task('t2', 'Beta', 'Done')]);
  await page.goto('/');
  await page.getByRole('heading', { name: 'Todo' }).waitFor();
  await expect(page).toHaveScreenshot('kanban.png', { maxDiffPixelRatio: 0.002, fullPage: true });
});

test('prázdný Kanban snapshot', async ({ page }) => {
  await mockAuthedApp(page, []);
  await page.goto('/');
  await page.getByText('Zatím žádné úkoly').waitFor();
  await expect(page).toHaveScreenshot('kanban-empty.png', {
    maxDiffPixelRatio: 0.002,
    fullPage: true,
  });
});
