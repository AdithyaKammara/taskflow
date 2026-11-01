import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Cloud mode, signed out: the sign-in screen and the invite link. Only client-side checks run here;
 * nothing is sent to the Supabase project.
 */

test('an invite link shows the sign-in screen and remembers the invite', async ({ page }) => {
  await page.goto('./?invite=0123456789abcdef0123456789abcdef');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Sign in or create an account to join your team.')).toBeVisible();
  await expect(page).toHaveURL(/\/taskflow\/$/); // token removed from the address bar
  expect(await page.evaluate(() => localStorage.getItem('todo-app:invite'))).toBe(
    '0123456789abcdef0123456789abcdef'
  );
  await expect(page.locator('#sidebar')).toHaveCount(0);
});

test('the forms check their fields before sending anything', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.');
  await expect(page.getByLabel('Email')).toBeFocused();

  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Test');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Use at least 8 characters.');
});

test('the sign-in screen passes an accessibility scan', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
