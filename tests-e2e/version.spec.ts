import { expect, test } from '@playwright/test';

test('Backup shows a build version string with a commit hash and a date', async ({ page }) => {
  await page.goto('/#/backup');
  const version = page.getByText(/^Version /);
  await expect(version).toBeVisible();
  const text = await version.textContent();
  // e.g. "Version a1b2c3d · committed 25/09/2026, 18:08:26" (or "a1b2c3d (modified)" if the
  // tree had uncommitted changes when this build was made).
  expect(text).toMatch(/^Version (unknown|[0-9a-f]{7,}( \(modified\))?)/);
  expect(text).toMatch(/committed .+\d{4}/);
});
