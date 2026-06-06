import { test, expect } from '@playwright/test';
import { mockAuthedApp, task } from './helpers';

// PLAN.md 4.2 – Kanban, vytvoření úkolu, přepínání pohledů, klávesové zkratky.
test.beforeEach(async ({ page }) => {
  await mockAuthedApp(page, [task('t1', 'Existující úkol', 'Todo')]);
});

test('zobrazí Kanban se sloupci a úkolem', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
  await expect(page.getByText('Existující úkol')).toBeVisible();
});

test('otevře modal nového úkolu klávesou N', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('přepne na kalendář klávesou 3', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('3');
  await expect(page.getByText('Po', { exact: true })).toBeVisible();
});

test('vytvoří úkol přes modal', async ({ page }) => {
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: task('new', 'Nový z E2E') });
    } else {
      await route.fulfill({ json: [task('t1', 'Existující úkol')] });
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Nový úkol' }).click();
  await page.getByLabel('Název').fill('Nový z E2E');
  await page.getByRole('button', { name: 'Vytvořit' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
