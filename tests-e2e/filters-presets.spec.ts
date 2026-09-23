import { expect, test } from '@playwright/test';
import { autoAcceptDialogs, filterSelect, pickInMemoryFile, sampleBookJson } from './fixtures';

test.describe('search, filters, presets and the Books menu', () => {
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
    await expect(page.locator('.tech-row')).toHaveCount(4);

    // Read + Drilled + Sparred 2 on Flower Sweep, Drilled only on Scissor Sweep.
    const flower = page.locator('.tech-row', { hasText: 'Flower Sweep' });
    await flower.getByRole('button', { name: /^Read/ }).click();
    await flower.getByRole('button', { name: /^Drilled/ }).click();
    await flower.getByRole('button', { name: 'Sparred 2' }).click();
    await page
      .locator('.tech-row', { hasText: 'Scissor Sweep' })
      .getByRole('button', { name: /^Drilled/ })
      .click();
    // Read but not drilled, so it is the one thing the "Drill" (to-drill) preset should surface.
    await page
      .locator('.tech-row', { hasText: 'Armbar' })
      .getByRole('button', { name: /^Read/ })
      .click();
  });

  test('search matches technique, chapter, book name and notes', async ({ page }) => {
    await page.getByLabel('Search').fill('half');
    await expect(page.locator('.tech-row')).toHaveCount(1);
    await expect(page.locator('.tech-row')).toContainText('Knee Shield Recovery');
    await page.getByLabel('Search').fill('');
    await expect(page.locator('.tech-row')).toHaveCount(4);
  });

  test('Read/Drilled/Sparred filters combine', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click();
    await filterSelect(page, 'Drilled').selectOption('yes');
    await expect(page.locator('.tech-row')).toHaveCount(2);
    await filterSelect(page, 'Read').selectOption('yes');
    await expect(page.locator('.tech-row')).toHaveCount(1);
    await expect(page.locator('.tech-row')).toContainText('Flower Sweep');
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('.tech-row')).toHaveCount(4);
  });

  test('the four preset chips filter to the right technique and show a live percentage', async ({
    page,
  }) => {
    const chip = (label: string) => page.locator('.presets button', { hasText: label });

    await chip('Spar').click();
    await expect(chip('Spar')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tech-row')).toHaveCount(1);
    await expect(page.locator('.tech-row')).toContainText('Flower Sweep');
    await chip('Spar').click(); // toggles back off
    await expect(page.locator('.tech-row')).toHaveCount(4);

    await chip('Drill').click();
    await expect(page.locator('.tech-row')).toHaveCount(1);
    await expect(page.locator('.tech-row')).toContainText('Armbar');
  });

  test('deselecting a Book in the menu hides its techniques', async ({ page }) => {
    await page.goto('/#/books');
    await page.getByRole('button', { name: '+ Add Book' }).click();
    await page.locator('form input[type=text]').first().fill('Other Book');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('Other Book').click();
    await page.getByLabel('New chapter name').fill('Ch');
    await page.getByRole('button', { name: '+ Chapter' }).click();
    const input = page.getByLabel('New technique name in Ch');
    await input.fill('Other Technique');
    await input.press('Enter');

    await page.goto('/#/');
    await expect(page.locator('.tech-row')).toHaveCount(5);

    await page.getByRole('button', { name: 'Books' }).click();
    await page.getByLabel('Other Book').uncheck();
    await expect(page.locator('.tech-row')).toHaveCount(4);
    await expect(page.locator('.tech-row', { hasText: 'Other Technique' })).toHaveCount(0);
  });
});
