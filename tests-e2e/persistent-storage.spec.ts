import { expect, test } from '@playwright/test';

test('requests persistent storage without throwing, and reports the result on Backup', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/#/backup');

  // The API itself works in this browser and returns a real boolean, whatever Chromium decides
  // to grant in a fresh, engagement-less profile; we only assert the call is well-formed.
  const persisted = await page.evaluate(() => navigator.storage.persisted());
  expect(typeof persisted).toBe('boolean');

  // The app's own request (fired on startup) should show up as a "Storage:" line rather than
  // being silently skipped.
  await expect(page.getByText(/^Storage: (persistent|not persistent)/)).toBeVisible();
  expect(errors).toEqual([]);
});
