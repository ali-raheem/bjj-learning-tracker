import { expect, test } from '@playwright/test';
import {
  autoAcceptDialogs,
  pickInMemoryFile,
  sampleBookJson,
  sampleBookJsonV2,
  sampleBookText,
} from './fixtures';

test.describe('Book import', () => {
  test.beforeEach(({ page }) => autoAcceptDialogs(page));

  test('imports a JSON Book file', async ({ page }) => {
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
    await expect(page.locator('.tech-row')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Closed Guard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Half Guard' })).toBeVisible();
  });

  test('imports the plain-text Book format, detected by content not extension', async ({
    page,
  }) => {
    await page.goto('/#/books');
    await pickInMemoryFile(page, 'Import Book file', 'sample.txt', sampleBookText());
    await expect(page.locator('.card.success')).toContainText('E2E Text Book');

    await page.goto('/#/');
    await expect(page.locator('.tech-row')).toHaveCount(3);
  });

  test('re-importing an updated file merges by id and keeps progress', async ({ page }) => {
    await page.goto('/#/books');
    await pickInMemoryFile(
      page,
      'Import Book file',
      'sample.json',
      sampleBookJson(),
      'application/json',
    );
    await expect(page.locator('.card.success')).toContainText('E2E Sample Book');

    // Record progress on the technique that will be renamed, and on the one that will be dropped.
    await page.goto('/#/');
    const flower = page.locator('.tech-row', { hasText: 'Flower Sweep' });
    await flower.getByRole('button', { name: /^Read/ }).click();
    await flower.getByRole('button', { name: /^Drilled/ }).click();
    const scissor = page.locator('.tech-row', { hasText: 'Scissor Sweep' });
    await scissor.getByRole('button', { name: /^Drilled/ }).click();

    await page.goto('/#/books');
    await pickInMemoryFile(
      page,
      'Import Book file',
      'sample-v2.json',
      sampleBookJsonV2(),
      'application/json',
    );
    await expect(page.locator('.card.success')).toContainText('Updated');
    await expect(page.locator('.card.success')).toContainText('E2E Sample Book');

    await page.goto('/#/');
    // Renamed technique keeps its progress under the new name.
    const renamed = page.locator('.tech-row', { hasText: 'Flower / Pendulum Sweep' });
    await expect(renamed).toBeVisible();
    await expect(renamed.getByRole('button', { name: /^Read/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(renamed.getByRole('button', { name: /^Drilled/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // New technique from the updated file is present.
    await expect(page.locator('.tech-row', { hasText: 'Triangle' })).toBeVisible();
    // Dropped technique carried progress, so it is orphaned rather than silently deleted.
    const orphaned = page.locator('.tech-row', { hasText: 'Scissor Sweep' });
    await expect(orphaned).toBeVisible();
    await expect(orphaned.getByText('orphaned')).toBeVisible();
  });

  test('rejects an invalid Book file and reports every problem', async ({ page }) => {
    await page.goto('/#/books');
    const bad = JSON.stringify({
      schemaVersion: 1,
      type: 'book',
      book: {
        externalId: 'bad',
        name: 'Bad Book',
        chapters: [
          {
            externalId: 'a',
            name: 'A',
            techniques: [
              { externalId: 'x', name: 'X' },
              { externalId: 'x', name: 'Y' },
            ],
          },
        ],
      },
    });
    await pickInMemoryFile(page, 'Import Book file', 'bad.json', bad, 'application/json');
    await expect(page.locator('.notice.danger')).toBeVisible();
    await expect(page.locator('pre.problems')).toContainText('duplicate technique id');
  });
});
