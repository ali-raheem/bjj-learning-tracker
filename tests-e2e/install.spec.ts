import { expect, test } from '@playwright/test';

test('Install app button appears only once the browser offers an install prompt', async ({
  page,
}) => {
  await page.goto('/#/backup');
  await expect(page.getByRole('heading', { name: 'Danger zone' })).toBeVisible();
  const button = page.getByRole('button', { name: 'Install app' });
  await expect(button).toHaveCount(0);

  // Headless Chromium never fires beforeinstallprompt, so dispatch a stand-in.
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = async () => {
      (window as unknown as { prompted: boolean }).prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });

  await button.click();
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(
    true,
  );
  // A captured prompt is single-use, so the button goes away after it is used.
  await expect(button).toHaveCount(0);
});
