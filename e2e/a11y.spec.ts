import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/* Automated accessibility scan (axe, WCAG 2.1 A/AA) of every page and the main dialogs, in both themes. */

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(', ')}`);
}

// axe takes a while on the busier pages, especially with several workers running
test.describe.configure({ timeout: 90_000 });

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('todo-app:theme', t), theme);
      await page.goto('./');
      await page.getByRole('button', { name: 'Add sample data' }).click();
    });

    for (const path of ['./', './tasks', './board', './calendar']) {
      test(`page ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('h1')).toBeVisible();
        expect(await scan(page)).toEqual([]);
      });
    }

    test('task drawer', async ({ page }) => {
      await page.goto('./tasks');
      await page.getByRole('button', { name: 'Write case-study copy', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Task details' })).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('settings dialog', async ({ page }) => {
      await page.getByRole('button', { name: 'Settings' }).click();
      await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  });
}
