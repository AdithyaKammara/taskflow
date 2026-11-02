import { expect, test, type Page } from '@playwright/test';

/* Local mode: the main task flows, in a real browser with real keyboard and pointer input. */

async function seed(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add sample data' }).click();
  await expect(page.getByText('Sample data added')).toBeVisible();
}

const row = (page: Page, title: string) =>
  page.locator('li.row').filter({ has: page.getByRole('button', { name: title, exact: true }) });

test('sample data fills the dashboard', async ({ page }) => {
  await seed(page);
  await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Start here' }).locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('.db-stat')).toHaveCount(4);
  await expect(page.getByRole('img', { name: /Status breakdown/ })).toBeVisible();
});

test('quick add parses the task and it survives a reload', async ({ page }) => {
  await page.goto('./tasks');
  const quick = page.getByLabel('Quick add task');
  await quick.fill('Review PR tomorrow @priya #dev !high');
  await expect(page.locator('#quickHint')).toContainText('Will add: "Review PR" · high');
  await quick.press('Enter');
  await expect(page.getByText('Added to Inbox')).toBeVisible();
  await page.reload();
  const r = row(page, 'Review PR');
  await expect(r).toContainText('#dev');
  await expect(r).toContainText('Due tomorrow');
  await expect(r.getByLabel('Priya Sharma')).toBeVisible();
});

test('the drawer saves an edit even when Escape closes it', async ({ page }) => {
  await seed(page);
  await page.goto('./tasks');
  await page.getByRole('button', { name: 'Write case-study copy', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  const title = drawer.getByLabel('Task title');
  await title.fill('Write the case-study copy');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Write the case-study copy', exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Write the case-study copy', exact: true }).click();
  await drawer.getByLabel('New subtask').fill('Draft intro');
  await drawer.getByLabel('New subtask').press('Enter');
  await drawer.getByLabel('New comment').fill('Looks good');
  await drawer.getByLabel('New comment').press('Enter');
  await expect(drawer.locator('.sub-list')).toContainText('Draft intro');
  await expect(drawer.locator('.comments')).toContainText('Looks good');
  await expect(drawer.locator('.log')).toContainText('Title edited');
});

test('bulk move, then undo with the keyboard', async ({ page }) => {
  await seed(page);
  await page.goto('./tasks');
  for (const name of ['Set up analytics events', 'Design onboarding flow']) {
    await row(page, name).getByRole('checkbox').check();
  }
  await expect(page.locator('.bulk')).toContainText('2 selected');
  await page.getByLabel('Move selected to').selectOption('done');
  await expect(row(page, 'Set up analytics events').getByLabel(/Status of/)).toHaveValue('done');
  await page.locator('body').press('Control+z');
  await expect(row(page, 'Set up analytics events').getByLabel(/Status of/)).toHaveValue('todo');
});

test('dragging a card moves it to another column', async ({ page }) => {
  await seed(page);
  await page.goto('./board');
  const column = (id: string) =>
    page.locator('section.column').filter({ has: page.locator(`#col-${id}`) });
  // the first card, so the board does not scroll between measuring it and pressing on it
  const card = column('todo').locator('.task-card').first();
  const title = (await card.locator('.title-btn').textContent())!;
  await card.dragTo(column('review'));
  await expect(column('review')).toContainText(title);
  await expect(column('todo')).not.toContainText(title);
});

test('the command palette navigates', async ({ page }) => {
  await page.goto('./');
  await page.locator('body').press('Control+k');
  const palette = page.getByRole('combobox', { name: 'Command palette' });
  await palette.fill('calendar');
  await palette.press('Enter');
  await expect(page).toHaveURL(/\/taskflow\/calendar$/);
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
});

test('a deep link opens that page', async ({ page }) => {
  await page.goto('./board');
  await expect(page.getByRole('heading', { name: 'Board', level: 1 })).toBeVisible();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the menu drawer opens, traps the page and returns focus on Escape', async ({ page }) => {
    await page.goto('./');
    const menu = page.getByRole('button', { name: 'Open menu' });
    await menu.click();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });
});
