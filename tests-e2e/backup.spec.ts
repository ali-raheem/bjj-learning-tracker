import { expect, test } from '@playwright/test';
import { autoAcceptDialogs, pickInMemoryFile, sampleBookJson } from './fixtures';

test.describe('backup export and restore', () => {
  test.beforeEach(({ page }) => autoAcceptDialogs(page));

  async function seed(page: import('@playwright/test').Page) {
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
    await page
      .locator('.tech-row', { hasText: 'Flower Sweep' })
      .getByRole('button', { name: /^Read/ })
      .click();
  }

  test('export downloads a JSON backup and clears the "last backup" nudge', async ({ page }) => {
    await seed(page);
    await page.goto('/#/backup');
    await expect(page.getByText('Last backup: never')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export backup' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^bjj-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const fs = await import('node:fs');
    const data = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
    expect(data.type).toBe('backup');
    expect(data.techniques.length).toBe(4);

    await expect(page.getByText('Last backup: today')).toBeVisible();
    await expect(page.getByText('Backup downloaded.')).toBeVisible();
  });

  test('replace restore wipes current data and loads the backup exactly', async ({ page }) => {
    await seed(page);
    await page.goto('/#/backup');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export backup' }).click(),
    ]);
    const fs = await import('node:fs');
    const backupJson = fs.readFileSync((await download.path())!, 'utf8');

    // Add an unrelated Book locally, then restore-replace should wipe it.
    await page.goto('/#/books');
    await page.getByRole('button', { name: '+ Add Book' }).click();
    await page.locator('form input[type=text]').first().fill('Should Be Wiped');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('Should Be Wiped')).toBeVisible();

    await page.goto('/#/backup');
    await pickInMemoryFile(
      page,
      'Choose backup file',
      'backup.json',
      backupJson,
      'application/json',
    );
    await expect(page.locator('.notice')).toContainText('4 techniques');
    await page.getByRole('button', { name: 'Replace current data' }).click();
    await expect(page.getByText('Restored (replace)')).toBeVisible();

    await page.goto('/#/books');
    await expect(page.getByText('Should Be Wiped')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /E2E Sample Book/ })).toBeVisible();

    await page.goto('/#/');
    await expect(
      page.locator('.tech-row', { hasText: 'Flower Sweep' }).getByRole('button', { name: /^Read/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('deleting all data clears every Book', async ({ page }) => {
    await seed(page);
    await page.goto('/#/backup');
    await page.getByRole('button', { name: 'Delete all data on this device' }).click();
    await page.goto('/#/books');
    await expect(page.getByText('No Books yet.')).toBeVisible();
  });
});
