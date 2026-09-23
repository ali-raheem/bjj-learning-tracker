import { expect, test } from '@playwright/test';
import { autoAcceptDialogs } from './fixtures';

test.describe('manual creation and inline progress', () => {
  test.beforeEach(({ page }) => autoAcceptDialogs(page));

  test('create a Book, Chapter and Technique, then edit progress inline', async ({ page }) => {
    await page.goto('/#/books');
    await expect(page.getByText('No Books yet.')).toBeVisible();

    await page.getByRole('button', { name: '+ Add Book' }).click();
    await page.locator('form input[type=text]').first().fill('My No-Gi Game');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('My No-Gi Game')).toBeVisible();

    await page.getByText('My No-Gi Game').click();
    await page.getByLabel('New chapter name').fill('Butterfly Guard');
    await page.getByRole('button', { name: '+ Chapter' }).click();
    await expect(page.getByText('Butterfly Guard', { exact: true })).toBeVisible();

    const newTechInput = page.getByLabel('New technique name in Butterfly Guard');
    await newTechInput.fill('Shoulder Crunch Sweep');
    await newTechInput.press('Enter');
    await expect(page.getByRole('link', { name: 'Shoulder Crunch Sweep' })).toBeVisible();

    await page.goto('/#/');
    const row = page.locator('.tech-row', { hasText: 'Shoulder Crunch Sweep' });
    await expect(row).toBeVisible();

    // Toggle Read, Drilled and two sparring markers; each is inline, no separate save step.
    await row.getByRole('button', { name: /^Read/ }).click();
    await row.getByRole('button', { name: /^Drilled/ }).click();
    await row.getByRole('button', { name: 'Sparred 2' }).click();

    await expect(row.getByRole('button', { name: /^Read/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(row.getByRole('button', { name: /^Drilled/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(row.getByRole('button', { name: 'Sparred 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(row.getByRole('button', { name: 'Sparred 3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // Sparring caps at 3 and never goes below 0; tapping the current top marker undoes it.
    await row.getByRole('button', { name: 'Sparred 3' }).click();
    await expect(row.getByRole('button', { name: 'Sparred 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await row.getByRole('button', { name: 'Sparred 3' }).click(); // undo back to 2
    await expect(row.getByRole('button', { name: 'Sparred 3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // A single fully-progressed technique should make every chip 100% and the Works chip active.
    await row.getByRole('button', { name: 'Sparred 3' }).click();
    const works = page.locator('.presets button', { hasText: 'Works' });
    await expect(works).toContainText('100%');
    await expect(page.getByText('1 technique · 100% complete')).toBeVisible();
  });

  test('progress survives a reload (persisted, not just in-memory)', async ({ page }) => {
    await page.goto('/#/books');
    await page.getByRole('button', { name: '+ Add Book' }).click();
    await page.locator('form input[type=text]').first().fill('Reload Check');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('Reload Check').click();
    await page.getByLabel('New chapter name').fill('Ch');
    await page.getByRole('button', { name: '+ Chapter' }).click();
    const newTechInput = page.getByLabel('New technique name in Ch');
    await newTechInput.fill('Persisted Technique');
    await newTechInput.press('Enter');

    await page.goto('/#/');
    const row = page.locator('.tech-row', { hasText: 'Persisted Technique' });
    await row.getByRole('button', { name: /^Read/ }).click();

    await page.reload();
    await expect(
      page
        .locator('.tech-row', { hasText: 'Persisted Technique' })
        .getByRole('button', { name: /^Read/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
