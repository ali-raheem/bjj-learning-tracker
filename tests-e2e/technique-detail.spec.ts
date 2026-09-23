import { expect, test } from '@playwright/test';
import { autoAcceptDialogs, filterSelect, pickInMemoryFile, sampleBookJson } from './fixtures';

test.describe('technique detail', () => {
  test.beforeEach(async ({ page }) => {
    autoAcceptDialogs(page);
    await page.goto('/#/books');
    await pickInMemoryFile(
      page,
      'Import Book file',
      'sample.json',
      sampleBookJson(),
      'application/json',
    );
    await expect(page.locator('.card.success')).toContainText('E2E Sample Book');
    await page.goto('/#/');
    await page.locator('.tech-row', { hasText: 'Flower Sweep' }).getByRole('link').click();
    await expect(page.getByLabel('Technique name')).toHaveValue('Flower Sweep');
  });

  test('notes and links autosave and survive a reload', async ({ page }) => {
    await page.getByLabel('Notes').fill('## Details\n\nOutside foot rotated.');
    await page.waitForTimeout(700); // notes autosave is debounced

    await page.getByLabel('New link URL').fill('https://example.com/video');
    await page.getByLabel('New link title').fill('Reference video');
    await page.getByRole('button', { name: '+ Add Link' }).click();
    await expect(page.locator('.link-row')).toHaveCount(1);

    await page.reload();
    // Notes are non-empty, so the app auto-opens in Preview rather than showing "Preview" to tap.
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.locator('.markdown')).toContainText('Outside foot rotated');
    await expect(page.locator('.link-row')).toHaveCount(1);
    await expect(page.locator('.link-row')).toContainText('Reference video');
  });

  test('archiving hides a technique from the default list and shows a notice', async ({ page }) => {
    await page.getByRole('button', { name: 'Archive Technique' }).click();
    await expect(page.getByText('This technique is archived and hidden')).toBeVisible();

    await page.goto('/#/');
    await expect(page.locator('.tech-row', { hasText: 'Flower Sweep' })).toHaveCount(0);

    // Archived filter shows it again.
    await page.getByRole('button', { name: 'Filters' }).click();
    await filterSelect(page, 'Archived').selectOption('show');
    await expect(page.locator('.tech-row', { hasText: 'Flower Sweep' })).toBeVisible();
    await expect(
      page.locator('.tech-row', { hasText: 'Flower Sweep' }).getByText('archived'),
    ).toBeVisible();
  });

  test('permanent delete removes the technique for good', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('.tech-row', { hasText: 'Flower Sweep' })).toHaveCount(0);
  });
});
